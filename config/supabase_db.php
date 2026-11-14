<?php
/**
 * ============================================================
 * SupabaseRpcDatabase — lapisan database untuk Vercel
 * ============================================================
 *
 * Di Vercel (serverless) aplikasi tidak bisa membuka koneksi TCP ke
 * PostgreSQL, sehingga semua SQL dikirim lewat PostgREST ke fungsi
 * PostgreSQL `public.re_query(q text)` yang menjalankannya apa adanya
 * dan mengembalikan hasilnya sebagai JSON.
 *
 * Dengan pendekatan ini JOIN, subquery, agregat, CASE, BETWEEN dan
 * ON CONFLICT tetap berjalan persis seperti di SQLite lokal — tidak ada
 * emulasi SQL di PHP. Parameter di-inline sebagai literal PostgreSQL
 * yang sudah di-escape dengan benar.
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
        ?array $prefetched = null
    ) {
        if ($prefetched !== null) {
            $this->rows = $prefetched;
            $this->affected = count($prefetched);
        }
    }

    public function execute(array $params = []): bool
    {
        if ($params) $this->params = array_values($params);
        [$rows, $affected, $insertId] = $this->db->runSql($this->sql, $this->params);
        $this->rows = $rows;
        $this->affected = $affected;
        if ($insertId !== null) $this->db->rememberInsertId($insertId);
        return true;
    }

    public function fetch(): array|false
    {
        if (!$this->rows) return false;
        $row = array_shift($this->rows);
        return is_array($row) ? $row : false;
    }

    public function fetchAll(): array
    {
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

    public function rowCount(): int { return $this->affected; }
}

class SupabaseRpcDatabase
{
    private string $insertId = '';
    private bool $inTx = false;

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
        return new SupabaseRpcStatement($this, trim($sql), []);
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
    // EKSEKUSI
    // ============================================================
    /**
     * @return array{0: array, 1: int, 2: ?string} [rows, affected, insertId]
     */
    public function runSql(string $sql, array $params = []): array
    {
        $sql = preg_replace('/\s+/', ' ', $sql);
        if ($sql === '') return [[], 0, null];

        $sql = $this->prefixTables($sql);
        $sql = $this->replacePlaceholders($sql, array_values($params));

        $verb = strtoupper(strtok(ltrim($sql), " \t\n\r("));
        $rows = $this->rpc($sql);

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

    /** Kirim SQL ke Supabase lewat PostgREST RPC re_query. */
    private function rpc(string $sql): array
    {
        $url = rtrim(SUPABASE_URL, '/') . '/rest/v1/rpc/re_query';
        $key = (defined('SUPABASE_SERVICE_KEY') && SUPABASE_SERVICE_KEY !== '')
            ? SUPABASE_SERVICE_KEY
            : SUPABASE_ANON_KEY;

        $payload = json_encode(['q' => $sql], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'apikey: ' . $key,
                'Authorization: Bearer ' . $key,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
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
        return is_array($decoded) ? $decoded : [];
    }
}
