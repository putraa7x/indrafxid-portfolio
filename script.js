
// ── Config ────────────────────────────────────────────────────────────────────
const API_URL = 'https://indrafxidportfoliof690.indranovita572.workers.dev/';
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ── Chart instance ────────────────────────────────────────────────────────────
let equityChart = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fmt = (n, decimals = 2) =>
  parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Selalu tanpa desimal, tanpa tanda
const fmtAbs = n => '$' + Math.round(Math.abs(parseFloat(n))).toLocaleString('en-US');

// Dengan tanda +/- di depan $
const fmtUSD = n => {
  const num = parseFloat(n);
  if (num < 0) return '-' + fmtAbs(num);
  return fmtAbs(num);
};

// Dengan tanda + untuk positif
const fmtUSDSigned = n => {
  const num = parseFloat(n);
  if (num > 0) return '+' + fmtAbs(num);
  if (num < 0) return '-' + fmtAbs(num);
  return fmtAbs(num);
};

const fmtPct = n => (parseFloat(n) >= 0 ? '+' : '') + fmt(n, 2) + '%';

function formatDate(str) {
  if (!str) return '—';
  let d;
  if (str.includes('/')) {
    const [datePart] = str.split(' ');
    const [mm, dd, yyyy] = datePart.split('/');
    d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  } else {
    d = new Date(str);
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDuration(open, close) {
  if (!open || !close) return '—';
  const parseMyDateTime = s => {
    const [datePart, timePart] = s.split(' ');
    const [mm, dd, yyyy] = datePart.split('/');
    const [hh, min] = (timePart || '00:00').split(':');
    return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(min));
  };
  const diff = parseMyDateTime(close) - parseMyDateTime(open);
  const totalMins = Math.floor(diff / 60000);
  const days  = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins  = totalMins % 60;
  if (days >= 1) {
    if (hours === 0) return days + 'd';
    return days + 'd ' + hours + 'h';
  }
  if (hours >= 1) return hours + 'h ' + mins + 'm';
  return mins + 'm';
}

// ── Render functions ──────────────────────────────────────────────────────────
function renderKPIs(a) {
  $('hero-balance').textContent  = fmtUSD(a.balance);
  $('hero-gain').textContent     = fmtPct(a.gain);
  $('hero-drawdown').textContent = a.drawdown + '%';

  const isDemo = a.demo;
  $('badge-dot').className     = 'badge-dot' + (isDemo ? ' demo' : '');
  $('badge-label').textContent = isDemo ? 'Demo Account' : 'Live Account';

  $('kpi-balance').textContent     = fmtUSD(a.balance);
  $('kpi-balance-sub').textContent = 'from ' + fmtUSD(a.deposits);

  const gain = parseFloat(a.gain);
  $('kpi-gain').textContent     = fmtPct(gain);
  $('kpi-gain').className       = 'kpi-value ' + (gain >= 0 ? 'green' : 'red');
  $('kpi-gain-sub').textContent = 'Abs: ' + fmtUSDSigned(a.profit);

  $('kpi-winrate').textContent     = (a.winRate ?? '—') + '%';
  $('kpi-winrate-sub').textContent = 'From ' + (a.trades ?? 0) + ' trades';

  $('kpi-drawdown').textContent = a.drawdown + '%';
  $('kpi-pf').textContent       = a.profitFactor;

  const daily = parseFloat(a.dailyGain);
  $('kpi-daily').textContent   = fmtPct(daily);
  $('kpi-daily').className     = 'kpi-value ' + (daily >= 0 ? 'green' : 'red');
  $('kpi-monthly').textContent = 'Monthly: ' + fmtPct(a.monthlyGain);

  $('dw-deposits').textContent    = fmtUSD(a.deposits);
  $('dw-withdrawals').textContent = fmtUSD(a.withdrawals);

  const profit = parseFloat(a.profit);
  $('dw-netprofit').textContent = fmtUSDSigned(profit);
  $('dw-netprofit').className   = 'kpi-value ' + (profit >= 0 ? 'green' : 'red');

  $('dw-equity').textContent = fmtUSD(a.equity);
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
          callbacks: { label: c => ' ' + fmtUSD(c.raw) }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5A6B7E', font: { family: 'Manrope', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5A6B7E', font: { family: 'Manrope', size: 11 }, callback: v => fmtUSD(v) } }
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
    tile.innerHTML =
      '<div class="month-name">' + m.name + '</div>' +
      '<div class="month-pct ' + (hasData ? (val >= 0 ? 'pos' : 'neg') : 'na') + '">' +
      (hasData ? fmtPct(val) : '—') + '</div>';
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
    const isBuy = String(t.type).toLowerCase() === 'buy' || t.type === '0';
    const card = document.createElement('div');
    card.className = 'open-trade-card';
    card.innerHTML =
      '<div class="otc-top">' +
        '<span class="otc-pair">' + t.pair + '</span>' +
        '<span class="otc-profit ' + (profit >= 0 ? 'pos' : 'neg') + '">' + fmtUSDSigned(profit) + '</span>' +
      '</div>' +
      '<div class="otc-meta">' +
        '<span class="type-pill ' + (isBuy ? 'buy' : 'sell') + '">' + t.type + '</span>' +
        '<span class="otc-detail">' + t.lots + ' lots</span>' +
        '<span class="otc-detail">@ ' + t.openPrice + '</span>' +
      '</div>' +
      '<div class="otc-meta">' +
        '<span class="otc-detail">Opened: ' + formatDate(t.openTime) + '</span>' +
        '<span class="otc-detail">Swap: ' + (t.swap ?? 0) + '</span>' +
        '<span class="otc-detail">Pips: ' + (t.pips ?? '—') + '</span>' +
      '</div>';
    grid.appendChild(card);
  });
}

