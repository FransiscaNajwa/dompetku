'use strict';

// ============================================================
// CONFIG — sesuai lokasi folder api di server
// ============================================================
const API_BASE = './api';

// ============================================================
// CONSTANTS
// ============================================================
const PERIODS = [
  { id:1, label:'Periode 1 (1–7)',   start:1,  end:7  },
  { id:2, label:'Periode 2 (8–14)',  start:8,  end:14 },
  { id:3, label:'Periode 3 (15–21)', start:15, end:21 },
  { id:4, label:'Periode 4 (22–28)', start:22, end:28 },
  { id:5, label:'Periode 5 (29–31)', start:29, end:31 },
];
const CHART_COLORS = ['#7ec8c8','#4a86c8','#a8d5e2','#c8a87e','#e07b7b','#5ab08a','#b8a0d4','#f0c05a','#82b0d4','#d4a0b8'];
const MONTH_NAMES  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ============================================================
// STATE
// ============================================================
let token          = localStorage.getItem('dompetku_token') || null;
let currentUser    = null; // { id, username, name }
let appData        = null; // semua data dari server

let activeSemId     = null;
let expenseMonthKey = null;
let incomeMonthKey  = null;
let budgetMonthKey  = null;
let activePeriodId  = 1;

let chartBar = null, chartPie = null;

// ============================================================
// API HELPER
// ============================================================
async function api(file, action, body = null) {
  const url  = `${API_BASE}/${file}.php?action=${action}`;
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body)  opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(url, opts);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Terjadi kesalahan.');
    return data;
  } catch (e) {
    showToast('❌ ' + e.message);
    throw e;
  }
}

// ============================================================
// UTILS
// ============================================================
function fmt(n)       { return 'Rp ' + Math.abs(n || 0).toLocaleString('id-ID'); }
function fmtSigned(n) { return (n < 0 ? '-' : '') + fmt(n); }
function monthKey(y, m)   { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function parseMonthKey(k) { const [y, m] = k.split('-'); return { year: +y, month: +m - 1 }; }
function monthLabel(k)    { const { year, month } = parseMonthKey(k); return `${MONTH_NAMES[month]} ${year}`; }
function today()          { return new Date().toISOString().split('T')[0]; }
function todayMonthKey()  { const d = new Date(); return monthKey(d.getFullYear(), d.getMonth()); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function showError(el, msg) { el.textContent = msg; el.style.display = 'block'; }
function hideError(el)      { el.style.display = 'none'; }

function showLoading(show = true) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div'); el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.75);z-index:9998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
    el.innerHTML = '<div style="text-align:center"><div style="font-size:2.5rem">⏳</div><div style="font-size:0.9rem;color:#4a86c8;margin-top:10px;font-family:DM Sans,sans-serif;font-weight:600">Memuat data...</div></div>';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ============================================================
// AUTH
// ============================================================
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.querySelectorAll('.auth-tab').forEach((b, i) => b.classList.toggle('active', isLogin ? i === 0 : i === 1));
  document.getElementById('login-form').classList.toggle('hidden', !isLogin);
  document.getElementById('register-form').classList.toggle('hidden', isLogin);
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const pass     = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-err');
  hideError(errEl);
  if (!username || !pass) { showError(errEl, 'Isi semua field.'); return; }
  try {
    showLoading();
    const res = await api('auth', 'login', { username, password: pass });
    token = res.token;
    localStorage.setItem('dompetku_token', token);
    currentUser = res.user;
    await loadAppData();
    enterApp();
  } catch (e) { showError(errEl, e.message); }
  finally { showLoading(false); }
}

async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const pass     = document.getElementById('reg-pass').value;
  const errEl    = document.getElementById('reg-err');
  hideError(errEl);
  if (!name || !username || !pass)         { showError(errEl, 'Isi semua field.'); return; }
  if (username.length < 3)                 { showError(errEl, 'Username minimal 3 karakter.'); return; }
  if (!/^[a-z0-9_]+$/.test(username))     { showError(errEl, 'Username hanya huruf kecil, angka, underscore.'); return; }
  if (pass.length < 6)                     { showError(errEl, 'Password minimal 6 karakter.'); return; }
  try {
    showLoading();
    const res = await api('auth', 'register', { name, username, password: pass });
    token = res.token;
    localStorage.setItem('dompetku_token', token);
    currentUser = res.user;
    await loadAppData();
    enterApp();
  } catch (e) { showError(errEl, e.message); }
  finally { showLoading(false); }
}

function doLogout() {
  token = null; currentUser = null; appData = null;
  localStorage.removeItem('dompetku_token');
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-pass').value = '';
  hideError(document.getElementById('login-err'));
}

// Auto-login jika token masih ada
async function tryAutoLogin() {
  if (!token) return;
  try {
    showLoading();
    const parts   = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Date.now() / 1000) throw new Error('Token expired');
    currentUser = { id: payload.user_id, username: payload.username, name: payload.username };
    await loadAppData();
    enterApp();
  } catch (e) {
    token = null;
    localStorage.removeItem('dompetku_token');
  } finally { showLoading(false); }
}

