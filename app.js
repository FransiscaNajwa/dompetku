/* ===========================
   DOMPETKU — app.js
   =========================== */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const STORE_KEY = 'dompetku_data';

const DEFAULT_CATEGORIES = [
  { id: 'cat1',  emoji: '💼', name: 'Gaji',          type: 'income'  },
  { id: 'cat2',  emoji: '💹', name: 'Investasi',     type: 'income'  },
  { id: 'cat3',  emoji: '🎁', name: 'Bonus',         type: 'income'  },
  { id: 'cat4',  emoji: '🍽️', name: 'Makan & Minum', type: 'expense' },
  { id: 'cat5',  emoji: '🚗', name: 'Transportasi',  type: 'expense' },
  { id: 'cat6',  emoji: '🏠', name: 'Rumah & Sewa',  type: 'expense' },
  { id: 'cat7',  emoji: '🛍️', name: 'Belanja',       type: 'expense' },
  { id: 'cat8',  emoji: '💊', name: 'Kesehatan',     type: 'expense' },
  { id: 'cat9',  emoji: '🎮', name: 'Hiburan',       type: 'expense' },
  { id: 'cat10', emoji: '📱', name: 'Tagihan',       type: 'expense' },
];

const CHART_COLORS = [
  '#7ec8c8', '#4a86c8', '#a8d5e2', '#c8a87e',
  '#e07b7b', '#5ab08a', '#b8a0d4', '#f0c05a',
  '#82b0d4', '#d4a0b8',
];


// ============================================================
// STATE
// ============================================================

let currentUser = null;   // email string
let userData    = null;   // { name, passwordHash, transactions, categories }
let activePeriod = 'month';

// Chart instances (kept to destroy before re-render)
let chartBar  = null;
let chartPie  = null;
let chartLine = null;


// ============================================================
// STORAGE HELPERS
// ============================================================

/**
 * Read the entire app data object from localStorage.
 * @returns {Object} keyed by email
 */
function getAllData() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * Persist the entire app data object.
 * @param {Object} data
 */
function saveAllData(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

/**
 * Get (or initialise) a specific user's data object.
 * @param {string} email
 * @returns {Object}
 */
function getUserData(email) {
  const all = getAllData();
  if (!all[email]) {
    all[email] = {
      name: '',
      passwordHash: '',
      transactions: [],
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    };
    saveAllData(all);
  }
  return all[email];
}

/**
 * Persist the current user's data.
 */
function save() {
  const all = getAllData();
  all[currentUser] = userData;
  saveAllData(all);
}


// ============================================================
// SECURITY HELPERS
// ============================================================

/**
 * Very lightweight deterministic hash (not cryptographic).
 * Sufficient for local, single-device, non-sensitive usage.
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/**
 * Basic email format check.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// ============================================================
// AUTH
// ============================================================

/**
 * Toggle between Login and Register panels.
 * @param {'login'|'register'} tab
 */
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.querySelectorAll('.auth-tab').forEach((btn, i) => {
    btn.classList.toggle('active', isLogin ? i === 0 : i === 1);
  });
  document.getElementById('login-form').classList.toggle('hidden', !isLogin);
  document.getElementById('register-form').classList.toggle('hidden', isLogin);
}

/** Attempt to log in with the supplied credentials. */
function doLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const pass     = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-err');

  hideError(errEl);

  if (!username || !pass) { showError(errEl, 'Isi semua field.'); return; }

  const all = getAllData();
  if (!all[username] || all[username].passwordHash !== simpleHash(pass)) {
    showError(errEl, 'Username atau kata sandi salah.');
    return;
  }

  currentUser = username;
  userData    = all[username];
  enterApp();
}

/** Attempt to register a new account. */
function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const pass     = document.getElementById('reg-pass').value;
  const errEl    = document.getElementById('reg-err');

  hideError(errEl);

  if (!name || !username || !pass)     { showError(errEl, 'Isi semua field.'); return; }
  if (username.length < 3)             { showError(errEl, 'Username minimal 3 karakter.'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showError(errEl, 'Username hanya huruf, angka, dan underscore.'); return; }
  if (pass.length < 6)                 { showError(errEl, 'Kata sandi minimal 6 karakter.'); return; }

  const all = getAllData();
  if (all[username] && all[username].passwordHash) {
    showError(errEl, 'Username sudah digunakan.'); return;
  }

  const ud           = getUserData(username);
  ud.name            = name;
  ud.username        = username;
  ud.passwordHash    = simpleHash(pass);
  ud.joinDate        = ud.joinDate || new Date().toISOString();
  const updated      = getAllData();
  updated[username]  = ud;
  saveAllData(updated);

  currentUser = username;
  userData    = ud;
  enterApp();
}

