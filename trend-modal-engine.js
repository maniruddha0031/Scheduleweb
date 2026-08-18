/* ============================================================
   KPI / Section Trend Modal — ENGINE
   Ported verbatim from "AI Org Dashboard.html" (the exact same
   Historical / Store vs Store tabs, supporting-KPI sub-charts,
   comparison sidebar, bar/line/table views, CSV export, chain/org
   compare). KPI_CFG starts empty — entries are registered at
   render time via window.registerTrendKpi() by trend-modal.js.
   ============================================================ */

(function(){
// ── DATE HELPERS ──────────────────────────────────────────────────────────────
function currentMonday(){var d=new Date();d.setHours(0,0,0,0);var day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return d;}
function addDays(d,n){var r=new Date(d);r.setDate(r.getDate()+n);return r;}
function addWeeks(d,n){return addDays(d,n*7);}
function mmdd(d){return(d.getMonth()+1).toString().padStart(2,'0')+'/'+(d.getDate()).toString().padStart(2,'0');}
function getDayLabels(){return['4a','8a','12p','4p','8p','12a'];}
function getWeekLabels(){var m=currentMonday();return Array.from({length:7},function(_,i){return mmdd(addDays(m,i));});}
function getMonthLabels(){var now=new Date();var d=new Date(now.getFullYear(),now.getMonth(),1);var day=d.getDay();d.setDate(d.getDate()+(day===0?1:day===1?0:8-day));return Array.from({length:4},function(){var r=mmdd(new Date(d));d.setDate(d.getDate()+7);return r;});}
function getQuarterLabels(){var m=currentMonday();return Array.from({length:13},function(_,i){return mmdd(addWeeks(m,-12+i));});}
function getLabels(range,sd,ed){
  if(range==='Day')return getDayLabels();
  if(range==='Week')return getWeekLabels();
  if(range==='Month')return getMonthLabels();
  if(range==='Quarter')return getQuarterLabels();
  if(range==='Custom'&&sd&&ed){
    var s=new Date(sd),e=new Date(ed);var diff=Math.round((e-s)/86400000);
    if(diff<=15)return Array.from({length:Math.min(diff+1,16)},function(_,i){return mmdd(addDays(s,i));});
    var dd=new Date(s);var wd=dd.getDay();dd.setDate(dd.getDate()+(wd===0?1:wd===1?0:8-wd));
    var labels=[];while(dd<=e&&labels.length<16){labels.push(mmdd(new Date(dd)));dd.setDate(dd.getDate()+7);}
    return labels.length?labels:[mmdd(s)];
  }
  return getWeekLabels();
}
function orgAvg(data){return data.map(function(v){return+(v*1.04+2).toFixed(1);});}

// ── KPI CONFIG ────────────────────────────────────────────────────────────────
var KPI_CFG={};
window.registerTrendKpi=function(id,cfg){ KPI_CFG[id]=cfg; };
window.getTrendKpiCfg=function(id){ return KPI_CFG[id]; };

var LM_STORES=[{name:'Rancho #3096',rank:1},{name:'Downtown #2104',rank:2},{name:'Westside #1882',rank:3},{name:'Northgate #4411',rank:4},{name:'Lakeside #3340',rank:5},{name:'Southbay #1122',rank:6},{name:'Uptown #2278',rank:7},{name:'Valley #3319',rank:8}];

// ── STATE ─────────────────────────────────────────────────────────────────────
var lmCurKPI='labor',lmRange='Week',lmModalMode='weekly',lmWtd=false,lmOrg=false,lmChain=false,lmGranularity='week',lmTab='hist',lmView='bar',lmActiveSup=null,lmMenuOpen=false;
var lmSupMode=false,lmSupKpiKey=null;
var lmOverlayKeys=[],lmAddMetricOpen=false;
var LM_OVERLAY_COLORS=['#DB2777','#0EA5E9','#059669'];
var LM_OVERLAY_MAX=3;
var lmSvsSort='asc',lmSvsSearch='',lmSelectedStores=new Set([0,1,2,3,4]);
var lmSvsMode='weekly';var lmSvsGranularity='day';
var lmHiddenSeries=new Set();
var lmCharts={main:null,svs:null,sup:{}};
var lmAllowedKpis=null,lmNoSup=false;
var LM_STORE_RANK={sales:3,cash:12,labor:5,loss:8,food:7},LM_TOTAL_STORES=25;

function lmGetActiveCfg(){
  if(lmSupMode&&lmSupKpiKey){
    var mainCfg=KPI_CFG[lmCurKPI];
    var sup=mainCfg.supporting.find(function(s){return s.key===lmSupKpiKey;});
    if(sup)return Object.assign({},sup,{color:sup.iconColor});
  }
  return KPI_CFG[lmCurKPI];
}
function lmBuildKpiMenu(){
  var menu=document.getElementById('lm-kpiMenu');if(!menu)return;
  var html='';
  Object.keys(KPI_CFG).forEach(function(key){
    if(lmAllowedKpis&&lmAllowedKpis.indexOf(key)===-1)return;
    var cfg=KPI_CFG[key];
    var isActive=!lmSupMode&&lmCurKPI===key;
    html+='<div class="lm-kopt'+(isActive?' active':'')+'" onclick="lmSelectKPI(\''+key+'\')" data-kpi="'+key+'">'
      +'<span class="lm-kdot" style="background:'+cfg.color+'"></span>'+cfg.label+'</div>';
    if(!lmNoSup&&cfg.supporting&&cfg.supporting.length>0){
      cfg.supporting.forEach(function(s){
        var isSupActive=lmSupMode&&lmCurKPI===key&&lmSupKpiKey===s.key;
        html+='<div class="lm-kopt lm-kopt-sub'+(isSupActive?' active':'')+'" onclick="lmSelectSupKPI(\''+key+'\',\''+s.key+'\')" data-kpi="'+key+'" data-sup-key="'+s.key+'" style="padding-left:26px;">'+s.label+'</div>';
      });
    }
  });
  menu.innerHTML=html;
}

// ── ADD METRIC (cross-dashboard, same-data-type overlay, up to LM_OVERLAY_MAX) ─
function lmMetricType(cfg){ return cfg.isCur?'$':(cfg.unit==='%'?'%':'number'); }
function lmUpdateAddMetricBtn(){
  var btn=document.getElementById('lm-addMetricBtn');if(!btn)return;
  if(lmOverlayKeys.length){
    var first=KPI_CFG[lmOverlayKeys[0]];
    var extra=lmOverlayKeys.length-1;
    btn.classList.add('active');
    btn.innerHTML='<span class="lm-kdot" style="background:'+LM_OVERLAY_COLORS[0]+'"></span><span>'+(first?first.label:'')+'</span>'
      +(extra>0?'<span class="lm-addmetric-more">+'+extra+'</span>':'')
      +'<span class="lm-addmetric-x" onclick="lmClearOverlays(event)" title="Remove all">&times;</span>';
  }else{
    btn.classList.remove('active');
    btn.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span id="lm-addMetricLbl">Add Metric</span>';
  }
}
function lmBuildAddMetricMenu(){
  var menu=document.getElementById('lm-addMetricMenu');if(!menu)return;
  var mainCfg=lmGetActiveCfg();if(!mainCfg){menu.innerHTML='';return;}
  var mainType=lmMetricType(mainCfg);
  var typeName=mainType==='$'?'dollar':mainType==='%'?'percent':'number';
  var catalog=(typeof tmBuildMetricCatalog==='function'?tmBuildMetricCatalog():[])
    .filter(function(m){ return m.type===mainType&&m.key!==lmCurKPI; })
    .sort(function(a,b){
      if(a.dashLabel!==b.dashLabel)return a.dashLabel<b.dashLabel?-1:1;
      return a.label<b.label?-1:1;
    });
  if(!catalog.length){ menu.innerHTML='<div class="lm-kopt-empty">No other '+typeName+' metrics available</div>'; return; }
  var atMax=lmOverlayKeys.length>=LM_OVERLAY_MAX;
  var html='<div class="lm-kopt-group lm-kopt-group-hdr"><span>Select up to '+LM_OVERLAY_MAX+'</span><span>'+lmOverlayKeys.length+'/'+LM_OVERLAY_MAX+'</span></div>';
  var lastGroup=null;
  catalog.forEach(function(m){
    if(m.dashLabel!==lastGroup){ html+='<div class="lm-kopt-group">'+m.dashLabel+'</div>'; lastGroup=m.dashLabel; }
    var isChecked=lmOverlayKeys.indexOf(m.key)!==-1;
    var disabled=!isChecked&&atMax;
    html+='<div class="lm-kopt lm-kopt-check'+(isChecked?' active':'')+(disabled?' disabled':'')+'" '+(disabled?'':'onclick="lmToggleOverlay(\''+m.key+'\')"')+'>'
      +'<span class="lm-kchk">'+(isChecked?'&#10003;':'')+'</span>'+m.label+'</div>';
  });
  menu.innerHTML=html;
}
window.lmToggleAddMetricMenu=function(){
  lmAddMetricOpen=!lmAddMetricOpen;
  var m=document.getElementById('lm-addMetricMenu');if(m)m.classList.toggle('open',lmAddMetricOpen);
  if(lmAddMetricOpen)lmBuildAddMetricMenu();
};
window.lmToggleOverlay=function(key){
  var idx=lmOverlayKeys.indexOf(key);
  if(idx!==-1){ lmOverlayKeys.splice(idx,1); }
  else{ if(lmOverlayKeys.length>=LM_OVERLAY_MAX)return; lmOverlayKeys.push(key); }
  lmBuildAddMetricMenu();
  lmBuildMain();
};
window.lmClearOverlays=function(e){
  if(e)e.stopPropagation();
  lmOverlayKeys=[];
  lmBuildMain();
};
function lmApplyOverlay(){
  lmUpdateAddMetricBtn();
  if(!lmOverlayKeys.length||lmWtd)return;
  var sd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
  var ed=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
  var isTable=lmView==='table';
  var thead,tbody,tfoot,rows;
  if(isTable){
    thead=document.getElementById('lm-mainTHead');tbody=document.getElementById('lm-mainTBody');tfoot=document.getElementById('lm-mainTFoot');
    rows=tbody?tbody.querySelectorAll('tr'):null;
  }
  lmOverlayKeys.forEach(function(key,idx){
    var ocfg=KPI_CFG[key];if(!ocfg)return;
    var color=LM_OVERLAY_COLORS[idx%LM_OVERLAY_COLORS.length];
    var odata=lmRange==='Day' ? (ocfg.day||[]) : (((lmGetRangeData(ocfg,lmRange,sd,ed))||{}).data||[]);
    if(isTable){
      if(thead){var th=document.createElement('th');th.textContent=ocfg.label;th.style.color=color;thead.appendChild(th);}
      if(rows){
        rows.forEach(function(tr,i){
          var td=document.createElement('td');td.style.color=color;td.style.fontWeight='500';
          td.textContent=odata[i]!=null?lmFmtVal(odata[i],ocfg):'—';
          tr.appendChild(td);
        });
      }
      if(tfoot){
        var frow=tfoot.querySelector('tr');
        if(frow&&odata.length){
          var ftd=document.createElement('td');ftd.style.color=color;
          var isAvg=!ocfg.isCur;
          var sum=odata.reduce(function(s,v){return s+v;},0);
          ftd.textContent=isAvg?lmFmtVal(lmAvg(odata),ocfg):lmFmtVal(+sum.toFixed(1),ocfg);
          frow.appendChild(ftd);
        }
      }
    }else{
      if(!lmCharts.main)return;
      lmCharts.main.data.datasets.push({
        type:'line',label:ocfg.label,data:odata,
        borderColor:color,backgroundColor:'transparent',borderWidth:2.5,
        pointRadius:3,pointBackgroundColor:color,pointBorderColor:'#fff',pointBorderWidth:1.5,
        tension:0.35,fill:false,order:0
      });
    }
  });
  if(!isTable&&lmCharts.main){
    lmCharts.main.update();
    var lgd=document.getElementById('lm-mainLgd');
    if(lgd){
      lmOverlayKeys.forEach(function(key,idx){
        var ocfg=KPI_CFG[key];if(!ocfg)return;
        var color=LM_OVERLAY_COLORS[idx%LM_OVERLAY_COLORS.length];
        lgd.insertAdjacentHTML('beforeend','<span style="display:inline-flex;align-items:center;gap:4px;margin-left:8px;"><span class="lm-lgsolid" style="color:'+color+'"></span>'+ocfg.label+'</span>');
      });
    }
  }
}
function lmFmtVal(v,cfg){if(cfg.isCur){var a=Math.abs(v);return(v<0?'-$':'$')+a.toLocaleString();}return v+cfg.unit;}
function lmLwOf(a){return a.map(function(v){return+(v*1.09).toFixed(1);});}
function lmLyOf(a){return a.map(function(v){return+(v*1.16).toFixed(1);});}
function lmAvg(a){return+(a.reduce(function(s,v){return s+v;},0)/a.length).toFixed(1);}
function lmDestroyChart(k){if(lmCharts[k]){lmCharts[k].destroy();lmCharts[k]=null;}}

function lmGetRangeData(cfg,range,sd,ed){
  // Weekly granularity + Custom range: always produce week-boundary labels
  // (getLabels falls back to daily for ranges ≤15 days, which is wrong here)
  if(lmGranularity==='week'&&range==='Custom'&&sd&&ed){
    var _s=new Date(sd),_e=new Date(ed);
    var _d=new Date(_s);var _dw=_d.getDay();
    _d.setDate(_d.getDate()+(_dw===0?1:_dw===1?0:8-_dw));
    var _wl=[];
    while(_d<=_e&&_wl.length<16){_wl.push(mmdd(new Date(_d)));_d.setDate(_d.getDate()+7);}
    if(!_wl.length)_wl=[mmdd(_s)];
    return{labels:_wl,data:Array.from({length:_wl.length},function(_,i){return cfg.week[i%cfg.week.length];})};
  }
  if(lmGranularity==='day'&&range!=='Day'){
    if(range==='Week'){
      var wl=getWeekLabels();
      return{labels:wl,data:Array.from({length:7},function(_,i){return cfg.week[i%cfg.week.length];})};
    }
    if(range==='Month'){
      var now2=new Date();var d1=new Date(now2.getFullYear(),now2.getMonth(),1);
      var lastDay=new Date(now2.getFullYear(),now2.getMonth()+1,0).getDate();
      var ml=Array.from({length:lastDay},function(_,i){return mmdd(addDays(d1,i));});
      var md=Array.from({length:lastDay},function(_,i){return cfg.week[i%cfg.week.length];});
      return{labels:ml,data:md};
    }
    if(range==='Quarter'){
      var qStart=addWeeks(currentMonday(),-12);
      var qEnd=addDays(currentMonday(),6);
      var qlD=[],qd=new Date(qStart);
      while(qd<=qEnd&&qlD.length<92){qlD.push(mmdd(new Date(qd)));qd.setDate(qd.getDate()+1);}
      return{labels:qlD,data:Array.from({length:qlD.length},function(_,i){return cfg.week[i%cfg.week.length];})};
    }
    if(range==='Custom'&&sd&&ed){
      var cs=new Date(sd),ce=new Date(ed);
      var cdays=Math.round((ce-cs)/86400000)+1;
      var cl=Array.from({length:Math.min(cdays,90)},function(_,i){return mmdd(addDays(new Date(sd),i));});
      return{labels:cl,data:Array.from({length:cl.length},function(_,i){return cfg.week[i%cfg.week.length];})};
    }
  }
  var labels=getLabels(range,sd,ed);
  var map={Day:'day',Week:'week',Month:'month',Quarter:'quarter'};
  var base=cfg[map[range]||'week']||cfg.week;
  return{labels:labels,data:Array.from({length:labels.length},function(_,i){return base[i%base.length];})};
}

function lmBaseOpts(cfg,labelCount){
  var many=labelCount&&labelCount>14;
  return{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},datalabels:{display:false},tooltip:{mode:'index',intersect:false,callbacks:{label:function(c){return' '+c.dataset.label+': '+lmFmtVal(c.parsed.y,cfg);}}}},
    scales:{x:{grid:{display:false},ticks:{font:{size:many?8:10,family:'Roboto,system-ui,sans-serif'},color:'#4a4d58',autoSkip:!many,maxRotation:many?45:0,minRotation:many?45:0,maxTicksLimit:many?labelCount:16}},
      y:{ticks:{font:{size:10,family:'Roboto,system-ui,sans-serif'},color:'#4a4d58',callback:function(v){return lmFmtVal(v,cfg);}},grid:{color:'rgba(0,0,0,.06)'}}}};
}