// ============================================================
// LOAD ALL DATA
// ============================================================
async function loadAppData() {
  const res = await api('data', 'load_all');
  appData = res.data;
  if (!appData.income)      appData.income = {};
  if (!appData.expenses)    appData.expenses = {};
  if (!appData.budget)      appData.budget = {};
  if (!appData.savings)     appData.savings = {};
  if (!appData.investments) appData.investments = {};
  if (!appData.platform_map)  appData.platform_map = {};
  if (!appData.portfolio_map) appData.portfolio_map = {};
}

// ============================================================
// ENTER APP
// ============================================================
function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';
  document.getElementById('header-username').textContent = `${currentUser.name || currentUser.username} (@${currentUser.username})`;
  const tk = todayMonthKey();
  expenseMonthKey = tk; incomeMonthKey = tk; budgetMonthKey = tk;
  activeSemId = appData.semesters[0]?.id || null;
  buildSemesterSelect();
  showPage('dashboard');
}

// ============================================================
// SEMESTER
// ============================================================
function getActiveSemester() { return appData.semesters.find(s => s.id == activeSemId) || appData.semesters[0]; }

function getSemesterMonths(sem) {
  if (!sem) return [];
  const months = []; let { year: y, month: m } = parseMonthKey(sem.start_month);
  const { year: ey, month: em } = parseMonthKey(sem.end_month);
  while (y < ey || (y === ey && m <= em)) { months.push(monthKey(y, m)); m++; if (m > 11) { m = 0; y++; } }
  return months;
}

function buildSemesterSelect() {
  const sel = document.getElementById('semester-select');
  sel.innerHTML = appData.semesters.map(s =>
    `<option value="${s.id}"${s.id == activeSemId ? ' selected' : ''}>${s.name}</option>`).join('');
}

function onSemesterChange() {
  activeSemId = document.getElementById('semester-select').value;
  showPage('dashboard');
}

function openSemesterModal()  { renderSemesterList(); document.getElementById('semester-modal').classList.remove('hidden'); }
function closeSemesterModal() { document.getElementById('semester-modal').classList.add('hidden'); }

function renderSemesterList() {
  const el = document.getElementById('semester-list');
  if (!appData.semesters.length) { el.innerHTML = '<div class="empty-state"><p>Belum ada semester.</p></div>'; return; }
  el.innerHTML = appData.semesters.map(s => `
    <div class="semester-item${s.id == activeSemId ? ' active-sem' : ''}">
      <div>
        <div class="semester-item-name">${s.name}</div>
        <div class="semester-item-range">${monthLabel(s.start_month)} – ${monthLabel(s.end_month)}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-sm" onclick="selectSemester(${s.id})">Pilih</button>
        <button class="btn-sm" style="color:var(--expense);border-color:var(--expense);" onclick="deleteSemester(${s.id})">Hapus</button>
      </div>
    </div>`).join('');
}

function selectSemester(id) { activeSemId = id; buildSemesterSelect(); closeSemesterModal(); showPage('dashboard'); }

async function deleteSemester(id) {
  if (appData.semesters.length <= 1) { showToast('Minimal 1 semester!'); return; }
  await api('data', 'delete_semester', { id });
  appData.semesters = appData.semesters.filter(s => s.id != id);
  if (activeSemId == id) activeSemId = appData.semesters[0].id;
  buildSemesterSelect(); renderSemesterList();
}

async function addSemester() {
  const name  = document.getElementById('new-sem-name').value.trim();
  const start = document.getElementById('new-sem-start').value;
  const end   = document.getElementById('new-sem-end').value;
  if (!name || !start || !end) { showToast('Lengkapi semua field!'); return; }
  if (start > end) { showToast('Bulan mulai harus sebelum selesai!'); return; }
  const res = await api('data', 'add_semester', { name, start, end });
  appData.semesters.push({ id: res.id, name, start_month: start, end_month: end });
  buildSemesterSelect(); renderSemesterList();
  document.getElementById('new-sem-name').value = '';
  showToast('Semester ditambahkan! 🎓');
}

// ============================================================
// NAVIGATION
// ============================================================
const PAGES = ['dashboard','expense','income','budget','saving','invest','categories','profile'];

function showPage(page) {
  PAGES.forEach(p => document.getElementById(`page-${p}`).classList.toggle('hidden', p !== page));
  document.querySelectorAll('.nav-tab').forEach((t, i) => t.classList.toggle('active', PAGES[i] === page));
  if (page === 'dashboard')  renderDashboard();
  if (page === 'expense')    renderExpensePage();
  if (page === 'income')     renderIncomePage();
  if (page === 'budget')     renderBudgetPage();
  if (page === 'saving')     renderSavingPage();
  if (page === 'invest')     renderInvestPage();
  if (page === 'categories') renderCategories();
  if (page === 'profile')    renderProfile();
}