/** Log out and return to the auth screen. */
function doLogout() {
  currentUser  = null;
  userData     = null;
  activePeriod = 'month';

  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';

  // Reset inputs
  document.getElementById('login-username').value = '';
  document.getElementById('login-pass').value     = '';
  hideError(document.getElementById('login-err'));
}

/** Transition from the auth screen into the main app. */
function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';

  const displayName = userData.name
    ? `${userData.name} (@${currentUser})`
    : `@${currentUser}`;
  document.getElementById('header-username').textContent = displayName;

  setTodayDates();
  refreshCategorySelects();
  showPage('income');
}


// ============================================================
// NAVIGATION
// ============================================================

/**
 * Display a specific page and hide the rest.
 * @param {'income'|'expense'|'summary'|'categories'} page
 */
function showPage(page) {
  const pages = ['income', 'expense', 'summary', 'categories', 'profile'];

  pages.forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle('hidden', p !== page);
  });

  document.querySelectorAll('.nav-tab').forEach((tab, i) => {
    tab.classList.toggle('active', pages[i] === page);
  });

  if (page === 'income')     renderList('income');
  if (page === 'expense')    renderList('expense');
  if (page === 'summary')    renderSummary();
  if (page === 'categories') renderCategories();
  if (page === 'profile')    renderProfile();
}


// ============================================================
// UTILITY HELPERS
// ============================================================

/** Set date inputs to today's date. */
function setTodayDates() {
  const today = new Date().toISOString().split('T')[0];
  ['inc-date', 'exp-date'].forEach(id => {
    document.getElementById(id).value = today;
  });
}

/**
 * Format a number as Indonesian Rupiah.
 * @param {number} n
 * @returns {string}
 */
