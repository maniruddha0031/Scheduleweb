/* ============================================================
   Analytics tab — per-card range selector (7D / 14D / 4W / 3M / 6M)
   Monkey-patches getChartData to scale data + relabel x-axis,
   without touching the existing inline chart definitions.
   ============================================================ */
(function(){

  // ---------- State ----------
  // Card indexes used on this dashboard: 0, 1, 3, 4 (no #2)
  window.cardRanges = window.cardRanges || { 0: '7D', 1: '7D', 3: '7D', 4: '7D' };

  // ---------- Label helpers ----------
  function dateLabels(n) {
    const base = new Date(2026, 1, 22); // Sun 02/22/2026 (mock week-end)
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      out.push(String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0'));
    }
    return out;
  }
  function weekLabels(n)  { return Array.from({length:n}, (_, i) => 'W' + (i+1)); }
  function monthLabels(n) {
    const months = ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];
    return months.slice(0, n);
  }
  function labelsForRange(range) {
    switch(range) {
      case '7D':  return { labels: dateLabels(7),  n: 7  };
      case '14D': return { labels: dateLabels(14), n: 14 };
      case '4W':  return { labels: weekLabels(4),  n: 4  };
      case '3M':  return { labels: monthLabels(3), n: 3  };
      case '6M':  return { labels: monthLabels(6), n: 6  };
      default:    return { labels: dateLabels(7),  n: 7  };
    }
  }

  // ---------- Data scaling ----------
  // Deterministic pseudo-random so the same chart+range always yields the same series
  function seededRand(seed) {
    let x = (seed * 9301 + 49297) % 233280;
    return x / 233280;
  }

  function scaleDataset(values, targetN, seed) {
    const baseN = values.length;
    if (targetN === baseN) return values.slice();
    const out = [];
    if (targetN > baseN) {
      // Extend by repeating, with gentle drift so it doesn't look like a sawtooth
      for (let i = 0; i < targetN; i++) {
        const v = values[i % baseN];
        const drift = 1 + (seededRand(seed + i) - 0.5) * 0.16; // ±8%
        out.push(roundLike(v, v * drift));
      }
      return out;
    }
    // Collapse: bucket-average then apply a mild growth trend across buckets
    const groupSize = baseN / targetN;
    for (let i = 0; i < targetN; i++) {
      const start = Math.floor(i * groupSize);
      const end = Math.min(baseN, Math.floor((i + 1) * groupSize));
      let sum = 0, count = 0;
      for (let j = start; j < end; j++) { sum += values[j]; count++; }
      const avg = count ? (sum / count) : 0;
      const trend = 1 + i * 0.05;                      // 0%, 5%, 10%…
      const noise = 1 + (seededRand(seed + i) - 0.5) * 0.1; // ±5%
      out.push(roundLike(values[0] || 1, avg * trend * noise));
    }
    return out;
  }
  // Match the rounding style of the source value (ints vs decimals)
  function roundLike(sample, v) {
    if (Number.isInteger(sample)) return Math.max(0, Math.round(v));
    return Math.max(0, Math.round(v * 10) / 10);
  }

  // Decide if a chart's labels are date-based (replace) vs categorical (keep)
  function labelsAreCategorical(labels) {
    if (!labels || !labels.length) return false;
    const first = String(labels[0]);
    // time-of-day buckets like "4am", "12pm"  /  shift buckets like "8A-2P"
    return /^\d+(am|pm)$/i.test(first) ||
           /^\d+[AP]-\d+[AP]$/.test(first) ||
           /^(Other|Kitchen|Front|Management|Maintenance)$/i.test(first);
  }

  function applyRange(rawData, range, chartKeyForSeed) {
    const baseSeed = Array.from(String(chartKeyForSeed || ''))
                          .reduce((a, c) => a + c.charCodeAt(0), 0);
    const { labels, n } = labelsForRange(range);
    const useNewLabels = !labelsAreCategorical(rawData.labels);
    const newLabels = useNewLabels ? labels : rawData.labels;
    const targetN   = useNewLabels ? n      : rawData.labels.length;

    const datasets = rawData.datasets.map((ds, dsi) => ({
      ...ds,
      data: scaleDataset(ds.data, targetN, baseSeed + dsi * 31)
    }));
    return { labels: newLabels, datasets };
  }

  // ---------- Monkey-patch getChartData per render ----------
  // We don't know which card is calling getChartData, so we temporarily swap it
  // around updateCardGraph / updateModalGraph calls.
  let _origGetChartData = null;
  function withRange(range, key, fn) {
    if (!_origGetChartData) _origGetChartData = window.getChartData;
    const orig = _origGetChartData;
    window.getChartData = function(k) {
      const raw = orig(k);
      return applyRange(raw, range, k);
    };
    try { return fn(); }
    finally { window.getChartData = orig; }
  }

  // ---------- Public: setCardRange ----------
  window.setCardRange = function(index, range) {
    window.cardRanges[index] = range;
    const canvas = document.getElementById('cardChart' + index);
    if (!canvas) return;
    const card = canvas.closest('.card');
    if (!card) return;
    // sync pill active state
    card.querySelectorAll('.analytics-range-row[data-card-index="' + index + '"] .analytics-range-pill')
        .forEach(b => b.classList.toggle('active', b.dataset.range === range));
    // re-render with currently selected chart option
    const sel = card.querySelector('select');
    if (sel && typeof window.updateCardGraph === 'function') {
      withRange(range, sel.value, () => window.updateCardGraph(index, sel.value));
    }
  };

  // ---------- Install range pill rows in each analytics card ----------
  function installRangeRows() {
    const indexes = [0, 1, 3, 4];
    indexes.forEach(idx => {
      const canvas = document.getElementById('cardChart' + idx);
      if (!canvas) return;
      const card = canvas.closest('.card');
      if (!card || card.querySelector('.analytics-range-row[data-card-index="' + idx + '"]')) return;
      const row = document.createElement('div');
      row.className = 'analytics-range-row';
      row.dataset.cardIndex = idx;
      const current = window.cardRanges[idx] || '7D';
      row.innerHTML = ['7D','14D','4W','3M','6M'].map(r =>
        '<button class="analytics-range-pill ' + (r === current ? 'active' : '') + '" ' +
        'data-range="' + r + '" onclick="setCardRange(' + idx + ',\'' + r + '\')">' + r + '</button>'
      ).join('');
      // Insert AFTER the dark header strip — i.e. before the canvas wrapper
      const canvasWrap = canvas.parentElement;
      if (canvasWrap && canvasWrap.parentElement === card) {
        card.insertBefore(row, canvasWrap);
      } else {
        card.appendChild(row);
      }
    });
  }

  // ---------- Wrap updateCardGraph + updateModalGraph for range-aware data ----------
  function installWrappers() {
    if (typeof window.updateCardGraph === 'function' && !window.updateCardGraph._tkWrapped) {
      const orig = window.updateCardGraph;
      const wrapped = function(index, key) {
        const range = window.cardRanges[index] || '7D';
        return withRange(range, key, () => orig(index, key));
      };
      wrapped._tkWrapped = true;
      window.updateCardGraph = wrapped;
    }
    if (typeof window.updateModalGraph === 'function' && !window.updateModalGraph._tkWrapped) {
      const orig = window.updateModalGraph;
      const wrapped = function(key) {
        const idx = (typeof window.currentMaximizedIndex === 'number') ? window.currentMaximizedIndex : 0;
        const range = window.cardRanges[idx] || '7D';
        return withRange(range, key, () => orig(key));
      };
      wrapped._tkWrapped = true;
      window.updateModalGraph = wrapped;
    }
  }

  // ---------- Boot ----------
  function boot() {
    installWrappers();
    installRangeRows();
    // Force a re-render of each card so initial 7D state propagates through the wrapper
    [0, 1, 3, 4].forEach(idx => {
      const canvas = document.getElementById('cardChart' + idx);
      if (!canvas) return;
      const card = canvas.closest('.card');
      const sel = card?.querySelector('select');
      if (sel && typeof window.updateCardGraph === 'function') {
        try { window.updateCardGraph(idx, sel.value); } catch(e) { /* ignore */ }
      }
    });
  }

  // The inline script defines updateCardGraph synchronously and renders charts on load;
  // we must run AFTER that. window.load fires after all scripts + Chart.js are ready.
  if (document.readyState === 'complete') setTimeout(boot, 0);
  else window.addEventListener('load', () => setTimeout(boot, 50));

})();