// ============================================================
// DASHBOARD
// ============================================================
function getMonthIncome(k)  { return (appData.income[k] || []).reduce((s, t) => s + t.amount, 0); }
function getMonthSaving(k)  { return Object.values(appData.savings[k] || {}).reduce((s, v) => s + (+v || 0), 0); }
function getMonthInvest(k)  { return Object.values(appData.investments[k] || {}).reduce((s, v) => s + (+v || 0), 0); }

function getMonthExpense(k) {
  let total = 0;
  appData.categories.forEach(cat => {
    const catExp = (appData.expenses[k] || {})[cat.id] || {};
    PERIODS.forEach(p => { total += (+catExp[`p${p.id}`] || 0); });
  });
  return total;
}

function getMonthExpenseByCat(k) {
  const result = {};
  appData.categories.forEach(cat => {
    const catExp = (appData.expenses[k] || {})[cat.id] || {};
    result[cat.id] = PERIODS.reduce((s, p) => s + (+catExp[`p${p.id}`] || 0), 0);
  });
  return result;
}

function renderDashboard() {
  const sem = getActiveSemester(); if (!sem) return;
  const months = getSemesterMonths(sem);
  document.getElementById('dash-subtitle').textContent = `${sem.name}: ${monthLabel(sem.start_month)} – ${monthLabel(sem.end_month)}`;
  const totInc = months.reduce((s, k) => s + getMonthIncome(k), 0);
  const totExp = months.reduce((s, k) => s + getMonthExpense(k), 0);
  const totSav = months.reduce((s, k) => s + getMonthSaving(k), 0);
  const totInv = months.reduce((s, k) => s + getMonthInvest(k), 0);
  document.getElementById('dash-balance').textContent  = fmtSigned(totInc - totExp);
  document.getElementById('dash-income').textContent   = fmt(totInc);
  document.getElementById('dash-expense').textContent  = fmt(totExp);
  document.getElementById('dash-saving').textContent   = fmt(totSav);
  document.getElementById('dash-invest').textContent   = fmt(totInv);
  renderDashBarChart(months); renderDashPieChart(months); renderDashRecapTable(months);
}

function renderDashBarChart(months) {
  const labels = months.map(k => MONTH_NAMES[parseMonthKey(k).month].slice(0, 3));
  if (chartBar) chartBar.destroy();
  chartBar = new Chart(document.getElementById('dashBarChart'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Pemasukan',    data: months.map(k => getMonthIncome(k)),  backgroundColor: 'rgba(90,176,138,0.75)',  borderRadius: 6, borderSkipped: false },
      { label: 'Pengeluaran', data: months.map(k => getMonthExpense(k)), backgroundColor: 'rgba(224,123,123,0.75)', borderRadius: 6, borderSkipped: false },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { family: 'DM Sans', size: 12 }, boxWidth: 12 } } },
      scales: {
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'DM Sans' }, callback: v => v >= 1e6 ? 'Rp' + (v/1e6).toFixed(1) + 'jt' : v >= 1000 ? 'Rp' + (v/1000).toFixed(0) + 'rb' : 'Rp' + v } },
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans' } } }
      }
    }
  });
}

function renderDashPieChart(months) {
  const catTotals = {};
  months.forEach(k => { const byCat = getMonthExpenseByCat(k); Object.entries(byCat).forEach(([id, v]) => { catTotals[id] = (catTotals[id] || 0) + v; }); });
  const labels = []; const values = [];
  appData.categories.forEach(cat => { if ((catTotals[cat.id] || 0) > 0) { labels.push(`${cat.emoji} ${cat.name}`); values.push(catTotals[cat.id]); } });
  if (chartPie) chartPie.destroy();
  if (!values.length) { chartPie = null; return; }
  chartPie = new Chart(document.getElementById('dashPieChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: CHART_COLORS.slice(0, labels.length), borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 12, padding: 12 } } } }
  });
}

function renderDashRecapTable(months) {
  const el = document.getElementById('dash-recap-table');
  const rows = months.map(k => {
    const inc = getMonthIncome(k), exp = getMonthExpense(k), sav = getMonthSaving(k), inv = getMonthInvest(k), sisa = inc - exp;
    return `<tr><td><strong>${monthLabel(k)}</strong></td><td class="num positive">${fmt(inc)}</td><td class="num negative">${fmt(exp)}</td><td class="num ${sisa >= 0 ? 'positive' : 'negative'}">${fmtSigned(sisa)}</td><td class="num" style="color:var(--saving)">${fmt(sav)}</td><td class="num" style="color:var(--invest)">${fmt(inv)}</td></tr>`;
  }).join('');
  const tI = months.reduce((s,k)=>s+getMonthIncome(k),0), tE = months.reduce((s,k)=>s+getMonthExpense(k),0);
  const tS = months.reduce((s,k)=>s+getMonthSaving(k),0), tV = months.reduce((s,k)=>s+getMonthInvest(k),0);
  const tSisa = tI - tE;
  el.innerHTML = `<thead><tr><th>Bulan</th><th class="num">Pemasukan</th><th class="num">Pengeluaran</th><th class="num">Sisa</th><th class="num">Tabungan</th><th class="num">Investasi</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td><td class="num positive">${fmt(tI)}</td><td class="num negative">${fmt(tE)}</td><td class="num ${tSisa>=0?'positive':'negative'}">${fmtSigned(tSisa)}</td><td class="num" style="color:var(--saving)">${fmt(tS)}</td><td class="num" style="color:var(--invest)">${fmt(tV)}</td></tr></tfoot>`;
}