function formatRupiah(n) {
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

/**
 * Shorten large Rupiah values for chart axes.
 * @param {number} v
 * @returns {string}
 */
function shortRupiah(v) {
  if (v >= 1_000_000) return 'Rp' + (v / 1_000_000).toFixed(1) + 'jt';
  if (v >= 1_000)     return 'Rp' + (v / 1_000).toFixed(0) + 'rb';
  return 'Rp' + v;
}

/** Generate a simple unique ID. */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Show a brief toast notification. */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError(el) {
  el.style.display = 'none';
}


// ============================================================
// CATEGORIES
// ============================================================

/**
 * Get categories applicable to a transaction type.
 * @param {'income'|'expense'} type
 * @returns {Array}
 */
function getCategoriesForType(type) {
  return userData.categories.filter(c => c.type === type || c.type === 'both');
}

/** Rebuild all category <select> elements from current userData. */
function refreshCategorySelects() {
  const incCats = getCategoriesForType('income');
  const expCats = getCategoriesForType('expense');

  const buildOptions = (cats, el) => {
    el.innerHTML = cats
      .map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`)
      .join('');
  };

  const buildFilterOptions = (cats, el) => {
    el.innerHTML =
      '<option value="">Semua Kategori</option>' +
      cats.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  };

  buildOptions(incCats, document.getElementById('inc-cat'));
  buildOptions(expCats, document.getElementById('exp-cat'));

  buildFilterOptions(incCats, document.getElementById('inc-filter-cat'));
  buildFilterOptions(expCats, document.getElementById('exp-filter-cat'));
}

/** Add a new custom category from the form inputs. */
function addCategory() {
  const emoji = document.getElementById('cat-emoji').value.trim() || '🏷️';
  const name  = document.getElementById('cat-name').value.trim();
  const type  = document.getElementById('cat-type').value;

  if (!name) { showToast('Nama kategori tidak boleh kosong!'); return; }

  userData.categories.push({ id: uid(), emoji, name, type });
  save();
  refreshCategorySelects();
  renderCategories();

  // Reset inputs
  document.getElementById('cat-name').value  = '';
  document.getElementById('cat-emoji').value = '';

  showToast('Kategori ditambahkan! 🎉');
}

/**
 * Remove a category by ID.
 * @param {string} id
 */
function deleteCategory(id) {
  userData.categories = userData.categories.filter(c => c.id !== id);
  save();
  refreshCategorySelects();
  renderCategories();
  showToast('Kategori dihapus.');
}

/** Render the categories grid. */
function renderCategories() {
  const grid = document.getElementById('cats-grid');

  if (!userData.categories.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏷️</div>
        <p>Belum ada kategori.</p>
      </div>`;
    return;
  }

  const typeBadge = { income: '📈', expense: '📉', both: '⇄' };

  grid.innerHTML = userData.categories.map(c => `
    <div class="cat-chip">
      <span class="cat-emoji">${c.emoji}</span>
      <span>${c.name}</span>
      <span class="cat-type-badge">${typeBadge[c.type] || ''}</span>
      <button class="btn-del-cat" onclick="deleteCategory('${c.id}')" title="Hapus">✕</button>
    </div>
  `).join('');
}


// ============================================================
// TRANSACTIONS
// ============================================================

/**
 * Add a new transaction from the relevant form.
 * @param {'income'|'expense'} type
 */
function addTransaction(type) {
  const p      = type === 'income' ? 'inc' : 'exp';
  const name   = document.getElementById(`${p}-name`).value.trim();
  const amount = parseFloat(document.getElementById(`${p}-amount`).value);
  const catId  = document.getElementById(`${p}-cat`).value;
  const date   = document.getElementById(`${p}-date`).value;
  const note   = document.getElementById(`${p}-note`).value.trim();

  if (!name || !amount || !catId || !date) {
    showToast('Lengkapi semua field wajib!');
    return;
  }
  if (amount <= 0) {
    showToast('Jumlah harus lebih dari 0!');
    return;
  }

  userData.transactions.push({ id: uid(), type, name, amount, catId, date, note });
  save();
  renderList(type);

  // Clear inputs (keep date & category as convenience)
  document.getElementById(`${p}-name`).value   = '';
  document.getElementById(`${p}-amount`).value = '';
  document.getElementById(`${p}-note`).value   = '';

  showToast(type === 'income' ? 'Pemasukan ditambahkan! 💰' : 'Pengeluaran dicatat! 📝');
}

/**
 * Delete a transaction by ID.
 * @param {string} id
 */
function deleteTransaction(id) {
  const tx = userData.transactions.find(t => t.id === id);
  userData.transactions = userData.transactions.filter(t => t.id !== id);
  save();
  if (tx) renderList(tx.type);
  showToast('Transaksi dihapus.');
}

/**
 * Render the filtered transaction list for a given type.
 * @param {'income'|'expense'} type
 */
function renderList(type) {
  const p       = type === 'income' ? 'inc' : 'exp';
  const listEl  = document.getElementById(`${type}-list`);
  const catFilter   = document.getElementById(`${p}-filter-cat`).value;
  const monthFilter = document.getElementById(`${p}-filter-month`).value;

  let txns = userData.transactions.filter(t => t.type === type);

  if (catFilter)   txns = txns.filter(t => t.catId === catFilter);
  if (monthFilter) txns = txns.filter(t => t.date.startsWith(monthFilter));

  // Sort newest first
  txns.sort((a, b) => b.date.localeCompare(a.date));

  if (!txns.length) {
    const label = type === 'income' ? 'pemasukan' : 'pengeluaran';
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${type === 'income' ? '💰' : '💸'}</div>
        <p>Belum ada ${label}.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = txns.map(t => {
    const cat     = userData.categories.find(c => c.id === t.catId) || { emoji: '🏷️', name: 'Umum' };
    const dateStr = new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const sign    = type === 'income' ? '+' : '-';
    const note    = t.note ? ` · ${t.note}` : '';

    return `
      <div class="trans-item">
        <div class="trans-left">
          <div class="trans-icon ${type}">${cat.emoji}</div>
          <div>
            <div class="trans-name">${t.name}</div>
            <div class="trans-meta">${cat.name} · ${dateStr}${note}</div>
          </div>
        </div>
        <div class="trans-right">
          <div class="trans-amount ${type}">${sign}${formatRupiah(t.amount)}</div>
          <button class="btn-del" onclick="deleteTransaction('${t.id}')" title="Hapus">🗑</button>
        </div>
      </div>`;
  }).join('');
}


// ============================================================
// SUMMARY
// ============================================================

/**
 * Change the active summary period and refresh.
 * @param {'week'|'month'|'year'|'all'} period
 */
function setPeriod(period) {
  activePeriod = period;

  const labels = { week: 'minggu', month: 'bulan', year: 'tahun', all: 'semua' };
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === labels[period]);
  });

  renderSummary();
}

/**
 * Filter transactions to the active period.
 * @returns {Array}
 */
function getFilteredTransactions() {
  const now = new Date();

  return userData.transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    switch (activePeriod) {
      case 'week': {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 7);
        return d >= cutoff;
      }
      case 'month':
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      case 'year':
        return d.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  });
}

