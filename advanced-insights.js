/* ============================================================
   Advanced Insights — page logic
   Renders Chart.js charts + interactive range pills + heatmap
   ============================================================ */
(function(){
  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    if (window.lucide) lucide.createIcons();
    drawGauge(94);
    renderLaborTrend('7D');
    renderSPLH('7D');
    renderComplianceMix();
    renderForecastVsActual();
    renderHeatmap();
    wireRangePills();
  }

  // ---------------- Gauge ----------------
  function drawGauge(value) {
    const svg = document.getElementById('aiGauge');
    if (!svg) return;
    const r = 100;
    const c = 2 * Math.PI * r;
    const fillLen = (value / 100) * c;
    const fillEl = svg.querySelector('.ai-gauge-fill');
    fillEl.setAttribute('stroke-dasharray', `${fillLen} ${c}`);
    document.getElementById('aiGaugeNum').textContent = value;
  }

  // ---------------- Range pills ----------------
  function wireRangePills() {
    document.querySelectorAll('.ai-range').forEach(group => {
      group.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        group.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        const range = btn.dataset.range;
        const chartKey = group.dataset.chart;
        if (chartKey === 'labor') renderLaborTrend(range);
        else if (chartKey === 'splh') renderSPLH(range);
        else if (chartKey === 'forecast') renderForecastVsActual(range);
      });
    });
  }

  // ---------------- Data helpers ----------------
  function dateLabels(n) {
    const base = new Date(2026, 4, 20);   // May 20, 2026
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      out.push((d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getDate().toString().padStart(2,'0'));
    }
    return out;
  }
  function weekLabels(n) { return Array.from({length:n}, (_, i) => 'W' + (i+1)); }
  function monthLabels(n) { return ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'].slice(-n); }
  function labelsForRange(range) {
    if (range === '7D')  return { labels: dateLabels(7),  n: 7 };
    if (range === '14D') return { labels: dateLabels(14), n: 14 };
    if (range === '4W')  return { labels: weekLabels(4),  n: 4 };
    if (range === '3M')  return { labels: monthLabels(3), n: 3 };
    if (range === '6M')  return { labels: monthLabels(6), n: 6 };
    return { labels: dateLabels(7), n: 7 };
  }
  function seededRand(s) { const x = (s * 9301 + 49297) % 233280; return x / 233280; }
  function scale(values, target, seed) {
    if (target === values.length) return values.slice();
    const out = [];
    if (target > values.length) {
      for (let i = 0; i < target; i++) {
        const v = values[i % values.length];
        out.push(roundLike(v, v * (1 + (seededRand(seed + i) - 0.5) * 0.18)));
      }
      return out;
    }
    const gs = values.length / target;
    for (let i = 0; i < target; i++) {
      let s = 0, c = 0;
      for (let j = Math.floor(i*gs); j < Math.floor((i+1)*gs); j++) { s += values[j]; c++; }
      out.push(roundLike(values[0], (s/c) * (1 + i*0.04) * (1 + (seededRand(seed+i)-0.5)*0.08)));
    }
    return out;
  }
  function roundLike(sample, v) {
    if (Number.isInteger(sample)) return Math.max(0, Math.round(v));
    return Math.max(0, Math.round(v * 10) / 10);
  }

  function themeColors() {
    const dark = document.documentElement.classList.contains('dark') ||
                 document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      dark,
      txt:   dark ? '#888EA0' : '#6E7488',
      grid:  dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,18,40,0.06)',
      tipBg: dark ? '#1B1D29' : '#FFFFFF',
      tipTx: dark ? '#F2F3F7' : '#0E0F1A',
      tipSub:dark ? '#B5B9C7' : '#6E7488',
      tipBd: dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,18,40,0.10)'
    };
  }
  function baseOpts(t, fmt) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: t.txt, font: { size: 11, weight: '600' }, usePointStyle: true, boxWidth: 7, padding: 12 } },
        tooltip: { backgroundColor: t.tipBg, titleColor: t.tipSub, bodyColor: t.tipTx, borderColor: t.tipBd, borderWidth: 1, cornerRadius: 8, padding: 10 }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: t.txt, font: { size: 11, weight: 500 } } },
        y: { beginAtZero: false, grid: { color: t.grid, drawTicks: false }, border: { display: false }, ticks: { color: t.txt, font: { size: 11, weight: 500 }, callback: fmt } }
      }
    };
  }

  // ---------------- Labor trend ----------------
  let laborChart;
  function renderLaborTrend(range) {
    const { n, labels } = labelsForRange(range);
    const ctx = document.getElementById('chartLabor').getContext('2d');
    if (laborChart) laborChart.destroy();
    const t = themeColors();
    const scheduled = scale([18.2, 18.5, 18.1, 18.4, 19.0, 18.8, 18.5], n, 11);
    const actual    = scale([18.8, 19.0, 18.5, 18.9, 19.4, 19.2, 18.9], n, 23);
    const target    = scheduled.map(()=>18.0);
    laborChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Actual', data: actual, borderColor: '#5B5BD6', backgroundColor: 'rgba(91,91,214,0.12)', borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: '#fff', pointBorderColor: '#5B5BD6', pointBorderWidth: 2, pointRadius: 3.5 },
        { label: 'Scheduled', data: scheduled, borderColor: '#F2994A', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.4, borderDash: [5, 5], pointBackgroundColor: '#fff', pointBorderColor: '#F2994A', pointBorderWidth: 2, pointRadius: 3.5 },
        { label: 'Target', data: target, borderColor: 'rgba(31,174,92,0.85)', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [2, 3], pointRadius: 0, tension: 0 }
      ]},
      options: baseOpts(t, v => v + '%')
    });
  }

  // ---------------- SPLH ----------------
  let splhChart;
  function renderSPLH(range) {
    const { n, labels } = labelsForRange(range);
    const ctx = document.getElementById('chartSPLH').getContext('2d');
    if (splhChart) splhChart.destroy();
    const t = themeColors();
    const splh   = scale([62.8, 63.2, 61.9, 60.5, 58.1, 59.4, 60.9], n, 37);
    const target = splh.map(()=>60.2);
    splhChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Actual SPLH', data: splh, backgroundColor: '#7C3AED', borderRadius: 6, barThickness: 'flex', maxBarThickness: 38 },
        { label: 'Target', type: 'line', data: target, borderColor: '#F2994A', backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, tension: 0 }
      ]},
      options: baseOpts(t, v => '$' + v)
    });
  }

  // ---------------- Forecast vs Actual sales ----------------
  let fcChart;
  function renderForecastVsActual(range) {
    const r = range || '14D';
    const { n, labels } = labelsForRange(r);
    const ctx = document.getElementById('chartForecast').getContext('2d');
    if (fcChart) fcChart.destroy();
    const t = themeColors();
    const fc = scale([11200, 10800, 11400, 12300, 13980, 12410, 9100], n, 47);
    const ac = scale([10900, 10500, 11100, 12500, 14150, 12700, 9300], n, 53);
    fcChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Forecast', data: fc, backgroundColor: 'rgba(91,91,214,0.45)', borderRadius: 6, barThickness: 'flex', maxBarThickness: 26 },
        { label: 'Actual', data: ac, backgroundColor: '#5B5BD6', borderRadius: 6, barThickness: 'flex', maxBarThickness: 26 }
      ]},
      options: baseOpts(t, v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'K' : v))
    });
  }

  // ---------------- Compliance pie ----------------
  let compChart;
  function renderComplianceMix() {
    const ctx = document.getElementById('chartCompliance').getContext('2d');
    if (compChart) compChart.destroy();
    const t = themeColors();
    compChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Meal Break', 'Minor Hours', 'OT Threshold', 'Rest Period', 'No-Show'],
        datasets: [{
          data: [35, 25, 20, 12, 8],
          backgroundColor: ['#E5484D', '#F2994A', '#7C3AED', '#5B5BD6', '#9DA3B3'],
          borderColor: t.dark ? '#15161F' : '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: t.txt, font: { size: 11, weight: '600' }, usePointStyle: true, boxWidth: 7, padding: 10 } },
          tooltip: { backgroundColor: t.tipBg, titleColor: t.tipSub, bodyColor: t.tipTx, borderColor: t.tipBd, borderWidth: 1, cornerRadius: 8, padding: 10,
                     callbacks: { label: c => ' ' + c.label + ': ' + c.raw + '%' } }
        }
      }
    });
  }

  // ---------------- Heatmap (coverage by hour, Mon-Sun) ----------------
  function renderHeatmap() {
    const wrap = document.getElementById('heatmap');
    if (!wrap) return;
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    // 24 hours * 7 days. Values: 0..5 for coverage band; 'risk'/'risk2' for at-risk cells
    // Mimic morning ramp-up, lunch + dinner peaks, late close
    const patterns = {
      base: [0,0,0,0,0,1,2,3,4,4,4,5,5,4,3,3,3,4,5,5,4,3,2,1],
      fri:  [0,0,0,0,0,1,2,3,4,4,4,5,5,4,4,4,4,5,5,5,4,3,2,1],
      sat:  [0,0,0,0,0,1,2,3,3,4,4,5,5,4,3,3,3,4,5,5,4,3,2,1],
      sun:  [0,0,0,0,0,0,1,2,3,3,3,4,4,3,3,2,2,3,4,3,2,1,0,0]
    };
    const risks = {
      'Tue-22': 'risk2',   // late meal break
      'Wed-15': 'risk2',
      'Thu-19': 'risk',    // overstaffed warning
      'Fri-12': 'risk',
      'Sat-22': 'risk2'
    };

    // Header
    const hours = Array.from({length: 24}, (_, i) => {
      const h = i % 12 === 0 ? 12 : i % 12;
      return h + (i < 12 ? 'A' : 'P');
    });
    let html = '<div class="ai-heat-th"></div>';
    hours.forEach(h => { html += `<div class="ai-heat-th">${h}</div>`; });
    days.forEach(d => {
      html += `<div class="ai-heat-row-label">${d}</div>`;
      const pat = d === 'Fri' ? patterns.fri : d === 'Sat' ? patterns.sat : d === 'Sun' ? patterns.sun : patterns.base;
      pat.forEach((v, i) => {
        const key = d + '-' + i;
        const final = risks[key] || v;
        const title = (d + ' ' + hours[i] + ' — ' + (typeof final === 'string'
          ? (final === 'risk' ? 'Overstaffed' : 'Late meal-break risk')
          : 'Coverage: ' + final + '/5'));
        html += `<div class="ai-heat-cell" data-v="${final}" title="${title}"></div>`;
      });
    });

    wrap.innerHTML = html;
  }

  // Re-render charts on theme change
  const obs = new MutationObserver(() => {
    const r1 = document.querySelector('.ai-range[data-chart="labor"]    .active')?.dataset.range || '7D';
    const r2 = document.querySelector('.ai-range[data-chart="splh"]     .active')?.dataset.range || '7D';
    const r3 = document.querySelector('.ai-range[data-chart="forecast"] .active')?.dataset.range || '14D';
    renderLaborTrend(r1);
    renderSPLH(r2);
    renderComplianceMix();
    renderForecastVsActual(r3);
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

})();
