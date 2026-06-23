
// ── Config ────────────────────────────────────────────────────────────────────
const API_URL = 'https://myfxbook-api.YOUR_SUBDOMAIN.workers.dev/';
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// ── Chart instance ────────────────────────────────────────────────────────────
let equityChart = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = (n, decimals = 2) => parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtUSD = n => '$' + fmt(n, 2);
const fmtPct = n => (parseFloat(n) >= 0 ? '+' : '') + fmt(n, 2) + '%';

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDuration(open, close) {
  if (!open || !close) return '—';
  const diff = new Date(close) - new Date(open);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Intraday';
  return days + (days === 1 ? ' day' : ' days');
}

// ── Render functions ──────────────────────────────────────────────────────────
function renderKPIs(a) {
  $('hero-balance').textContent = fmtUSD(a.balance);
  $('hero-gain').textContent    = fmtPct(a.gain);
  $('hero-trades').textContent  = a.trades;

  $('kpi-balance').textContent     = fmtUSD(a.balance);
  $('kpi-balance-sub').textContent = '↑ from ' + fmtUSD(a.deposits);
  $('kpi-gain').textContent        = fmtPct(a.gain);
  $('kpi-gain-sub').textContent    = 'Abs: ' + fmtUSD(a.absGain);
  $('kpi-winrate').textContent     = a.winRate + '%';
  $('kpi-winrate-sub').textContent = a.wonTrades + ' of ' + a.trades + ' wins';
  $('kpi-drawdown').textContent    = a.maxDrawdown + '%';
  $('kpi-pf').textContent          = a.profitFactor;

  const daily = parseFloat(a.dailyGain);
  $('kpi-daily').textContent     = fmtPct(daily);
  $('kpi-daily').className       = 'kpi-value ' + (daily >= 0 ? 'green' : 'red');
  $('kpi-monthly').textContent   = 'Monthly: ' + fmtPct(a.monthlyGain);

  $('dw-deposits').textContent    = fmtUSD(a.deposits);
  $('dw-withdrawals').textContent = fmtUSD(a.withdrawals);
  $('dw-netprofit').textContent   = fmtUSD(parseFloat(a.balance) - parseFloat(a.deposits) + parseFloat(a.withdrawals));
  $('dw-equity').textContent      = fmtUSD(a.equity);
}

function renderEquityChart(curve) {
  const labels = curve.map(p => p.label);
  const values = curve.map(p => p.value);
  const ctx = $('equityChart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(201,168,76,0.20)');
  grad.addColorStop(1, 'rgba(201,168,76,0)');

  if (equityChart) equityChart.destroy();
  equityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#C9A84C', borderWidth: 2.5,
        backgroundColor: grad, tension: 0.42, fill: true,
        pointBackgroundColor: '#C9A84C', pointBorderColor: '#05080F',
        pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0D1424',
          borderColor: 'rgba(201,168,76,0.3)', borderWidth: 1,
          titleColor: '#8A9BB0', bodyColor: '#F5F0E8',
          bodyFont: { family: 'Manrope', size: 13, weight: '500' },
          padding: 14,
          callbacks: { label: c => ' $' + c.raw.toLocaleString() }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5A6B7E', font: { family: 'Manrope', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5A6B7E', font: { family: 'Manrope', size: 11 }, callback: v => '$' + (v/1000).toFixed(1) + 'k' } }
      }
    }
  });
  $('equity-tag').textContent = labels[0] + ' – ' + labels[labels.length - 1];
}

function renderMonthly(monthly) {
  const grid = $('monthly-grid');
  grid.innerHTML = '';
  monthly.forEach(m => {
    const hasData = m.gain !== null;
    const val = hasData ? parseFloat(m.gain) : null;
    const tile = document.createElement('div');
    tile.className = 'month-tile' + (hasData ? (val >= 0 ? ' positive' : ' negative') : '');
    tile.innerHTML = `
      <div class="month-name">${m.name}</div>
      <div class="month-pct ${hasData ? (val >= 0 ? 'pos' : 'neg') : 'na'}">
        ${hasData ? fmtPct(val) : '—'}
      </div>`;
    grid.appendChild(tile);
  });
}

