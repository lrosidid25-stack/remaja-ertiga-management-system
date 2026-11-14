<?php
/**
 * ============================================================
 * SupabaseRpcDatabase — lapisan database untuk Vercel
 * ============================================================
 *
 * Di Vercel (serverless) aplikasi tidak bisa membuka koneksi TCP ke
 * PostgreSQL, sehingga SQL dikirim lewat PostgREST ke fungsi PostgreSQL
 * `public.re_query_batch(qs jsonb)` yang menjalankannya apa adanya dan
 * mengembalikan hasilnya sebagai JSON.
 *
 * ## Kenapa "batch"?
 * Satu halaman butuh 9–19 query. Kalau tiap query satu HTTP request,
 * latensi menumpuk (Vercel iad1 → Supabase ap-southeast-1 ≈ 250 ms per
 * request). Karena PHP membuat seluruh halaman sampai output pertama
 * dikirim, query-query tersebut bisa dikumpulkan dulu lalu dikirim
 * SEKALI dalam satu request. Hasilnya sama persis, tapi latensinya
 * jadi satu kali perjalanan pulang-pergi, bukan belasan.
 *
 * Alurnya:
 *   1. Halaman memanggil $db->query()/prepare() seperti biasa.
 *   2. Selama output buffering aktif (sebelum byte pertama dikirim),
 *      query ditunda dan dicatat.
 *   3. Saat hasilnya benar-benar dibutuhkan (fetch, fetchAll, rowCount) ATAU
 *      buffer akan dikirim (register_shutdown_function), antrean
 *      dieksekusi dalam satu request batch.
 *
 * API meniru PDO:
 *   $db->prepare($sql)->execute($params)  → SupabaseRpcStatement
 *   $stmt->fetch()/fetchAll()/fetchColumn()/rowCount()
 *   $db->query($sql), $db->exec($sql), $db->lastInsertId()
 *   $db->beginTransaction()/commit()/rollBack()
 */

class SupabaseDbError extends RuntimeException {}

class SupabaseRpcStatement
{
    private array $rows = [];
    private int $affected = 0;

    public function __construct(
        private SupabaseRpcDatabase $db,
        private string $sql,
        private array $params = [],
        private ?int $pendingId = null
    ) {}

    /** Antrekan / jalankan query lalu simpan hasilnya. */
    public function execute(array $params = []): bool
    {
        if ($params) $this->params = array_values($params);

        if ($this->db->canDefer() && $this->pendingId === null && $this->db->isReadOnly($this->sql)) {
            // Baca: boleh ditunda sampai hasilnya diperlukan
            $this->pendingId = $this->db->enqueue($this->sql, $this->params);
            return true;
        }

        [$rows, $affected, $insertId] = $this->db->runSql($this->sql, $this->params);
        $this->rows = $rows;
        $this->affected = $affected;
        if ($insertId !== null) $this->db->rememberInsertId($insertId);
        return true;
    }

    /** Ambil hasil (kalau masih ditunda, flush batch dulu). */
    private function resolve(): void
    {
        if ($this->pendingId === null) return;

        $id = $this->pendingId;
        $this->pendingId = null;

        [$rows, $affected] = $this->db->fetchPending($id);
        $this->rows = $rows;
        $this->affected = $affected;
    }

    public function fetch(): array|false
    {
        $this->resolve();
        if (!$this->rows) return false;
        $row = array_shift($this->rows);
        return is_array($row) ? $row : false;
    }

    public function fetchAll(): array
    {
        $this->resolve();
        $rows = $this->rows;
        $this->rows = [];
        return $rows;
    }

    public function fetchColumn(int $col = 0): mixed
    {
        $row = $this->fetch();
        if ($row === false) return 0;
        $vals = array_values($row);
        return $vals[$col] ?? 0;
    }

    public function rowCount(): int
    {
        $this->resolve();
        return $this->affected;
    }
}

class SupabaseRpcDatabase
{
    private string $insertId = '';
    private bool $inTx = false;

    /** @var array<int, array{sql:string}> query yang menunggu dieksekusi */
    private array $queue = [];
    /** @var array<int, array{rows:array, affected:int}> hasil per id */
    private array $results = [];
    private int $nextId = 0;