/** Render stat cards and all three charts. */
function renderSummary() {
  const txns    = getFilteredTransactions();
  const incomes  = txns.filter(t => t.type === 'income');
  const expenses = txns.filter(t => t.type === 'expense');

  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const balance  = totalInc - totalExp;

  document.getElementById('stat-balance').textContent = (balance < 0 ? '-' : '') + formatRupiah(balance);
  document.getElementById('stat-income').textContent  = formatRupiah(totalInc);
  document.getElementById('stat-expense').textContent = formatRupiah(totalExp);

  renderBarChart();
  renderPieChart();
  renderLineChart();
}

/** Bar chart — income vs expense for the last 6 months. */
function renderBarChart() {
  const now     = new Date();
  const labels  = [];
  const incData = [];
  const expData = [];

  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    labels.push(d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }));

    const mTxns = userData.transactions.filter(t => t.date.startsWith(key));
    incData.push(mTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expData.push(mTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }

  if (chartBar) chartBar.destroy();

  chartBar = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incData,
          backgroundColor: 'rgba(90,176,138,0.75)',
          borderRadius: 8,
          borderSkipped: false,
        },
        {
          label: 'Pengeluaran',
          data: expData,
          backgroundColor: 'rgba(224,123,123,0.75)',
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { family: 'DM Sans', size: 12 }, boxWidth: 12 } },
      },
      scales: {
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { family: 'DM Sans' }, callback: shortRupiah },
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans' } },
        },
      },
    },
  });
}

/** Doughnut chart — expense breakdown by category (current period). */
function renderPieChart() {
  const expTxns = getFilteredTransactions().filter(t => t.type === 'expense');

  // Aggregate by category name
  const catMap = {};
  expTxns.forEach(t => {
    const cat = userData.categories.find(c => c.id === t.catId) || { name: 'Lainnya' };
    catMap[cat.name] = (catMap[cat.name] || 0) + t.amount;
  });

  const labels = Object.keys(catMap);
  const values = Object.values(catMap);

  if (chartPie) chartPie.destroy();
  if (!values.length) { chartPie = null; return; }

  chartPie = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 12, padding: 14 },
        },
      },
    },
  });
}

/** Line chart — daily cash flow for the last 30 days. */
function renderLineChart() {
  const now     = new Date();
  const labels  = [];
  const incLine = [];
  const expLine = [];

  for (let i = 29; i >= 0; i--) {
    const d   = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0];

    labels.push(
      i % 5 === 0
        ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
        : ''
    );

    const dayTxns = userData.transactions.filter(t => t.date === key);
    incLine.push(dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expLine.push(dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }

  if (chartLine) chartLine.destroy();

  chartLine = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incLine,
          borderColor: '#5ab08a',
          backgroundColor: 'rgba(90,176,138,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          borderWidth: 2,
        },
        {
          label: 'Pengeluaran',
          data: expLine,
          borderColor: '#e07b7b',
          backgroundColor: 'rgba(224,123,123,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { family: 'DM Sans', size: 12 }, boxWidth: 12 } },
      },
      scales: {
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { family: 'DM Sans' }, callback: shortRupiah },
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 11 } },
        },
      },
    },
  });
}


// ============================================================
// PROFILE
// ============================================================