function calcGain(profit, deposits) {
  if (!deposits || deposits === 0) return null;
  return ((profit / deposits) * 100).toFixed(2);
}

function drawMiniChart(canvas, profit, pips) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const isPos = profit >= 0;

  // Warna kayak Myfxbook: biru untuk profit, pink/merah untuk loss
  const color    = isPos ? '#6B8CFF' : '#FF6B8C';
  const colorEnd = isPos ? '#4A6FE8' : '#E84A6F';
  const fillTop  = isPos ? 'rgba(107,140,255,0.25)' : 'rgba(255,107,140,0.25)';
  const fillBot  = isPos ? 'rgba(107,140,255,0.02)' : 'rgba(255,107,140,0.02)';

  // Generate natural-looking points dengan sedikit noise
  const numPoints = 8;
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    // Trend utama + noise kecil
    const trend = isPos ? (1 - t) * 0.75 + t * 0.1 : (1 - t) * 0.2 + t * 0.85;
    const noises = [0, 0.08, -0.06, 0.1, -0.04, 0.07, -0.05, 0];
    const y = Math.max(0.05, Math.min(0.95, trend + noises[i])) * h;
    points.push({ x: (t * w), y });
  }

  ctx.clearRect(0, 0, w, h);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fillTop);
  grad.addColorStop(1, fillBot);

  ctx.beginPath();
  ctx.moveTo(points[0].x, h);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cp = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 };
    ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, cp.x, cp.y);
  }
  ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
  ctx.lineTo(points[points.length-1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line gradient
  const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
  lineGrad.addColorStop(0, color);
  lineGrad.addColorStop(1, colorEnd);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cp = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 };
    ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, cp.x, cp.y);
  }
  ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Dot merah/hijau di akhir
  const last = points[points.length - 1];
  const dotColor = isPos ? '#22C55E' : '#EF4444';
  ctx.beginPath();
  ctx.arc(last.x - 1, last.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();
}

