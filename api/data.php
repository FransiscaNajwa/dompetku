<?php
// =============================================
// data.php — Semua CRUD data keuangan
// =============================================

require_once 'config.php';
setCORS();

$auth   = requireAuth();
$userId = $auth['user_id'];
$action = $_GET['action'] ?? '';
$db     = getDB();
$body   = getBody();

// ============================================================
// LOAD ALL — ambil semua data sekaligus saat login
// ============================================================
if ($action === 'load_all') {
    $data = [];

    // Categories
    $stmt = $db->prepare('SELECT id, emoji, name, sort_order FROM categories WHERE user_id = ? ORDER BY sort_order');
    $stmt->execute([$userId]);
    $data['categories'] = $stmt->fetchAll();

    // Semesters
    $stmt = $db->prepare('SELECT id, name, start_month, end_month FROM semesters WHERE user_id = ? ORDER BY start_month');
    $stmt->execute([$userId]);
    $data['semesters'] = $stmt->fetchAll();

    // Platforms
    $stmt = $db->prepare('SELECT id, name FROM saving_platforms WHERE user_id = ? ORDER BY sort_order');
    $stmt->execute([$userId]);
    $data['platforms'] = array_column($stmt->fetchAll(), 'name');
    $data['platform_ids'] = $stmt->fetchAll() ?: [];
    // refetch
    $stmt->execute([$userId]);
    $platformRows = $stmt->fetchAll();
    $data['platforms']    = array_column($platformRows, 'name');
    $data['platform_map'] = array_column($platformRows, 'id', 'name');

    // Portfolios
    $stmt = $db->prepare('SELECT id, name FROM portfolios WHERE user_id = ? ORDER BY sort_order');
    $stmt->execute([$userId]);
    $portRows = $stmt->fetchAll();
    $data['portfolios']    = array_column($portRows, 'name');
    $data['portfolio_map'] = array_column($portRows, 'id', 'name');

    // Income
    $stmt = $db->prepare('SELECT id, name, amount, trans_date, note, month_key FROM income WHERE user_id = ? ORDER BY trans_date DESC');
    $stmt->execute([$userId]);
    $incomeRows = $stmt->fetchAll();
    $data['income'] = [];
    foreach ($incomeRows as $r) {
        if (!isset($data['income'][$r['month_key']])) $data['income'][$r['month_key']] = [];
        $data['income'][$r['month_key']][] = ['id' => $r['id'], 'name' => $r['name'], 'amount' => (float)$r['amount'], 'date' => $r['trans_date'], 'note' => $r['note']];
    }

    // Expenses
    $stmt = $db->prepare('SELECT e.category_id, e.month_key, e.period, e.amount FROM expenses e WHERE e.user_id = ?');
    $stmt->execute([$userId]);
    $expRows = $stmt->fetchAll();
    $data['expenses'] = [];
    foreach ($expRows as $r) {
        $mk  = $r['month_key'];
        $cid = $r['category_id'];
        $p   = 'p'.$r['period'];
        if (!isset($data['expenses'][$mk])) $data['expenses'][$mk] = [];
        if (!isset($data['expenses'][$mk][$cid])) $data['expenses'][$mk][$cid] = [];
        $data['expenses'][$mk][$cid][$p] = (float)$r['amount'];
    }

    // Budget
    $stmt = $db->prepare('SELECT category_id, month_key, amount FROM budget WHERE user_id = ?');
    $stmt->execute([$userId]);
    $budRows = $stmt->fetchAll();
    $data['budget'] = [];
    foreach ($budRows as $r) {
        if (!isset($data['budget'][$r['month_key']])) $data['budget'][$r['month_key']] = [];
        $data['budget'][$r['month_key']][$r['category_id']] = (float)$r['amount'];
    }

    // Savings
    $stmt = $db->prepare('SELECT sp.name as platform, s.month_key, s.amount FROM savings s JOIN saving_platforms sp ON sp.id = s.platform_id WHERE s.user_id = ?');
    $stmt->execute([$userId]);
    $savRows = $stmt->fetchAll();
    $data['savings'] = [];
    foreach ($savRows as $r) {
        if (!isset($data['savings'][$r['month_key']])) $data['savings'][$r['month_key']] = [];
        $data['savings'][$r['month_key']][$r['platform']] = (float)$r['amount'];
    }

    // Investments
    $stmt = $db->prepare('SELECT p.name as portfolio, i.month_key, i.amount FROM investments i JOIN portfolios p ON p.id = i.portfolio_id WHERE i.user_id = ?');
    $stmt->execute([$userId]);
    $invRows = $stmt->fetchAll();
    $data['investments'] = [];
    foreach ($invRows as $r) {
        if (!isset($data['investments'][$r['month_key']])) $data['investments'][$r['month_key']] = [];
        $data['investments'][$r['month_key']][$r['portfolio']] = (float)$r['amount'];
    }

    respond(['success' => true, 'data' => $data]);
}

