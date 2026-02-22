'use strict';

// ============================================================
// CONSTANTS & DEFAULTS
// ============================================================

const STORE_KEY = 'dompetku_v2';

const DEFAULT_CATEGORIES = [
  { id: 'c1',  emoji: '🍽️', name: 'Food' },
  { id: 'c2',  emoji: '🚗', name: 'Transport' },
  { id: 'c3',  emoji: '📱', name: 'Kouta' },
  { id: 'c4',  emoji: '🛒', name: 'Groceries' },
  { id: 'c5',  emoji: '👨‍👩‍👧', name: 'Orang Tua' },
  { id: 'c6',  emoji: '🏠', name: 'Kost' },
  { id: 'c7',  emoji: '💰', name: 'RDPU' },
  { id: 'c8',  emoji: '📦', name: 'ETC' },
];

const DEFAULT_PLATFORMS = ['JAGO', 'BYU', 'SEABANK', 'BIBIT', 'Tunai'];
const DEFAULT_PORTFOLIOS = ['Dana Wisuda', 'Dana Tabungan', 'Dana Darurat'];

// Expense periods per month
const PERIODS = [
  { id: 1, label: 'Periode 1 (1–7)',   start: 1,  end: 7  },
  { id: 2, label: 'Periode 2 (8–14)',  start: 8,  end: 14 },
  { id: 3, label: 'Periode 3 (15–21)', start: 15, end: 21 },
  { id: 4, label: 'Periode 4 (22–28)', start: 22, end: 28 },
  { id: 5, label: 'Periode 5 (29–31)', start: 29, end: 31 },
];

const CHART_COLORS = ['#7ec8c8','#4a86c8','#a8d5e2','#c8a87e','#e07b7b','#5ab08a','#b8a0d4','#f0c05a','#82b0d4','#d4a0b8'];
const MONTH_NAMES  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ============================================================
// STATE
// ============================================================
let currentUser   = null;
let userData      = null;
let activeSemId   = null;

// Page-specific active month keys (YYYY-MM)
let expenseMonthKey = null;
let incomeMonthKey  = null;
let budgetMonthKey  = null;
let activePeriodId  = 1;

// Charts
let chartBar = null, chartPie = null;