function renderTrades(trades) {
  if (!trades || !trades.length) {
    $('trade-cards-mobile').innerHTML = '<div class="no-open">No trade history yet.</div>';
    $('trade-table-body').innerHTML = '<tr><td colspan="8" style="text-align:center;color:#5A6B7E;">No trade history yet.</td></tr>';
    return;
  }

  const mobile = $('trade-cards-mobile');
  mobile.innerHTML = '';
  trades.slice(0, 10).forEach(t => {
    const profit  = parseFloat(t.profit);
    const pips    = parseFloat(t.pips ?? 0);
    const isBuy   = String(t.type).toLowerCase() === 'buy' || t.type === '0';
    const isPos   = profit >= 0;
    const dur     = getDuration(t.openTime, t.closeTime);
    const gainPct = profit >= 0 ? '+' + Math.abs(profit / 55).toFixed(2) + '%' : '-' + Math.abs(profit / 55).toFixed(2) + '%';

    const card = document.createElement('div');
    card.className = 'trade-card';
    card.innerHTML =
      '<div class="tc-header">' +
        '<div class="tc-pair-wrap">' +
          '<span class="tc-pair">' + t.pair + '</span>' +
          '<span class="type-pill ' + (isBuy ? 'buy' : 'sell') + '">' + t.type + '</span>' +
        '</div>' +
        '<div class="tc-result ' + (isPos ? 'pos' : 'neg') + '">' + fmtUSDSigned(profit) + '</div>' +
      '</div>' +

      '<div class="tc-dates">' +
        '<div class="tc-date-item"><span class="tc-date-label">Open</span><span class="tc-date-val">' + t.openTime + '</span></div>' +
        '<div class="tc-date-item"><span class="tc-date-label">Close</span><span class="tc-date-val">' + t.closeTime + '</span></div>' +
      '</div>' +

      '<div class="tc-details">' +
        '<div class="tc-detail-item"><span class="tc-dl">Lots</span><span class="tc-dv">' + t.lots + '</span></div>' +
        '<div class="tc-detail-item"><span class="tc-dl">Open</span><span class="tc-dv">' + t.openPrice + '</span></div>' +
        '<div class="tc-detail-item"><span class="tc-dl">Close</span><span class="tc-dv">' + t.closePrice + '</span></div>' +
        '<div class="tc-detail-item"><span class="tc-dl">Pips</span><span class="tc-dv ' + (pips >= 0 ? 'pos' : 'neg') + '">' + (pips >= 0 ? '+' : '') + pips + '</span></div>' +
        '<div class="tc-detail-item"><span class="tc-dl">Duration</span><span class="tc-dv">' + getDuration(t.openTime, t.closeTime) + '</span></div>' +
        '<div class="tc-detail-item"><span class="tc-dl">Gain</span><span class="tc-dv ' + (isPos ? 'pos' : 'neg') + '">' + gainPct + '</span></div>' +
      '</div>' +

      '<div class="tc-bottom-row">' +
        '<canvas class="tc-chart" data-profit="' + profit + '"></canvas>' +
      '</div>';

    mobile.appendChild(card);
  });

  // Draw mini charts
  document.querySelectorAll('.tc-chart').forEach(canvas => {
    drawMiniChart(canvas, parseFloat(canvas.dataset.profit), 0);
  });

  const tbody = $('trade-table-body');
  tbody.innerHTML = '';
  trades.forEach(t => {
    const profit = parseFloat(t.profit);
    const pips   = parseFloat(t.pips ?? 0);
    const isBuy  = String(t.type).toLowerCase() === 'buy' || t.type === '0';
    const isPos  = profit >= 0;
    const gainPct = (isPos ? '+' : '-') + Math.abs(profit / 55).toFixed(2) + '%';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + t.openTime + '</td>' +
      '<td>' + t.closeTime + '</td>' +
      '<td>' + t.pair + '</td>' +
      '<td><span class="type-pill ' + (isBuy ? 'buy' : 'sell') + '">' + t.type + '</span></td>' +
      '<td>' + t.lots + '</td>' +
      '<td class="' + (pips >= 0 ? 'result-pos' : 'result-neg') + '">' + (pips >= 0 ? '+' : '') + pips + '</td>' +
      '<td>' + t.openPrice + ' → ' + t.closePrice + '</td>' +
      '<td class="' + (isPos ? 'result-pos' : 'result-neg') + '">' + fmtUSDSigned(profit) + '</td>' +
      '<td class="' + (isPos ? 'result-pos' : 'result-neg') + '">' + gainPct + '</td>' +
      '<td>' + getDuration(t.openTime, t.closeTime) + '</td>';
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
    if (data.equityCurve && data.equityCurve.length) renderEquityChart(data.equityCurve);
    renderMonthly(data.monthly);
    renderOpenTrades(data.openTrades || []);
    renderTrades(data.trades || []);
    renderLastUpdated(data.updatedAt);

  } catch (err) {
    console.error('Load error:', err);
    $('error-banner').style.display = 'block';
  } finally {
    const overlay = $('loading-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 700);
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
setInterval(loadData, AUTO_REFRESH_MS);
    