// ============================================================
// EXPENSE PAGE
// ============================================================
function changeExpenseMonth(dir) {
  const { year, month } = parseMonthKey(expenseMonthKey);
  const d = new Date(year, month + dir, 1);
  expenseMonthKey = monthKey(d.getFullYear(), d.getMonth());
  renderExpensePage();
}

function renderExpensePage() {
  document.getElementById('expense-month-label').textContent = monthLabel(expenseMonthKey);
  const inc = getMonthIncome(expenseMonthKey), exp = getMonthExpense(expenseMonthKey);
  document.getElementById('exp-page-income').textContent  = fmt(inc);
  document.getElementById('exp-page-expense').textContent = fmt(exp);
  document.getElementById('exp-page-sisa').textContent    = fmtSigned(inc - exp);
  renderPeriodTabs(); renderPeriodForm(); renderExpenseRecapTable();
}

function renderPeriodTabs() {
  document.getElementById('period-tabs').innerHTML = PERIODS.map(p =>
    `<button class="period-tab${p.id === activePeriodId ? ' active' : ''}" onclick="selectPeriod(${p.id})">${p.label}</button>`).join('');
}

function selectPeriod(id) { activePeriodId = id; renderPeriodTabs(); renderPeriodForm(); }

function renderPeriodForm() {
  const period = PERIODS.find(p => p.id === activePeriodId);
  document.getElementById('expense-period-title').textContent = period.label;
  document.getElementById('expense-cat-grid').innerHTML = appData.categories.map(cat => {
    const val = ((appData.expenses[expenseMonthKey] || {})[cat.id] || {})[`p${activePeriodId}`] || '';
    return `<div class="expense-cat-item">
      <span>${cat.emoji}</span>
      <label>${cat.name}</label>
      <input type="number" min="0" placeholder="0" value="${val}"
        onchange="updateExpense(${cat.id}, ${activePeriodId}, this.value)"
        oninput="updatePeriodTotal()">
    </div>`;
  }).join('');
  updatePeriodTotal();
}

async function updateExpense(catId, periodId, value) {
  if (!appData.expenses[expenseMonthKey]) appData.expenses[expenseMonthKey] = {};
  if (!appData.expenses[expenseMonthKey][catId]) appData.expenses[expenseMonthKey][catId] = {};
  appData.expenses[expenseMonthKey][catId][`p${periodId}`] = +value || 0;
  updatePeriodTotal(); renderExpenseRecapTable();
  const inc = getMonthIncome(expenseMonthKey), exp = getMonthExpense(expenseMonthKey);
  document.getElementById('exp-page-expense').textContent = fmt(exp);
  document.getElementById('exp-page-sisa').textContent    = fmtSigned(inc - exp);
  await api('data', 'save_expense', { category_id: catId, month_key: expenseMonthKey, period: periodId, amount: +value || 0 });
}

function updatePeriodTotal() {
  let total = 0;
  appData.categories.forEach(cat => { total += (+((appData.expenses[expenseMonthKey] || {})[cat.id] || {})[`p${activePeriodId}`] || 0); });
  document.getElementById('expense-period-total').textContent = fmt(total);
}

