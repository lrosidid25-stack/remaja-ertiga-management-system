<?php
/**
 * SUPABASE DB — PDO-compatible wrapper for Supabase PostgreSQL
 * Digunakan di Vercel (serverless) sebagai pengganti Google Sheets
 */

class SupabaseDB {
    private string $baseUrl;
    private string $apiKey;
    private string $lastTable = '';
    private array $lastRow = [];
    private string $lastQuery = '';
    private array $lastParams = [];
    private $lastInsertId = '';

    function __construct() {
        $this->baseUrl = SUPABASE_URL . '/rest/v1';
        $this->apiKey  = SUPABASE_ANON_KEY;
    }

    function setAttribute(int $attr, mixed $val): bool { return true; }

    // ============================================================
    // QUERY — SELECT biasa
    // ============================================================
    function query(string $sql) {
        $this->lastQuery = $sql;
        $this->lastParams = [];
        return $this->_execute();
    }

    // ============================================================
    // PREPARE + EXECUTE
    // ============================================================
    function prepare(string $sql) { $this->lastQuery = $sql; return $this; }
    function execute(array $params = []) { $this->lastParams = $params; return $this->_execute(); }

    // ============================================================
    // EXEC — raw SQL (CREATE, INSERT, UPDATE, DELETE)
    // ============================================================
    function exec(string $sql): int|false {
        $this->lastQuery = $sql;
        $this->lastParams = [];
        return $this->_exec();
    }

    // ============================================================
    // FETCH METHODS
    // ============================================================
    function fetch(int $mode = 2): array|false {
        return array_shift($this->lastRow) ?: false;
    }
    function fetchAll(int $mode = 2): array {
        $rows = $this->lastRow;
        $this->lastRow = [];
        return $rows;
    }
    function fetchColumn(int $col = 0): mixed {
        $row = $this->fetch();
        if (!$row) return 0;
        $vals = array_values($row);
        return $vals[$col] ?? 0;
    }
    function lastInsertId(): string {
        return $this->lastInsertId;
    }

    // ============================================================
    // INTERNAL: Parse & execute SELECT
    // ============================================================
    private function _execute() {
        $sql = trim($this->lastQuery);
        $upper = strtoupper($sql);

        if (str_starts_with($upper, 'SELECT')) {
            return $this->_doSelect($sql);
        }
        return $this->_exec();
    }

    private function _doSelect(string $sql) {
        // Handle COUNT(*)
        if (preg_match('/SELECT\s+COUNT\s*\(\s*\*\s*\)/i', $sql)) {
            preg_match('/FROM\s+(\w+)/i', $sql, $m);
            $table = $m[1] ?? '';

            // Build Supabase count URL
            $where = '';
            $params = $this->lastParams;

            if (preg_match('/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|\s*$)/is', $sql, $wm)) {
                $where = $this->_buildWhereUrl($wm[1], $params);
            }

            $url = "{$this->baseUrl}/{$table}?select=id{$where}";
            $rows = $this->_apiGet($url);
            $count = is_array($rows) ? count($rows) : 0;
            $this->lastRow = [['count' => $count]];
            return $this;
        }

        // Parse: SELECT ... FROM table
        preg_match('/FROM\s+(\w+)/i', $sql, $m);
        $table = $m[1] ?? '';
        $this->lastTable = $table;

        // Parse SELECT columns
        $selectCols = '*';
        if (preg_match('/SELECT\s+(.*?)\s+FROM/i', $sql, $sm)) {
            $selectCols = trim($sm[1]);
        }

        // Build URL with query params
        $where = '';
        $orderBy = '';
        $limit = '';
        $params = $this->lastParams;

        if (preg_match('/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|\s*$)/is', $sql, $wm)) {
            $where = $this->_buildWhereUrl($wm[1], $params);
        }

        if (preg_match('/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i', $sql, $om)) {
            $col = strtolower($om[1]);
            $dir = strtoupper($om[2] ?? 'ASC') === 'DESC' ? '.desc' : '.asc';
            $orderBy = "&order={$col}{$dir}";
        }

        if (preg_match('/LIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i', $sql, $lm)) {
            $o = isset($lm[2]) ? (int)$lm[1] : 0;
            $l = isset($lm[2]) ? (int)$lm[2] : (int)$lm[1];
            $limit = "&limit={$l}&offset={$o}";
        }

        $sel = $selectCols !== '*' ? '&select=' . urlencode(str_replace(' ', '', $selectCols)) : '';
        $url = "{$this->baseUrl}/{$table}?select=*{$sel}{$where}{$orderBy}{$limit}";

        $data = $this->_apiGet($url);

        if (!is_array($data)) { $this->lastRow = []; return $this; }
        $this->lastRow = $data;
        return $this;
    }

    // ============================================================
    // INTERNAL: Execute INSERT/UPDATE/DELETE/CREATE
    // ============================================================
    private function _exec(): int|false {
        $sql = trim($this->lastQuery);
        $upper = strtoupper($sql);

        if (str_starts_with($upper, 'INSERT')) {
            return $this->_doInsert($sql);
        }
        if (str_starts_with($upper, 'UPDATE')) {
            return $this->_doUpdate($sql);
        }
        if (str_starts_with($upper, 'CREATE') || str_starts_with($upper, 'PRAGMA')) {
            return 0; // No-op — tables already exist via Supabase
        }

        return 0;
    }