// ============================================================
// STORAGE
// ============================================================
function getAllData()         { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function saveAllData(data)   { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
function save()              { const all = getAllData(); all[currentUser] = userData; saveAllData(all); }

function initUserData(username) {
  return {
    name: '', username, passwordHash: '',
    joinDate: new Date().toISOString(),
    categories:  JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    platforms:   [...DEFAULT_PLATFORMS],
    portfolios:  [...DEFAULT_PORTFOLIOS],
    semesters:   [],
    // keyed by month YYYY-MM: { expenses: {catId: {p1,p2,p3,p4,p5}}, income: [], budget: {catId: amount}, saving: {platform: amount}, invest: {portfolio: amount} }
    months: {},
  };
}

function getOrInitMonth(key) {
  if (!userData.months[key]) userData.months[key] = { expenses: {}, income: [], budget: {}, saving: {}, invest: {} };
  return userData.months[key];
}

// ============================================================
// UTILS
// ============================================================
function simpleHash(str) { let h=0; for(let i=0;i<str.length;i++) h=(Math.imul(31,h)+str.charCodeAt(i))|0; return h.toString(36); }
function uid()           { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function fmt(n)          { return 'Rp '+Math.abs(n||0).toLocaleString('id-ID'); }
function fmtSigned(n)    { return (n<0?'-':'')+fmt(n); }
function monthKey(y,m)   { return `${y}-${String(m+1).padStart(2,'0')}`; }
function parseMonthKey(k){ const [y,m]=k.split('-'); return {year:+y, month:+m-1}; }
function monthLabel(k)   { const {year,month}=parseMonthKey(k); return `${MONTH_NAMES[month]} ${year}`; }

function showToast(msg) {
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}
function showError(el,msg) { el.textContent=msg; el.style.display='block'; }
function hideError(el)     { el.style.display='none'; }

function today() { return new Date().toISOString().split('T')[0]; }
function todayMonthKey() { const d=new Date(); return monthKey(d.getFullYear(),d.getMonth()); }

// ============================================================
// AUTH
// ============================================================
function switchAuthTab(tab) {
  const isLogin = tab==='login';
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',isLogin?i===0:i===1));
  document.getElementById('login-form').classList.toggle('hidden',!isLogin);
  document.getElementById('register-form').classList.toggle('hidden',isLogin);
}

function doLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const pass     = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-err');
  hideError(errEl);
  if (!username||!pass) { showError(errEl,'Isi semua field.'); return; }
  const all = getAllData();
  if (!all[username]||all[username].passwordHash!==simpleHash(pass)) { showError(errEl,'Username atau kata sandi salah.'); return; }
  currentUser=username; userData=all[username]; enterApp();
}

function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const pass     = document.getElementById('reg-pass').value;
  const errEl    = document.getElementById('reg-err');
  hideError(errEl);
  if (!name||!username||!pass)        { showError(errEl,'Isi semua field.'); return; }
  if (username.length<3)              { showError(errEl,'Username minimal 3 karakter.'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showError(errEl,'Username hanya huruf kecil, angka, underscore.'); return; }
  if (pass.length<6)                  { showError(errEl,'Kata sandi minimal 6 karakter.'); return; }
  const all=getAllData();
  if (all[username]?.passwordHash)    { showError(errEl,'Username sudah digunakan.'); return; }
  const ud=initUserData(username); ud.name=name; ud.passwordHash=simpleHash(pass);
  // Default semester
  const now=new Date(); const curM=monthKey(now.getFullYear(),now.getMonth());
  const endD=new Date(now.getFullYear(),now.getMonth()+5,1); const endM=monthKey(endD.getFullYear(),endD.getMonth());
  ud.semesters=[{id:uid(),name:'Semester 1',start:curM,end:endM}];
  all[username]=ud; saveAllData(all);
  currentUser=username; userData=ud; enterApp();
}

function doLogout() {
  currentUser=null; userData=null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('login-username').value='';
  document.getElementById('login-pass').value='';
  hideError(document.getElementById('login-err'));
}

function enterApp() {
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='block';
  document.getElementById('header-username').textContent=`${userData.name||currentUser} (@${currentUser})`;
  // Set default month keys
  const tk=todayMonthKey();
  expenseMonthKey=tk; incomeMonthKey=tk; budgetMonthKey=tk;
  // Active semester = first one
  if (userData.semesters.length) activeSemId=userData.semesters[0].id;
  buildSemesterSelect();
  showPage('dashboard');
}

// ============================================================
// SEMESTER
// ============================================================
function getActiveSemester() { return userData.semesters.find(s=>s.id===activeSemId)||userData.semesters[0]; }

function getSemesterMonths(sem) {
  if (!sem) return [];
  const months=[]; let {year:y,month:m}=parseMonthKey(sem.start);
  const {year:ey,month:em}=parseMonthKey(sem.end);
  while(y<ey||(y===ey&&m<=em)) { months.push(monthKey(y,m)); m++; if(m>11){m=0;y++;} }
  return months;
}

function buildSemesterSelect() {
  const sel=document.getElementById('semester-select');
  sel.innerHTML=userData.semesters.map(s=>`<option value="${s.id}"${s.id===activeSemId?' selected':''}>${s.name}</option>`).join('');
}

function onSemesterChange() {
  activeSemId=document.getElementById('semester-select').value;
  showPage('dashboard');
}

function openSemesterModal() {
  renderSemesterList();
  document.getElementById('semester-modal').classList.remove('hidden');
}
function closeSemesterModal() { document.getElementById('semester-modal').classList.add('hidden'); }

function renderSemesterList() {
  const el=document.getElementById('semester-list');
  if (!userData.semesters.length) { el.innerHTML='<div class="empty-state"><p>Belum ada semester.</p></div>'; return; }
  el.innerHTML=userData.semesters.map(s=>`
    <div class="semester-item${s.id===activeSemId?' active-sem':''}">
      <div>
        <div class="semester-item-name">${s.name}</div>
        <div class="semester-item-range">${monthLabel(s.start)} – ${monthLabel(s.end)}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-sm" onclick="selectSemester('${s.id}')">Pilih</button>
        <button class="btn-sm" style="color:var(--expense);border-color:var(--expense);" onclick="deleteSemester('${s.id}')">Hapus</button>
      </div>
    </div>`).join('');
}

function selectSemester(id) {
  activeSemId=id; buildSemesterSelect(); closeSemesterModal(); showPage('dashboard');
}

function deleteSemester(id) {
  if (userData.semesters.length<=1) { showToast('Minimal 1 semester harus ada!'); return; }
  userData.semesters=userData.semesters.filter(s=>s.id!==id);
  if (activeSemId===id) activeSemId=userData.semesters[0].id;
  save(); buildSemesterSelect(); renderSemesterList();
}

function addSemester() {
  const name =document.getElementById('new-sem-name').value.trim();
  const start=document.getElementById('new-sem-start').value;
  const end  =document.getElementById('new-sem-end').value;
  if (!name||!start||!end) { showToast('Lengkapi semua field semester!'); return; }
  if (start>end) { showToast('Bulan mulai harus sebelum bulan selesai!'); return; }
  userData.semesters.push({id:uid(),name,start,end});
  save(); buildSemesterSelect(); renderSemesterList();
  document.getElementById('new-sem-name').value='';
  showToast('Semester ditambahkan! 🎓');
}

// ============================================================
// NAVIGATION
// ============================================================
const PAGES=['dashboard','expense','income','budget','saving','invest','categories','profile'];

function showPage(page) {
  PAGES.forEach(p=>document.getElementById(`page-${p}`).classList.toggle('hidden',p!==page));
  document.querySelectorAll('.nav-tab').forEach((t,i)=>t.classList.toggle('active',PAGES[i]===page));
  if (page==='dashboard')  renderDashboard();
  if (page==='expense')    renderExpensePage();
  if (page==='income')     renderIncomePage();
  if (page==='budget')     renderBudgetPage();
  if (page==='saving')     renderSavingPage();
  if (page==='invest')     renderInvestPage();
  if (page==='categories') renderCategories();
  if (page==='profile')    renderProfile();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const sem=getActiveSemester(); if (!sem) return;
  const months=getSemesterMonths(sem);
  document.getElementById('dash-subtitle').textContent=`${sem.name}: ${monthLabel(sem.start)} – ${monthLabel(sem.end)}`;

  let totalInc=0, totalExp=0, totalSav=0, totalInv=0;
  months.forEach(k=>{
    const md=userData.months[k]||{};
    totalInc+=getMonthIncome(k);
    totalExp+=getMonthExpense(k);
    totalSav+=getMonthSaving(k);
    totalInv+=getMonthInvest(k);
  });

  document.getElementById('dash-balance').textContent = fmtSigned(totalInc-totalExp);
  document.getElementById('dash-income').textContent  = fmt(totalInc);
  document.getElementById('dash-expense').textContent = fmt(totalExp);
  document.getElementById('dash-saving').textContent  = fmt(totalSav);
  document.getElementById('dash-invest').textContent  = fmt(totalInv);

  renderDashBarChart(months);
  renderDashPieChart(months);
  renderDashRecapTable(months);
}

function getMonthIncome(key)  { return (userData.months[key]?.income||[]).reduce((s,t)=>s+t.amount,0); }
function getMonthSaving(key)  { return Object.values(userData.months[key]?.saving||{}).reduce((s,v)=>s+(+v||0),0); }
function getMonthInvest(key)  { return Object.values(userData.months[key]?.invest||{}).reduce((s,v)=>s+(+v||0),0); }
function getMonthExpense(key) {
  const exp=userData.months[key]?.expenses||{};
  let total=0;
  userData.categories.forEach(cat=>{
    const catExp=exp[cat.id]||{};
    PERIODS.forEach(p=>{ total+=(+catExp[`p${p.id}`]||0); });
  });
  return total;
}
function getMonthExpenseByCat(key) {
  const exp=userData.months[key]?.expenses||{}; const result={};
  userData.categories.forEach(cat=>{
    const catExp=exp[cat.id]||{};
    result[cat.id]=PERIODS.reduce((s,p)=>s+(+catExp[`p${p.id}`]||0),0);
  });
  return result;
}

function renderDashBarChart(months) {
  const incData=months.map(k=>getMonthIncome(k));
  const expData=months.map(k=>getMonthExpense(k));
  const labels=months.map(k=>{ const {month}=parseMonthKey(k); return MONTH_NAMES[month].slice(0,3); });
  if (chartBar) chartBar.destroy();
  chartBar=new Chart(document.getElementById('dashBarChart'),{
    type:'bar',
    data:{ labels, datasets:[
      {label:'Pemasukan',data:incData,backgroundColor:'rgba(90,176,138,0.75)',borderRadius:6,borderSkipped:false},
      {label:'Pengeluaran',data:expData,backgroundColor:'rgba(224,123,123,0.75)',borderRadius:6,borderSkipped:false},
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{font:{family:'DM Sans',size:12},boxWidth:12}}},
      scales:{ y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{family:'DM Sans'},callback:v=>v>=1e6?'Rp'+(v/1e6).toFixed(1)+'jt':v>=1000?'Rp'+(v/1000).toFixed(0)+'rb':'Rp'+v}}, x:{grid:{display:false},ticks:{font:{family:'DM Sans'}}} }
    }
  });
}