function renderExpenseRecapTable() {
  const el = document.getElementById('expense-recap-table');
  const md  = appData.expenses[expenseMonthKey] || {};
  const rows = appData.categories.map(cat => {
    const vals  = PERIODS.map(p => `<td class="num">${fmt(+(md[cat.id] || {})[`p${p.id}`] || 0)}</td>`).join('');
    const total = PERIODS.reduce((s, p) => s + (+(md[cat.id] || {})[`p${p.id}`] || 0), 0);
    return `<tr><td>${cat.emoji} ${cat.name}</td>${vals}<td class="num negative"><strong>${fmt(total)}</strong></td></tr>`;
  }).join('');
  const pTotals = PERIODS.map(p => appData.categories.reduce((s, cat) => s + (+(md[cat.id] || {})[`p${p.id}`] || 0), 0));
  const grand   = pTotals.reduce((s, v) => s + v, 0);
  el.innerHTML = `<thead><tr><th>Kategori</th>${PERIODS.map(p=>`<th class="num">P${p.id}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td>${pTotals.map(v=>`<td class="num negative">${fmt(v)}</td>`).join('')}<td class="num negative"><strong>${fmt(grand)}</strong></td></tr></tfoot>`;
}

// ============================================================
// INCOME
// ============================================================
function changeIncomeMonth(dir) {
  const { year, month } = parseMonthKey(incomeMonthKey);
  const d = new Date(year, month + dir, 1);
  incomeMonthKey = monthKey(d.getFullYear(), d.getMonth());
  renderIncomePage();
}

function renderIncomePage() {
  document.getElementById('income-month-label').textContent = monthLabel(incomeMonthKey);
  document.getElementById('inc-date').value = today();
  renderIncomeList();
}

async function addIncome() {
  const name   = document.getElementById('inc-name').value.trim();
  const amount = parseFloat(document.getElementById('inc-amount').value);
  const date   = document.getElementById('inc-date').value;
  const note   = document.getElementById('inc-note').value.trim();
  if (!name || !amount || !date) { showToast('Lengkapi semua field!'); return; }
  if (amount <= 0) { showToast('Jumlah harus lebih dari 0!'); return; }
  const res = await api('data', 'add_income', { name, amount, date, note, month_key: incomeMonthKey });
  if (!appData.income[incomeMonthKey]) appData.income[incomeMonthKey] = [];
  appData.income[incomeMonthKey].push({ id: res.id, name, amount, date, note });
  renderIncomeList();
  document.getElementById('inc-name').value = '';
  document.getElementById('inc-amount').value = '';
  document.getElementById('inc-note').value = '';
  showToast('Pemasukan ditambahkan! 💰');
}

async function deleteIncome(id) {
  await api('data', 'delete_income', { id });
  if (appData.income[incomeMonthKey])
    appData.income[incomeMonthKey] = appData.income[incomeMonthKey].filter(t => t.id != id);
  renderIncomeList();
  showToast('Pemasukan dihapus.');
}

function renderIncomeList() {
  const el   = document.getElementById('income-list');
  const txns = (appData.income[incomeMonthKey] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!txns.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><p>Belum ada pemasukan di ${monthLabel(incomeMonthKey)}.</p></div>`; return; }
  el.innerHTML = txns.map(t => `
    <div class="trans-item">
      <div class="trans-left">
        <div class="trans-icon">💰</div>
        <div>
          <div class="trans-name">${t.name}</div>
          <div class="trans-meta">${new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}${t.note ? ' · ' + t.note : ''}</div>
        </div>
      </div>
      <div class="trans-right">
        <div class="trans-amount income">+${fmt(t.amount)}</div>
        <button class="btn-del" onclick="deleteIncome(${t.id})">🗑</button>
      </div>
    </div>`).join('');
}

// ============================================================
// BUDGET
// ============================================================
function changeBudgetMonth(dir) {
  const { year, month } = parseMonthKey(budgetMonthKey);
  const d = new Date(year, month + dir, 1);
  budgetMonthKey = monthKey(d.getFullYear(), d.getMonth());
  renderBudgetPage();
}

function renderBudgetPage() {
  document.getElementById('budget-month-label').textContent = monthLabel(budgetMonthKey);
  const budData = appData.budget[budgetMonthKey] || {};
  document.getElementById('budget-grid').innerHTML = appData.categories.map(cat => {
    const budVal = budData[cat.id] || 0;
    const expVal = getMonthExpenseByCat(budgetMonthKey)[cat.id] || 0;
    const pct      = budVal > 0 ? Math.min(Math.round(expVal / budVal * 100), 999) : 0;
    const barClass = pct < 80 ? 'ok' : pct < 100 ? 'warn' : 'over';
    return `<div class="budget-cat-item">
      <div class="budget-cat-label">${cat.emoji} ${cat.name}</div>
      <input type="number" min="0" placeholder="0" value="${budVal || ''}" id="bud-${cat.id}">
      <div class="progress-bar-wrap"><div class="progress-bar ${barClass}" style="width:${Math.min(pct, 100)}%"></div></div>
      <span class="progress-pct">${budVal > 0 ? pct + '%' : '-'}</span>
      <span style="font-size:0.78rem;color:var(--text-muted);min-width:80px;text-align:right;">${budVal > 0 ? fmt(expVal) + ' / ' + fmt(budVal) : fmt(expVal)}</span>
    </div>`;
  }).join('');
  renderBudgetRecapTable();
}

async function saveBudget() {
  const budgets = appData.categories.map(cat => ({ category_id: cat.id, amount: +(document.getElementById(`bud-${cat.id}`)?.value || 0) }));
  await api('data', 'save_budget', { budgets, month_key: budgetMonthKey });
  if (!appData.budget[budgetMonthKey]) appData.budget[budgetMonthKey] = {};
  budgets.forEach(b => { appData.budget[budgetMonthKey][b.category_id] = b.amount; });
  renderBudgetPage();
  showToast('Budget disimpan! 🎯');
}

