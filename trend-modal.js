/* ============================================================
   Trend-modal ADAPTER
   Builds KPI_CFG-shaped entries (day/week/month/quarter series +
   supporting sub-KPIs) from this app's KPI-tile and grid-section
   data, registers them with the ported engine
   (trend-modal-engine.js), then opens the exact same modal used
   by "AI Org Dashboard.html" — same Historical / Store vs Store
   tabs, supporting-KPI sub-charts, comparison sidebar, CSV export.
   ============================================================ */

const KPI_REGISTRY = {};
const SECTION_REGISTRY = {};

const TM_COLOR_HEX = { blue:'#2563eb', green:'#16a34a', red:'#dc2626', orange:'#d97706', purple:'#7c3aed', indigo:'#4338ca' };
const TM_SPARK_TO_HEX = { indigo:'#6366f1', orange:'#f59e0b', teal:'#14b8a6', blue:'#3b82f6', purple:'#a855f7' };

const TM_EMOJI_MAP = {
  'labor $':'💰', 'sales':'🛒', 'waste':'🗑️', 'theo':'📊', 'act. hrs':'⏰', 'ideal hrs':'⏱️',
  'voids':'⚡', 'refunds':'↩️', 'transaction':'🧾', 'fct. sales':'📊', 'ot hours':'⏰', 'ly ot':'📉',
  'act. hrs.':'⏰', 'sch. hrs.':'📅', 'early in':'🌅', 'late out':'🌇', 'act sales':'🛒', 'fct trans':'🧾', 'act trans':'🧾'
};
function tmEmojiFor(label){
  const l = (label || '').toLowerCase();
  for(const key in TM_EMOJI_MAP){ if(l.indexOf(key) !== -1) return TM_EMOJI_MAP[key]; }
  return '📈';
}

function tmParseNum(v){
  if(v==null) return 0;
  const n = parseFloat(String(v).replace(/[,$%]/g,''));
  return isNaN(n) ? 0 : n;
}
function tmUnitOf(v){
  const s = String(v==null ? '' : v);
  if(s.indexOf('$') !== -1) return '$';
  if(s.indexOf('%') !== -1) return '%';
  return '';
}
function tmSeededRand(seedStr){
  let h = 0;
  for(let i=0;i<seedStr.length;i++){ h = (h*31 + seedStr.charCodeAt(i)) >>> 0; }
  return function(){ h = (h*1103515245 + 12345) >>> 0; return (h % 10000)/10000; };
}
function tmGenArr(seed, baseValue, points){
  const rand = tmSeededRand(seed);
  const amp = Math.max(Math.abs(baseValue)*0.24, 0.8);
  let cur = baseValue - amp*0.5;
  const out = [];
  for(let i=0;i<points;i++){
    cur += (rand()-0.42)*amp*0.6;
    out.push(+Math.max(0,cur).toFixed(2));
  }
  out[out.length-1] = +baseValue.toFixed(2);
  return out;
}
/* day:6, week:7, month:4, quarter:13 — matches the ported engine's own label generators */
function tmGenSeries(seed, baseValue){
  return {
    day:     tmGenArr(seed+'-d', baseValue, 6),
    week:    tmGenArr(seed+'-w', baseValue, 7),
    month:   tmGenArr(seed+'-m', baseValue, 4),
    quarter: tmGenArr(seed+'-q', baseValue, 13)
  };
}