    private function _doInsert(string $sql): int {
        preg_match('/INSERT\s+INTO\s+(\w+)/i', $sql, $tm);
        $table = $tm[1] ?? '';

        $values = $this->lastParams;
        if (!empty($values) && is_array($values[0]) && !is_array($values[0] ?? null)) {
            // single row values
        }

        // Flatten if nested (first param is array of values)
        if (!empty($values) && is_array($values[0] ?? null)) {
            $values = $values[0];
        }

        // Parse column names from INSERT INTO table (col1, col2, col3)
        $cols = [];
        if (preg_match('/\((.+?)\)\s*VALUES/i', $sql, $cm)) {
            $cols = array_map('trim', explode(',', $cm[1]));
        }

        // Build JSON body
        $body = [];
        foreach ($cols as $i => $col) {
            $body[$col] = $values[$i] ?? '';
        }

        $url = "{$this->baseUrl}/{$table}";
        $res = $this->_apiPost($url, $body);

        if (is_array($res) && !empty($res)) {
            $this->lastInsertId = (string)($res[0]['id'] ?? '');
            $this->lastRow = $res;
            return 1;
        }
        return 0;
    }

    private function _doUpdate(string $sql): int {
        preg_match('/UPDATE\s+(\w+)\s+SET/i', $sql, $tm);
        $table = $tm[1] ?? '';

        // Parse SET cols
        preg_match('/SET\s+(.+?)(?:\s+WHERE|$)/is', $sql, $sm);
        $setStr = $sm[1] ?? '';
        preg_match_all('/(\w+)\s*=\s*\?/i', $setStr, $sets);
        $setCols = $sets[1];

        $setVals = $this->lastParams;
        $whereVal = array_pop($setVals) ?? '';
        $setVals = array_slice($setVals, 0, count($setCols));

        // Build JSON body
        $body = [];
        foreach ($setCols as $i => $col) {
            $body[$col] = $setVals[$i] ?? '';
        }

        // Build WHERE: id=eq.{value}
        $whereCol = 'id';
        $url = "{$this->baseUrl}/{$table}?{$whereCol}=eq." . urlencode($whereVal);

        $this->_apiPatch($url, $body);
        return 1;
    }

    // ============================================================
    // SUPABASE REST API — HTTP Methods
    // ============================================================
    private function _apiGet(string $url): ?array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "apikey: {$this->apiKey}",
                "Authorization: Bearer {$this->apiKey}",
                "Content-Type: application/json",
            ],
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 200 && $code < 300) {
            return json_decode($res, true) ?: [];
        }
        return [];
    }

    private function _apiPost(string $url, array $body): ?array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => json_encode($body),
            CURLOPT_HTTPHEADER => [
                "apikey: {$this->apiKey}",
                "Authorization: Bearer {$this->apiKey}",
                "Content-Type: application/json",
                "Prefer: return=representation",
            ],
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 200 && $code < 300) {
            return json_decode($res, true) ?: [];
        }
        return null;
    }

    private function _apiPatch(string $url, array $body): void {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'PATCH',
            CURLOPT_POSTFIELDS => json_encode($body),
            CURLOPT_HTTPHEADER => [
                "apikey: {$this->apiKey}",
                "Authorization: Bearer {$this->apiKey}",
                "Content-Type: application/json",
                "Prefer: return=minimal",
            ],
            CURLOPT_TIMEOUT => 15,
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    // ============================================================
    // BUILD WHERE clause for Supabase URL query
    // ============================================================
    private function _buildWhereUrl(string $where, array &$params): string {
        $pi = 0;

        // Handle simple: col = ?
        $where = preg_replace_callback('/(\w+)\s*=\s*\?/', function($m) use (&$params, &$pi) {
            $col = $m[1];
            $val = $params[$pi++] ?? '';
            return "{$col}=eq." . urlencode($val);
        }, $where);

        // Handle: col IN (...)
        // Supabase uses: col=in.(val1,val2,val3)
        $where = preg_replace_callback(
            '/(\w+)\s+IN\s*\(\s*(.+?)\s*\)/i',
            function($m) use (&$params, &$pi) {
                $col = $m[1];
                $vals = [];
                // Replace ? placeholders in IN clause
                $inner = preg_replace_callback('/\?/', function() use (&$params, &$pi) {
                    return '___PH___' . ($pi++) . '___';
                }, $m[2]);

                // Extract values from params
                $inner = preg_replace_callback('/___PH___(\d+)___/', function($pm) use (&$params) {
                    $idx = (int)$pm[1];
                    $val = $params[$idx] ?? '';
                    return $val;
                }, $inner);

                $innerVals = array_map('trim', explode(',', $inner));
                return "{$col}=in.(" . implode(',', $innerVals) . ")";
            },
            $where
        );

        // Handle IS NULL / IS NOT NULL
        $where = preg_replace('/(\w+)\s+IS\s+NULL/i', '$1=is.null', $where);
        $where = preg_replace('/(\w+)\s+IS\s+NOT\s+NULL/i', '$1=not.is.null', $where);

        return '&' . trim($where, '& ');
    }
}