function renderBudgetRecapTable() {
  const el      = document.getElementById('budget-recap-table');
  const budData = appData.budget[budgetMonthKey] || {};
  const expByCat = getMonthExpenseByCat(budgetMonthKey);
  const rows = appData.categories.map(cat => {
    const bud = budData[cat.id] || 0, exp = expByCat[cat.id] || 0, dev = bud - exp, pct = bud > 0 ? Math.round(exp / bud * 100) : '-';
    return `<tr><td>${cat.emoji} ${cat.name}</td><td class="num">${bud > 0 ? fmt(bud) : '—'}</td><td class="num negative">${fmt(exp)}</td><td class="num ${dev >= 0 ? 'positive' : 'negative'}">${bud > 0 ? fmtSigned(dev) : '—'}</td><td class="num">${pct !== '-' ? pct + '%' : '—'}</td></tr>`;
  }).join('');
  el.innerHTML = `<thead><tr><th>Kategori</th><th class="num">Budget</th><th class="num">Realisasi</th><th class="num">Deviasi</th><th class="num">%</th></tr></thead><tbody>${rows}</tbody>`;
}

// ============================================================
// SAVING
// ============================================================
async function addSavingPlatform() {
  const name = document.getElementById('new-platform').value.trim();
  if (!name) { showToast('Nama tidak boleh kosong!'); return; }
  if (appData.platforms.includes(name)) { showToast('Platform sudah ada!'); return; }
  const res = await api('data', 'add_platform', { name });
  appData.platforms.push(name);
  appData.platform_map[name] = res.id;
  document.getElementById('new-platform').value = '';
  renderSavingPage();
  showToast('Platform ditambahkan! 🏦');
}

async function deleteSavingPlatform(name) {
  await api('data', 'delete_platform', { name });
  appData.platforms = appData.platforms.filter(p => p !== name);
  renderSavingPage();
  showToast('Platform dihapus.');
}

function renderSavingPage() {
  const sem = getActiveSemester(); if (!sem) return;
  const months = getSemesterMonths(sem);
  document.getElementById('saving-platforms-display').innerHTML = appData.platforms.map(p =>
    `<div class="cat-chip"><span class="cat-emoji">🏦</span><span>${p}</span><button class="btn-del-cat" onclick="deleteSavingPlatform('${p}')">✕</button></div>`).join('');
  const thead = `<tr><th>Platform</th>${months.map(k => `<th class="num">${MONTH_NAMES[parseMonthKey(k).month].slice(0,3)}</th>`).join('')}<th class="num">Total</th></tr>`;
  const rows = appData.platforms.map(plat => {
    const cols  = months.map(k => `<td><input class="editable-input" type="number" min="0" placeholder="0" value="${(appData.savings[k] || {})[plat] || ''}" data-month="${k}" data-plat="${plat}"></td>`).join('');
    const total = months.reduce((s, k) => s + (+(appData.savings[k] || {})[plat] || 0), 0);
    return `<tr><td><strong>${plat}</strong></td>${cols}<td class="num" style="color:var(--saving)">${fmt(total)}</td></tr>`;
  }).join('');
  const footCols = months.map(k => `<td class="num" style="color:var(--saving)">${fmt(getMonthSaving(k))}</td>`).join('');
  const grand    = months.reduce((s, k) => s + getMonthSaving(k), 0);
  document.getElementById('saving-table').innerHTML = `<thead>${thead}</thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td>${footCols}<td class="num" style="color:var(--saving)">${fmt(grand)}</td></tr></tfoot>`;
}

async function saveSavings() {
  const sem = getActiveSemester(); if (!sem) return;
  const months = getSemesterMonths(sem);
  for (const k of months) {
    const savings = [];
    appData.platforms.forEach(plat => {
      const inp = document.querySelector(`input[data-month="${k}"][data-plat="${plat}"]`);
      const val = +(inp?.value || 0);
      if (!appData.savings[k]) appData.savings[k] = {};
      appData.savings[k][plat] = val;
      const platId = appData.platform_map[plat];
      if (platId) savings.push({ platform_id: platId, amount: val });
    });
    if (savings.length) await api('data', 'save_saving', { savings, month_key: k });
  }
  renderSavingPage();
  showToast('Tabungan disimpan! 🏦');
}

// ============================================================
// INVEST
// ============================================================
async function addPortfolio() {
  const name = document.getElementById('new-portfolio').value.trim();
  if (!name) { showToast('Nama tidak boleh kosong!'); return; }
  if (appData.portfolios.includes(name)) { showToast('Portofolio sudah ada!'); return; }
  const res = await api('data', 'add_portfolio', { name });
  appData.portfolios.push(name);
  appData.portfolio_map[name] = res.id;
  document.getElementById('new-portfolio').value = '';
  renderInvestPage();
  showToast('Portofolio ditambahkan! 📈');
}

async function deletePortfolio(name) {
  await api('data', 'delete_portfolio', { name });
  appData.portfolios = appData.portfolios.filter(p => p !== name);
  renderInvestPage();
  showToast('Portofolio dihapus.');
}