    // ============================================================
    // API kompatibel PDO
    // ============================================================
    public function setAttribute(int $attr, mixed $value): bool { return true; }

    public function prepare(string $sql): SupabaseRpcStatement
    {
        return new SupabaseRpcStatement($this, trim($sql));
    }

    public function query(string $sql): SupabaseRpcStatement
    {
        // PDO::query() langsung mengeksekusi; di sini hasilnya boleh ditunda.
        $stmt = new SupabaseRpcStatement($this, trim($sql), []);
        $stmt->execute();
        return $stmt;
    }

    public function exec(string $sql): int|false
    {
        $sql = trim($sql);
        // DDL tidak perlu dijalankan: skema sudah ada di Supabase.
        if (preg_match('/^\s*(CREATE|ALTER|DROP|PRAGMA|COMMENT|VACUUM)\b/i', $sql)) return 0;

        [$rows, $affected] = $this->runSql($sql, []);
        return $affected ?: 0;
    }

    public function lastInsertId(?string $name = null): string { return $this->insertId; }

    public function rememberInsertId(string $id): void { $this->insertId = $id; }

    // Catatan: PostgREST tidak mendukung transaksi lintas request. Penanda ini
    // menjaga alur kode (begin/commit/rollBack) tetap berjalan.
    public function beginTransaction(): bool { $this->inTx = true; return true; }
    public function commit(): bool { $this->inTx = false; return true; }
    public function rollBack(): bool { $this->inTx = false; return true; }
    public function inTransaction(): bool { return $this->inTx; }

    // ============================================================
    // ANTREAN (batching)
    // ============================================================
    /**
     * Query baca boleh ditunda selama output belum dikirim ke browser.
     * Ini yang membuat 19 query dashboard menjadi 1 request jaringan.
     */
    public function canDefer(): bool
    {
        if (getenv('RE_NO_BATCH')) return false;
        // Kalau header sudah terkirim, output sudah jalan → jangan ditunda
        return !headers_sent();
    }

    public function isReadOnly(string $sql): bool
    {
        return (bool)preg_match('/^\s*(SELECT|WITH)\b/i', $sql);
    }

    public function enqueue(string $sql, array $params): int
    {
        $translated = $this->prepareSql($sql, $params);
        $id = $this->nextId++;
        $this->queue[$id] = ['sql' => $translated];
        $this->results[$id] = ['rows' => [], 'affected' => 0];

        // Eksekusi lebih awal jika antrean sudah cukup besar
        if (count($this->queue) >= 60) $this->flush();
        return $id;
    }

    public function fetchPending(int $id): array
    {
        $this->flush();
        $res = $this->results[$id] ?? ['rows' => [], 'affected' => 0];
        unset($this->results[$id]);
        return [$res['rows'], $res['affected']];
    }

    /** Kirim semua query yang menunggu dalam satu request HTTP. */
    public function flush(): void
    {
        if (!$this->queue) return;

        $batch = $this->queue;
        $this->queue = [];

        $payload = array_map(fn($item) => $item['sql'], array_values($batch));
        $responses = $this->rpcBatch($payload);

        $i = 0;
        foreach (array_keys($batch) as $id) {
            $rows = $responses[$i] ?? [];
            $this->results[$id] = [
                'rows' => is_array($rows) ? $rows : [],
                'affected' => is_array($rows) ? count($rows) : 0,
            ];
            $i++;
        }
    }

    // ============================================================
    // EKSEKUSI
    // ============================================================
    /**
     * @return array{0: array, 1: int, 2: ?string} [rows, affected, insertId]
     */
    public function runSql(string $sql, array $params = []): array
    {
        // Tulis harus melihat data terbaru → flush antrean baca dulu
        $this->flush();

        $sql = $this->prepareSql($sql, $params);
        if ($sql === '') return [[], 0, null];

        $verb = strtoupper(strtok(ltrim($sql), " \t\n\r("));
        $rows = $this->rpcBatch([$sql])[0] ?? [];

        if (in_array($verb, ['INSERT', 'UPDATE', 'DELETE'], true)) {
            $insertId = null;
            if ($verb === 'INSERT' && !empty($rows[0]['id'])) {
                $insertId = (string)$rows[0]['id'];
            } elseif ($verb === 'INSERT' && isset($rows[0]['kunci'])) {
                $insertId = (string)$rows[0]['kunci'];
            }
            return [$rows, max(1, count($rows)), $insertId];
        }

        return [$rows, count($rows), null];
    }

