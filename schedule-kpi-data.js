/* ============================================================
   Schedule Dashboard KPI registry — feeds the ported trend-modal
   engine (trend-modal-engine.js + trend-modal.js) with this page's
   5 KPI tiles, in the exact shape tmCfgFromTile() expects.
   ============================================================ */

KPI_REGISTRY['sched-sales'] = {
  label: 'Forecasted Sales',
  value: '$81,400',
  spark: 'indigo',
  cur: { lw: '+2.4%', lwUp: true },
  footer: [ ['Sales (WTD)', '$412K'], ['WTD Variance', '-$2.2K'] ]
};

KPI_REGISTRY['sched-labor'] = {
  label: 'Sched. Labor Cost %',
  value: '18.5%',
  spark: 'teal',
  cur: { lw: '+0.5%', lwUp: true },
  footer: [ ['Act. Labor% (WTD)', '19.2%'], ['Labor Variance', '+0.7%'] ]
};

KPI_REGISTRY['sched-hours'] = {
  label: 'Scheduled Hours',
  value: '1,240',
  spark: 'blue',
  cur: { lw: '-1.2%', lwUp: false },
  footer: [ ['On-Time % (WTD)', '98.5%'], ['Missed Hours (WTD)', '42'] ]
};

KPI_REGISTRY['sched-splh'] = {
  label: 'Scheduled SPLH',
  value: '$60.20',
  spark: 'purple',
  cur: { lw: '+3.5%', lwUp: true },
  footer: [ ['Actual SPLH (WTD)', '$58.7'], ['SPLH Variance', '-$1.5'] ]
};

KPI_REGISTRY['sched-ot'] = {
  label: 'Schedule OT%',
  value: '3.8%',
  spark: 'orange',
  cur: { lw: '+0.6%', lwUp: true },
  footer: [ ['OT Cost ($)', '$1,240'], ['OT Employees', '6'] ]
};