function renderInvestPage() {
  const sem = getActiveSemester(); if (!sem) return;
  const months = getSemesterMonths(sem);
  document.getElementById('invest-portfolios-display').innerHTML = appData.portfolios.map(p =>
    `<div class="cat-chip"><span class="cat-emoji">📁</span><span>${p}</span><button class="btn-del-cat" onclick="deletePortfolio('${p}')">✕</button></div>`).join('');
  const thead = `<tr><th>Portofolio</th>${months.map(k => `<th class="num">${MONTH_NAMES[parseMonthKey(k).month].slice(0,3)}</th>`).join('')}<th class="num">Total</th></tr>`;
  const rows = appData.portfolios.map(port => {
    const cols  = months.map(k => `<td><input class="editable-input" type="number" min="0" placeholder="0" value="${(appData.investments[k] || {})[port] || ''}" data-month="${k}" data-port="${port}"></td>`).join('');
    const total = months.reduce((s, k) => s + (+(appData.investments[k] || {})[port] || 0), 0);
    return `<tr><td><strong>${port}</strong></td>${cols}<td class="num" style="color:var(--invest)">${fmt(total)}</td></tr>`;
  }).join('');
  const footCols = months.map(k => `<td class="num" style="color:var(--invest)">${fmt(getMonthInvest(k))}</td>`).join('');
  const grand    = months.reduce((s, k) => s + getMonthInvest(k), 0);
  document.getElementById('invest-table').innerHTML = `<thead>${thead}</thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td>${footCols}<td class="num" style="color:var(--invest)">${fmt(grand)}</td></tr></tfoot>`;
}

async function saveInvestments() {
  const sem = getActiveSemester(); if (!sem) return;
  const months = getSemesterMonths(sem);
  for (const k of months) {
    const investments = [];
    appData.portfolios.forEach(port => {
      const inp = document.querySelector(`input[data-month="${k}"][data-port="${port}"]`);
      const val = +(inp?.value || 0);
      if (!appData.investments[k]) appData.investments[k] = {};
      appData.investments[k][port] = val;
      const portId = appData.portfolio_map[port];
      if (portId) investments.push({ portfolio_id: portId, amount: val });
    });
    if (investments.length) await api('data', 'save_investment', { investments, month_key: k });
  }
  renderInvestPage();
  showToast('Investasi disimpan! 📈');
}

// ============================================================
// CATEGORIES
// ============================================================
async function addCategory() {
  const emoji = document.getElementById('cat-emoji').value.trim() || '🏷️';
  const name  = document.getElementById('cat-name').value.trim();
  if (!name) { showToast('Nama tidak boleh kosong!'); return; }
  const res = await api('data', 'add_category', { emoji, name });
  appData.categories.push({ id: res.id, emoji, name });
  renderCategories();
  document.getElementById('cat-name').value  = '';
  document.getElementById('cat-emoji').value = '';
  showToast('Kategori ditambahkan! 🎉');
}

async function deleteCategory(id) {
  await api('data', 'delete_category', { id });
  appData.categories = appData.categories.filter(c => c.id != id);
  renderCategories();
  showToast('Kategori dihapus.');
}