    /** Normalisasi SQL: rapikan spasi, beri prefix tabel, isi parameter. */
    public function prepareSql(string $sql, array $params): string
    {
        $sql = preg_replace('/\s+/', ' ', trim($sql));
        if ($sql === '') return '';
        $sql = $this->prefixTables($sql);
        return $this->replacePlaceholders($sql, array_values($params));
    }

    /**
     * Tambahkan prefix tabel (mis. "anggota" → "re_anggota") pada nama tabel
     * yang belum ber-prefix. Nama kolom tidak tersentuh.
     */
    public function prefixTables(string $sql): string
    {
        $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
        if ($prefix === '') return $sql;

        return preg_replace_callback(
            '/\b(FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i',
            function (array $m) use ($prefix) {
                $table = $m[2];
                if (stripos($table, $prefix) === 0) return $m[0];
                return $m[1] . ' ' . $prefix . $table;
            },
            $sql
        );
    }

    /**
     * Ganti placeholder '?' dengan literal PostgreSQL yang sudah di-escape.
     * Placeholder di dalam string literal diabaikan.
     */
    public function replacePlaceholders(string $sql, array $params): string
    {
        if (!$params) return $sql;

        $out = '';
        $inStr = false;
        $pi = 0;
        $len = strlen($sql);

        for ($i = 0; $i < $len; $i++) {
            $ch = $sql[$i];

            if ($ch === "'") {
                if ($inStr && $i + 1 < $len && $sql[$i + 1] === "'") {
                    $out .= "''";
                    $i++;
                    continue;
                }
                $inStr = !$inStr;
                $out .= $ch;
                continue;
            }

            if ($ch === '?' && !$inStr) {
                $out .= $this->literal($params[$pi] ?? null);
                $pi++;
                continue;
            }

            $out .= $ch;
        }

        return $out;
    }

    /** Ubah nilai PHP menjadi literal SQL yang aman. */
    private function literal(mixed $val): string
    {
        if ($val === null) return 'NULL';
        if (is_bool($val)) return $val ? 'TRUE' : 'FALSE';
        if (is_int($val) || is_float($val)) return (string)$val;
        return "'" . str_replace(["'", "\0"], ["''", ''], (string)$val) . "'";
    }

    /** Kirim satu atau banyak SQL sekaligus ke Supabase. */
    private function rpcBatch(array $queries): array
    {
        $key = (defined('SUPABASE_SERVICE_KEY') && SUPABASE_SERVICE_KEY !== '')
            ? SUPABASE_SERVICE_KEY
            : SUPABASE_ANON_KEY;

        $headers = [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        // Satu query → RPC biasa; banyak query → RPC batch
        if (count($queries) === 1) {
            $url = rtrim(SUPABASE_URL, '/') . '/rest/v1/rpc/re_query';
            $payload = json_encode(['q' => $queries[0]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            $url = rtrim(SUPABASE_URL, '/') . '/rest/v1/rpc/re_query_batch';
            $payload = json_encode(['qs' => array_values($queries)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 25,
            CURLOPT_CONNECTTIMEOUT => 8,
            // Koneksi dipertahankan untuk request berikutnya dalam satu invocation
            CURLOPT_TCP_KEEPALIVE  => 1,
        ]);

        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        unset($ch);

        if ($raw === false || $err !== '') {
            throw new SupabaseDbError('Koneksi ke Supabase gagal: ' . $err);
        }

        $decoded = json_decode((string)$raw, true);

        if ($code >= 400) {
            $msg = is_array($decoded) ? ($decoded['message'] ?? $decoded['hint'] ?? '') : '';
            throw new SupabaseDbError('Supabase error ' . $code . ': ' . ($msg ?: substr((string)$raw, 0, 200)));
        }

        if (is_string($decoded)) $decoded = json_decode($decoded, true);
        if (!is_array($decoded)) return [];

        // RPC batch mengembalikan array hasil per query
        if (count($queries) > 1) {
            return array_map(fn($r) => is_array($r) ? $r : [], $decoded);
        }

        return [$decoded];
    }
}