// ============================================================
// INCOME
// ============================================================
if ($action === 'add_income') {
    $name     = trim($body['name']   ?? '');
    $amount   = (float)($body['amount'] ?? 0);
    $date     = $body['date']  ?? '';
    $note     = trim($body['note']   ?? '');
    $monthKey = $body['month_key'] ?? '';

    if (!$name || !$amount || !$date || !$monthKey) respondError('Field tidak lengkap.');
    $stmt = $db->prepare('INSERT INTO income (user_id, name, amount, trans_date, note, month_key) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $name, $amount, $date, $note, $monthKey]);
    respond(['success' => true, 'id' => $db->lastInsertId()]);
}

if ($action === 'delete_income') {
    $id = (int)($body['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM income WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    respond(['success' => true]);
}

// ============================================================
// EXPENSE (upsert per category per period per month)
// ============================================================
if ($action === 'save_expense') {
    $catId    = (int)($body['category_id'] ?? 0);
    $monthKey = $body['month_key'] ?? '';
    $period   = (int)($body['period']    ?? 0);
    $amount   = (float)($body['amount']  ?? 0);

    if (!$catId || !$monthKey || !$period) respondError('Field tidak lengkap.');
    $stmt = $db->prepare('INSERT INTO expenses (user_id, category_id, month_key, period, amount)
                          VALUES (?, ?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE amount = VALUES(amount)');
    $stmt->execute([$userId, $catId, $monthKey, $period, $amount]);
    respond(['success' => true]);
}

// ============================================================
// BUDGET (upsert per category per month)
// ============================================================
if ($action === 'save_budget') {
    $budgets  = $body['budgets']   ?? []; // [{category_id, amount}, ...]
    $monthKey = $body['month_key'] ?? '';
    if (!$monthKey || !is_array($budgets)) respondError('Data tidak valid.');
    $stmt = $db->prepare('INSERT INTO budget (user_id, category_id, month_key, amount)
                          VALUES (?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE amount = VALUES(amount)');
    foreach ($budgets as $b) $stmt->execute([$userId, (int)$b['category_id'], $monthKey, (float)$b['amount']]);
    respond(['success' => true]);
}

// ============================================================
// SAVING (upsert per platform per month)
// ============================================================
if ($action === 'save_saving') {
    $savings  = $body['savings']   ?? []; // [{platform_id, amount}, ...]
    $monthKey = $body['month_key'] ?? '';
    if (!$monthKey) respondError('Month key wajib diisi.');
    $stmt = $db->prepare('INSERT INTO savings (user_id, platform_id, month_key, amount)
                          VALUES (?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE amount = VALUES(amount)');
    foreach ($savings as $s) $stmt->execute([$userId, (int)$s['platform_id'], $monthKey, (float)$s['amount']]);
    respond(['success' => true]);
}

// ============================================================
// INVESTMENT (upsert per portfolio per month)
// ============================================================
if ($action === 'save_investment') {
    $investments = $body['investments'] ?? []; // [{portfolio_id, amount}, ...]
    $monthKey    = $body['month_key']   ?? '';
    if (!$monthKey) respondError('Month key wajib diisi.');
    $stmt = $db->prepare('INSERT INTO investments (user_id, portfolio_id, month_key, amount)
                          VALUES (?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE amount = VALUES(amount)');
    foreach ($investments as $inv) $stmt->execute([$userId, (int)$inv['portfolio_id'], $monthKey, (float)$inv['amount']]);
    respond(['success' => true]);
}

// ============================================================
// CATEGORIES
// ============================================================
if ($action === 'add_category') {
    $emoji = $body['emoji'] ?? '🏷️';
    $name  = trim($body['name'] ?? '');
    if (!$name) respondError('Nama kategori wajib diisi.');
    $stmt = $db->prepare('SELECT MAX(sort_order) as max_order FROM categories WHERE user_id = ?');
    $stmt->execute([$userId]); $row = $stmt->fetch();
    $order = ($row['max_order'] ?? 0) + 1;
    $stmt = $db->prepare('INSERT INTO categories (user_id, emoji, name, sort_order) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $emoji, $name, $order]);
    respond(['success' => true, 'id' => $db->lastInsertId()]);
}

if ($action === 'delete_category') {
    $id = (int)($body['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM categories WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    respond(['success' => true]);
}

// ============================================================
// SEMESTERS
// ============================================================
if ($action === 'add_semester') {
    $name  = trim($body['name']  ?? '');
    $start = $body['start'] ?? '';
    $end   = $body['end']   ?? '';
    if (!$name || !$start || !$end) respondError('Semua field semester wajib diisi.');
    if ($start > $end) respondError('Bulan mulai harus sebelum bulan selesai.');
    $stmt = $db->prepare('INSERT INTO semesters (user_id, name, start_month, end_month) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $name, $start, $end]);
    respond(['success' => true, 'id' => $db->lastInsertId()]);
}

if ($action === 'delete_semester') {
    $id   = (int)($body['id'] ?? 0);
    $stmt = $db->prepare('SELECT COUNT(*) as cnt FROM semesters WHERE user_id = ?');
    $stmt->execute([$userId]); $row = $stmt->fetch();
    if ($row['cnt'] <= 1) respondError('Minimal 1 semester harus ada.');
    $stmt = $db->prepare('DELETE FROM semesters WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $userId]);
    respond(['success' => true]);
}

// ============================================================
// SAVING PLATFORMS
// ============================================================
if ($action === 'add_platform') {
    $name = trim($body['name'] ?? '');
    if (!$name) respondError('Nama platform wajib diisi.');
    $stmt = $db->prepare('SELECT id FROM saving_platforms WHERE user_id = ? AND name = ?');
    $stmt->execute([$userId, $name]);
    if ($stmt->fetch()) respondError('Platform sudah ada.');
    $stmt = $db->prepare('SELECT MAX(sort_order) as m FROM saving_platforms WHERE user_id = ?');
    $stmt->execute([$userId]); $row = $stmt->fetch();
    $stmt = $db->prepare('INSERT INTO saving_platforms (user_id, name, sort_order) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $name, ($row['m'] ?? 0) + 1]);
    respond(['success' => true, 'id' => $db->lastInsertId()]);
}

if ($action === 'delete_platform') {
    $name = trim($body['name'] ?? '');
    $stmt = $db->prepare('DELETE FROM saving_platforms WHERE user_id = ? AND name = ?');
    $stmt->execute([$userId, $name]);
    respond(['success' => true]);
}

// ============================================================
// PORTFOLIOS
// ============================================================
if ($action === 'add_portfolio') {
    $name = trim($body['name'] ?? '');
    if (!$name) respondError('Nama portofolio wajib diisi.');
    $stmt = $db->prepare('SELECT id FROM portfolios WHERE user_id = ? AND name = ?');
    $stmt->execute([$userId, $name]);
    if ($stmt->fetch()) respondError('Portofolio sudah ada.');
    $stmt = $db->prepare('SELECT MAX(sort_order) as m FROM portfolios WHERE user_id = ?');
    $stmt->execute([$userId]); $row = $stmt->fetch();
    $stmt = $db->prepare('INSERT INTO portfolios (user_id, name, sort_order) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $name, ($row['m'] ?? 0) + 1]);
    respond(['success' => true, 'id' => $db->lastInsertId()]);
}

if ($action === 'delete_portfolio') {
    $name = trim($body['name'] ?? '');
    $stmt = $db->prepare('DELETE FROM portfolios WHERE user_id = ? AND name = ?');
    $stmt->execute([$userId, $name]);
    respond(['success' => true]);
}

// ============================================================
// DELETE ALL DATA
// ============================================================
if ($action === 'clear_data') {
    $tables = ['income', 'expenses', 'budget', 'savings', 'investments'];
    foreach ($tables as $t) {
        $stmt = $db->prepare("DELETE FROM $t WHERE user_id = ?");
        $stmt->execute([$userId]);
    }
    respond(['success' => true]);
}

if ($action === 'delete_account') {
    $stmt = $db->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    respond(['success' => true]);
}

respondError('Action tidak dikenal.', 404);