function renderOpenTrades(openTrades) {
  const grid = $('open-trades-grid');
  $('open-trades-tag').textContent = openTrades.length + ' Open';
  if (!openTrades.length) {
    grid.innerHTML = '<div class="no-open">No open positions at the moment.</div>';
    return;
  }
  grid.innerHTML = '';
  openTrades.forEach(t => {
    const profit = parseFloat(t.profit);
    const card = document.createElement('div');
    card.className = 'open-trade-card';
    card.innerHTML = `
      <div class="otc-top">
        <span class="otc-pair">${t.pair}</span>
        <span class="otc-profit ${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : ''}${fmtUSD(profit)}</span>
      </div>
      <div class="otc-meta">
        <span class="type-pill ${t.type.toLowerCase() === 'buy' ? 'buy' : 'sell'}">${t.type}</span>
        <span class="otc-detail">${t.lots} lots</span>
        <span class="otc-detail">@ ${t.openPrice}</span>
        <span class="otc-detail">Now: ${t.currentPrice}</span>
      </div>
      <div class="otc-meta">
        <span class="otc-detail">Opened: ${formatDate(t.openTime)}</span>
        <span class="otc-detail">Swap: ${t.swap}</span>
      </div>`;
    grid.appendChild(card);
  });
}

function renderTrades(trades) {
  // Mobile cards
  const mobile = $('trade-cards-mobile');
  mobile.innerHTML = '';
  trades.slice(0, 10).forEach(t => {
    const profit = parseFloat(t.profit);
    const dur = getDuration(t.openTime, t.closeTime);
    const card = document.createElement('div');
    card.className = 'trade-card';
    card.innerHTML = `
      <div class="tc-top"><span class="tc-date">${formatDate(t.closeTime)}</span><span class="tc-pair">${t.pair}</span></div>
      <div class="tc-result ${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : ''}${fmtUSD(profit)}</div>
      <div class="tc-bottom">
        <span class="type-pill ${t.type.toLowerCase() === 'buy' ? 'buy' : 'sell'}">${t.type}</span>
        <span class="tc-dur">${dur}</span>
      </div>
      <div class="tc-pill-wrap"></div>`;
    mobile.appendChild(card);
  });

  // Desktop table
  const tbody = $('trade-table-body');
  tbody.innerHTML = '';
  trades.forEach(t => {
    const profit = parseFloat(t.profit);
    const dur = getDuration(t.openTime, t.closeTime);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(t.closeTime)}</td>
      <td>${t.pair}</td>
      <td><span class="type-pill ${t.type.toLowerCase() === 'buy' ? 'buy' : 'sell'}">${t.type}</span></td>
      <td><span class="dur">${dur}</span></td>
      <td>${t.pips}</td>
      <td class="${profit >= 0 ? 'result-pos' : 'result-neg'}">${profit >= 0 ? '+' : ''}${fmtUSD(profit)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderLastUpdated(iso) {
  const d = new Date(iso);
  $('last-updated-time').textContent = d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Main data loader ──────────────────────────────────────────────────────────
async function loadData() {
  $('error-banner').style.display = 'none';

  try {
    const res  = await fetch(API_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.message);

    renderKPIs(data.account);
    if (data.equityCurve.length) renderEquityChart(data.equityCurve);
    renderMonthly(data.monthly);
    renderOpenTrades(data.openTrades);
    renderTrades(data.trades);
    renderLastUpdated(data.updatedAt);

  } catch (err) {
    console.error('Load error:', err);
    $('error-banner').style.display = 'block';
  } finally {
    // Hide loading overlay
    const overlay = $('loading-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 700);

    // Trigger reveal animations
    document.querySelectorAll('.reveal').forEach(el => {
      setTimeout(() => el.classList.add('visible'), 100);
    });
  }
}

// ── Scroll reveal ─────────────────────────────────────────────────────────────
const obs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 60);
      obs.unobserve(e.target);
    }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
setInterval(loadData, AUTO_REFRESH_MS); // auto-refresh every 5 minutes
