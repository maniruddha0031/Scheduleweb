/* ============================================================
   AI Insight modal — controller
   Populates Daily + Weekly recommendation lists.
   ============================================================ */
(function(){

  // Schedule-related insights (relate to the dashboard's headline metrics)
  const DAILY = [
    'Labor <strong>+0.8%</strong> vs target today &mdash; overspend during 2&ndash;5 PM lull.',
    'SPLH at <strong>$58.10</strong> vs $60.20 target &mdash; trim 4 hrs from mid-shift transition.',
    'Sales <strong>+12.4%</strong> YoY &mdash; protect FOH coverage between 11 AM and 1 PM.',
    'Compliance: <strong>3 employees</strong> at risk of late meal-break violations on Grill station.',
    '<strong>2 shifts</strong> still unassigned for tomorrow &mdash; 5 eligible employees within budget.'
  ];

  const WEEKLY = [
    'Labor <strong>+1.6%</strong> vs target WTD &mdash; weekends drive most of the variance.',
    'SPLH down <strong>4% WoW</strong> &mdash; consistent overstaffing pattern at 2&ndash;4 PM.',
    'Friday peak generates <strong>18%</strong> of weekly revenue &mdash; reinforce expeditor role.',
    'Sales <strong>+10.8% WoW</strong>; attachment gap ~<strong>12%</strong> across stores.',
    'Schedule health holding at <strong>94%</strong> &mdash; up from 90% last week.'
  ];

  window.openAiInsightModal = function() {
    const modal = document.getElementById('aiInsightModal');
    if (!modal) return;
    document.getElementById('aiDailyList').innerHTML  = DAILY.map(t  => `<div class="ai-col-item">${t}</div>`).join('');
    document.getElementById('aiWeeklyList').innerHTML = WEEKLY.map(t => `<div class="ai-col-item">${t}</div>`).join('');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
  };

  window.closeAiInsightModal = function() {
    const modal = document.getElementById('aiInsightModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  };

  // Backdrop click + Esc to close
  document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('aiInsightModal');
    if (!modal) return;
    modal.addEventListener('click', function(e) {
      if (e.target === modal) window.closeAiInsightModal();
    });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('aiInsightModal');
    if (modal && !modal.classList.contains('hidden')) window.closeAiInsightModal();
  });

})();