function renderDashPieChart(months) {
  const catTotals={};
  months.forEach(k=>{ const byCat=getMonthExpenseByCat(k); Object.entries(byCat).forEach(([id,v])=>{ catTotals[id]=(catTotals[id]||0)+v; }); });
  const labels=[]; const values=[];
  userData.categories.forEach(cat=>{ if ((catTotals[cat.id]||0)>0) { labels.push(`${cat.emoji} ${cat.name}`); values.push(catTotals[cat.id]); } });
  if (chartPie) chartPie.destroy();
  if (!values.length) { chartPie=null; return; }
  chartPie=new Chart(document.getElementById('dashPieChart'),{
    type:'doughnut',
    data:{ labels, datasets:[{data:values,backgroundColor:CHART_COLORS.slice(0,labels.length),borderWidth:2,borderColor:'#fff',hoverOffset:8}]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{legend:{position:'bottom',labels:{font:{family:'DM Sans',size:11},boxWidth:12,padding:12}}}
    }
  });
}

function renderDashRecapTable(months) {
  const el=document.getElementById('dash-recap-table');
  const rows=months.map(k=>{
    const inc=getMonthIncome(k), exp=getMonthExpense(k), sav=getMonthSaving(k), inv=getMonthInvest(k);
    const sisa=inc-exp;
    return `<tr>
      <td><strong>${monthLabel(k)}</strong></td>
      <td class="num positive">${fmt(inc)}</td>
      <td class="num negative">${fmt(exp)}</td>
      <td class="num ${sisa>=0?'positive':'negative'}">${fmtSigned(sisa)}</td>
      <td class="num" style="color:var(--saving)">${fmt(sav)}</td>
      <td class="num" style="color:var(--invest)">${fmt(inv)}</td>
    </tr>`;
  }).join('');
  const totInc=months.reduce((s,k)=>s+getMonthIncome(k),0);
  const totExp=months.reduce((s,k)=>s+getMonthExpense(k),0);
  const totSav=months.reduce((s,k)=>s+getMonthSaving(k),0);
  const totInv=months.reduce((s,k)=>s+getMonthInvest(k),0);
  const totSisa=totInc-totExp;
  el.innerHTML=`
    <thead><tr><th>Bulan</th><th class="num">Pemasukan</th><th class="num">Pengeluaran</th><th class="num">Sisa</th><th class="num">Tabungan</th><th class="num">Investasi</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td><strong>TOTAL</strong></td><td class="num positive">${fmt(totInc)}</td><td class="num negative">${fmt(totExp)}</td><td class="num ${totSisa>=0?'positive':'negative'}">${fmtSigned(totSisa)}</td><td class="num" style="color:var(--saving)">${fmt(totSav)}</td><td class="num" style="color:var(--invest)">${fmt(totInv)}</td></tr></tfoot>`;
}