function lmOrgDs(data,lbl){
  return{type:'line',label:lbl||'Org Avg',data:orgAvg(data),borderColor:'#8B5CF6',backgroundColor:'transparent',borderWidth:2,borderDash:[],pointRadius:3,pointBackgroundColor:'#8B5CF6',tension:0.35,fill:false,order:0,hidden:lmHiddenSeries.has('org')};
}
function lmChainDs(data,lbl){
  return{type:'line',label:lbl||'Chain Avg',data:data.map(function(v){return+(v*0.97-1).toFixed(1);}),borderColor:'#D97706',backgroundColor:'transparent',borderWidth:2,borderDash:[3,3],pointRadius:3,pointBackgroundColor:'#D97706',tension:0.35,fill:false,order:0,hidden:lmHiddenSeries.has('chain')};
}

function lmGetLegendItems(cfg,showLW,isWTD3bar){
  if(isWTD3bar){
    var it=[{key:'cur_wtd',label:'Current WTD',color:'#7F77DD',style:'sq'},{key:'lw_wtd',label:'LW WTD',color:'#E2784A',style:'sq'},{key:'ly_wtd',label:'LY WTD',color:'#639922',style:'sq'}];
    if(lmOrg)it.push({key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'});
    if(lmChain)it.push({key:'chain',label:'Chain Avg',color:'#D97706',style:'dash'});
    return it;
  }
  var it2=[{key:'current',label:cfg.label,color:cfg.color,style:'sq'}];
  if(showLW)it2.push({key:'lw',label:'Last Week',color:'#E2784A',style:'dash'});
  it2.push({key:'ly',label:'Last Year',color:'#639922',style:'dash'});
  if(lmOrg)it2.push({key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'});
  if(lmChain)it2.push({key:'chain',label:'Chain Avg',color:'#D97706',style:'dash'});
  return it2;
}

function lmBuildLegend(items){
  return items.map(function(item){
    var off=lmHiddenSeries.has(item.key);
    var icon='';
    if(item.style==='sq')icon='<span class="lm-lgsq" style="background:'+(off?'#ccc':item.color)+'"></span>';
    else if(item.style==='dash')icon='<span class="lm-lgline" style="color:'+(off?'#ccc':item.color)+'"></span>';
    else icon='<span class="lm-lgsolid" style="color:'+(off?'#ccc':item.color)+'"></span>';
    var chk='<input type="checkbox" '+(off?'':'checked')+' onchange="lmToggleSeries(\''+item.key+'\')" onclick="event.stopPropagation()" style="cursor:pointer;accent-color:'+item.color+';width:11px;height:11px;margin:0 3px 0 0;vertical-align:middle;">';
    return'<label style="cursor:pointer;opacity:'+(off?0.45:1)+';user-select:none;transition:opacity .15s;display:inline-flex;align-items:center;gap:1px;">'+chk+icon+item.label+'</label>';
  }).join('');
}

window.lmToggleSeries=function(key){
  if(lmHiddenSeries.has(key))lmHiddenSeries.delete(key);else lmHiddenSeries.add(key);
  if(lmTab==='svs')lmBuildSvS();else lmBuildMain();
};

// ── LW VISIBILITY HELPERS ────────────────────────────────────────────────────
function lmShowLW(){
  if(lmRange==='Month'||lmRange==='Quarter')return false;
  if(lmRange==='Custom'){
    var _s=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
    var _e=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
    if(_s&&_e&&Math.round((new Date(_e)-new Date(_s))/86400000)>14)return false;
  }
  return true;
}
function lmShowSvsLW(){
  if(lmSvsMode==='3m')return false;
  if(lmSvsMode==='custom'){
    var _s=document.getElementById('lm-svs-sd')?document.getElementById('lm-svs-sd').value:'';
    var _e=document.getElementById('lm-svs-ed')?document.getElementById('lm-svs-ed').value:'';
    if(_s&&_e&&Math.round((new Date(_e)-new Date(_s))/86400000)>14)return false;
  }
  return true;
}

// ── COMPARISON STATS ─────────────────────────────────────────────────────────
function lmBuildCompStats(){
  var el=document.getElementById('lm-compStats');if(!el)return;
  var cfg=KPI_CFG[lmCurKPI];
  function avg(a){return(!a||!a.length)?0:+(a.reduce(function(s,v){return s+v;},0)/a.length).toFixed(1);}
  function pct(cur,ref){if(!ref)return'—';var v=(cur-ref)/Math.abs(ref)*100;return(v>0?'+':'')+v.toFixed(1)+'%';}
  function vcolor(s){var n=parseFloat(s);return isNaN(n)?'#6b6d7a':n>0?'#3E7A59':'#a32d2d';}
  var dCur=avg(cfg.day),dLw=avg(lmLwOf(cfg.day||[])),dLy=avg(lmLyOf(cfg.day||[]));
  var wCur=avg(cfg.week),wLw=avg(lmLwOf(cfg.week||[])),wLy=avg(lmLyOf(cfg.week||[]));
  var mCur=avg(cfg.month||[]),mLm=avg(lmLwOf(cfg.month||[])),mLy=avg(lmLyOf(cfg.month||[]));
  var items;
  if(lmRange==='Day'){
    items=[
      {lbl:'CUR VS LW',sub:'Same Day',val:pct(dCur,dLw)},
      {lbl:'CUR VS LY',sub:'Same Day',val:pct(dCur,dLy)}
    ];
  }else if(lmRange==='Week'){
    items=[
      {lbl:'WTD VS LW',sub:'Week to Date',val:pct(wCur,wLw)},
      {lbl:'WTD VS LY',sub:'Week to Date',val:pct(wCur,wLy)}
    ];
  }else if(lmRange==='Month'){
    items=[
      {lbl:'MTD VS LM',sub:'Month to Date',val:pct(mCur,mLm)},
      {lbl:'MTD VS LY',sub:'Month to Date',val:pct(mCur,mLy)}
    ];
  }else if(lmRange==='Quarter'){
    items=[
      {lbl:'RANGE VS LY',sub:'Selected Range',val:pct(wCur,wLy)}
    ];
  }else{
    // Custom range: >30 days → LY only; ≤30 days → LM + LY
    var _csd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
    var _ced=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
    var _nd=(_csd&&_ced)?Math.round((new Date(_ced)-new Date(_csd))/86400000):0;
    if(_nd>30){
      items=[{lbl:'RANGE VS LY',sub:'Selected Range',val:pct(wCur,wLy)}];
    }else{
      items=[
        {lbl:'RANGE VS LM',sub:'Selected Range',val:pct(mCur,mLm)},
        {lbl:'RANGE VS LY',sub:'Selected Range',val:pct(wCur,wLy)}
      ];
    }
  }
  el.innerHTML=items.map(function(it,i){
    var col=vcolor(it.val);
    return'<div class="lm-citem">'
      +'<div><div class="lm-clbl">'+it.lbl+'</div><div class="lm-csub">'+it.sub+'</div></div>'
      +'<div class="lm-cval" style="color:'+col+'">'+it.val+'</div>'
      +'</div>';
  }).join('');
}

// ── PERIOD SUMMARY (reflects whichever KPI + range is currently shown) ──────
function lmBuildGraphSummary(){
  var el=document.getElementById('lm-graphSummary');if(!el)return;
  var cfg=lmGetActiveCfg();if(!cfg){el.innerHTML='';return;}
  var data;
  if(lmRange==='Day'){
    data=cfg.day||[];
  }else{
    var sd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
    var ed=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
    var rd=lmGetRangeData(cfg,lmRange,sd,ed);
    data=(rd&&rd.data)||[];
  }
  if(!data.length){el.innerHTML='';return;}
  var avgV=lmAvg(data);
  var minV=Math.min.apply(null,data),maxV=Math.max.apply(null,data);
  var first=data[0],last=data[data.length-1];
  var chgPct=first?((last-first)/Math.abs(first)*100):0;
  var chgUp=chgPct>=0;
  el.innerHTML='<div class="lm-stitle">Period Summary</div>'
    +'<div class="lm-ps">'
      +'<div class="lm-ps-row"><span class="lm-ps-lbl">Latest</span><span class="lm-ps-val">'+lmFmtVal(last,cfg)+'</span></div>'
      +'<div class="lm-ps-row"><span class="lm-ps-lbl">Average</span><span class="lm-ps-val">'+lmFmtVal(avgV,cfg)+'</span></div>'
      +'<div class="lm-ps-row"><span class="lm-ps-lbl">High</span><span class="lm-ps-val">'+lmFmtVal(maxV,cfg)+'</span></div>'
      +'<div class="lm-ps-row"><span class="lm-ps-lbl">Low</span><span class="lm-ps-val">'+lmFmtVal(minV,cfg)+'</span></div>'
      +'<div class="lm-ps-row"><span class="lm-ps-lbl">Change over range</span><span class="lm-ps-val '+(chgUp?'up':'down')+'">'+(chgUp?'&#9650;':'&#9660;')+' '+Math.abs(chgPct).toFixed(1)+'%</span></div>'
    +'</div>';
}

// ── MAIN CHART ────────────────────────────────────────────────────────────────
function lmBuildMain(){
  lmDestroyChart('main');
  var isTable=lmView==='table';
  var cw=document.getElementById('lm-mainChartWrap'),tw=document.getElementById('lm-mainTableWrap');
  if(!cw)return;
  cw.style.display=isTable?'none':'';
  tw.style.display=isTable?'':'none';
  var cb=document.getElementById('lm-wtdCardBlock');cb.style.display='none';cb.innerHTML='';
  if(lmRange==='Day')lmBuildDailyMain();
  else if(lmWtd)lmBuildWTDMain();else lmBuildNormalMain();
  lmBuildSubCharts();
  lmBuildCompStats();
  lmBuildGraphSummary();
  lmApplyOverlay();
}

function lmBuildNormalMain(){
  var cfg=lmGetActiveCfg();
  var sd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
  var ed=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
  var rd=lmGetRangeData(cfg,lmRange,sd,ed);
  var labels=rd.labels,data=rd.data;
  var lw=lmLwOf(data),ly=lmLyOf(data);
  var isLine=lmView==='line';
  var showLW=lmShowLW();
  var datasets=[{type:isLine?'line':'bar',label:cfg.label,data:data,backgroundColor:isLine?cfg.color+'25':cfg.color+'BB',borderColor:cfg.color,borderWidth:isLine?2.5:0,borderRadius:4,pointRadius:isLine?4:0,pointHoverRadius:isLine?6:0,pointBackgroundColor:cfg.color,pointBorderColor:'#fff',pointBorderWidth:isLine?1.5:0,tension:0.35,fill:isLine?'origin':false,order:2,hidden:lmHiddenSeries.has('current')}];
  if(showLW)datasets.push({type:'line',label:'Last Week',data:lw,borderColor:'#E2784A',backgroundColor:'transparent',borderWidth:2,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#E2784A',tension:0.35,fill:false,order:1,hidden:lmHiddenSeries.has('lw')});
  datasets.push({type:'line',label:'Last Year',data:ly,borderColor:'#639922',backgroundColor:'transparent',borderWidth:2,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#639922',tension:0.35,fill:false,order:1,hidden:lmHiddenSeries.has('ly')});
  if(lmOrg)datasets.push(lmOrgDs(data));
  if(lmChain)datasets.push(lmChainDs(data));
  var ctx=document.getElementById('lm-mainC');if(!ctx)return;
  lmCharts.main=new Chart(ctx,{type:isLine?'line':'bar',data:{labels:labels,datasets:datasets},options:lmBaseOpts(cfg,labels.length)});
  document.getElementById('lm-mainLgd').innerHTML=lmBuildLegend(lmGetLegendItems(cfg,showLW,false));
  var thead=document.getElementById('lm-mainTHead'),tbody=document.getElementById('lm-mainTBody');
  var chainData=lmChain?data.map(function(v){return+(v*0.97-1).toFixed(1);}):null;
  thead.innerHTML='<th>Period</th><th>Current</th>'+(showLW?'<th>LW</th>':'')+'<th>LY</th>'+(lmOrg?'<th>Org Avg</th>':'')+(lmChain?'<th>Chain</th>':'');
  var org=lmOrg?orgAvg(data):null;
  tbody.innerHTML=labels.map(function(l,i){return'<tr><td>'+l+'</td><td>'+lmFmtVal(data[i],cfg)+'</td>'+(showLW?'<td>'+lmFmtVal(lw[i],cfg)+'</td>':'')+'<td>'+lmFmtVal(ly[i],cfg)+'</td>'+(org?'<td style="color:#8B5CF6;font-weight:500">'+lmFmtVal(org[i],cfg)+'</td>':'')+(chainData?'<td style="color:#D97706;font-weight:500">'+lmFmtVal(chainData[i],cfg)+'</td>':'')+'</tr>';}).join('');
  var tfoot=document.getElementById('lm-mainTFoot');
  if(tfoot){
    var isAvg=!cfg.isCur;
    var footLabel=isAvg?'Average':'Total';
    var sumFn=function(a){return a.reduce(function(s,v){return s+v;},0);};
    var footVal=isAvg?lmFmtVal(lmAvg(data),cfg):lmFmtVal(+sumFn(data).toFixed(1),cfg);
    var footLw=isAvg?lmFmtVal(lmAvg(lw),cfg):lmFmtVal(+sumFn(lw).toFixed(1),cfg);
    var footLy=isAvg?lmFmtVal(lmAvg(ly),cfg):lmFmtVal(+sumFn(ly).toFixed(1),cfg);
    tfoot.innerHTML='<tr><td>'+footLabel+'</td><td>'+footVal+'</td>'+(showLW?'<td>'+footLw+'</td>':'')+'<td>'+footLy+'</td>'+(org?'<td style="color:#8B5CF6">'+lmFmtVal(lmAvg(org),cfg)+'</td>':'')+(chainData?'<td style="color:#D97706">'+lmFmtVal(lmAvg(chainData),cfg)+'</td>':'')+'</tr>';
  }
}

function lmBuildDailyMain(){
  var cfg=lmGetActiveCfg();
  var cur=lmAvg(cfg.day),lw=lmAvg(lmLwOf(cfg.day)),ly=lmAvg(lmLyOf(cfg.day));
  var yest=addDays(new Date(),-1),lwDay=addDays(yest,-7),lyDay=addDays(yest,-364);
  var barLabels=['Today\n'+mmdd(yest),'Last Week\n'+mmdd(lwDay),'Last Year\n'+mmdd(lyDay)];
  var barKeys=['cur_day','lw_day','ly_day'];
  var barVals=[cur,lw,ly];
  var barCols=[cfg.color+'BB','#E2784A99','#63992299'];
  var isLine=lmView==='line';
  var datasets=[{
    type:isLine?'line':'bar',
    data:barVals.map(function(v,i){return lmHiddenSeries.has(barKeys[i])?null:v;}),
    backgroundColor:isLine?'transparent':barCols.map(function(c,i){return lmHiddenSeries.has(barKeys[i])?'rgba(200,200,200,0.4)':c;}),
    borderColor:isLine?cfg.color:'transparent',
    borderWidth:isLine?2:0,borderRadius:isLine?0:6,
    pointRadius:isLine?5:0,pointBackgroundColor:isLine?cfg.color:'transparent',
    tension:0.1,fill:false,
    label:'Daily',categoryPercentage:0.55,barPercentage:0.75
  }];
  if(lmOrg){var ov=+(cur*1.04+2).toFixed(1);datasets.push({type:'line',label:'Org Avg',data:[ov,ov,ov],borderColor:'#8B5CF6',backgroundColor:'transparent',borderWidth:2,pointRadius:5,pointBackgroundColor:'#8B5CF6',fill:false,order:0,hidden:lmHiddenSeries.has('org')});}
  if(lmChain){var cv=+(cur*0.97-1).toFixed(1);datasets.push({type:'line',label:'Chain Avg',data:[cv,cv,cv],borderColor:'#D97706',backgroundColor:'transparent',borderWidth:2,borderDash:[3,3],pointRadius:5,pointBackgroundColor:'#D97706',fill:false,order:0,hidden:lmHiddenSeries.has('chain')});}
  var ctx=document.getElementById('lm-mainC');if(!ctx)return;
  lmCharts.main=new Chart(ctx,{type:isLine?'line':'bar',data:{labels:barLabels,datasets:datasets},options:lmBaseOpts(cfg)});
  var lgItems=[{key:'cur_day',label:'Current',color:cfg.color,style:isLine?'solid':'sq'},{key:'lw_day',label:'Last Week',color:'#E2784A',style:isLine?'solid':'sq'},{key:'ly_day',label:'Last Year',color:'#639922',style:isLine?'solid':'sq'}];
  if(lmOrg)lgItems.push({key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'});
  if(lmChain)lgItems.push({key:'chain',label:'Chain Avg',color:'#D97706',style:'dash'});
  document.getElementById('lm-mainLgd').innerHTML=lmBuildLegend(lgItems);
  var thead=document.getElementById('lm-mainTHead'),tbody=document.getElementById('lm-mainTBody'),tfoot=document.getElementById('lm-mainTFoot');
  thead.innerHTML='<th>Period</th><th>Value</th>'+(lmOrg?'<th>Org Avg</th>':'')+(lmChain?'<th>Chain</th>':'');
  var orgV=lmOrg?+(cur*1.04+2).toFixed(1):null,chainV=lmChain?+(cur*0.97-1).toFixed(1):null;
  tbody.innerHTML=[{lbl:'Current ('+mmdd(yest)+')',val:cur},{lbl:'Last Week ('+mmdd(lwDay)+')',val:lw},{lbl:'Last Year ('+mmdd(lyDay)+')',val:ly}].map(function(r){
    return'<tr><td>'+r.lbl+'</td><td>'+lmFmtVal(r.val,cfg)+'</td>'+(orgV?'<td style="color:#8B5CF6;font-weight:500">'+lmFmtVal(orgV,cfg)+'</td>':'')+(chainV?'<td style="color:#D97706;font-weight:500">'+lmFmtVal(chainV,cfg)+'</td>':'')+'</tr>';
  }).join('');
  if(tfoot)tfoot.innerHTML='';
}

function lmBuildWTDMain(){
  var cfg=lmGetActiveCfg();
  var isLine=lmView==='line';
  if(lmRange==='Week'){
    var cur=lmAvg(cfg.week),lw=lmAvg(lmLwOf(cfg.week)),ly=lmAvg(lmLyOf(cfg.week));
    var vsLw=+(cur-lw).toFixed(1),vsLy=+(cur-ly).toFixed(1);
    var mon=currentMonday(),lwMon=addWeeks(mon,-1),lyMon=addWeeks(mon,-52);
    var cb=document.getElementById('lm-wtdCardBlock');
    cb.innerHTML='<div class="lm-wcard"><div class="lm-wcard-lbl">WTD Current</div><div class="lm-wcard-val" style="color:#7F77DD">'+lmFmtVal(cur,cfg)+'</div></div>'
      +'<div class="lm-wcard"><div class="lm-wcard-lbl">WTD Last Week</div><div class="lm-wcard-val" style="color:#E2784A">'+lmFmtVal(lw,cfg)+'</div><div class="lm-wcard-sub '+(vsLw<0?'lm-pos':'lm-neg')+'">'+(vsLw>0?'+':'')+vsLw+cfg.unit+'</div></div>'
      +'<div class="lm-wcard"><div class="lm-wcard-lbl">WTD Last Year</div><div class="lm-wcard-val" style="color:#639922">'+lmFmtVal(ly,cfg)+'</div><div class="lm-wcard-sub '+(vsLy<0?'lm-pos':'lm-neg')+'">'+(vsLy>0?'+':'')+vsLy+cfg.unit+'</div></div>';
    if(lmOrg){var ov=+(cur*1.04+2).toFixed(1);cb.innerHTML+='<div class="lm-wcard"><div class="lm-wcard-lbl">Org Avg</div><div class="lm-wcard-val" style="color:#8B5CF6">'+lmFmtVal(ov,cfg)+'</div></div>';}
    cb.style.display='flex';
    var wtdKeys=['cur_wtd','lw_wtd','ly_wtd'];
    var wtdColors=['#7F77DD','#E2784A','#639922'];
    var barLabels=['Cur Wk\n'+mmdd(mon),'LW\n'+mmdd(lwMon),'LY\n'+mmdd(lyMon)];
    var datasets=[{
      type:isLine?'line':'bar',
      data:[cur,lw,ly],
      backgroundColor:isLine?wtdColors:wtdColors.map(function(c,i){return lmHiddenSeries.has(wtdKeys[i])?'#ddd':c;}),
      borderColor:isLine?wtdColors:'transparent',
      borderWidth:isLine?2:0,borderRadius:isLine?0:6,
      pointRadius:isLine?5:0,pointBackgroundColor:isLine?wtdColors:undefined,
      tension:0.1,fill:false,label:'WTD'
    }];
    if(lmOrg){var ov2=+(cur*1.04+2).toFixed(1);datasets.push({type:'line',label:'Org Avg',data:[ov2,ov2,ov2],borderColor:'#8B5CF6',backgroundColor:'transparent',borderWidth:2,pointRadius:4,pointBackgroundColor:'#8B5CF6',fill:false,order:0,hidden:lmHiddenSeries.has('org')});}
    if(lmChain){var cv2=+(cur*0.97-1).toFixed(1);datasets.push({type:'line',label:'Chain Avg',data:[cv2,cv2,cv2],borderColor:'#D97706',backgroundColor:'transparent',borderWidth:2,borderDash:[3,3],pointRadius:4,pointBackgroundColor:'#D97706',fill:false,order:0,hidden:lmHiddenSeries.has('chain')});}
    var ctx=document.getElementById('lm-mainC');if(!ctx)return;
    lmCharts.main=new Chart(ctx,{type:isLine?'line':'bar',data:{labels:barLabels,datasets:datasets},options:lmBaseOpts(cfg)});
    document.getElementById('lm-mainLgd').innerHTML=lmBuildLegend(lmGetLegendItems(cfg,false,true));
  }else{
    var sd2=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
    var ed2=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
    var rd2=lmGetRangeData(cfg,lmRange,sd2,ed2);
    var labels2=rd2.labels,data2=rd2.data,ly2=lmLyOf(data2);
    var datasets2=[{type:isLine?'line':'bar',label:'WTD Current',data:data2,backgroundColor:cfg.color+'BB',borderColor:cfg.color,borderWidth:isLine?2:0,borderRadius:4,pointRadius:isLine?3:0,pointBackgroundColor:cfg.color,tension:0.35,fill:false,order:2,hidden:lmHiddenSeries.has('current')},{type:'line',label:'Last Year',data:ly2,borderColor:'#639922',backgroundColor:'transparent',borderWidth:2,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#639922',tension:0.35,fill:false,order:1,hidden:lmHiddenSeries.has('ly')}];
    if(lmOrg)datasets2.push(lmOrgDs(data2));
    var ctx2=document.getElementById('lm-mainC');if(!ctx2)return;
    lmCharts.main=new Chart(ctx2,{type:isLine?'line':'bar',data:{labels:labels2,datasets:datasets2},options:lmBaseOpts(cfg)});
    document.getElementById('lm-mainLgd').innerHTML=lmBuildLegend([{key:'current',label:'WTD Current',color:cfg.color,style:isLine?'solid':'sq'},{key:'ly',label:'Last Year',color:'#639922',style:'dash'}].concat(lmOrg?[{key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'}]:[]));
  }
}

// ── SUB CHARTS ────────────────────────────────────────────────────────────────
function lmBuildSubCharts(){
  var row=document.getElementById('lm-subChartsRow');if(!row)return;
  row.innerHTML='';
  Object.keys(lmCharts.sup).forEach(function(k){if(lmCharts.sup[k]){lmCharts.sup[k].destroy();delete lmCharts.sup[k];}});
  if(lmNoSup||lmSupMode){var sp=document.getElementById('lm-subPaneWrap');if(sp)sp.style.display='none';return;}
  var cfg=KPI_CFG[lmCurKPI];
  if(!cfg.supporting||cfg.supporting.length===0){document.getElementById('lm-subPaneWrap').style.display='none';return;}
  document.getElementById('lm-subPaneWrap').style.display='';
  var isTable=lmView==='table';
  cfg.supporting.forEach(function(s){
    if(lmRange==='Day')lmBuildOneDaySup(s,isTable);
    else if(lmWtd)lmBuildOneSupWTD(s,isTable);
    else lmBuildOneSup(s,isTable);
  });
}

function lmBuildOneDaySup(s,isTable){
  var scfg=Object.assign({},s);
  var cur=lmAvg(scfg.day||scfg.week),lw=lmAvg(lmLwOf(scfg.day||scfg.week)),ly=lmAvg(lmLyOf(scfg.day||scfg.week));
  var yest=addDays(new Date(),-1),lwDay=addDays(yest,-7),lyDay=addDays(yest,-364);
  var row=document.getElementById('lm-subChartsRow');
  var col=document.createElement('div');col.className='lm-sub-chart-col';col.id='lm-subCol_'+s.key;
  col.innerHTML='<div class="lm-sub-cbt"><span style="width:8px;height:8px;border-radius:50%;background:'+s.iconColor+';display:inline-block;flex-shrink:0;"></span><span>'+s.label+'</span><span style="font-size:10px;color:#9295a0;font-weight:400;margin-left:2px;">'+s.value+' <span class="'+(s.up?'lm-pos':'lm-neg')+'" style="font-size:9px;">'+s.change+'</span></span></div>'
    +'<div class="lm-sub-chwrap" style="display:'+(isTable?'none':'block')+'"><canvas id="lm-subC_'+s.key+'"></canvas></div>'
    +'<div id="lm-subTbl_'+s.key+'" style="display:'+(isTable?'block':'none')+';overflow-x:auto;max-height:200px;overflow-y:auto;"><table class="lm-tbl"><thead><tr><th>Period</th><th>Value</th>'+(lmOrg?'<th>Org</th>':'')+'</tr></thead><tbody><tr><td>Today ('+mmdd(yest)+')</td><td>'+lmFmtVal(cur,scfg)+'</td>'+(lmOrg?'<td style="color:#8B5CF6">'+lmFmtVal(+(cur*1.04+2).toFixed(1),scfg)+'</td>':'')+'</tr><tr><td>LW ('+mmdd(lwDay)+')</td><td>'+lmFmtVal(lw,scfg)+'</td>'+(lmOrg?'<td style="color:#8B5CF6">'+lmFmtVal(+(lw*1.04+2).toFixed(1),scfg)+'</td>':'')+'</tr><tr><td>LY ('+mmdd(lyDay)+')</td><td>'+lmFmtVal(ly,scfg)+'</td>'+(lmOrg?'<td style="color:#8B5CF6">'+lmFmtVal(+(ly*1.04+2).toFixed(1),scfg)+'</td>':'')+'</tr></tbody></table></div>'
    +'<div class="lm-lgrow" id="lm-subLgd_'+s.key+'" style="margin-top:4px;font-size:10px;"></div>';
  row.appendChild(col);
  var ctx=document.getElementById('lm-subC_'+s.key);if(!ctx)return;
  var barLabels=['Today\n'+mmdd(yest),'Last Week\n'+mmdd(lwDay),'Last Year\n'+mmdd(lyDay)];
  var barCols=[s.iconColor+'BB','#E2784A99','#63992299'];
  var isLine=lmView==='line';
  var ptColors=[s.iconColor,'#E2784A','#639922'];
  var datasets=[{
    type:isLine?'line':'bar',
    data:[cur,lw,ly],
    backgroundColor:isLine?'transparent':barCols,
    borderColor:isLine?ptColors:'transparent',
    borderWidth:isLine?2:0,borderRadius:isLine?0:4,
    pointRadius:isLine?4:0,pointBackgroundColor:isLine?ptColors:'transparent',
    tension:0.1,fill:false,label:'Daily',categoryPercentage:0.55,barPercentage:0.75
  }];
  if(lmOrg){var ov=+(cur*1.04+2).toFixed(1);datasets.push({type:'line',label:'Org Avg',data:[ov,ov,ov],borderColor:'#8B5CF6',backgroundColor:'transparent',borderWidth:2,pointRadius:3,pointBackgroundColor:'#8B5CF6',fill:false,order:0,hidden:lmHiddenSeries.has('org')});}
  lmCharts.sup[s.key]=new Chart(ctx,{type:isLine?'line':'bar',data:{labels:barLabels,datasets:datasets},options:lmBaseOpts(scfg)});
  var lgd=document.getElementById('lm-subLgd_'+s.key);
  if(lgd)lgd.innerHTML=lmBuildLegend([{key:'cur_day',label:'Current',color:s.iconColor,style:isLine?'solid':'sq'},{key:'lw_day',label:'Last Week',color:'#E2784A',style:isLine?'solid':'sq'},{key:'ly_day',label:'Last Year',color:'#639922',style:isLine?'solid':'sq'}].concat(lmOrg?[{key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'}]:[]));
}

function lmBuildOneSup(s,isTable){
  var scfg=Object.assign({},s);
  var sd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
  var ed=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
  var rd=lmGetRangeData(scfg,lmRange,sd,ed);var labels=rd.labels,data=rd.data;
  var lw=lmLwOf(data),ly=lmLyOf(data);
  var isLine=lmView==='line';
  var showLW=lmShowLW();
  var row=document.getElementById('lm-subChartsRow');
  var col=document.createElement('div');col.className='lm-sub-chart-col';col.id='lm-subCol_'+s.key;
  col.innerHTML='<div class="lm-sub-cbt"><span style="width:8px;height:8px;border-radius:50%;background:'+s.iconColor+';display:inline-block;flex-shrink:0;"></span><span>'+s.label+'</span><span style="font-size:10px;color:#9295a0;font-weight:400;margin-left:2px;">'+s.value+' <span class="'+(s.up?'lm-pos':'lm-neg')+'" style="font-size:9px;">'+s.change+'</span></span></div>'
    +'<div class="lm-sub-chwrap" style="display:'+(isTable?'none':'block')+'"><canvas id="lm-subC_'+s.key+'"></canvas></div>'
    +'<div id="lm-subTbl_'+s.key+'" style="display:'+(isTable?'block':'none')+';overflow-x:auto;max-height:165px;overflow-y:auto;"><table class="lm-tbl"><thead><tr><th>Period</th><th>Cur</th>'+(showLW?'<th>LW</th>':'')+'<th>LY</th>'+(lmOrg?'<th>Org</th>':'')+'</tr></thead><tbody id="lm-subTbody_'+s.key+'"></tbody><tfoot id="lm-subTFoot_'+s.key+'"></tfoot></table></div>'
    +'<div class="lm-lgrow" id="lm-subLgd_'+s.key+'" style="margin-top:4px;font-size:10px;"></div>';
  row.appendChild(col);
  var ctx=document.getElementById('lm-subC_'+s.key);if(!ctx)return;
  var datasets=[{type:isLine?'line':'bar',label:s.label,data:data,backgroundColor:s.iconColor+'BB',borderColor:s.iconColor,borderWidth:isLine?2:0,borderRadius:3,pointRadius:isLine?2:0,pointBackgroundColor:s.iconColor,tension:0.35,fill:false,order:2,hidden:lmHiddenSeries.has('current')}];
  if(showLW)datasets.push({type:'line',label:'Last Week',data:lw,borderColor:'#E2784A',backgroundColor:'transparent',borderWidth:1.5,borderDash:[4,3],pointRadius:2,pointBackgroundColor:'#E2784A',tension:0.35,fill:false,order:1,hidden:lmHiddenSeries.has('lw')});
  datasets.push({type:'line',label:'Last Year',data:ly,borderColor:'#639922',backgroundColor:'transparent',borderWidth:1.5,borderDash:[4,3],pointRadius:2,pointBackgroundColor:'#639922',tension:0.35,fill:false,order:1,hidden:lmHiddenSeries.has('ly')});
  if(lmOrg)datasets.push(lmOrgDs(data,s.label+' Org'));
  lmCharts.sup[s.key]=new Chart(ctx,{type:isLine?'line':'bar',data:{labels:labels,datasets:datasets},options:lmBaseOpts(scfg,labels.length)});
  var lgd=document.getElementById('lm-subLgd_'+s.key);
  if(lgd)lgd.innerHTML=lmBuildLegend(lmGetLegendItems({label:s.label,color:s.iconColor},showLW,false));
  var tbody=document.getElementById('lm-subTbody_'+s.key);
  var org=lmOrg?orgAvg(data):null;
  if(tbody)tbody.innerHTML=labels.map(function(l,i){return'<tr><td>'+l+'</td><td>'+lmFmtVal(data[i],scfg)+'</td>'+(showLW?'<td>'+lmFmtVal(lw[i],scfg)+'</td>':'')+'<td>'+lmFmtVal(ly[i],scfg)+'</td>'+(org?'<td style="color:#8B5CF6;font-weight:500">'+lmFmtVal(org[i],scfg)+'</td>':'')+'</tr>';}).join('');
  var stfoot=document.getElementById('lm-subTFoot_'+s.key);
  if(stfoot){
    var sIsAvg=!scfg.isCur,sfn=function(a){return a.reduce(function(t,v){return t+v;},0);};
    var sfLabel=sIsAvg?'Average':'Total';
    var sfVal=sIsAvg?lmFmtVal(lmAvg(data),scfg):lmFmtVal(+sfn(data).toFixed(1),scfg);
    var sfLw=showLW?(sIsAvg?lmFmtVal(lmAvg(lw),scfg):lmFmtVal(+sfn(lw).toFixed(1),scfg)):null;
    var sfLy=sIsAvg?lmFmtVal(lmAvg(ly),scfg):lmFmtVal(+sfn(ly).toFixed(1),scfg);
    stfoot.innerHTML='<tr><td>'+sfLabel+'</td><td>'+sfVal+'</td>'+(sfLw?'<td>'+sfLw+'</td>':'')+'<td>'+sfLy+'</td>'+(org?'<td style="color:#8B5CF6">'+lmFmtVal(lmAvg(org),scfg)+'</td>':'')+'</tr>';
  }
}

function lmBuildOneSupWTD(s,isTable){
  var scfg=Object.assign({},s);
  var row=document.getElementById('lm-subChartsRow');
  var col=document.createElement('div');col.className='lm-sub-chart-col';col.id='lm-subCol_'+s.key;
  if(lmRange==='Week'){
    var cur=lmAvg(scfg.week),lw=lmAvg(lmLwOf(scfg.week)),ly=lmAvg(lmLyOf(scfg.week));
    var vsLw=+(cur-lw).toFixed(1),vsLy=+(cur-ly).toFixed(1);
    var mon=currentMonday(),lwMon=addWeeks(mon,-1),lyMon=addWeeks(mon,-52);
    col.innerHTML='<div class="lm-sub-cbt"><span style="width:8px;height:8px;border-radius:50%;background:'+s.iconColor+';display:inline-block;flex-shrink:0;"></span><span>'+s.label+'</span><span style="font-size:10px;color:#9295a0;font-weight:400;margin-left:2px;">'+s.value+' <span class="'+(s.up?'lm-pos':'lm-neg')+'" style="font-size:9px;">'+s.change+'</span></span></div>'
      +'<div class="lm-sub-chwrap" style="display:'+(isTable?'none':'block')+'"><canvas id="lm-subC_'+s.key+'"></canvas></div>'
      +'<div id="lm-subTbl_'+s.key+'" style="display:'+(isTable?'block':'none')+';overflow-x:auto;max-height:150px;overflow-y:auto;"><table class="lm-tbl"><thead><tr><th>Period</th><th>Cur WTD</th><th>LW WTD</th><th>LY WTD</th>'+(lmOrg?'<th>Org</th>':'')+'</tr></thead><tbody><tr><td>WTD</td><td>'+lmFmtVal(cur,scfg)+'</td><td>'+lmFmtVal(lw,scfg)+'</td><td>'+lmFmtVal(ly,scfg)+'</td>'+(lmOrg?'<td style="color:#8B5CF6;font-weight:500">'+lmFmtVal(+(cur*1.04+2).toFixed(1),scfg)+'</td>':'')+'</tr></tbody></table></div>'
      +'<div class="lm-lgrow" id="lm-subLgd_'+s.key+'" style="margin-top:4px;font-size:10px;"></div>';
    row.appendChild(col);
    var ctx=document.getElementById('lm-subC_'+s.key);if(!ctx)return;
    var wtdColors=['#7F77DD','#E2784A','#639922'];
    var barLabels=['Cur Wk\n'+mmdd(mon),'LW\n'+mmdd(lwMon),'LY\n'+mmdd(lyMon)];
    var _isl=lmView==='line';
    var datasets=[{type:_isl?'line':'bar',data:[cur,lw,ly],backgroundColor:_isl?wtdColors:wtdColors.map(function(c,i){return lmHiddenSeries.has(['cur_wtd','lw_wtd','ly_wtd'][i])?'#ddd':c;}),borderColor:_isl?wtdColors:'transparent',borderWidth:_isl?2:0,borderRadius:_isl?0:4,pointRadius:_isl?4:0,pointBackgroundColor:_isl?wtdColors:undefined,tension:0.1,fill:false,label:'WTD'}];
    if(lmOrg){var ov=+(cur*1.04+2).toFixed(1);datasets.push({type:'line',label:'Org Avg',data:[ov,ov,ov],borderColor:'#8B5CF6',backgroundColor:'transparent',borderWidth:2,pointRadius:3,pointBackgroundColor:'#8B5CF6',fill:false,order:0,hidden:lmHiddenSeries.has('org')});}
    lmCharts.sup[s.key]=new Chart(ctx,{type:_isl?'line':'bar',data:{labels:barLabels,datasets:datasets},options:lmBaseOpts(scfg)});
    var lgd=document.getElementById('lm-subLgd_'+s.key);
    if(lgd)lgd.innerHTML=lmBuildLegend(lmGetLegendItems(scfg,false,true));
  }else{
    var sd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
    var ed=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
    var rd=lmGetRangeData(scfg,lmRange,sd,ed);var labels=rd.labels,data=rd.data,ly=lmLyOf(data);
    col.innerHTML='<div class="lm-sub-cbt"><span style="width:8px;height:8px;border-radius:50%;background:'+s.iconColor+';display:inline-block;flex-shrink:0;"></span><span>'+s.label+'</span><span style="font-size:10px;color:#9295a0;font-weight:400;margin-left:2px;">'+s.value+' <span class="'+(s.up?'lm-pos':'lm-neg')+'" style="font-size:9px;">'+s.change+'</span></span></div>'
      +'<div class="lm-sub-chwrap" style="display:'+(isTable?'none':'block')+'"><canvas id="lm-subC_'+s.key+'"></canvas></div>'
      +'<div class="lm-lgrow" id="lm-subLgd_'+s.key+'" style="margin-top:4px;font-size:10px;"></div>';
    row.appendChild(col);
    var ctx2=document.getElementById('lm-subC_'+s.key);if(!ctx2)return;
    var _isl2=lmView==='line';
    var datasets2=[{type:_isl2?'line':'bar',label:'WTD Current',data:data,backgroundColor:scfg.iconColor+'BB',borderColor:scfg.iconColor,borderWidth:_isl2?1.5:0,borderRadius:3,pointRadius:_isl2?2:0,pointBackgroundColor:scfg.iconColor,tension:0.35,fill:false,order:2,hidden:lmHiddenSeries.has('current')},{type:'line',label:'Last Year',data:ly,borderColor:'#639922',backgroundColor:'transparent',borderWidth:1.5,borderDash:[4,3],pointRadius:2,pointBackgroundColor:'#639922',tension:0.35,fill:false,order:1,hidden:lmHiddenSeries.has('ly')}];
    if(lmOrg)datasets2.push(lmOrgDs(data,s.label+' Org'));
    lmCharts.sup[s.key]=new Chart(ctx2,{type:_isl2?'line':'bar',data:{labels:labels,datasets:datasets2},options:lmBaseOpts(scfg)});
    var lgd2=document.getElementById('lm-subLgd_'+s.key);
    if(lgd2)lgd2.innerHTML=lmBuildLegend([{key:'current',label:'WTD Current',color:scfg.iconColor,style:'sq'},{key:'ly',label:'Last Year',color:'#639922',style:'dash'}].concat(lmOrg?[{key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'}]:[]));
  }
}

// ── SUP KPI CARDS ─────────────────────────────────────────────────────────────
function lmRenderSupKPICards(){
  var cfg=KPI_CFG[lmCurKPI];
  var el=document.getElementById('lm-supKpis');if(!el)return;
  el.innerHTML=cfg.supporting.map(function(s){
    return'<div class="lm-skpi '+(lmActiveSup===s.key?'active-sup':'')+'" onclick="lmClickSup(\''+s.key+'\')">'
      +'<div class="lm-skpi-icon" style="background:'+s.iconBg+';color:'+s.iconColor+'">'+s.icon+'</div>'
      +'<div><div class="lm-skpi-lbl">'+s.label+'</div><div style="display:flex;align-items:baseline;"><span class="lm-skpi-val">'+s.value+'</span><span class="lm-skpi-chg '+(s.up?'lm-pos':'lm-neg')+'">'+s.change+'</span></div></div>'
      +'</div>';
  }).join('');
}

window.lmClickSup=function(key){
  lmActiveSup=lmActiveSup===key?null:key;
  lmRenderSupKPICards();
  if(lmActiveSup){
    document.querySelectorAll('.lm-sub-chart-col').forEach(function(c){
      var isT=c.id==='lm-subCol_'+key;
      c.style.background=isT?'#FAFBFF':'';c.style.borderTop=isT?'2px solid #5b52d4':'';
    });
    var wrap=document.getElementById('lm-subPaneWrap');
    if(wrap)setTimeout(function(){wrap.scrollIntoView({behavior:'smooth',block:'nearest'});},80);
  }else{
    document.querySelectorAll('.lm-sub-chart-col').forEach(function(c){c.style.background='';c.style.borderTop='';});
  }
};

// ── SvS EXTRA COLUMNS ─────────────────────────────────────────────────────────
var LM_SVS_EXTRA_COLS = {
  labor:[
    {key:'sales_v',   label:'Net Sales',    fn:function(s){return'$'+Math.round((26-s.rank)*2100+s.idx*180).toLocaleString();}},
    {key:'labor_usd', label:'Labor $',       fn:function(s){return'$'+Math.round(((26-s.rank)*2100+s.idx*180)*s.val*0.01).toLocaleString();}},
    {key:'fct_sales', label:'Fct Sales',     fn:function(s){return'$'+Math.round(((26-s.rank)*2100+s.idx*180)*1.03).toLocaleString();}},
    {key:'sch_hrs',   label:'Sch Hrs',       fn:function(s){return Math.round((26-s.rank)*38+s.idx*4);}},
    {key:'act_hrs',   label:'Act Hrs',       fn:function(s){return Math.round((26-s.rank)*39+s.idx*4);}},
    {key:'splh',      label:'SPLH',          fn:function(s){return'$'+(54-s.rank*0.6).toFixed(2);}},
  ],
  sales:[
    {key:'labor_pct', label:'Labor %',       fn:function(s){return(28+s.rank*0.25).toFixed(1)+'%';}},
    {key:'trans',     label:'Transactions',  fn:function(s){return Math.round((26-s.rank)*28+s.idx*5).toLocaleString();}},
    {key:'avg_check', label:'Avg Check',     fn:function(s){return'$'+(13.5-s.rank*0.08).toFixed(2);}},
    {key:'fct_sales', label:'Fct Sales',     fn:function(s){return'$'+Math.round(s.val*1.04).toLocaleString();}},
  ],
  food:[
    {key:'waste_usd', label:'Waste $',       fn:function(s){return'$'+Math.round((s.val-20)*180+s.idx*20).toLocaleString();}},
    {key:'theo_pct',  label:'Theo Cost %',   fn:function(s){return(s.val-2.8-s.rank*0.05).toFixed(1)+'%';}},
    {key:'variance',  label:'Variance',      fn:function(s){return'+'+(s.val-(s.val-2.8-s.rank*0.05)).toFixed(1)+'%';}},
  ],
  cash:[
    {key:'trans',     label:'Transactions',  fn:function(s){return Math.round((26-s.rank)*24+s.idx*4).toLocaleString();}},
    {key:'avg_check', label:'Avg Check',     fn:function(s){return'$'+(12.8+s.rank*0.1).toFixed(2);}},
    {key:'splh',      label:'SPLH',          fn:function(s){return'$'+(53-s.rank*0.5).toFixed(1);}},
  ],
  loss:[
    {key:'splh',      label:'SPLH',          fn:function(s){return'$'+(52-s.rank*0.6).toFixed(1);}},
    {key:'labor_usd', label:'Labor $',       fn:function(s){return'$'+Math.round((26-s.rank)*390+s.idx*30).toLocaleString();}},
    {key:'act_hrs',   label:'Act Hrs',       fn:function(s){return Math.round((26-s.rank)*7.8+s.idx*0.6);}},
  ],
};
var lmSvsSelectedCols = new Set();
window.lmToggleSvsDropdown=function(e){
  if(e)e.stopPropagation();
  var drop=document.getElementById('lm-svsColDrop');if(!drop)return;
  var isOpen=drop.style.display!=='none';
  drop.style.display=isOpen?'none':'';
  if(!isOpen){
    function _closeCol(ev){
      var btn=document.getElementById('lm-svsColBtn');
      if(drop&&!drop.contains(ev.target)&&ev.target!==btn&&!( btn&&btn.contains(ev.target))){
        drop.style.display='none';document.removeEventListener('click',_closeCol);
      }
    }
    setTimeout(function(){document.addEventListener('click',_closeCol);},0);
  }
};
window.lmToggleSvsCol=function(key,chk){
  if(chk)lmSvsSelectedCols.add(key);else lmSvsSelectedCols.delete(key);
  // Update count badge on the Columns button
  var btn=document.getElementById('lm-svsColBtn');
  if(btn){
    var badges=btn.querySelectorAll('span');badges.forEach(function(s){s.remove();});
    var cnt=lmSvsSelectedCols.size;
    if(cnt){var b=document.createElement('span');b.textContent=cnt;b.style.cssText='background:#5b52d4;color:#fff;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;';btn.insertBefore(b,btn.lastElementChild);}
  }
  // rebuild only the table header + body
  var cfg=KPI_CFG[lmCurKPI];
  var extraCols=(LM_SVS_EXTRA_COLS[lmCurKPI]||[]).filter(function(c){return lmSvsSelectedCols.has(c.key);});
  var lbls=lmSvsLabels();
  var baseVals=lmSvsBaseVals(cfg);
  var selected=LM_STORES.map(function(s,i){return Object.assign({},s,{idx:i,val:baseVals[i%baseVals.length]});}).filter(function(s){return lmSelectedStores.has(s.idx);});
  var sorted=selected.slice().sort(function(a,b){return lmSvsSort==='asc'?a.rank-b.rank:b.rank-a.rank;});
  var lwVals=sorted.map(function(s){return+(s.val*1.09).toFixed(1);});
  var lyVals=sorted.map(function(s){return+(s.val*1.16).toFixed(1);});
  var extraH=extraCols.map(function(c){return'<th>'+c.label+'</th>';}).join('');
  var thead=document.getElementById('lm-svsTHead');
  if(thead)thead.innerHTML='<th>Rank</th><th>Store</th><th>'+lbls.cur+'</th><th style="color:#E2784A">'+lbls.lw+'</th><th style="color:#639922">'+lbls.ly+'</th>'+extraH;
  var svsTbody=document.getElementById('lm-svsTbody');
  if(svsTbody)svsTbody.innerHTML=sorted.map(function(s,i){
    var extraD=extraCols.map(function(c){return'<td>'+c.fn(s)+'</td>';}).join('');
    return'<tr><td>#'+s.rank+'</td><td>'+s.name+'</td><td>'+lmFmtVal(baseVals[i%baseVals.length]||s.val,cfg)+'</td>'
      +'<td style="color:#E2784A;font-weight:500">'+lmFmtVal(lwVals[i],cfg)+'</td>'
      +'<td style="color:#639922;font-weight:500">'+lmFmtVal(lyVals[i],cfg)+'</td>'+extraD+'</tr>';
  }).join('');
};

// ── SvS ───────────────────────────────────────────────────────────────────────
function lmSvsBaseVals(cfg){
  if(lmSvsMode==='daily')return cfg.day||cfg.week;
  if(lmSvsMode==='monthly')return cfg.month||cfg.week;
  if(lmSvsMode==='3m')return cfg.week;
  return cfg.week; // weekly + custom
}
function lmSvsLabels(){
  if(lmSvsMode==='daily')return{cur:'Today',lw:'LW Same Day',ly:'LY Same Day'};
  if(lmSvsMode==='monthly')return{cur:'MTD',lw:'Last Month',ly:'LY Month'};
  if(lmSvsMode==='3m')return{cur:'3M Avg',lw:'Prior 3M',ly:'LY 3M'};
  if(lmSvsMode==='custom')return{cur:'Period',lw:'LW Period',ly:'LY Period'};
  return{cur:'WTD',lw:'LW WTD',ly:'LY WTD'};
}
function lmUpdateSvsDateDisplay(){
  var el=document.getElementById('lm-svsDateDisplay');if(!el)return;
  if(lmSvsMode==='daily')el.innerHTML='<span class="lm-date-pill">'+lmGetYestDisplay()+'</span>';
  else if(lmSvsMode==='weekly')el.innerHTML='<span class="lm-date-pill">'+lmGetWeekDisplay()+'</span>';
  else if(lmSvsMode==='monthly')el.innerHTML='<span class="lm-date-pill">'+lmGetMonthDisplay()+'</span>';
  else if(lmSvsMode==='3m')el.innerHTML='<span class="lm-date-pill">'+lmGet3MDisplay()+'</span>';
  else el.innerHTML='<input type="date" class="lm-date-inp" id="lm-svs-sd" onchange="lmApplySvsCustom()">'
    +'<span style="font-size:11px;color:#6b6d7a;">to</span>'
    +'<input type="date" class="lm-date-inp" id="lm-svs-ed" onchange="lmApplySvsCustom()">';
}
window.lmSetSvsMode=function(btn,mode){
  lmSvsMode=mode;
  document.querySelectorAll('#lm-svsRangeBtns .lm-rbtn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  // Granularity toggle: 3m forces Week, others restore Daily
  var _sd=document.getElementById('lm-svsWtdDaily'),_sw=document.getElementById('lm-svsWtdWTD');
  if(mode==='3m'){
    lmSvsGranularity='week';
    if(_sd){_sd.classList.remove('active');_sd.classList.add('disabled');}
    if(_sw)_sw.classList.add('active');
  } else {
    lmSvsGranularity='day';
    if(_sd){_sd.classList.add('active');_sd.classList.remove('disabled');}
    if(_sw){_sw.classList.remove('active');_sw.classList.remove('disabled');}
  }
  lmUpdateSvsDateDisplay();
  if(mode!=='custom')lmBuildSvS();
};
window.lmToggleSvsWTD=function(on){
  if(lmSvsMode==='3m')return;
  lmSvsGranularity=on?'week':'day';
  var _sd=document.getElementById('lm-svsWtdDaily'),_sw=document.getElementById('lm-svsWtdWTD');
  if(_sd)_sd.classList.toggle('active',!on);
  if(_sw)_sw.classList.toggle('active',on);
  lmBuildSvS();
};
window.lmApplySvsCustom=function(){
  var sd=document.getElementById('lm-svs-sd'),ed=document.getElementById('lm-svs-ed');
  if(sd&&ed&&sd.value&&ed.value&&new Date(ed.value)>=new Date(sd.value)){
    var nd=Math.round((new Date(ed.value)-new Date(sd.value))/86400000);
    lmSyncCustomGranBtn(nd,false);
    lmBuildSvS();
  }
};
window.lmSvsToggleOrg=function(){
  var chk=document.getElementById('lm-svsOrgChk');if(!chk)return;
  lmOrg=chk.checked;
  var btn=document.getElementById('lm-svsOrgBtn');if(btn)btn.classList.toggle('on',lmOrg);
  lmBuildSvS();
};
window.lmSvsToggleChain=function(){
  var chk=document.getElementById('lm-svsChainChk');if(!chk)return;
  lmChain=chk.checked;
  var btn=document.getElementById('lm-svsChainBtn');if(btn)btn.classList.toggle('on',lmChain);
  lmBuildSvS();
};
function lmBuildSvS(){
  lmDestroyChart('svs');
  lmRenderStoreList();
  var cfg=KPI_CFG[lmCurKPI];
  var baseVals=lmSvsBaseVals(cfg);
  var lbls=lmSvsLabels();
  var selected=LM_STORES.map(function(s,i){return Object.assign({},s,{idx:i,val:baseVals[i%baseVals.length]});}).filter(function(s){return lmSelectedStores.has(s.idx);});
  var sorted=selected.slice().sort(function(a,b){return lmSvsSort==='asc'?a.rank-b.rank:b.rank-a.rank;});
  var isEmpty=sorted.length===0;
  var isTable=lmView==='table';
  var emptyEl=document.getElementById('lm-svsEmpty');
  var chwrap=document.querySelector('#lm-svsArea .lm-chwrap');
  var tblWrap=document.getElementById('lm-svsTableWrap');
  var lgd=document.getElementById('lm-svsLgd');
  if(emptyEl)emptyEl.style.display=isEmpty?'flex':'none';
  if(chwrap)chwrap.style.display=(!isEmpty&&!isTable)?'block':'none';
  if(tblWrap)tblWrap.style.display=(!isEmpty&&isTable)?'block':'none';
  if(lgd)lgd.style.display=isEmpty?'none':'';
  if(isEmpty)return;
  var isLine=lmView==='line';
  var showSvsLW=lmShowSvsLW();
  var svsVals=sorted.map(function(s){return s.val;});
  var lwVals=sorted.map(function(s){return+(s.val*1.09).toFixed(1);});
  var lyVals=sorted.map(function(s){return+(s.val*1.16).toFixed(1);});
  var svsAvg=lmAvg(svsVals);
  var datasets=[{
    type:isLine?'line':'bar',
    data:svsVals,label:lbls.cur+' — '+cfg.label,
    backgroundColor:isLine?'transparent':cfg.color+'BB',
    borderColor:cfg.color,borderWidth:isLine?2:0,borderRadius:isLine?0:4,
    tension:0.35,fill:false,pointRadius:isLine?4:0,pointBackgroundColor:cfg.color,
    hidden:lmHiddenSeries.has('current')
  }];
  if(showSvsLW)datasets.push({type:'line',label:lbls.lw,data:lwVals,borderColor:'#E2784A',backgroundColor:'transparent',borderWidth:2,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#E2784A',tension:0.35,fill:false,hidden:lmHiddenSeries.has('lw')});
  datasets.push({type:'line',label:lbls.ly,data:lyVals,borderColor:'#639922',backgroundColor:'transparent',borderWidth:2,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#639922',tension:0.35,fill:false,hidden:lmHiddenSeries.has('ly')});
  if(lmOrg){var ov=+(svsAvg*1.04+2).toFixed(1);datasets.push({type:'line',label:'Org Avg',data:Array(sorted.length).fill(ov),borderColor:'#8B5CF6',backgroundColor:'transparent',borderWidth:2,pointRadius:3,pointBackgroundColor:'#8B5CF6',fill:false,hidden:lmHiddenSeries.has('org')});}
  if(lmChain){var cv=+(svsAvg*0.97-1).toFixed(1);datasets.push({type:'line',label:'Chain Avg',data:Array(sorted.length).fill(cv),borderColor:'#D97706',backgroundColor:'transparent',borderWidth:2,borderDash:[3,3],pointRadius:3,pointBackgroundColor:'#D97706',fill:false,hidden:lmHiddenSeries.has('chain')});}
  var ctx=document.getElementById('lm-svsC');if(!ctx)return;
  lmCharts.svs=new Chart(ctx,{type:'bar',data:{labels:sorted.map(function(s){return s.name.split(' ')[0];}),datasets:datasets},options:lmBaseOpts(cfg)});
  var lgItems=[{key:'current',label:lbls.cur+' — '+cfg.label,color:cfg.color,style:isLine?'solid':'sq'}];
  if(showSvsLW)lgItems.push({key:'lw',label:lbls.lw,color:'#E2784A',style:'dash'});
  lgItems.push({key:'ly',label:lbls.ly,color:'#639922',style:'dash'});
  if(lmOrg)lgItems.push({key:'org',label:'Org Avg',color:'#8B5CF6',style:'solid'});
  if(lmChain)lgItems.push({key:'chain',label:'Chain Avg',color:'#D97706',style:'dash'});
  if(lgd)lgd.innerHTML=lmBuildLegend(lgItems);
  // Column picker (table view only)
  var colPicker=document.getElementById('lm-svsColPicker');
  if(colPicker){
    if(isTable){
      var extraAvail=LM_SVS_EXTRA_COLS[lmCurKPI]||[];
      if(extraAvail.length){
        colPicker.style.display='';
        var _selCount=lmSvsSelectedCols.size;
        colPicker.innerHTML='<div style="position:relative;display:inline-block;">'
          +'<button id="lm-svsColBtn" onclick="lmToggleSvsDropdown(event)" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#5b52d4;background:#EEEDFE;border:1px solid #c4c0f5;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:Roboto,system-ui,sans-serif;">'
          +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>'
          +'Columns'
          +(_selCount?'<span style="background:#5b52d4;color:#fff;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;">'+_selCount+'</span>':'')
          +'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'
          +'</button>'
          +'<div id="lm-svsColDrop" style="display:none;position:absolute;z-index:200;top:calc(100% + 4px);left:0;background:#fff;border:1px solid #e2e4ec;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.13);padding:6px;min-width:168px;">'
          +extraAvail.map(function(c){
            var chk=lmSvsSelectedCols.has(c.key)?'checked':'';
            return'<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#2d2f3a;cursor:pointer;padding:5px 7px;border-radius:6px;font-family:Roboto,system-ui,sans-serif;" onmouseenter="this.style.background=\'#f5f6fa\'" onmouseleave="this.style.background=\'\'">'
              +'<input type="checkbox" '+chk+' onchange="lmToggleSvsCol(\''+c.key+'\',this.checked)" style="accent-color:#5b52d4;width:13px;height:13px;flex-shrink:0;">'
              +c.label+'</label>';
          }).join('')
          +'</div>'
          +'</div>';
      } else { colPicker.style.display='none'; }
    } else { colPicker.style.display='none'; lmSvsSelectedCols.clear(); }
  }
  // Build table header + body with selected extra cols
  var extraCols=(LM_SVS_EXTRA_COLS[lmCurKPI]||[]).filter(function(c){return lmSvsSelectedCols.has(c.key);});
  var extraH=extraCols.map(function(c){return'<th>'+c.label+'</th>';}).join('');
  var thead=document.getElementById('lm-svsTHead');
  if(thead)thead.innerHTML='<th>Rank</th><th>Store</th><th>'+lbls.cur+'</th>'+(showSvsLW?'<th style="color:#E2784A">'+lbls.lw+'</th>':'')+'<th style="color:#639922">'+lbls.ly+'</th>'+extraH;
  var svsTbody=document.getElementById('lm-svsTbody');
  if(svsTbody)svsTbody.innerHTML=sorted.map(function(s,i){
    var extraD=extraCols.map(function(c){return'<td>'+c.fn(s)+'</td>';}).join('');
    return'<tr><td>#'+s.rank+'</td><td>'+s.name+'</td><td>'+lmFmtVal(svsVals[i],cfg)+'</td>'
      +(showSvsLW?'<td style="color:#E2784A;font-weight:500">'+lmFmtVal(lwVals[i],cfg)+'</td>':'')
      +'<td style="color:#639922;font-weight:500">'+lmFmtVal(lyVals[i],cfg)+'</td>'+extraD+'</tr>';
  }).join('');
}

// ── STORE LIST ────────────────────────────────────────────────────────────────
function lmRenderStoreList(){
  var filtered=LM_STORES.filter(function(s){return lmSvsSearch===''||s.name.toLowerCase().includes(lmSvsSearch.toLowerCase());});
  var sorted=filtered.slice().sort(function(a,b){return lmSvsSort==='asc'?a.rank-b.rank:b.rank-a.rank;});
  var cntEl=document.getElementById('lm-svsSelCount');if(cntEl)cntEl.textContent=lmSelectedStores.size+'/'+LM_STORES.length;
  var listEl=document.getElementById('lm-storeList');if(!listEl)return;
  listEl.innerHTML=sorted.map(function(s){
    var i=LM_STORES.indexOf(s);var isSel=lmSelectedStores.has(i);
    return'<div class="lm-store-item '+(isSel?'top':'oth')+'" onclick="lmToggleStore('+i+')">'
      +'<span class="lm-sn" style="font-weight:'+(isSel?'600':'400')+';color:'+(isSel?'#fff':'#9295a0')+';">'+s.name+'</span>'
      +'<span class="lm-sr">'+s.rank+'</span></div>';
  }).join('');
}

window.lmToggleStore=function(i){
  if(lmSelectedStores.has(i))lmSelectedStores.delete(i);else lmSelectedStores.add(i);
  lmRenderStoreList();lmBuildSvS();
};

// ── INTERACTIONS ──────────────────────────────────────────────────────────────
window.lmToggleKMenu=function(){
  lmMenuOpen=!lmMenuOpen;
  var m=document.getElementById('lm-kpiMenu');if(m)m.classList.toggle('open',lmMenuOpen);
};

window.lmSelectKPI=function(kpi){
  lmCurKPI=kpi;lmSupMode=false;lmSupKpiKey=null;lmMenuOpen=false;lmActiveSup=null;lmOverlayKeys=[];
  var m=document.getElementById('lm-kpiMenu');if(m)m.classList.remove('open');
  var cfg=KPI_CFG[kpi];
  var lbl=document.getElementById('lm-mainKpiLbl');if(lbl)lbl.textContent=cfg.label;
  var dot=document.getElementById('lm-mainKpiDot');if(dot)dot.style.background=cfg.color;
  var cbdot=document.getElementById('lm-mainCBdot');if(cbdot)cbdot.style.background=cfg.color;
  var cblbl=document.getElementById('lm-mainCBlbl');if(cblbl)cblbl.textContent=cfg.label;
  var cbval=document.getElementById('lm-mainCBval');if(cbval)cbval.textContent=cfg.value||'';
  var cbch=document.getElementById('lm-mainCBchange');if(cbch){cbch.textContent=cfg.change||'';cbch.className=cfg.value?(cfg.up?'lm-pos':'lm-neg'):'';}
  var rankEl=document.getElementById('lm-rankNum');if(rankEl)rankEl.textContent='#'+(LM_STORE_RANK[kpi]||1);
  lmBuildKpiMenu();
  lmRenderSupKPICards();lmBuildMain();
};

window.lmSwitchTab=function(t){
  lmTab=t;
  var th=document.getElementById('lm-tabHist'),ts=document.getElementById('lm-tabSvS');
  if(th)th.classList.toggle('active',t==='hist');
  if(ts)ts.classList.toggle('active',t==='svs');
  var histSB=document.getElementById('lm-histSB'),svsSB=document.getElementById('lm-svsSB');
  var histArea=document.getElementById('lm-histArea'),svsArea=document.getElementById('lm-svsArea');
  var subPane=document.getElementById('lm-subPaneWrap');
  if(histSB)histSB.style.display=t==='hist'?'':'none';
  if(svsSB)svsSB.style.display=t==='svs'?'block':'none';
  if(histArea)histArea.style.display=t==='hist'?'':'none';
  if(svsArea)svsArea.style.display=t==='svs'?'':'none';
  if(subPane)subPane.style.display=t==='svs'?'none':'';
  if(t==='svs'){lmUpdateSvsDateDisplay();lmBuildSvS();}
};

window.lmSelComp=function(el){
  document.querySelectorAll('.lm-citem').forEach(function(i){i.classList.remove('sel');});el.classList.add('sel');
};

function lmGetYestDisplay(){
  var d=new Date();d.setDate(d.getDate()-1);
  return (d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();
}
function lmGetWeekDisplay(){
  var mon=currentMonday(),sun=addDays(mon,6);
  return mmdd(mon)+'/'+mon.getFullYear()+' – '+mmdd(sun)+'/'+sun.getFullYear();
}
function lmGetMonthDisplay(){
  var d=new Date();
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()]+' '+d.getFullYear();
}
function lmGet3MDisplay(){
  var now=new Date(),ago=new Date(now);ago.setMonth(ago.getMonth()-3);
  return mmdd(ago)+'/'+ago.getFullYear()+' – '+mmdd(now)+'/'+now.getFullYear();
}
function lmUpdateDateDisplay(){
  var el=document.getElementById('lm-dateDisplay');if(!el)return;
  if(lmModalMode==='daily'){
    el.innerHTML='<span class="lm-date-pill">'+lmGetYestDisplay()+'</span>';
  }else if(lmModalMode==='weekly'){
    el.innerHTML='<span class="lm-date-pill">'+lmGetWeekDisplay()+'</span>';
  }else if(lmModalMode==='monthly'){
    el.innerHTML='<span class="lm-date-pill">'+lmGetMonthDisplay()+'</span>';
  }else if(lmModalMode==='3m'){
    el.innerHTML='<span class="lm-date-pill">'+lmGet3MDisplay()+'</span>';
  }else{
    el.innerHTML='<input type="date" class="lm-date-inp" id="lm-sd" onchange="lmApplyCustom()">'
      +'<span style="font-size:11px;color:#6b6d7a;">to</span>'
      +'<input type="date" class="lm-date-inp" id="lm-ed" onchange="lmApplyCustom()">';
  }
}
window.lmSetModeNew=function(btn,mode){
  lmModalMode=mode;
  document.querySelectorAll('#lm-rangeBtns .lm-rbtn').forEach(function(b){b.classList.remove('active');b.classList.remove('disabled');});
  btn.classList.add('active');
  if(mode==='daily'){lmRange='Day';lmWtd=false;}
  else if(mode==='weekly'){lmRange='Week';}
  else if(mode==='monthly'){lmRange='Month';lmWtd=false;}
  else if(mode==='3m'){lmRange='Quarter';lmWtd=false;}
  else{lmRange='Custom';lmWtd=false;}
  if(mode!=='weekly'){
    var dailyBtn=document.getElementById('lm-wtdDaily'),weekBtn=document.getElementById('lm-wtdWTD');
    if(mode==='3m'){
      // 3m: only weekly granularity allowed — grey Daily, activate Week
      if(dailyBtn){dailyBtn.classList.remove('active');dailyBtn.classList.add('disabled');}
      if(weekBtn)weekBtn.classList.add('active');
    } else if(mode==='daily'){
      // Daily range: Week granularity not applicable — grey it out
      if(dailyBtn){dailyBtn.classList.add('active');dailyBtn.classList.remove('disabled');}
      if(weekBtn){weekBtn.classList.remove('active');weekBtn.classList.add('disabled');}
    } else {
      // monthly/custom: both granularities available
      if(dailyBtn){dailyBtn.classList.add('active');dailyBtn.classList.remove('disabled');}
      if(weekBtn){weekBtn.classList.remove('active');weekBtn.classList.remove('disabled');}
    }
    lmGranularity=mode==='3m'?'week':'day';
  }
  lmUpdateDateDisplay();
  if(mode!=='custom')lmBuildMain();
  else lmBuildCompStats();
};

function lmSyncCustomGranBtn(nd, isHist){
  var dBtn=document.getElementById(isHist?'lm-wtdDaily':'lm-svsWtdDaily');
  var wBtn=document.getElementById(isHist?'lm-wtdWTD':'lm-svsWtdWTD');
  if(!dBtn||!wBtn)return;
  if(nd>0&&nd<7){
    // Less than a week — force Daily, lock Week out
    if(isHist){lmGranularity='day';lmWtd=false;}
    else{lmSvsGranularity='day';}
    dBtn.classList.add('active');dBtn.classList.remove('disabled');
    wBtn.classList.remove('active');wBtn.classList.add('disabled');
  }else{
    // 7+ days — both available, just unlock Week
    wBtn.classList.remove('disabled');
  }
}
window.lmApplyCustom=function(){
  var sd=document.getElementById('lm-sd'),ed=document.getElementById('lm-ed');
  if(sd&&ed&&sd.value&&ed.value&&new Date(ed.value)>=new Date(sd.value)){
    var nd=Math.round((new Date(ed.value)-new Date(sd.value))/86400000);
    lmSyncCustomGranBtn(nd,true);
    lmBuildMain();
  }
};

window.lmToggleWTD=function(on){
  // Block if the target button is disabled (e.g. custom range < 7 days)
  var weekBtn=document.getElementById('lm-wtdWTD');
  if(on&&weekBtn&&weekBtn.classList.contains('disabled'))return;
  lmGranularity=on?'week':'day';
  lmWtd=on&&lmRange==='Week';
  var daily=document.getElementById('lm-wtdDaily');
  if(daily)daily.classList.toggle('active',!on);
  if(weekBtn)weekBtn.classList.toggle('active',on);
  lmBuildMain();
};

window.lmToggleOrg=function(){
  var chk=document.getElementById('lm-orgChk');if(!chk)return;
  lmOrg=chk.checked;
  var btn=document.getElementById('lm-orgToggleBtn');if(btn)btn.classList.toggle('on',lmOrg);
  if(lmTab==='svs')lmBuildSvS();else lmBuildMain();
};

window.lmToggleChain=function(){
  var chk=document.getElementById('lm-chainChk');if(!chk)return;
  lmChain=chk.checked;
  var btn=document.getElementById('lm-chainToggleBtn');if(btn)btn.classList.toggle('on',lmChain);
  if(lmTab==='svs')lmBuildSvS();else lmBuildMain();
};

window.lmExportCSV=function(){
  var cfg=lmGetActiveCfg();
  var sd=document.getElementById('lm-sd')?document.getElementById('lm-sd').value:'';
  var ed=document.getElementById('lm-ed')?document.getElementById('lm-ed').value:'';
  var rd=lmGetRangeData(cfg,lmRange,sd,ed);
  var labels=rd.labels,data=rd.data;
  var showLW=lmShowLW();
  var lw=lmLwOf(data),ly=lmLyOf(data);
  var headers=['Period','Current'];
  if(showLW)headers.push('Last Week');
  headers.push('Last Year');
  if(lmOrg)headers.push('Org Avg');
  if(lmChain)headers.push('Chain Avg');
  var org=lmOrg?orgAvg(data):null;
  var chainData=lmChain?data.map(function(v){return+(v*0.97-1).toFixed(1);}):null;
  var rows=[headers.join(',')];
  labels.forEach(function(l,i){
    var row=['"'+l+'"',data[i]];
    if(showLW)row.push(lw[i]);
    row.push(ly[i]);
    if(org)row.push(org[i]);
    if(chainData)row.push(chainData[i]);
    rows.push(row.join(','));
  });
  var csv=rows.join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=(cfg.label||'kpi').replace(/[^a-z0-9]/gi,'_')+'_'+lmRange+'.csv';a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
};

window.lmSelectSupKPI=function(parentKpi,supKey){
  lmCurKPI=parentKpi;lmSupMode=true;lmSupKpiKey=supKey;lmMenuOpen=false;lmActiveSup=null;lmOverlayKeys=[];
  var m=document.getElementById('lm-kpiMenu');if(m)m.classList.remove('open');
  var cfg=lmGetActiveCfg();
  var lbl=document.getElementById('lm-mainKpiLbl');if(lbl)lbl.textContent=cfg.label;
  var dot=document.getElementById('lm-mainKpiDot');if(dot)dot.style.background=cfg.color;
  var cbdot=document.getElementById('lm-mainCBdot');if(cbdot)cbdot.style.background=cfg.color;
  var cblbl=document.getElementById('lm-mainCBlbl');if(cblbl)cblbl.textContent=cfg.label;
  var cbval=document.getElementById('lm-mainCBval');if(cbval)cbval.textContent=cfg.value||'';
  var cbch=document.getElementById('lm-mainCBchange');if(cbch){cbch.textContent=cfg.change||'';cbch.className=cfg.value?(cfg.up?'lm-pos':'lm-neg'):'';}
  lmBuildKpiMenu();
  lmRenderSupKPICards();
  lmBuildMain();
};

window.lmSetView=function(v){
  lmView=v;
  ['lm-vBar','lm-vLine','lm-vTable'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  var target=document.getElementById(v==='bar'?'lm-vBar':v==='line'?'lm-vLine':'lm-vTable');if(target)target.classList.add('active');
  if(lmTab==='svs'){lmBuildSvS();return;}
  lmBuildMain();
};

window.lmToggleSvsSort=function(){
  lmSvsSort=lmSvsSort==='asc'?'desc':'asc';
  lmSelectedStores=lmSvsSort==='asc'?new Set([0,1,2,3,4]):new Set([3,4,5,6,7]);
  lmBuildSvS();
};

window.lmFilterStores=function(val){lmSvsSearch=val;lmRenderStoreList();};

// close on outside click
document.addEventListener('click',function(e){
  if(!e.target.closest('.lm-kpi-wrap')&&lmMenuOpen){lmMenuOpen=false;var m=document.getElementById('lm-kpiMenu');if(m)m.classList.remove('open');}
  if(!e.target.closest('.lm-addmetric-wrap')&&lmAddMetricOpen){lmAddMetricOpen=false;var am=document.getElementById('lm-addMetricMenu');if(am)am.classList.remove('open');}
});

// ── MODAL HTML TEMPLATE ───────────────────────────────────────────────────────
var LM_TEMPLATE='<div class="lm-modal">'
  +'<div class="lm-mhdr">'
    +'<div class="lm-hrow1">'
      +'<div class="lm-hrow1-left">'
        +'<div class="lm-kpi-wrap">'
          +'<div class="lm-msel" onclick="lmToggleKMenu()">'
            +'<span class="lm-kdot" id="lm-mainKpiDot" style="background:#5b52d4"></span>'
            +'<span id="lm-mainKpiLbl">Labor %</span>'
            +'<svg width="11" height="11" viewBox="0 0 24 24" stroke="#9295a0" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
          +'</div>'
          +'<div class="lm-kmenu" id="lm-kpiMenu"></div>'
        +'</div>'
        +'<div class="lm-addmetric-wrap">'
          +'<button class="lm-addmetric-btn" id="lm-addMetricBtn" onclick="lmToggleAddMetricMenu()">'
            +'<svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
            +'<span id="lm-addMetricLbl">Add Metric</span>'
          +'</button>'
          +'<div class="lm-kmenu" id="lm-addMetricMenu"></div>'
        +'</div>'
        +'<div class="lm-tabg">'
          +'<button class="lm-tbtn active" id="lm-tabHist" onclick="lmSwitchTab(\'hist\')">Historical</button>'
          +'<button class="lm-tbtn" id="lm-tabSvS" onclick="lmSwitchTab(\'svs\')">Store vs Store</button>'
        +'</div>'
      +'</div>'

      +'<div class="lm-hicons">'
        +'<button class="lm-vbtn active" id="lm-vBar" onclick="lmSetView(\'bar\')"><svg viewBox="0 0 24 24"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg></button>'
        +'<button class="lm-vbtn" id="lm-vLine" onclick="lmSetView(\'line\')"><svg viewBox="0 0 24 24"><polyline points="3 17 8 11 13 14 19 6"/><circle cx="3" cy="17" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg></button>'
        +'<button class="lm-vbtn" id="lm-vTable" onclick="lmSetView(\'table\')"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg></button>'
        +'<button class="lm-vbtn lm-export-btn" onclick="lmExportCSV()" title="Export CSV"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M4 20h16"/></svg></button>'
        +'<button class="lm-cbtn" onclick="lmCloseModal()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
      +'</div>'
    +'</div>'
  +'</div>'
  +'<div class="lm-mbody">'
    +'<div class="lm-sidebar" id="lm-histSB">'
      +'<div class="lm-stitle">Comparison</div>'
      +'<div id="lm-compStats"></div>'
      +'<div class="lm-gs" id="lm-graphSummary"></div>'
    +'</div>'
    +'<div class="lm-svs-sb" id="lm-svsSB">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
        +'<span style="font-size:11px;font-weight:600;font-family:Roboto,system-ui,sans-serif;">Stores</span>'
        +'<span id="lm-svsSelCount" style="font-size:11px;color:#9295a0;font-family:Roboto,system-ui,sans-serif;">5/8</span>'
      +'</div>'
      +'<div class="lm-search-row">'
        +'<div class="lm-search-box"><svg width="11" height="11" viewBox="0 0 24 24" stroke="#9295a0" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="lm-svsSearchInput" placeholder="Search..." oninput="lmFilterStores(this.value)"></div>'
        +'<button class="lm-sort-btn" onclick="lmToggleSvsSort()" title="Sort"><svg width="13" height="13" viewBox="0 0 24 24" stroke="#5b52d4" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/></svg></button>'
      +'</div>'
      +'<div id="lm-storeList"></div>'
    +'</div>'
    +'<div class="lm-scroll-outer" id="lm-scrollOuter">'
      +'<div id="lm-histArea">'
        +'<div class="lm-main-pane">'
          +'<div class="lm-ctrls">'
            +'<div style="flex:1;">'
              +'<div class="lm-rgrp" id="lm-rangeBtns">'
                +'<button class="lm-rbtn" id="lm-rDaily" onclick="lmSetModeNew(this,\'daily\')">Daily</button>'
                +'<button class="lm-rbtn" id="lm-rWeekly" onclick="lmSetModeNew(this,\'weekly\')">Weekly</button>'
                +'<button class="lm-rbtn" id="lm-rMonthly" onclick="lmSetModeNew(this,\'monthly\')">Monthly</button>'
                +'<button class="lm-rbtn active" id="lm-r3Month" onclick="lmSetModeNew(this,\'3m\')">3 Months</button>'
                +'<button class="lm-rbtn" id="lm-rCustom" onclick="lmSetModeNew(this,\'custom\')">Custom</button>'
                +'<div class="lm-date-disp" id="lm-dateDisplay"></div>'
              +'</div>'
            +'</div>'
            +'<label class="lm-cmp-chk" id="lm-chainToggleBtn">'
              +'<input type="checkbox" id="lm-chainChk" onchange="lmToggleChain()">'
              +'<span>vs Chain</span>'
            +'</label>'
            +'<div class="lm-tabg">'
              +'<button class="lm-tbtn active" id="lm-wtdDaily" onclick="lmToggleWTD(false)">Daily</button>'
              +'<button class="lm-tbtn" id="lm-wtdWTD" onclick="lmToggleWTD(true)">Week</button>'
            +'</div>'
          +'</div>'
          +'<div id="lm-wtdCardBlock" style="display:none;" class="lm-wtd-cards"></div>'
          +'<div class="lm-cbt"><span class="lm-cbdot" id="lm-mainCBdot" style="background:#5b52d4"></span><span id="lm-mainCBlbl">Labor %</span><span id="lm-mainCBval" style="font-size:11px;color:#9295a0;font-weight:400;margin-left:6px;"></span><span id="lm-mainCBchange" style="font-size:10px;font-weight:600;margin-left:3px;"></span></div>'
          +'<div class="lm-chwrap" id="lm-mainChartWrap"><canvas id="lm-mainC"></canvas></div>'
          +'<div id="lm-mainTableWrap" style="display:none;overflow-x:auto;"><table class="lm-tbl"><thead><tr id="lm-mainTHead"></tr></thead><tbody id="lm-mainTBody"></tbody><tfoot id="lm-mainTFoot"></tfoot></table></div>'
          +'<div class="lm-lgrow" id="lm-mainLgd"></div>'
        +'</div>'
        +'<div class="lm-sub-pane-wrap" id="lm-subPaneWrap">'
          +'<div class="lm-sub-charts-row" id="lm-subChartsRow"></div>'
        +'</div>'
      +'</div>'
      +'<div id="lm-svsArea" class="lm-svs-pane" style="display:none;">'
        +'<div class="lm-ctrls" style="margin-bottom:10px;flex-shrink:0;">'
          +'<div style="flex:1;">'
            +'<div class="lm-rgrp" id="lm-svsRangeBtns">'
              +'<button class="lm-rbtn" onclick="lmSetSvsMode(this,\'daily\')">Daily</button>'
              +'<button class="lm-rbtn active" onclick="lmSetSvsMode(this,\'weekly\')">Weekly</button>'
              +'<button class="lm-rbtn" onclick="lmSetSvsMode(this,\'monthly\')">Monthly</button>'
              +'<button class="lm-rbtn" onclick="lmSetSvsMode(this,\'3m\')">3 Months</button>'
              +'<button class="lm-rbtn" onclick="lmSetSvsMode(this,\'custom\')">Custom</button>'
              +'<div class="lm-date-disp" id="lm-svsDateDisplay"></div>'
            +'</div>'
          +'</div>'
          +'<label class="lm-cmp-chk" id="lm-svsOrgBtn">'
            +'<input type="checkbox" id="lm-svsOrgChk" onchange="lmSvsToggleOrg()">'
            +'<span>vs Org</span>'
          +'</label>'
          +'<label class="lm-cmp-chk" id="lm-svsChainBtn">'
            +'<input type="checkbox" id="lm-svsChainChk" onchange="lmSvsToggleChain()">'
            +'<span>vs Chain</span>'
          +'</label>'
        +'</div>'
        +'<div id="lm-svsEmpty" style="display:none;align-items:center;justify-content:center;height:180px;color:#9295a0;font-size:12px;flex-direction:column;gap:6px;font-family:Roboto,system-ui,sans-serif;"><span>Select stores to compare</span></div>'
        +'<div class="lm-chwrap"><canvas id="lm-svsC"></canvas></div>'
        +'<div id="lm-svsColPicker" style="display:none;padding:8px 0 4px;border-top:1px solid #f0f1f5;margin-top:6px;"></div>'
        +'<div id="lm-svsTableWrap" style="display:none;overflow-x:auto;margin-top:8px;"><table class="lm-tbl"><thead><tr id="lm-svsTHead"><th>Rank</th><th>Store</th><th>Current</th><th style="color:#E2784A">vs LW</th><th style="color:#639922">vs LY</th></tr></thead><tbody id="lm-svsTbody"></tbody></table></div>'
        +'<div class="lm-lgrow" id="lm-svsLgd" style="margin-top:6px;"></div>'
      +'</div>'
    +'</div>'
  +'</div>'
+'</div>';

// ── OPEN / CLOSE ──────────────────────────────────────────────────────────────
window.openLaborModal=function(kpiId,allowedKpis,noSup){
  // Reset state
  lmCurKPI=kpiId||'labor';
  lmAllowedKpis=allowedKpis||null;
  lmNoSup=!!noSup;
  // Always default to 3 months
  var _df=window.lmDashFrom,_dt=window.lmDashTo;
  lmRange='Quarter';lmModalMode='3m';lmGranularity='week';
  lmWtd=false;lmOrg=false;lmChain=false;lmTab='hist';lmView='line';lmActiveSup=null;lmMenuOpen=false;
  lmSupMode=false;lmSupKpiKey=null;
  lmOverlayKeys=[];lmAddMetricOpen=false;
  lmSvsSort='asc';lmSvsSearch='';lmSelectedStores=new Set([0,1,2,3,4]);lmHiddenSeries=new Set();lmSvsMode='weekly';lmSvsGranularity='day';lmSvsSelectedCols=new Set();
  Object.keys(lmCharts.sup).forEach(function(k){if(lmCharts.sup[k]){lmCharts.sup[k].destroy();delete lmCharts.sup[k];}});
  if(lmCharts.main){lmCharts.main.destroy();lmCharts.main=null;}
  if(lmCharts.svs){lmCharts.svs.destroy();lmCharts.svs=null;}

  var root=document.getElementById('kpi-modal-root');
  root.innerHTML=LM_TEMPLATE;
  root.classList.add('open');
  lmUpdateDateDisplay();
  // Activate correct range button and pre-fill custom dates
  document.querySelectorAll('#lm-rangeBtns .lm-rbtn').forEach(function(b){b.classList.remove('active');});
  var _btnId={daily:'lm-rDaily',weekly:'lm-rWeekly',monthly:'lm-rMonthly','3m':'lm-r3Month',custom:'lm-rCustom'}[lmModalMode]||'lm-r3Month';
  var _ab=document.getElementById(_btnId);if(_ab)_ab.classList.add('active');
  if(lmModalMode==='3m'){
    // Right-side granularity: grey Daily, activate Week
    var _dw=document.getElementById('lm-wtdDaily'),_ww=document.getElementById('lm-wtdWTD');
    if(_dw){_dw.classList.remove('active');_dw.classList.add('disabled');}
    if(_ww)_ww.classList.add('active');
  }
  // Sync view buttons with current lmView state (template defaults bar as active)
  ['lm-vBar','lm-vLine','lm-vTable'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('active');});
  var _vBtnId=lmView==='bar'?'lm-vBar':lmView==='line'?'lm-vLine':'lm-vTable';
  var _vBtn=document.getElementById(_vBtnId);if(_vBtn)_vBtn.classList.add('active');
  if(lmModalMode==='custom'&&_df){
    var _sd=document.getElementById('lm-sd'),_ed=document.getElementById('lm-ed');
    if(_sd)_sd.value=_df;if(_ed)_ed.value=_dt;
  }

  // Set selected KPI in dropdown
  var cfg=KPI_CFG[lmCurKPI];
  var lbl=document.getElementById('lm-mainKpiLbl');if(lbl)lbl.textContent=cfg.label;
  var dot=document.getElementById('lm-mainKpiDot');if(dot)dot.style.background=cfg.color;
  var cbdot=document.getElementById('lm-mainCBdot');if(cbdot)cbdot.style.background=cfg.color;
  var cblbl=document.getElementById('lm-mainCBlbl');if(cblbl)cblbl.textContent=cfg.label;
  var cbval=document.getElementById('lm-mainCBval');if(cbval)cbval.textContent=cfg.value||'';
  var cbch=document.getElementById('lm-mainCBchange');if(cbch){cbch.textContent=cfg.change||'';cbch.className=cfg.value?(cfg.up?'lm-pos':'lm-neg'):'';}
  document.querySelectorAll('.lm-kopt').forEach(function(o){o.classList.toggle('active',o.dataset.kpi===lmCurKPI);});

  lmBuildKpiMenu();
  lmRenderSupKPICards();
  lmBuildMain();
  var rankEl=document.getElementById('lm-rankNum');if(rankEl)rankEl.textContent='#'+(LM_STORE_RANK[lmCurKPI]||1);

  // Close on backdrop click
  root.addEventListener('click',function(e){if(e.target===root)lmCloseModal();});
};

window.lmCloseModal=function(){
  lmAllowedKpis=null;lmNoSup=false;
  var root=document.getElementById('kpi-modal-root');
  root.classList.remove('open');
  setTimeout(function(){
    Object.keys(lmCharts.sup).forEach(function(k){if(lmCharts.sup[k]){lmCharts.sup[k].destroy();delete lmCharts.sup[k];}});
    if(lmCharts.main){lmCharts.main.destroy();lmCharts.main=null;}
    if(lmCharts.svs){lmCharts.svs.destroy();lmCharts.svs=null;}
    root.innerHTML='';
  },250);
};

})();