/** Populate profile page with current user data. */
function renderProfile() {
  const name     = userData.name || '';
  const username = currentUser;

  // Avatar — first letter of name or username
  const initial = (name || username).charAt(0).toUpperCase();
  document.getElementById('profile-avatar-display').textContent    = initial;
  document.getElementById('profile-display-name').textContent      = name || '(Belum diisi)';
  document.getElementById('profile-display-username').textContent  = '@' + username;

  // Pre-fill edit fields
  document.getElementById('edit-name').value     = name;
  document.getElementById('edit-username').value = username;

  // Clear error & password fields
  const errEl = document.getElementById('profile-info-err');
  if (errEl) errEl.style.display = 'none';
  ['pass-old', 'pass-new', 'pass-confirm'].forEach(id => {
    document.getElementById(id).value = '';
  });

  // Mini stats
  document.getElementById('profile-total-txn').textContent = userData.transactions.length;
  document.getElementById('profile-total-cat').textContent = userData.categories.length;
  document.getElementById('profile-member-since').textContent =
    userData.joinDate
      ? new Date(userData.joinDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      : 'Lama';
}

/** Save name and username changes. */
function saveProfileInfo() {
  const newName     = document.getElementById('edit-name').value.trim();
  const newUsername = document.getElementById('edit-username').value.trim().toLowerCase();
  const errEl       = document.getElementById('profile-info-err');

  errEl.style.display = 'none';

  if (!newName)     { errEl.textContent = 'Nama tidak boleh kosong!'; errEl.style.display = 'block'; return; }
  if (!newUsername) { errEl.textContent = 'Username tidak boleh kosong!'; errEl.style.display = 'block'; return; }
  if (newUsername.length < 3) { errEl.textContent = 'Username minimal 3 karakter.'; errEl.style.display = 'block'; return; }
  if (!/^[a-z0-9_]+$/.test(newUsername)) { errEl.textContent = 'Username hanya boleh huruf kecil, angka, dan underscore.'; errEl.style.display = 'block'; return; }

  // Check if username already taken by another account
  if (newUsername !== currentUser) {
    const all = getAllData();
    if (all[newUsername] && all[newUsername].passwordHash) {
      errEl.textContent = 'Username sudah digunakan akun lain.';
      errEl.style.display = 'block';
      return;
    }
  }

  // Update name
  userData.name = newName;

  // If username changed — migrate data to new key
  if (newUsername !== currentUser) {
    const all = getAllData();
    userData.username = newUsername;
    all[newUsername]  = userData;
    delete all[currentUser];
    saveAllData(all);
    currentUser = newUsername;
  } else {
    save();
  }

  // Update header display
  const displayName = `${newName} (@${currentUser})`;
  document.getElementById('header-username').textContent = displayName;

  // Update sidebar
  document.getElementById('profile-display-name').textContent     = newName;
  document.getElementById('profile-display-username').textContent = '@' + currentUser;
  document.getElementById('profile-avatar-display').textContent   = newName.charAt(0).toUpperCase();

  showToast('Profil berhasil disimpan! ✅');
}

/** Change password. */
function saveNewPassword() {
  const oldPass = document.getElementById('pass-old').value;
  const newPass = document.getElementById('pass-new').value;
  const confirm = document.getElementById('pass-confirm').value;

  if (!oldPass || !newPass || !confirm) {
    showToast('Isi semua field kata sandi!'); return;
  }
  if (simpleHash(oldPass) !== userData.passwordHash) {
    showToast('Kata sandi lama salah!'); return;
  }
  if (newPass.length < 6) {
    showToast('Kata sandi baru minimal 6 karakter!'); return;
  }
  if (newPass !== confirm) {
    showToast('Konfirmasi kata sandi tidak cocok!'); return;
  }

  userData.passwordHash = simpleHash(newPass);
  save();

  ['pass-old', 'pass-new', 'pass-confirm'].forEach(id => {
    document.getElementById(id).value = '';
  });

  showToast('Kata sandi berhasil diubah! 🔒');
}

/** Toggle password visibility. */
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
}

/** Show confirmation modal. */
function showModal({ icon, title, desc, confirmLabel, confirmClass, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">${icon}</div>
      <div class="modal-title">${title}</div>
      <div class="modal-desc">${desc}</div>
      <div class="modal-actions">
        <button class="btn-modal-cancel" id="modal-cancel">Batal</button>
        <button class="btn-danger ${confirmClass || ''}" id="modal-confirm">${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('modal-cancel').onclick  = () => overlay.remove();
  document.getElementById('modal-confirm').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

/** Confirm & clear all transactions. */
function confirmClearData() {
  showModal({
    icon: '🗑️',
    title: 'Hapus Semua Transaksi?',
    desc: 'Seluruh riwayat pemasukan dan pengeluaran akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
    confirmLabel: 'Ya, Hapus Semua',
    onConfirm: () => {
      userData.transactions = [];
      save();
      renderProfile();
      showToast('Semua transaksi telah dihapus.');
    },
  });
}

/** Confirm & delete account. */
function confirmDeleteAccount() {
  showModal({
    icon: '💀',
    title: 'Hapus Akun?',
    desc: `Akun <strong>${currentUser}</strong> beserta seluruh datanya akan dihapus permanen. Anda akan dikembalikan ke halaman login.`,
    confirmLabel: 'Ya, Hapus Akun Saya',
    onConfirm: () => {
      const all = getAllData();
      delete all[currentUser];
      saveAllData(all);
      doLogout();
      showToast('Akun berhasil dihapus.');
    },
  });
}


// ============================================================
// INIT
// ============================================================

// Pre-fill today's date on page load (before login)
setTodayDates();