// ============================================================
// EXPENSE PAGE
// ============================================================
function changeExpenseMonth(dir) {
  const {year,month}=parseMonthKey(expenseMonthKey);
  const d=new Date(year,month+dir,1);
  expenseMonthKey=monthKey(d.getFullYear(),d.getMonth());
  renderExpensePage();
}

function renderExpensePage() {
  document.getElementById('expense-month-label').textContent=monthLabel(expenseMonthKey);
  // Stats
  const inc=getMonthIncome(expenseMonthKey), exp=getMonthExpense(expenseMonthKey);
  document.getElementById('exp-page-income').textContent=fmt(inc);
  document.getElementById('exp-page-expense').textContent=fmt(exp);
  document.getElementById('exp-page-sisa').textContent=fmtSigned(inc-exp);
  renderPeriodTabs();
  renderPeriodForm();
  renderExpenseRecapTable();
}

function renderPeriodTabs() {
  const el=document.getElementById('period-tabs');
  el.innerHTML=PERIODS.map(p=>`
    <button class="period-tab${p.id===activePeriodId?' active':''}" onclick="selectPeriod(${p.id})">${p.label}</button>`).join('');
}

function selectPeriod(id) { activePeriodId=id; renderPeriodTabs(); renderPeriodForm(); }

function renderPeriodForm() {
  const period=PERIODS.find(p=>p.id===activePeriodId);
  document.getElementById('expense-period-title').textContent=period.label;
  const md=getOrInitMonth(expenseMonthKey);
  const grid=document.getElementById('expense-cat-grid');
  grid.innerHTML=userData.categories.map(cat=>{
    const val=(md.expenses[cat.id]||{})[`p${activePeriodId}`]||'';
    return `<div class="expense-cat-item">
      <span>${cat.emoji}</span>
      <label>${cat.name}</label>
      <input type="number" min="0" placeholder="0" value="${val}"
        onchange="updateExpense('${cat.id}',${activePeriodId},this.value)"
        oninput="updatePeriodTotal()">
    </div>`;
  }).join('');
  updatePeriodTotal();
}

function updateExpense(catId, periodId, value) {
  const md=getOrInitMonth(expenseMonthKey);
  if (!md.expenses[catId]) md.expenses[catId]={};
  md.expenses[catId][`p${periodId}`]=+value||0;
  save(); updatePeriodTotal(); renderExpenseRecapTable();
  // update stats
  const inc=getMonthIncome(expenseMonthKey), exp=getMonthExpense(expenseMonthKey);
  document.getElementById('exp-page-expense').textContent=fmt(exp);
  document.getElementById('exp-page-sisa').textContent=fmtSigned(inc-exp);
}

function updatePeriodTotal() {
  const md=userData.months[expenseMonthKey]||{};
  let total=0;
  userData.categories.forEach(cat=>{ total+=(+(md.expenses?.[cat.id]?.[`p${activePeriodId}`])||0); });
  document.getElementById('expense-period-total').textContent=fmt(total);
}

function renderExpenseRecapTable() {
  const el=document.getElementById('expense-recap-table');
  const md=userData.months[expenseMonthKey]||{};
  const catCols=userData.categories.map(cat=>{
    const total=PERIODS.reduce((s,p)=>s+(+(md.expenses?.[cat.id]?.[`p${p.id}`])||0),0);
    return {cat,total};
  });
  const header=`<thead><tr><th>Kategori</th>${PERIODS.map(p=>`<th class="num">${p.label.split(' ')[0]+' '+p.id}</th>`).join('')}<th class="num">Total</th></tr></thead>`;
  const rows=userData.categories.map(cat=>{
    const vals=PERIODS.map(p=>`<td class="num">${fmt(+(md.expenses?.[cat.id]?.[`p${p.id}`])||0)}</td>`).join('');
    const total=PERIODS.reduce((s,p)=>s+(+(md.expenses?.[cat.id]?.[`p${p.id}`])||0),0);
    return `<tr><td><span>${cat.emoji}</span> ${cat.name}</td>${vals}<td class="num negative"><strong>${fmt(total)}</strong></td></tr>`;
  }).join('');
  const periodTotals=PERIODS.map(p=>userData.categories.reduce((s,cat)=>s+(+(md.expenses?.[cat.id]?.[`p${p.id}`])||0),0));
  const grandTotal=periodTotals.reduce((s,v)=>s+v,0);
  const footerCols=periodTotals.map(v=>`<td class="num negative">${fmt(v)}</td>`).join('');
  el.innerHTML=`${header}<tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td>${footerCols}<td class="num negative"><strong>${fmt(grandTotal)}</strong></td></tr></tfoot>`;
}

// ============================================================
// INCOME PAGE
// ============================================================
function changeIncomeMonth(dir) {
  const {year,month}=parseMonthKey(incomeMonthKey);
  const d=new Date(year,month+dir,1);
  incomeMonthKey=monthKey(d.getFullYear(),d.getMonth());
  renderIncomePage();
}

