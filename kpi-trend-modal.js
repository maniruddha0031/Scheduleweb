/* ============================================================
   Tasksy KPI Trend Modal — runtime
   Replaces openTrendModal / closeTrendModal / switchTrend / etc.
   Pure JS, no React.
   ============================================================ */
(function(){

  // ---------- KPI catalog ----------
  function dateLabels(n) {
    // ending Sun 02/22/2026 (the mock week-end)
    const base = new Date(2026, 1, 22);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      out.push(String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0'));
    }
    return out;
  }
  function weekLabels(n)  { return Array.from({length:n}, (_, i) => 'W' + (i+1)); }
  function monthLabels(n) {
    const m = ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];
    return m.slice(0, n);
  }

  const fmtDollar  = v => '$' + Math.round(v).toLocaleString();
  const fmtDollar2 = v => '$' + (Math.round(v*100)/100).toFixed(2);
  const fmtPct     = v => (Math.round(v*10)/10) + '%';
  const fmtNum     = v => Math.round(v).toLocaleString();

  const KPIs = {
    forecasted_sales: {
      title: 'Forecasted Sales', icon: 'trending-up',
      color: '#5B5BD6', format: fmtDollar, unit: '$',
      compare: [
        { code: 'CUR VS LW', desc: 'Same Day', delta: '+4.2%', tone: 'pos' },
        { code: 'CUR VS LY', desc: 'Same Day', delta: '+6.8%', tone: 'pos' },
        { code: 'WTD VS LW', desc: 'WTD',      delta: '+2.4%', tone: 'pos' },
        { code: 'WTD VS LY', desc: 'WTD',      delta: '+5.1%', tone: 'pos' }
      ],
      series: {
        '7D':  { labels: dateLabels(7),  values: [11200, 10800, 11400, 12300, 13980, 12410, 9100] },
        '14D': { labels: dateLabels(14), values: [9800, 10500, 10200, 11050, 11700, 12260, 8900, 11200, 10800, 11400, 12300, 13980, 12410, 9100] },
        '4W':  { labels: weekLabels(4),  values: [76200, 78900, 80100, 81400] },
        '3M':  { labels: monthLabels(3), values: [310000, 322000, 341000] },
        '6M':  { labels: monthLabels(6), values: [285000, 298000, 305000, 310000, 322000, 341000] }
      },
      ai: {
        updatedAt: 'Updated at: 05:21 AM',
        bullets: [
          'Forecast is up 6.8% YoY — strongest momentum in the region.',
          'Friday peak drives 18% of weekly revenue; protect FOH coverage.',
          'Mon–Tue dips suggest an off-peak promo opportunity (+$2.1K).'
        ]
      }
    },

    labor: {
      title: 'Labor %', icon: 'percent',
      color: '#7070DE', format: fmtPct, unit: '%',
      compare: [
        { code: 'CUR VS LW', desc: 'Same Day', delta: '-8%', tone: 'neg' },
        { code: 'CUR VS LY', desc: 'Same Day', delta: '-7%', tone: 'neg' },
        { code: 'WTD VS LW', desc: 'WTD',      delta: '-6%', tone: 'neg' },
        { code: 'WTD VS LY', desc: 'WTD',      delta: '-5%', tone: 'neg' }
      ],
      series: {
        '7D':  { labels: dateLabels(7),  values: [27, 17, 21, 25, 11, 35, 44] },
        '14D': { labels: dateLabels(14), values: [22, 18, 24, 19, 26, 21, 23, 27, 17, 21, 25, 11, 35, 44] },
        '4W':  { labels: weekLabels(4),  values: [20.4, 22.1, 19.8, 24.3] },
        '3M':  { labels: monthLabels(3), values: [19.2, 20.5, 21.7] },
        '6M':  { labels: monthLabels(6), values: [18.6, 19.0, 18.9, 19.2, 20.5, 21.7] }
      },
      ai: {
        updatedAt: 'Updated at: 05:21 AM',
        bullets: [
          'Labor % is 1.2% above regional average.',
          'SPLH drop detected at 12 stores.',
          'Sales up 12.4% with $8.2K upsell potential.'
        ]
      }
    },

    hours: {
      title: 'Scheduled Hours', icon: 'clock',
      color: '#4A4AC4', format: fmtNum, unit: 'hrs',
      compare: [
        { code: 'CUR VS LW', desc: 'Same Day', delta: '-2.1%', tone: 'neg' },
        { code: 'CUR VS LY', desc: 'Same Day', delta: '+3.4%', tone: 'pos' },
        { code: 'WTD VS LW', desc: 'WTD',      delta: '-1.2%', tone: 'neg' },
        { code: 'WTD VS LY', desc: 'WTD',      delta: '+2.8%', tone: 'pos' }
      ],
      series: {
        '7D':  { labels: dateLabels(7),  values: [178, 172, 176, 184, 192, 186, 152] },
        '14D': { labels: dateLabels(14), values: [170,168,172,180,188,182,150, 178,172,176,184,192,186,152] },
        '4W':  { labels: weekLabels(4),  values: [1180, 1215, 1240, 1240] },
        '3M':  { labels: monthLabels(3), values: [4980, 5210, 5340] },
        '6M':  { labels: monthLabels(6), values: [4600, 4720, 4810, 4980, 5210, 5340] }
      },
      ai: {
        updatedAt: 'Updated at: 05:21 AM',
        bullets: [
          'Missed-hour spike (42 hrs) concentrated in morning openings.',
          '3 employees within 2 hours of OT — swap windows available Sat.',
          'On-time adherence holds at 98.5%, ahead of district benchmark.'
        ]
      }
    },

    splh: {
      title: 'Scheduled SPLH', icon: 'activity',
      color: '#5B5BD6', format: fmtDollar2, unit: '$',
      compare: [
        { code: 'CUR VS LW', desc: 'Same Day', delta: '+3.5%', tone: 'pos' },
        { code: 'CUR VS LY', desc: 'Same Day', delta: '+8.1%', tone: 'pos' },
        { code: 'WTD VS LW', desc: 'WTD',      delta: '-2.5%', tone: 'neg' },
        { code: 'WTD VS LY', desc: 'WTD',      delta: '+4.7%', tone: 'pos' }
      ],
      series: {
        '7D':  { labels: dateLabels(7),  values: [62.8, 63.2, 61.9, 60.5, 58.1, 59.4, 60.9] },
        '14D': { labels: dateLabels(14), values: [59.1, 60.2, 58.9, 61.1, 62.5, 60.7, 59.8, 62.8, 63.2, 61.9, 60.5, 58.1, 59.4, 60.9] },
        '4W':  { labels: weekLabels(4),  values: [58.4, 59.7, 60.1, 60.2] },
        '3M':  { labels: monthLabels(3), values: [56.8, 58.4, 60.2] },
        '6M':  { labels: monthLabels(6), values: [54.1, 55.6, 56.2, 56.8, 58.4, 60.2] }
      },
      ai: {
        updatedAt: 'Updated at: 05:21 AM',
        bullets: [
          'SPLH ($58.7) trails the $60.20 target by $1.50.',
          'Increase secondary tasks during 2–4 PM lull to lift productivity.',
          'Fri evening shifts achieve $65 SPLH — replicate the model.'
        ]
      }
    },

    compliance: {
      title: 'Compliance', icon: 'shield-check',
      color: '#1FAE5C', format: fmtPct, unit: '%',
      compare: [
        { code: 'CUR VS LW', desc: 'Same Day', delta: '+0.6%', tone: 'pos' },
        { code: 'CUR VS LY', desc: 'Same Day', delta: '+1.4%', tone: 'pos' },
        { code: 'WTD VS LW', desc: 'WTD',      delta: '+0.4%', tone: 'pos' },
        { code: 'WTD VS LY', desc: 'WTD',      delta: '+1.1%', tone: 'pos' }
      ],
      series: {
        '7D':  { labels: dateLabels(7),  values: [97.2, 96.8, 97.5, 95.9, 96.4, 95.1, 96.7] },
        '14D': { labels: dateLabels(14), values: [95.5,96.0,95.8,96.2,96.7,96.5,95.9, 97.2,96.8,97.5,95.9,96.4,95.1,96.7] },
        '4W':  { labels: weekLabels(4),  values: [95.8, 96.1, 96.3, 96.5] },
        '3M':  { labels: monthLabels(3), values: [94.7, 95.6, 96.5] },
        '6M':  { labels: monthLabels(6), values: [93.2, 94.0, 94.4, 94.7, 95.6, 96.5] }
      },
      ai: {
        updatedAt: 'Updated at: 05:21 AM',
        bullets: [
          '8 violations this week — 50% are late meal breaks on Grill.',
          'Adjust Grill overlap by 15 min to enable timely breaks.',
          '3 employees flagged at-risk for OT threshold on Sat.'
        ]
      }
    },

    ai: {
      title: 'AI Schedule Summary', icon: 'sparkles',
      color: '#5B5BD6', format: fmtPct, unit: '%',
      compare: [
        { code: 'CUR VS LW', desc: 'Same Day', delta: '+2.1%', tone: 'pos' },
        { code: 'CUR VS LY', desc: 'Same Day', delta: '+5.3%', tone: 'pos' },
        { code: 'WTD VS LW', desc: 'WTD',      delta: '+1.4%', tone: 'pos' },
        { code: 'WTD VS LY', desc: 'WTD',      delta: '+4.2%', tone: 'pos' }
      ],
      series: {
        '7D':  { labels: dateLabels(7),  values: [92, 93, 95, 94, 91, 93, 95] },
        '14D': { labels: dateLabels(14), values: [88,89,91,90,92,90,91, 92,93,95,94,91,93,95] },
        '4W':  { labels: weekLabels(4),  values: [88, 90, 92, 94] },
        '3M':  { labels: monthLabels(3), values: [86, 90, 94] },
        '6M':  { labels: monthLabels(6), values: [82, 84, 85, 86, 90, 94] }
      },
      ai: {
        updatedAt: 'Updated at: 05:21 AM',
        bullets: [
          'Schedule health: 94% optimized — strongest in 6 months.',
          'Single point of failure detected: only 1 manager on Tue night.',
          '12 PM overlap can shed 4 hrs without dropping coverage.'
        ]
      }
    }
  };

  // Backward-compat aliases (old code calls openTrendModal('sales') / 'compliance' etc.)
  const ALIAS = { sales: 'forecasted_sales' };

  // ---------- State ----------
  let curKpi   = 'labor';
  let curRange = '7D';
  let curView  = 'bar';
  let chart    = null;

  // ---------- Public API ----------
  window.openTrendModal = function(type) {
    const key = ALIAS[type] || type || 'forecasted_sales';
    curKpi = KPIs[key] ? key : 'forecasted_sales';
    curRange = '7D';
    curView = (key === 'ai') ? 'ai' : 'bar';
    syncSegment('.tk-view-tab', 'data-view',  curView);
    syncSegment('.tk-range-pill','data-range', curRange);
    populateKpiMenu();
    const modal = document.getElementById('trendModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    refresh();
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
  };

  window.closeTrendModal = function() {
    const modal = document.getElementById('trendModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    if (chart) { try { chart.destroy(); } catch(e){} chart = null; }
    document.getElementById('tkKpiMenu')?.classList.add('hidden');
    document.getElementById('tkExportMenu')?.classList.add('hidden');
  };

  // Legacy helpers some places may still call — no-ops in the new modal
  window.switchTrend = function(){};
  window.updateTrendData = function(){};

  window.setKpiView = function(view) {
    curView = view;
    syncSegment('.tk-view-tab', 'data-view', view);
    refresh();
  };

  window.setKpiRange = function(range) {
    curRange = range;
    syncSegment('.tk-range-pill', 'data-range', range);
    refresh();
  };

  window.toggleKpiSelect = function(e) {
    if (e) e.stopPropagation();
    document.getElementById('tkExportMenu')?.classList.add('hidden');
    document.getElementById('tkKpiMenu')?.classList.toggle('hidden');
  };

  window.toggleTrendExport = function(e) {
    if (e) e.stopPropagation();
    document.getElementById('tkKpiMenu')?.classList.add('hidden');
    document.getElementById('tkExportMenu')?.classList.toggle('hidden');
  };

  window.selectKpi = function(key) {
    if (!KPIs[key]) return;
    curKpi = key;
    document.getElementById('tkKpiMenu')?.classList.add('hidden');
    refresh();
  };

  window.exportTrend = function(fmt) {
    document.getElementById('tkExportMenu')?.classList.add('hidden');
    const kpi = KPIs[curKpi];
    alert('Export ' + (fmt||'pdf').toUpperCase() + ' — ' + kpi.title + ' • ' + curRange);
  };

  // ---------- Internals ----------
  function syncSegment(selector, attr, value) {
    document.querySelectorAll(selector).forEach(b => b.classList.toggle('active', b.getAttribute(attr) === value));
  }

  function populateKpiMenu() {
    const menu = document.getElementById('tkKpiMenu');
    if (!menu) return;
    menu.innerHTML = Object.keys(KPIs).map(k =>
      `<button onclick="selectKpi('${k}')" class="${k === curKpi ? 'active':''}">
         <i data-lucide="${KPIs[k].icon}" class="w-3.5 h-3.5"></i>
         <span>${KPIs[k].title}</span>
       </button>`
    ).join('');
  }

  function refresh() {
    const kpi = KPIs[curKpi];
    if (!kpi) return;

    // header label + icon swap
    const labelEl = document.getElementById('tkKpiLabel');
    if (labelEl) labelEl.textContent = kpi.title;

    // comparison rail
    const list = document.getElementById('tkCompareList');
    if (list) {
      list.innerHTML = kpi.compare.map(c => `
        <div class="tk-compare-card">
          <div>
            <div class="tk-compare-code">${c.code}</div>
            <div class="tk-compare-desc">${c.desc}</div>
          </div>
          <div class="tk-compare-delta ${c.tone}">${c.delta}</div>
        </div>
      `).join('');
    }

    // view toggles
    const inAi    = curView === 'ai';
    const inTable = curView === 'table';
    const inChart = !inAi && !inTable;

    document.getElementById('tkChartArea')?.classList.toggle('hidden', !inChart);
    document.getElementById('tkTableArea')?.classList.toggle('hidden', !inTable);
    document.getElementById('tkAiArea')?.classList.toggle('hidden',    !inAi);

    // hide range row in AI view (the screenshot shows no range pills there)
    const rangeRow = document.getElementById('tkRangeRow');
    if (rangeRow) rangeRow.style.display = inAi ? 'none' : '';

    if (inChart) renderChart(kpi);
    else if (inTable) renderTable(kpi);
    else renderAi(kpi);

    if (window.lucide) lucide.createIcons();
  }

  function renderChart(kpi) {
    const series = kpi.series[curRange];
    if (!series) return;
    const ctx = document.getElementById('tkChart')?.getContext('2d');
    if (!ctx) return;
    if (chart) { try { chart.destroy(); } catch(e){} chart = null; }

    const isLine = curView === 'line';

    // Detect dark for chart colors
    const isDark = document.documentElement.classList.contains('dark') ||
                   document.documentElement.getAttribute('data-theme') === 'dark';
    const txt  = isDark ? '#888EA0' : '#6E7488';
    const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,18,40,0.06)';

    chart = new Chart(ctx, {
      type: isLine ? 'line' : 'bar',
      data: {
        labels: series.labels,
        datasets: [{
          label: kpi.title,
          data: series.values,
          backgroundColor: isLine ? (isDark ? 'rgba(112,112,222,0.20)' : 'rgba(112,112,222,0.16)') : kpi.color,
          borderColor: kpi.color,
          borderWidth: isLine ? 2.5 : 0,
          borderRadius: isLine ? 0 : 8,
          tension: 0.4,
          fill: isLine,
          pointBackgroundColor: '#fff',
          pointBorderColor: kpi.color,
          pointBorderWidth: 2,
          pointRadius: isLine ? 4 : 0,
          pointHoverRadius: isLine ? 6 : 0,
          barThickness: 'flex',
          maxBarThickness: 56,
          categoryPercentage: 0.72,
          barPercentage: 0.72
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 18, right: 8, bottom: 4, left: 4 } },
        plugins: {
          legend: { display: false },
          datalabels: isLine ? { display: false } : {
            display: true,
            anchor: 'end', align: 'top',
            offset: -2,
            color: kpi.color,
            font: { weight: 700, size: 11 },
            formatter: v => formatDataLabel(kpi, v)
          },
          tooltip: {
            backgroundColor: isDark ? '#1B1D29' : '#FFFFFF',
            titleColor: isDark ? '#B5B9C7' : '#6E7488',
            bodyColor:  isDark ? '#F2F3F7' : '#0E0F1A',
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,18,40,0.10)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            displayColors: false,
            titleFont: { size: 10, weight: 700 },
            bodyFont:  { size: 14, weight: 700 },
            callbacks: {
              title: () => kpi.title.toUpperCase(),
              label: ctx => kpi.format(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: txt, font: { size: 11, weight: 500 } },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            grid: { color: grid, drawTicks: false },
            ticks: {
              color: txt,
              font: { size: 11, weight: 500 },
              padding: 8,
              callback: v => kpi.unit === '%' ? v + '%' : kpi.format(v)
            },
            border: { display: false }
          }
        }
      }
    });

    // legend
    const legend = document.getElementById('tkChartLegend');
    if (legend) {
      legend.innerHTML = `<span class="tk-legend-dot" style="--c:${kpi.color}"></span><span>${kpi.title}</span>`;
    }
  }

  function formatDataLabel(kpi, v) {
    if (kpi.unit === '%') return v + '%';
    if (kpi.unit === '$') {
      if (Math.abs(v) >= 1000) return '$' + Math.round(v/1000) + 'K';
      return '$' + (Math.round(v*100)/100);
    }
    if (Math.abs(v) >= 1000) return Math.round(v/1000) + 'K';
    return Math.round(v).toLocaleString();
  }

  function renderTable(kpi) {
    const series = kpi.series[curRange];
    if (!series) return;
    const body = document.getElementById('tkTableBody');
    if (!body) return;
    body.innerHTML = series.labels.map((lbl, i) => `
      <tr class="${i % 2 === 0 ? 'alt' : ''}">
        <td>${lbl}</td>
        <td class="text-right num">${kpi.format(series.values[i])}</td>
      </tr>
    `).join('');
  }

  function renderAi(kpi) {
    const card = document.getElementById('tkAiCard');
    if (!card) return;
    card.innerHTML = `
      <div>
        <div class="tk-ai-avatar"><i data-lucide="lightbulb" style="width:42px;height:42px;"></i></div>
        <div class="tk-ai-avatar-label">AI INSIGHT</div>
      </div>
      <div class="tk-ai-body">
        <div class="tk-ai-head">
          <span>AI Recommendation — ${kpi.title}</span>
          <span class="tk-ai-time">${kpi.ai.updatedAt}</span>
        </div>
        <ul>
          ${kpi.ai.bullets.map(b => '<li>' + b + '</li>').join('')}
        </ul>
      </div>
    `;
  }

  // ---------- Global listeners ----------
  document.addEventListener('click', function(e) {
    const inSelect = e.target.closest && e.target.closest('#tkKpiSelect');
    const inExport = e.target.closest && e.target.closest('.tk-export');
    if (!inSelect) document.getElementById('tkKpiMenu')?.classList.add('hidden');
    if (!inExport) document.getElementById('tkExportMenu')?.classList.add('hidden');
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('trendModal');
    if (modal && !modal.classList.contains('hidden')) window.closeTrendModal();
  });

  // Click backdrop to close
  document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('trendModal');
    if (!modal) return;
    modal.addEventListener('click', function(e) {
      if (e.target === modal) window.closeTrendModal();
    });
  });

})();