/* Build a full KPI_CFG entry — with supporting sub-KPI charts — from one KPI tile */
function tmCfgFromTile(k, seedKey){
  const color = TM_SPARK_TO_HEX[k.spark] || '#2563eb';
  const base = tmParseNum(k.value);
  const series = tmGenSeries(seedKey, base);
  const supColors = ['#5b52d4', '#1D9E75'];
  const supporting = (k.footer && k.footer[0] && k.footer[0][0]) ? k.footer.map((f, i) => {
    const sColor = supColors[i % supColors.length];
    const sSeries = tmGenSeries(seedKey+'-sup'+i, tmParseNum(f[1]));
    return Object.assign({
      key: seedKey+'_sup'+i, label:f[0], icon:tmEmojiFor(f[0]),
      iconBg:sColor+'1A', iconColor:sColor,
      value:f[1], change:k.cur.lw, up:k.cur.lwUp,
      unit:tmUnitOf(f[1]), isCur:tmUnitOf(f[1])==='$'
    }, sSeries);
  }) : [];
  return Object.assign({
    label:k.label, color, unit:tmUnitOf(k.value), isCur:tmUnitOf(k.value)==='$',
    value:k.value, change:k.cur.lw, up:k.cur.lwUp, supporting
  }, series);
}

/* Build a KPI_CFG entry (no supporting sub-charts) from one grid-section row */
function tmCfgFromRow(row, colorHex, seedKey){
  const series = tmGenSeries(seedKey, tmParseNum(row[1]));
  return Object.assign({
    label:row[0], color:colorHex, unit:tmUnitOf(row[1]), isCur:tmUnitOf(row[1])==='$',
    supporting:[]
  }, series);
}

/* ---------------- Global metric catalog (for the "Add Metric" overlay picker) ---------------- */
const TM_DASH_LABELS = { storehealth:'Store Health', compliance:'Compliance', risk:'Risk', timeloss:'Timeloss', dar:'DAR' };
let tmMetricCatalog = null;
function tmBuildMetricCatalog(){
  if(tmMetricCatalog) return tmMetricCatalog;
  const cat = [];
  Object.keys(KPI_REGISTRY).forEach(id => {
    const prefix = id.slice(0, id.lastIndexOf('-'));
    if(!window.getTrendKpiCfg(id)) window.registerTrendKpi(id, tmCfgFromTile(KPI_REGISTRY[id], id));
    const cfg = window.getTrendKpiCfg(id);
    cat.push({ key:id, label:cfg.label, type: cfg.isCur?'$':(cfg.unit==='%'?'%':'number'), dashLabel: TM_DASH_LABELS[prefix]||prefix });
  });
  Object.keys(SECTION_REGISTRY).forEach(sid => {
    const sec = SECTION_REGISTRY[sid];
    const prefix = sid.split('-sec-')[0];
    const colorHex = TM_COLOR_HEX[sec.color] || '#2563eb';
    (sec.rows||[]).forEach((row,i) => {
      const key = sid+'__row'+i;
      if(!window.getTrendKpiCfg(key)) window.registerTrendKpi(key, tmCfgFromRow(row, colorHex, key));
      const cfg = window.getTrendKpiCfg(key);
      cat.push({ key, label:row[0], type: cfg.isCur?'$':(cfg.unit==='%'?'%':'number'), dashLabel:(TM_DASH_LABELS[prefix]||prefix)+' · '+sec.title });
    });
  });
  tmMetricCatalog = cat;
  return cat;
}

/* ---------------- Entry points (called from dashboard-render.js) ---------------- */
function openKpiTrend(id){
  const k = KPI_REGISTRY[id];
  if(!k || !window.openLaborModal) return;
  const prefix = id.slice(0, id.lastIndexOf('-'));
  const family = Object.keys(KPI_REGISTRY).filter(x => x.startsWith(prefix+'-'));
  family.forEach(fid => window.registerTrendKpi(fid, tmCfgFromTile(KPI_REGISTRY[fid], fid)));
  window.openLaborModal(id, family, false);
}

function openModuleTrend(sectionId, rowIdx){
  const sec = SECTION_REGISTRY[sectionId];
  if(!sec || !window.openLaborModal) return;
  rowIdx = rowIdx || 0;
  const colorHex = TM_COLOR_HEX[sec.color] || '#2563eb';
  const ids = sec.rows.map((r,i) => sectionId+'__row'+i);
  sec.rows.forEach((row,i) => window.registerTrendKpi(ids[i], tmCfgFromRow(row, colorHex, ids[i])));
  window.openLaborModal(ids[rowIdx], ids, true);
}