function renderIncomePage() {
  document.getElementById('income-month-label').textContent=monthLabel(incomeMonthKey);
  document.getElementById('inc-date').value=today();
  renderIncomeList();
}

function addIncome() {
  const name  =document.getElementById('inc-name').value.trim();
  const amount=parseFloat(document.getElementById('inc-amount').value);
  const date  =document.getElementById('inc-date').value;
  const note  =document.getElementById('inc-note').value.trim();
  if (!name||!amount||!date) { showToast('Lengkapi semua field!'); return; }
  if (amount<=0) { showToast('Jumlah harus lebih dari 0!'); return; }
  const md=getOrInitMonth(incomeMonthKey);
  md.income.push({id:uid(),name,amount,date,note});
  save(); renderIncomeList();
  document.getElementById('inc-name').value='';
  document.getElementById('inc-amount').value='';
  document.getElementById('inc-note').value='';
  showToast('Pemasukan ditambahkan! 💰');
}

function deleteIncome(id) {
  const md=userData.months[incomeMonthKey]; if (!md) return;
  md.income=md.income.filter(t=>t.id!==id);
  save(); renderIncomeList();
  showToast('Pemasukan dihapus.');
}

function renderIncomeList() {
  const el=document.getElementById('income-list');
  const md=userData.months[incomeMonthKey];
  const txns=(md?.income||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if (!txns.length) { el.innerHTML=`<div class="empty-state"><div class="empty-icon">💰</div><p>Belum ada pemasukan di ${monthLabel(incomeMonthKey)}.</p></div>`; return; }
  el.innerHTML=txns.map(t=>`
    <div class="trans-item">
      <div class="trans-left">
        <div class="trans-icon">💰</div>
        <div>
          <div class="trans-name">${t.name}</div>
          <div class="trans-meta">${new Date(t.date+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}${t.note?' · '+t.note:''}</div>
        </div>
      </div>
      <div class="trans-right">
        <div class="trans-amount income">+${fmt(t.amount)}</div>
        <button class="btn-del" onclick="deleteIncome('${t.id}')">🗑</button>
      </div>
    </div>`).join('');
}

// ============================================================
// BUDGET PAGE
// ============================================================
function changeBudgetMonth(dir) {
  const {year,month}=parseMonthKey(budgetMonthKey);
  const d=new Date(year,month+dir,1);
  budgetMonthKey=monthKey(d.getFullYear(),d.getMonth());
  renderBudgetPage();
}

function renderBudgetPage() {
  document.getElementById('budget-month-label').textContent=monthLabel(budgetMonthKey);
  const md=userData.months[budgetMonthKey]||{};
  const grid=document.getElementById('budget-grid');
  grid.innerHTML=userData.categories.map(cat=>{
    const budVal=(md.budget||{})[cat.id]||0;
    const expVal=getMonthExpenseByCat(budgetMonthKey)[cat.id]||0;
    const pct=budVal>0?Math.min(Math.round(expVal/budVal*100),999):0;
    const barClass=pct<80?'ok':pct<100?'warn':'over';
    return `<div class="budget-cat-item">
      <div class="budget-cat-label">${cat.emoji} ${cat.name}</div>
      <input type="number" min="0" placeholder="0" value="${budVal||''}" id="bud-${cat.id}" class="budget-cat-item input">
      <div class="progress-bar-wrap"><div class="progress-bar ${barClass}" style="width:${Math.min(pct,100)}%"></div></div>
      <span class="progress-pct">${budVal>0?pct+'%':'-'}</span>
      <span style="font-size:0.78rem;color:var(--text-muted);min-width:80px;text-align:right;">${budVal>0?fmt(expVal)+' / '+fmt(budVal):fmt(expVal)}</span>
    </div>`;
  }).join('');
  renderBudgetRecapTable();
}

function saveBudget() {
  const md=getOrInitMonth(budgetMonthKey);
  userData.categories.forEach(cat=>{
    const inp=document.getElementById(`bud-${cat.id}`);
    if (inp) md.budget[cat.id]=+inp.value||0;
  });
  save(); renderBudgetPage(); showToast('Budget disimpan! 🎯');
}

function renderBudgetRecapTable() {
  const el=document.getElementById('budget-recap-table');
  const md=userData.months[budgetMonthKey]||{};
  const expByCat=getMonthExpenseByCat(budgetMonthKey);
  const rows=userData.categories.map(cat=>{
    const bud=(md.budget||{})[cat.id]||0;
    const exp=expByCat[cat.id]||0;
    const dev=bud-exp; const pct=bud>0?Math.round(exp/bud*100):'-';
    return `<tr>
      <td>${cat.emoji} ${cat.name}</td>
      <td class="num">${bud>0?fmt(bud):'—'}</td>
      <td class="num negative">${fmt(exp)}</td>
      <td class="num ${dev>=0?'positive':'negative'}">${bud>0?fmtSigned(dev):'—'}</td>
      <td class="num">${pct!=='-'?pct+'%':'—'}</td>
    </tr>`;
  }).join('');
  el.innerHTML=`<thead><tr><th>Kategori</th><th class="num">Budget</th><th class="num">Realisasi</th><th class="num">Deviasi</th><th class="num">%</th></tr></thead><tbody>${rows}</tbody>`;
}

// ============================================================
// SAVING PAGE
// ============================================================
function addSavingPlatform() {
  const name=document.getElementById('new-platform').value.trim();
  if (!name) { showToast('Nama platform tidak boleh kosong!'); return; }
  if (userData.platforms.includes(name)) { showToast('Platform sudah ada!'); return; }
  userData.platforms.push(name); save(); renderSavingPage();
  document.getElementById('new-platform').value='';
  showToast('Platform ditambahkan! 🏦');
}

function deleteSavingPlatform(name) {
  userData.platforms=userData.platforms.filter(p=>p!==name);
  save(); renderSavingPage();
}

function renderSavingPage() {
  // Platforms display
  const pd=document.getElementById('saving-platforms-display');
  pd.innerHTML=userData.platforms.map(p=>`
    <div class="cat-chip"><span class="cat-emoji">🏦</span><span>${p}</span>
      <button class="btn-del-cat" onclick="deleteSavingPlatform('${p}')">✕</button>
    </div>`).join('');

  // Table: rows=platforms, cols=months
  const sem=getActiveSemester(); if (!sem) return;
  const months=getSemesterMonths(sem);
  const thead=`<tr><th>Platform</th>${months.map(k=>`<th class="num">${MONTH_NAMES[parseMonthKey(k).month].slice(0,3)}</th>`).join('')}<th class="num">Total</th></tr>`;
  const rows=userData.platforms.map(plat=>{
    const cols=months.map(k=>{
      const val=(userData.months[k]?.saving||{})[plat]||'';
      return `<td><input class="editable-input" type="number" min="0" placeholder="0" value="${val}" onchange="updateSaving('${k}','${plat}',this.value)"></td>`;
    }).join('');
    const total=months.reduce((s,k)=>s+(+(userData.months[k]?.saving||{})[plat]||0),0);
    return `<tr><td><strong>${plat}</strong></td>${cols}<td class="num" style="color:var(--saving)">${fmt(total)}</td></tr>`;
  }).join('');
  const footCols=months.map(k=>`<td class="num" style="color:var(--saving)">${fmt(getMonthSaving(k))}</td>`).join('');
  const grandTotal=months.reduce((s,k)=>s+getMonthSaving(k),0);
  document.getElementById('saving-table').innerHTML=`<thead>${thead}</thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td>${footCols}<td class="num" style="color:var(--saving)">${fmt(grandTotal)}</td></tr></tfoot>`;
}

function updateSaving(monthKey, platform, value) {
  const md=getOrInitMonth(monthKey);
  md.saving[platform]=+value||0;
  save();
}

function saveSavings() { save(); showToast('Tabungan disimpan! 🏦'); renderSavingPage(); }

// ============================================================
// INVEST PAGE
// ============================================================
function addPortfolio() {
  const name=document.getElementById('new-portfolio').value.trim();
  if (!name) { showToast('Nama portofolio tidak boleh kosong!'); return; }
  if (userData.portfolios.includes(name)) { showToast('Portofolio sudah ada!'); return; }
  userData.portfolios.push(name); save(); renderInvestPage();
  document.getElementById('new-portfolio').value='';
  showToast('Portofolio ditambahkan! 📈');
}

function deletePortfolio(name) {
  userData.portfolios=userData.portfolios.filter(p=>p!==name);
  save(); renderInvestPage();
}

function renderInvestPage() {
  const pd=document.getElementById('invest-portfolios-display');
  pd.innerHTML=userData.portfolios.map(p=>`
    <div class="cat-chip"><span class="cat-emoji">📁</span><span>${p}</span>
      <button class="btn-del-cat" onclick="deletePortfolio('${p}')">✕</button>
    </div>`).join('');

  const sem=getActiveSemester(); if (!sem) return;
  const months=getSemesterMonths(sem);
  const thead=`<tr><th>Portofolio</th>${months.map(k=>`<th class="num">${MONTH_NAMES[parseMonthKey(k).month].slice(0,3)}</th>`).join('')}<th class="num">Total</th></tr>`;
  const rows=userData.portfolios.map(port=>{
    const cols=months.map(k=>{
      const val=(userData.months[k]?.invest||{})[port]||'';
      return `<td><input class="editable-input" type="number" min="0" placeholder="0" value="${val}" onchange="updateInvest('${k}','${port}',this.value)"></td>`;
    }).join('');
    const total=months.reduce((s,k)=>s+(+(userData.months[k]?.invest||{})[port]||0),0);
    return `<tr><td><strong>${port}</strong></td>${cols}<td class="num" style="color:var(--invest)">${fmt(total)}</td></tr>`;
  }).join('');
  const footCols=months.map(k=>`<td class="num" style="color:var(--invest)">${fmt(getMonthInvest(k))}</td>`).join('');
  const grandTotal=months.reduce((s,k)=>s+getMonthInvest(k),0);
  document.getElementById('invest-table').innerHTML=`<thead>${thead}</thead><tbody>${rows}</tbody><tfoot><tr class="total-row"><td><strong>TOTAL</strong></td>${footCols}<td class="num" style="color:var(--invest)">${fmt(grandTotal)}</td></tr></tfoot>`;
}

function updateInvest(mKey, portfolio, value) {
  const md=getOrInitMonth(mKey);
  md.invest[portfolio]=+value||0;
  save();
}

function saveInvestments() { save(); showToast('Investasi disimpan! 📈'); renderInvestPage(); }

// ============================================================
// CATEGORIES
// ============================================================
function addCategory() {
  const emoji=document.getElementById('cat-emoji').value.trim()||'🏷️';
  const name =document.getElementById('cat-name').value.trim();
  if (!name) { showToast('Nama kategori tidak boleh kosong!'); return; }
  userData.categories.push({id:uid(),emoji,name});
  save(); renderCategories();
  document.getElementById('cat-name').value='';
  document.getElementById('cat-emoji').value='';
  showToast('Kategori ditambahkan! 🎉');
}

function deleteCategory(id) {
  userData.categories=userData.categories.filter(c=>c.id!==id);
  save(); renderCategories();
  showToast('Kategori dihapus.');
}

function renderCategories() {
  const el=document.getElementById('cats-grid');
  if (!userData.categories.length) { el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏷️</div><p>Belum ada kategori.</p></div>`; return; }
  el.innerHTML=userData.categories.map(c=>`
    <div class="cat-chip">
      <span class="cat-emoji">${c.emoji}</span>
      <span>${c.name}</span>
      <button class="btn-del-cat" onclick="deleteCategory('${c.id}')">✕</button>
    </div>`).join('');
}

// ============================================================
// PROFILE
// ============================================================
function renderProfile() {
  const name=userData.name||'', username=currentUser;
  document.getElementById('profile-avatar-display').textContent=(name||username).charAt(0).toUpperCase();
  document.getElementById('profile-display-name').textContent=name||'(Belum diisi)';
  document.getElementById('profile-display-username').textContent='@'+username;
  document.getElementById('edit-name').value=name;
  document.getElementById('edit-username').value=username;
  const errEl=document.getElementById('profile-info-err'); if(errEl) errEl.style.display='none';
  ['pass-old','pass-new','pass-confirm'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('profile-total-txn').textContent=Object.values(userData.months||{}).reduce((s,m)=>s+(m.income||[]).length,0);
  document.getElementById('profile-total-cat').textContent=userData.categories.length;
  document.getElementById('profile-member-since').textContent=userData.joinDate?new Date(userData.joinDate).toLocaleDateString('id-ID',{month:'short',year:'numeric'}):'—';
}

function saveProfileInfo() {
  const newName=document.getElementById('edit-name').value.trim();
  const newUsername=document.getElementById('edit-username').value.trim().toLowerCase();
  const errEl=document.getElementById('profile-info-err');
  errEl.style.display='none';
  if (!newName)     { errEl.textContent='Nama tidak boleh kosong!'; errEl.style.display='block'; return; }
  if (!newUsername||newUsername.length<3) { errEl.textContent='Username minimal 3 karakter.'; errEl.style.display='block'; return; }
  if (!/^[a-z0-9_]+$/.test(newUsername)) { errEl.textContent='Username hanya huruf kecil, angka, dan underscore.'; errEl.style.display='block'; return; }
  if (newUsername!==currentUser) {
    const all=getAllData();
    if (all[newUsername]?.passwordHash) { errEl.textContent='Username sudah digunakan.'; errEl.style.display='block'; return; }
    userData.name=newName; userData.username=newUsername;
    const all2=getAllData(); all2[newUsername]=userData; delete all2[currentUser]; saveAllData(all2);
    currentUser=newUsername;
  } else { userData.name=newName; save(); }
  document.getElementById('header-username').textContent=`${newName} (@${currentUser})`;
  document.getElementById('profile-display-name').textContent=newName;
  document.getElementById('profile-display-username').textContent='@'+currentUser;
  document.getElementById('profile-avatar-display').textContent=newName.charAt(0).toUpperCase();
  showToast('Profil disimpan! ✅');
}

function saveNewPassword() {
  const oldPass=document.getElementById('pass-old').value;
  const newPass=document.getElementById('pass-new').value;
  const confirm=document.getElementById('pass-confirm').value;
  if (!oldPass||!newPass||!confirm) { showToast('Isi semua field kata sandi!'); return; }
  if (simpleHash(oldPass)!==userData.passwordHash) { showToast('Kata sandi lama salah!'); return; }
  if (newPass.length<6) { showToast('Kata sandi baru minimal 6 karakter!'); return; }
  if (newPass!==confirm) { showToast('Konfirmasi tidak cocok!'); return; }
  userData.passwordHash=simpleHash(newPass); save();
  ['pass-old','pass-new','pass-confirm'].forEach(id=>document.getElementById(id).value='');
  showToast('Kata sandi diubah! 🔒');
}

function togglePass(inputId, btn) {
  const input=document.getElementById(inputId);
  const isPass=input.type==='password';
  input.type=isPass?'text':'password';
  btn.textContent=isPass?'🙈':'👁';
}

function confirmClearData() {
  if (!confirm('Hapus semua data transaksi, tabungan, dan investasi? Akun tetap ada.')) return;
  userData.months={}; save(); showToast('Semua data dihapus.'); showPage('dashboard');
}

function confirmDeleteAccount() {
  if (!confirm('Hapus akun ini secara permanen? Semua data akan hilang.')) return;
  const all=getAllData(); delete all[currentUser]; saveAllData(all); doLogout();
}

// ============================================================
// EXPORT EXCEL
// ============================================================
function exportToExcel() {
  const sem=getActiveSemester(); if (!sem) { showToast('Pilih semester dulu!'); return; }
  const months=getSemesterMonths(sem);
  const wb=XLSX.utils.book_new();

  // Sheet per bulan
  months.forEach(k=>{
    const {month,year}=parseMonthKey(k);
    const sheetName=MONTH_NAMES[month].slice(0,4).toUpperCase();
    const md=userData.months[k]||{};
    const inc=getMonthIncome(k), exp=getMonthExpense(k);
    const expByCat=getMonthExpenseByCat(k);
    const rows=[];

    rows.push([MONTH_NAMES[month].toUpperCase()+' '+year,'','','EXPENSE PER PERIOD (7 DAYS)']);
    rows.push(['MONTHLY BUDGETING','','','EXPENSE PERIODE 1 (1-7)','','EXPENSE PERIODE 2 (8-14)','','EXPENSE PERIODE 3 (15-21)']);
    rows.push(['INCOME',inc,'','CATEGORY','AMOUNT','CATEGORY','AMOUNT','CATEGORY','AMOUNT']);
    userData.categories.forEach((cat,i)=>{
      const p1=(md.expenses?.[cat.id]?.p1)||0;
      const p2=(md.expenses?.[cat.id]?.p2)||0;
      const p3=(md.expenses?.[cat.id]?.p3)||0;
      rows.push([i===0?'EXPENSE ALL':'',(i===0?exp:''),'',cat.name,p1,cat.name,p2,cat.name,p3]);
    });
    rows.push(['SISA',inc-exp]);
    rows.push([]);
    rows.push(['','','','EXPENSE PERIODE 4 (22-28)','','EXPENSE PERIODE 5 (29-31)','','EXPENSE RECAP']);
    rows.push(['','','','CATEGORY','AMOUNT','CATEGORY','AMOUNT','CATEGORY','AMOUNT']);
    userData.categories.forEach(cat=>{
      const p4=(md.expenses?.[cat.id]?.p4)||0;
      const p5=(md.expenses?.[cat.id]?.p5)||0;
      const recap=expByCat[cat.id]||0;
      rows.push(['','','',cat.name,p4,cat.name,p5,cat.name,recap]);
    });
    rows.push(['','','','TOTAL',PERIODS.slice(3).reduce((s,p)=>s+(userData.categories.reduce((ss,cat)=>ss+(+(md.expenses?.[cat.id]?.[`p${p.id}`])||0),0)),0),'TOTAL',0,'TOTAL',exp]);
    rows.push([]);
    rows.push(['SAVING']);
    rows.push(['ITEM','AMOUNT']);
    userData.platforms.forEach(plat=>{ rows.push([plat,(md.saving||{})[plat]||0]); });
    rows.push(['TOTAL',getMonthSaving(k)]);
    rows.push([]);
    rows.push(['INCOME']);
    rows.push(['CATEGORY','AMOUNT']);
    (md.income||[]).forEach(t=>{ rows.push([t.name,t.amount,t.note||'']); });
    rows.push(['TOTAL',inc]);

    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:18},{wch:16},{wch:4},{wch:18},{wch:16},{wch:18},{wch:16},{wch:18},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws,sheetName);
  });

  // Semester recap sheet
  const recapRows=[];
  recapRows.push([`REKAP ${sem.name.toUpperCase()}`]);
  recapRows.push(['EXPENSE RECAP']);
  recapRows.push(['CATEGORY','AMOUNT']);
  months.forEach(k=>{ const {month}=parseMonthKey(k); recapRows.push([MONTH_NAMES[month].toUpperCase(),getMonthExpense(k)]); });
  recapRows.push(['TOTAL',months.reduce((s,k)=>s+getMonthExpense(k),0)]);
  recapRows.push([]);
  recapRows.push(['TABUNGAN']);
  recapRows.push(['ITEM','AMOUNT']);
  months.forEach(k=>{ const {month}=parseMonthKey(k); recapRows.push([MONTH_NAMES[month],getMonthSaving(k)]); });
  recapRows.push(['TOTAL',months.reduce((s,k)=>s+getMonthSaving(k),0)]);
  recapRows.push([]);
  recapRows.push(['INVESTASI / RDPU']);
  recapRows.push(['PORTOFOLIO',...months.map(k=>MONTH_NAMES[parseMonthKey(k).month].slice(0,3)),'TOTAL']);
  userData.portfolios.forEach(port=>{
    const vals=months.map(k=>(userData.months[k]?.invest||{})[port]||0);
    recapRows.push([port,...vals,vals.reduce((s,v)=>s+v,0)]);
  });
  recapRows.push(['TOTAL',...months.map(k=>getMonthInvest(k)),months.reduce((s,k)=>s+getMonthInvest(k),0)]);

  const wsRecap=XLSX.utils.aoa_to_sheet(recapRows);
  wsRecap['!cols']=[{wch:20},...months.map(()=>({wch:14})),{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsRecap,sem.name.slice(0,15));

  XLSX.writeFile(wb,`Dompetku_${sem.name.replace(/\s+/g,'_')}.xlsx`);
  showToast('Export berhasil! 📥');
}

// ============================================================
// INIT
// ============================================================
document.getElementById('inc-date').value=today();