function renderCategories() {
  const el = document.getElementById('cats-grid');
  if (!appData.categories.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏷️</div><p>Belum ada kategori.</p></div>`; return; }
  el.innerHTML = appData.categories.map(c =>
    `<div class="cat-chip"><span class="cat-emoji">${c.emoji}</span><span>${c.name}</span><button class="btn-del-cat" onclick="deleteCategory(${c.id})">✕</button></div>`).join('');
}

// ============================================================
// PROFILE
// ============================================================
function renderProfile() {
  const name = currentUser.name || '', username = currentUser.username;
  document.getElementById('profile-avatar-display').textContent  = (name || username).charAt(0).toUpperCase();
  document.getElementById('profile-display-name').textContent    = name || '(Belum diisi)';
  document.getElementById('profile-display-username').textContent = '@' + username;
  document.getElementById('edit-name').value     = name;
  document.getElementById('edit-username').value = username;
  const errEl = document.getElementById('profile-info-err'); if (errEl) errEl.style.display = 'none';
  ['pass-old','pass-new','pass-confirm'].forEach(id => { document.getElementById(id).value = ''; });
  const totalTxn = Object.values(appData.income || {}).reduce((s, arr) => s + arr.length, 0);
  document.getElementById('profile-total-txn').textContent = totalTxn;
  document.getElementById('profile-total-cat').textContent = appData.categories.length;
}

async function saveProfileInfo() {
  const newName     = document.getElementById('edit-name').value.trim();
  const newUsername = document.getElementById('edit-username').value.trim().toLowerCase();
  const errEl       = document.getElementById('profile-info-err');
  errEl.style.display = 'none';
  if (!newName)                                    { errEl.textContent = 'Nama tidak boleh kosong!'; errEl.style.display = 'block'; return; }
  if (!newUsername || newUsername.length < 3)      { errEl.textContent = 'Username minimal 3 karakter.'; errEl.style.display = 'block'; return; }
  if (!/^[a-z0-9_]+$/.test(newUsername))           { errEl.textContent = 'Username tidak valid.'; errEl.style.display = 'block'; return; }
  const res = await api('auth', 'update_profile', { name: newName, username: newUsername });
  token = res.token; localStorage.setItem('dompetku_token', token);
  currentUser = { ...currentUser, name: newName, username: newUsername };
  document.getElementById('header-username').textContent          = `${newName} (@${newUsername})`;
  document.getElementById('profile-display-name').textContent     = newName;
  document.getElementById('profile-display-username').textContent = '@' + newUsername;
  document.getElementById('profile-avatar-display').textContent   = newName.charAt(0).toUpperCase();
  showToast('Profil disimpan! ✅');
}

async function saveNewPassword() {
  const oldPass = document.getElementById('pass-old').value;
  const newPass = document.getElementById('pass-new').value;
  const confirm = document.getElementById('pass-confirm').value;
  if (!oldPass || !newPass || !confirm) { showToast('Isi semua field!'); return; }
  if (newPass.length < 6)              { showToast('Password baru minimal 6 karakter!'); return; }
  if (newPass !== confirm)             { showToast('Konfirmasi tidak cocok!'); return; }
  await api('auth', 'change_password', { old_password: oldPass, new_password: newPass });
  ['pass-old','pass-new','pass-confirm'].forEach(id => document.getElementById(id).value = '');
  showToast('Password diubah! 🔒');
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type  = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'text' ? '🙈' : '👁';
}

async function confirmClearData() {
  if (!confirm('Hapus semua data? Akun tetap ada.')) return;
  await api('data', 'clear_data');
  appData.income = {}; appData.expenses = {}; appData.budget = {}; appData.savings = {}; appData.investments = {};
  showToast('Semua data dihapus.'); showPage('dashboard');
}

async function confirmDeleteAccount() {
  if (!confirm('Hapus akun permanen? Semua data hilang.')) return;
  await api('data', 'delete_account');
  doLogout();
}

// ============================================================
// EXPORT EXCEL
// ============================================================
function exportToExcel() {
  const sem = getActiveSemester(); if (!sem) { showToast('Pilih semester dulu!'); return; }
  const months = getSemesterMonths(sem);
  const wb = XLSX.utils.book_new();
  months.forEach(k => {
    const { month, year } = parseMonthKey(k);
    const md = appData.expenses[k] || {};
    const rows = [];
    rows.push([MONTH_NAMES[month].toUpperCase() + ' ' + year]);
    rows.push(['MONTHLY BUDGETING']);
    rows.push(['INCOME', getMonthIncome(k)]);
    rows.push(['EXPENSE ALL', getMonthExpense(k)]);
    rows.push(['SISA', getMonthIncome(k) - getMonthExpense(k)]);
    rows.push([]);
    rows.push(['EXPENSE PER PERIODE']);
    rows.push(['KATEGORI', ...PERIODS.map(p => p.label), 'TOTAL']);
    appData.categories.forEach(cat => {
      const vals = PERIODS.map(p => (md[cat.id] || {})[`p${p.id}`] || 0);
      rows.push([`${cat.emoji} ${cat.name}`, ...vals, vals.reduce((s, v) => s + v, 0)]);
    });
    const pTotals = PERIODS.map(p => appData.categories.reduce((s, cat) => s + (+(md[cat.id] || {})[`p${p.id}`] || 0), 0));
    rows.push(['TOTAL', ...pTotals, pTotals.reduce((s, v) => s + v, 0)]);
    rows.push([]);
    rows.push(['SAVING']);
    rows.push(['PLATFORM', 'AMOUNT']);
    appData.platforms.forEach(p => rows.push([p, (appData.savings[k] || {})[p] || 0]));
    rows.push(['TOTAL', getMonthSaving(k)]);
    rows.push([]);
    rows.push(['INCOME DETAIL']);
    rows.push(['NAMA', 'JUMLAH', 'CATATAN']);
    (appData.income[k] || []).forEach(t => rows.push([t.name, t.amount, t.note || '']));
    rows.push(['TOTAL', getMonthIncome(k)]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, MONTH_NAMES[month].slice(0, 4).toUpperCase());
  });
  // Rekap semester
  const recapRows = [[`REKAP ${sem.name.toUpperCase()}`], ['BULAN', 'PEMASUKAN', 'PENGELUARAN', 'SISA', 'TABUNGAN', 'INVESTASI']];
  months.forEach(k => recapRows.push([monthLabel(k), getMonthIncome(k), getMonthExpense(k), getMonthIncome(k) - getMonthExpense(k), getMonthSaving(k), getMonthInvest(k)]));
  const wsR = XLSX.utils.aoa_to_sheet(recapRows);
  wsR['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsR, sem.name.slice(0, 15));
  XLSX.writeFile(wb, `Dompetku_${sem.name.replace(/\s+/g, '_')}.xlsx`);
  showToast('Export berhasil! 📥');
}

// ============================================================
// INIT
// ============================================================
tryAutoLogin();