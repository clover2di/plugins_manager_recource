/** Plugin entry */
(function(window){
 'use strict';
let diffEngine=null; let cancelFlag=false; let legendDynamic=true; // legacy flag (now selection-driven)
function _attemptRestoreSelections(){
  const st=State.get();
  if(st.base && st.target) return; // nothing to do
  // Heuristic: pick first virtual sheet whose name hints side, else any
  const allVS = window.VirtualSheets? Object.keys(window.VirtualSheets): [];
  if(!st.base){
    const cand = allVS.find(k=>/Imported_Base_/i.test(k)) || allVS[0];
    if(cand) State.set({ base:cand });
  }
  if(!st.target){
    const cand = allVS.find(k=>/Imported_Target_/i.test(k) && k!==State.get().base) || allVS.find(k=>k!==State.get().base);
    if(cand) State.set({ target:cand });
  }
}
// Build quick row-level classification from diffs
function _classify(diff){ const rows={}, cells={}; if(!diff||!diff.raw) return {rows,cells}; diff.raw.forEach(d=>{ if(d.r==null || d.c==null) return; const t=d.type; if(!rows[d.r]) rows[d.r]=new Set(); rows[d.r].add(t); const key=d.r+':'+d.c; if(!cells[key]) cells[key]=new Set(); cells[key].add(t); }); return {rows,cells}; }
function _rowCssAll(set){ if(!set||!set.size) return []; const order=['inserted-row','deleted-row','inserted-col','deleted-col','formula','formulaToValue','valueToFormula','value','type','format']; const out=[]; order.forEach(k=>{ if(set.has(k)) out.push('diff-row-'+k.replace(/[^A-Za-z0-9]/g,'')); }); return out; }
function _cellCssAll(set){ if(!set||!set.size) return []; // Exclude structural categories from direct cell coloring
  const order=['formula','formulaToValue','valueToFormula','value','type','format']; const out=[]; order.forEach(k=>{ if(set.has(k)) out.push('diff-cell-'+k.replace(/[^A-Za-z0-9]/g,'')); }); return out; }
async function _renderPreviews(baseName,targetName,diff){ try {
  const wrap=document.getElementById('sheetPreviewWrapper'); if(!wrap) return; const baseDiv=document.getElementById('basePreview'); const targetDiv=document.getElementById('targetPreview'); if(!baseDiv||!targetDiv) return;
  // Dynamic per-column/row sizing removed (static preview sizing)
  // snapshot (reuse diffEngine or temp)
  const opts=State.get().options||{}; const eng = diffEngine || new DiffEngine(opts);
  const [baseSnap,targetSnap] = await Promise.all([eng.snapshotSheet(baseName), eng.snapshotSheet(targetName)]);
  // Limit rows/cols for preview (independent per side so inserted/deleted show only where they exist)
  const MAX_R=200, MAX_C=50; // preview caps
  const rCountBase = Math.min(MAX_R, baseSnap.maxR);
  const rCountTarget = Math.min(MAX_R, targetSnap.maxR);
  const cCountBase = Math.min(MAX_C, baseSnap.maxC);
  const cCountTarget = Math.min(MAX_C, targetSnap.maxC);
  const {rows:rowTypes, cells:cellTypes}=_classify(diff);
  // Build column structural maps (inserted/deleted col)
  let colStructInserted=new Set(), colStructDeleted=new Set();
  if(diff && diff.raw){ diff.raw.forEach(d=>{ if(d.type==='inserted-col') colStructInserted.add(d.c); else if(d.type==='deleted-col') colStructDeleted.add(d.c); }); }
  function buildTable(snap,isBase,rLimit,cLimit){ const tbl=document.createElement('table'); const thead=document.createElement('thead'); const hr=document.createElement('tr'); // corner cell
    const corner=document.createElement('th'); corner.textContent=''; corner.className='corner-cell'; hr.appendChild(corner);
    for(let c=0;c<cLimit;c++){ const th=document.createElement('th'); th.textContent=colName(c); if(colStructInserted.has(c) && !isBase) th.classList.add('col-struct-inserted'); if(colStructDeleted.has(c) && isBase) th.classList.add('col-struct-deleted'); hr.appendChild(th);} thead.appendChild(hr); tbl.appendChild(thead);
  const tb=document.createElement('tbody'); for(let r=0;r<rLimit;r++){ const tr=document.createElement('tr'); const rowClasses=_rowCssAll(rowTypes[r]); rowClasses.forEach(cls=>tr.classList.add(cls)); const th=document.createElement('th'); th.textContent=String(r+1);
      if(rowTypes[r]){ if(rowTypes[r].has('inserted-row')) th.classList.add('row-struct-inserted'); if(rowTypes[r].has('deleted-row')) th.classList.add('row-struct-deleted'); }
      tr.appendChild(th); const row=snap.rows[r]; for(let c=0;c<cLimit;c++){ const td=document.createElement('td'); const cell=row? row[c]:null; if(cell){ let v=cell.v; if(cell.f){ td.classList.add('cell-formula'); v='='+cell.f; } if(v===''||v==null){ td.classList.add('cell-empty'); v=''; } td.textContent=v; } else { td.classList.add('cell-empty'); td.textContent=''; } const set=cellTypes[r+':'+c];
        // Determine ordered categories for this cell once (used both for base color and stripes)
        // Cell visuals via helper module
        if(set && set.size){
          const ordered = (window.CellVisuals && CellVisuals.orderCategories(set)) || null;
          const baseCat = window.CellVisuals ? CellVisuals.computeBaseCategory(ordered): null;
          if(baseCat){ td.classList.add('diff-cell-'+ baseCat.replace(/[^A-Za-z0-9]/g,'')); }
          const stripe = window.CellVisuals && CellVisuals.computeStripeStyle(ordered);
          if(stripe){ td.classList.add('multi-cat'); td.style.backgroundImage=stripe; }
          // Tooltip: reuse existing legend text mapping
          const labelsCache = window.__catLabelsCache || (function(){ const m={}; document.querySelectorAll('#legendSection li[data-difftype]').forEach(li=>{ const t=li.getAttribute('data-difftype'); const span=li.querySelector('span[data-i18n^="legend."]'); if(t && span) m[t]=span.textContent.trim(); }); window.__catLabelsCache=m; return m; })();
          const priority= (window.CellVisuals && CellVisuals.PRIORITY_ORDER) || [];
          const orderedCats = ordered || [];
          td.title=orderedCats.map(k=>labelsCache[k]||k).join('\n');
          td.setAttribute('data-cats', orderedCats.join(','));
        }
        tr.appendChild(td);} tb.appendChild(tr);} tbl.appendChild(tb); return tbl; }
  baseDiv.innerHTML=''; targetDiv.innerHTML=''; const bTbl=buildTable(baseSnap,true,rCountBase,cCountBase); const tTbl=buildTable(targetSnap,false,rCountTarget,cCountTarget); baseDiv.appendChild(bTbl); targetDiv.appendChild(tTbl); wrap.classList.remove('hidden');
  // Dynamic preview titles (Workbook|Sheet) using diff meta or fallback names
  try {
  function stripExt(n){ return n? n.replace(/\.[^.]+$/,''): ''; }
  const stMeta = (diff && diff.meta) ? diff.meta : {};
  const stAll = (window.State && State.get && State.get()) ? State.get(): {};
  // Only use original workbook names (ignore virtual sheet ids in meta.base/meta.target)
  const ph1 = (window.__i18n && window.__i18n['placeholder.source1']) || 'Источник 1';
  const ph2 = (window.__i18n && window.__i18n['placeholder.source2']) || 'Источник 2';
  const baseWB = stripExt(stAll.baseOriginalFile || stMeta.baseWorkbook || ph1);
  const targetWB = stripExt(stAll.targetOriginalFile || stMeta.targetWorkbook || ph2);
  // Sheet names sourced from current selects first, then diff meta; never fallback to virtual ids
  const baseSheetSel = document.getElementById('baseSheetSelect');
  const targetSheetSel = document.getElementById('targetSheetSelect');
  const baseSheet = (baseSheetSel && baseSheetSel.value) || stMeta.baseSheet || stMeta.baseSheetName || '';
  const targetSheet = (targetSheetSel && targetSheetSel.value) || stMeta.targetSheet || stMeta.targetSheetName || '';
    const baseTitleEl=document.querySelector('[data-i18n="preview.baseTitle"]');
    const targetTitleEl=document.querySelector('[data-i18n="preview.targetTitle"]');
  if(baseTitleEl){ baseTitleEl.textContent = baseWB + (baseSheet? ' | '+baseSheet:''); }
  if(targetTitleEl){ targetTitleEl.textContent = targetWB + (targetSheet? ' | '+targetSheet:''); }
  } catch(_e){}
  const syncRow=document.getElementById('previewControlsRow'); if(syncRow){ syncRow.classList.add('active'); }
  // Virtualization disabled (legacy code removed)
  // Immediate synchronized scrolling
  let active=null; let rafPending=false; let syncing=false;
  // Sync scroll toggle
  const syncCheckbox = document.getElementById('chkSyncScroll');
  const isSyncEnabled = ()=> syncCheckbox && syncCheckbox.checked;
  function scheduleSync(from){ if(!isSyncEnabled()) return; if(syncing) return; if(!from) return; if(rafPending) return; rafPending=true; requestAnimationFrame(()=>{ rafPending=false; if(!isSyncEnabled()) return; const other=from===baseDiv? targetDiv: baseDiv; syncing=true; other.scrollTop=from.scrollTop; other.scrollLeft=from.scrollLeft; syncing=false; }); }
  // Align target to base horizontally when enabling
  if(syncCheckbox && !syncCheckbox._bound){ syncCheckbox._bound=true; syncCheckbox.addEventListener('change', ()=>{ if(syncCheckbox.checked){
        // Align target scrollbars to base
        targetDiv.scrollLeft = baseDiv.scrollLeft;
        targetDiv.scrollTop = baseDiv.scrollTop;
        // trigger one sync in case user starts from target
        scheduleSync(baseDiv);
      }
    }); }
  // Attach scroll listeners (idempotent) – previously missing causing sync scrolling to break
  try {
    if(!baseDiv._syncScrollBound){
      baseDiv.addEventListener('scroll', ()=>{ if(!syncing) scheduleSync(baseDiv); });
      baseDiv._syncScrollBound=true;
    }
    if(!targetDiv._syncScrollBound){
      targetDiv.addEventListener('scroll', ()=>{ if(!syncing) scheduleSync(targetDiv); });
      targetDiv._syncScrollBound=true;
    }
  } catch(_e){}
  } catch(e){ Logger.error('_renderPreviews failed', e); }
}
 function attachAscHandlers(){
   if(!window.Asc || !window.Asc.plugin){ setTimeout(attachAscHandlers,50); return; }
   const asc = window.Asc.plugin;
   if(asc.__compareTablesHandlersAttached) return; // idempotent
   asc.__compareTablesHandlersAttached = true;
   asc.init = function(){ Logger.info('Plugin init'); UI.init(); };
   asc.button = function(id){ if(id===-1){ Logger.info('Close button'); } };
   asc.onThemeChanged = function(theme){ if(asc.onThemeChangedBase) asc.onThemeChangedBase(theme); document.body.classList.toggle('dark', theme && theme.type==='dark'); };
   Logger.info('Asc handlers attached');
 }
 attachAscHandlers();
 async function startCompare(){ let st=State.get(); if(st.running) return; if(!st.base||!st.target){ _attemptRestoreSelections(); st=State.get(); }
  if(st.importDirtyForRun){
    const msg = (document.querySelector('[data-i18n="msg.importBlocked"]')?.textContent) || (window.__i18n && window.__i18n['msg.importBlocked']) || 'Очистите импорт перед запуском';
    State.set({ statusMessage: msg, statusKind:'warn' });
    if(window.PluginActions && window.PluginActions._pushUserMessage) window.PluginActions._pushUserMessage('warn', msg);
    return;
  }
  if(!st.base||!st.target){
    const msgEl=document.querySelector('[data-i18n="status.missingSelection"]');
    State.set({ statusMessage: msgEl? msgEl.textContent: 'Select both base and target sheets', statusKind:'warn' });
    return;
  }
  cancelFlag=false; legendDynamic=true; const opts={...st.options, enabledCategories: st.enabledCategories}; diffEngine=new DiffEngine(opts); State.set({ running:true, progress:0, diff:null, statusMessage:null, statusKind:null });
    // Lock further uploads (until user clears imports) once a comparison run is initiated with both sides present
    try { if(st.base && st.target){ State.set({ lockUploads:true }); } } catch(_e){}
  const btnCancel=document.getElementById('btnCancel'); if(btnCancel){ btnCancel.style.display='inline-block'; btnCancel.disabled=false; }
  clearMessages(); renderDiff(null); filterLegend(null); Logger.info('Compare start', st.base, st.target);
  // show previews before diff processing (previous diff for highlighting if exists)
  await _renderPreviews(st.base, st.target, st.diff);
   try {
  const diff = await diffEngine.compareSheets(st.base, st.target, (p)=>{ if(cancelFlag){ diffEngine.cancel(); } else State.set({ progress:p }); });
  if(diff.canceled){ const msgCanceled=document.querySelector('[data-i18n="msg.canceled"]')?.textContent || 'Сравнение отменено'; Logger.warn('Comparison canceled'); pushMessage('warn',msgCanceled); State.set({ running:false, progress:0 }); return; }
  State.set({ diff, running:false, progress:1 });
    if(btnCancel){ btnCancel.style.display='none'; }
    // Ensure counts visible again (may have been hidden by reset)
    document.querySelectorAll('.cat-count').forEach(sp=>{ sp.style.display='inline-block'; });
  // Re-render previews with latest diff to update highlighting
  await _renderPreviews(st.base, st.target, diff);
  renderDiff(diff); filterLegend(diff);
     Logger.info('Compare complete', diff.stats);
     // Diagnostics message
     try {
       if(window.PluginActions && window.PluginActions._pushUserMessage){
         const m=diff.meta.metrics||{}; const t=diff.meta.timings||{};
         const pct = m.changedCellsPct!=null? (m.changedCellsPct*100).toFixed(2)+'%':'?';
         const msg = `Cells: ${m.cellsCompared||0}, Changed: ${m.changedCells||0} (${pct}), Time: ${t.totalMs||diff.meta.durationMs||0}ms`;
         window.PluginActions._pushUserMessage('info', msg);
       }
     } catch(_e){}
  } catch(err){ Logger.error('Compare failed', err); State.set({ running:false }); const btnCancel=document.getElementById('btnCancel'); if(btnCancel){ btnCancel.style.display='none'; } }
 }
function renderDiff(diff){ const cont=document.getElementById('diffContainer'); if(!cont) return; cont.innerHTML=''; cont.classList.add('fixed-header'); const sb=document.getElementById('diffSearchBar'); if(!diff){ if(sb) sb.classList.add('hidden'); return; } else { if(sb) sb.classList.remove('hidden'); }
  // Fixed (non-scrolling) header
  const header=document.createElement('div'); header.className='diff-header';
  function trLocal(k,fb){ if(window.__i18n && window.__i18n[k]) return window.__i18n[k]; const el=document.querySelector(`[data-i18n="${k}"]`); return el? el.textContent.trim(): (fb||k); }
  function stripExt(n){ return n? n.replace(/\.[^.]+$/,''): ''; }
  // Build dynamic labels (Workbook | Sheet) full, no truncation
  let fromLabel=trLocal('report.header.from','From'); let toLabel=trLocal('report.header.to','To');
  try {
    const st = (window.State && State.get && State.get()) ? State.get() : {};
  const ph1 = (window.__i18n && window.__i18n['placeholder.source1']) || 'Источник 1';
  const ph2 = (window.__i18n && window.__i18n['placeholder.source2']) || 'Источник 2';
  const baseWB = stripExt(st.baseOriginalFile || (diff && diff.meta && (diff.meta.baseWorkbook||diff.meta.base)) || ph1);
  const targetWB = stripExt(st.targetOriginalFile || (diff && diff.meta && (diff.meta.targetWorkbook||diff.meta.target)) || ph2);
    const baseSheet = document.getElementById('baseSheetSelect')?.value || (diff && (diff.meta.baseSheet||diff.meta.baseSheetName)) || '';
    const targetSheet = document.getElementById('targetSheetSelect')?.value || (diff && (diff.meta.targetSheet||diff.meta.targetSheetName)) || '';
    fromLabel = baseWB + (baseSheet? ' | '+baseSheet:'');
    toLabel = targetWB + (targetSheet? ' | '+targetSheet:'');
  } catch(_e){}
  header.innerHTML=`<div class="col type" data-i18n="report.header.type">${trLocal('report.header.type','Type')}</div>`+
    `<div class="col addr" data-i18n="report.header.cell">${trLocal('report.header.cell','Cell')}</div>`+
  `<div class="col from" data-i18n="report.header.from" title="${trLocal('report.header.from','From')}">${fromLabel}</div>`+
  `<div class="col to" data-i18n="report.header.to" title="${trLocal('report.header.to','To')}">${toLabel}</div>`;
  cont.appendChild(header);
  // Scroll wrapper contains rows so they never overlap header
  const scroll=document.createElement('div'); scroll.className='diff-scroll'; cont.appendChild(scroll);
  const bodyWrap=document.createElement('div'); bodyWrap.className='diff-rows'; scroll.appendChild(bodyWrap);
  (diff.raw||[]).slice(0,5000).forEach((d,i)=>{ const row=document.createElement('div');
    const cssType = d.type==='value' ? 'value-change' : (d.type==='formula' ? 'formula-change' : d.type);
    row.className='diff-row '+cssType;
    row.setAttribute('data-diff-index', i);
    row.dataset.diffType = d.type;
    let addr= toA1(d.r,d.c);
    let displayType=d.type;
    if(d.type==='inserted-row' || d.type==='deleted-row'){ addr = 'Строка '+ (d.r+1); }
    else if(d.type==='inserted-col' || d.type==='deleted-col'){ addr = 'Столбец '+ colName(d.c); }
    row.innerHTML=`<div>${displayType}</div><div>${addr}</div><div>${escapeHtml(fmt(d.from))}</div><div>${escapeHtml(fmt(d.to))}</div>`;
  if(d.r!=null && d.c!=null){ row.dataset.r=d.r; row.dataset.c=d.c; row.title='Go to '+addr; row.tabIndex=0; row.setAttribute('role','button'); }
    bodyWrap.appendChild(row); });
  if((diff.raw||[]).length>5000){ const more=document.createElement('div'); more.className='diff-row more'; const lbl=document.querySelector('[data-i18n="msg.truncated"]')?.textContent || 'Только первые 5000'; more.textContent=lbl.replace('{extra}', diff.raw.length-5000); bodyWrap.appendChild(more);} }
  // Re-apply search highlighting if active
  if(window.__diffSearchState && window.__diffSearchState.query){ refreshDiffSearchMatches(); }
function filterLegend(diff){ const items=document.querySelectorAll('#legendSection li[data-difftype]'); if(!items) return; const selectedBoxes=[...document.querySelectorAll('.cat-filter')]; const selected = selectedBoxes.filter(cb=>cb.checked).map(cb=>cb.getAttribute('data-cat')); const treatAll = selected.length===0 || selected.length===selectedBoxes.length;
 // Always keep all legend items visible; unchecked categories just get a dim class (for optional styling)
 if(!diff){ items.forEach(li=>{ li.style.display=''; li.classList.remove('legend-dim'); }); updateCounts({}, selected, treatAll, false); return; }
 const presentCounts={}; (diff.raw||[]).forEach(d=>{ presentCounts[d.type]=(presentCounts[d.type]||0)+1; });
 items.forEach(li=>{ const t=li.getAttribute('data-difftype'); li.style.display=''; if(!treatAll && !selected.includes(t)) li.classList.add('legend-dim'); else li.classList.remove('legend-dim'); });
 updateCounts(presentCounts, selected, treatAll, true); }
 function updateCounts(presentCounts, selected, treatAll, hasDiff){ const spans=document.querySelectorAll('.cat-count[data-count]'); spans.forEach(sp=>{ const cat=sp.getAttribute('data-count'); let val=''; if(hasDiff){ if(presentCounts[cat]) val=String(presentCounts[cat]); else if(treatAll || selected.includes(cat)) val='0'; sp.style.display='inline-block'; } else { sp.style.display='none'; } sp.textContent=val; }); }
 function toA1(r,c){ return colName(c)+ (r+1); }
 function colName(c){ let s=''; c++; while(c>0){ let m=(c-1)%26; s=String.fromCharCode(65+m)+s; c=Math.floor((c-1)/26); } return s; }
 function fmt(v){ if(v==null) return ''; if(typeof v==='object') return JSON.stringify(v); return String(v); }
 function escapeHtml(s){ return s.replace(/[&<>'"]/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;' }[ch])); }
 function insertReport(){ const st=State.get(); if(!st.diff) return; Logger.info('Insert report start');
  window.Asc && window.Asc.plugin && window.Asc.plugin.callCommand(function(){ try {
     var reportName='CompareReport';
     var existing=Api.GetSheet(reportName);
     if(!existing){ Api.AddSheet(reportName); existing=Api.GetSheet(reportName); }
     if(existing){ existing.SetVisible(true); existing.SetActive(); var r=0; function w(row,col,text){ var cell=existing.GetCells(row,col); cell.SetValue(String(text)); }
       w(r++,0,'Compare Report'); w(r++,0,'Base'); w(r-1,1,Asc.scope.baseName); w(r++,0,'Target'); w(r-1,1,Asc.scope.targetName); var stats=Asc.scope.diffStats; for(var k in stats){ w(r,0,k); w(r,1,stats[k]); r++; } }
   } catch(e){ }
   }, function(){});
 }
 function tr(k, fallback){ const el=document.querySelector(`[data-i18n="${k}"]`); return el? el.textContent : (fallback||k); }
 function exportJSON(){ const st=State.get(); if(!st.diff){ pushMessage('warn', tr('msg.noDiff','No diff to export')); return; } try { const payload={ meta:st.diff.meta, stats:st.diff.stats, diffs:st.diff.raw }; const blob=new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); const ts=new Date().toISOString().replace(/[:]/g,'-'); a.href=url; a.download=`diff_${st.diff.meta.base}_vs_${st.diff.meta.target}_${ts}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },100); Logger.info('JSON exported'); pushMessage('info', tr('msg.exported','JSON exported')); } catch(e){ Logger.error('Export JSON failed', e); pushMessage('error', tr('msg.exportFailed','Export failed')); } }
 function pushMessage(kind,text){ const area=document.getElementById('messageArea'); if(!area) return; const span=document.createElement('span'); span.className='msg-'+kind; span.textContent=text; area.innerHTML=''; area.appendChild(span); }
 // internal helper for other modules (ui.js) to surface user messages
 window.PluginActions = window.PluginActions || {}; window.PluginActions._pushUserMessage = pushMessage;
 function clearMessages(){ const area=document.getElementById('messageArea'); if(area) area.innerHTML=''; }
 function resetLegend(){ legendDynamic=false; filterLegend(State.get().diff||null); }
 function enableLegendDynamic(){ legendDynamic=true; filterLegend(State.get().diff||null); }
 function refreshLegend(){ filterLegend(State.get().diff||null); }
// Merge into existing PluginActions to avoid wiping methods injected earlier (exportReportXlsx, _pushUserMessage)
window.PluginActions = Object.assign(window.PluginActions || {}, { startCompare, insertReport, exportJSON, /* exportReportXlsx preserved if already defined */ resetLegend, enableLegendDynamic, refreshLegend });
 // Cancel button behavior
 document.addEventListener('click', e=>{ if(e.target && e.target.id==='btnCancel'){ if(!cancelFlag){ cancelFlag=true; const btn=e.target; btn.disabled=true; pushMessage('warn', (document.querySelector('[data-i18n="msg.cancelRequested"]')?.textContent)||'Cancel requested'); } }});
 function prepareScopeForReport(){ const st=State.get(); if(!st.diff) return; Asc.scope.baseName=st.diff.meta.base; Asc.scope.targetName=st.diff.meta.target; Asc.scope.diffStats=st.diff.stats; }
State.subscribe(st=>{ if(st.diff) prepareScopeForReport(); });
// === Diff row navigation / preview focus ===
function focusPreviewCell(rr,cc, diffType){ const previews=[document.getElementById('basePreview'), document.getElementById('targetPreview')];
  const structuralRow = diffType==='inserted-row' || diffType==='deleted-row';
  const structuralCol = diffType==='inserted-col' || diffType==='deleted-col';
  previews.forEach(div=>{ if(!div) return; // Clear previous row/col highlights
    div.querySelectorAll('tr.preview-focus-row').forEach(tr=>tr.classList.remove('preview-focus-row'));
    div.querySelectorAll('.preview-focus, .preview-focus-col, .preview-focus-col-top, .preview-focus-col-bottom').forEach(td=>td.classList.remove('preview-focus','preview-focus-col','preview-focus-col-top','preview-focus-col-bottom')); });
  previews.forEach(div=>{ if(!div) return; const tbl=div.querySelector('table'); if(!tbl) return; const body=tbl.querySelector('tbody'); if(!body) return; const tr=body.querySelectorAll('tr')[rr]; if(!tr) return; const cells=tr.querySelectorAll('td'); const targetCell=cells[cc]; if(!targetCell && !structuralCol && !structuralRow) return;
    const refCell = targetCell || (cells[0] || null);
    if(refCell){ const top=refCell.offsetTop; const left=refCell.offsetLeft; div.scrollTop=Math.max(0, top-40); div.scrollLeft=Math.max(0,left-40); }
    if(structuralRow){ tr.classList.add('preview-focus-row'); }
    if(structuralCol){
      let firstCell=null, lastCell=null;
      body.querySelectorAll('tr').forEach(rtr=>{ const tds=rtr.querySelectorAll('td'); const colCell=tds[cc]; if(colCell){ colCell.classList.add('preview-focus-col'); if(!firstCell) firstCell=colCell; lastCell=colCell; } });
      if(firstCell) firstCell.classList.add('preview-focus-col-top');
      if(lastCell) lastCell.classList.add('preview-focus-col-bottom');
    }
    if(!structuralRow && !structuralCol && targetCell){ targetCell.classList.add('preview-focus'); }
  }); }
function activateDiffRow(row){ const r=row.dataset.r, c=row.dataset.c; if(r==null||c==null) return; const rr=parseInt(r,10), cc=parseInt(c,10); const diffType = row.dataset.diffType || ''; document.querySelectorAll('#diffContainer .diff-row.active').forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-selected','false'); }); row.classList.add('active'); row.setAttribute('aria-selected','true'); focusPreviewCell(rr,cc, diffType); }
// expose for search navigation
window.activateDiffRow = activateDiffRow;
document.addEventListener('click', e=>{ let tgt=e.target; if(tgt && !tgt.closest && tgt.parentElement) tgt=tgt.parentElement; if(!(tgt instanceof Element)) return; const row=tgt.closest('#diffContainer .diff-row'); if(!row) return; activateDiffRow(row); });
document.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' '){ const ae=document.activeElement; if(ae && ae.classList && ae.classList.contains('diff-row')){ e.preventDefault(); activateDiffRow(ae); } } });
// Arrow key navigation between diff rows (preserves structural highlighting)
document.addEventListener('keydown', e=>{
  if(e.key!=='ArrowDown' && e.key!=='ArrowUp') return; const active=document.querySelector('#diffContainer .diff-row.active')||document.activeElement; if(!active || !active.classList || !active.classList.contains('diff-row')) return;
  e.preventDefault(); const dir = e.key==='ArrowDown'? 1 : -1; let cur=active; while(true){ cur = (dir>0)? cur.nextElementSibling : cur.previousElementSibling; if(!cur) return; if(cur.classList && cur.classList.contains('diff-row')) break; }
  cur.focus(); activateDiffRow(cur);
});
 // Highlight & Diff search now handled by separate modules (highlight.js, diff_search.js)
 // Progress bar UI update
 State.subscribe(st=>{ const bar=document.getElementById('progressBar'); const pText=document.getElementById('progressText'); const btnCancel=document.getElementById('btnCancel'); if(!bar) return; const span=bar.querySelector('span'); if(!span) return; const pct=Math.round((st.progress||0)*100);
   if(st.importing){ bar.style.visibility='visible'; span.style.width=pct+'%'; if(pText){ const lblImp=document.querySelector('[data-i18n="status.importing"]'); pText.textContent=(lblImp?lblImp.textContent:'Importing...')+' '+pct+'%'; pText.className=''; } if(btnCancel) btnCancel.style.display='none'; return; }
   if(st.running){ bar.style.visibility='visible'; span.style.width=pct+'%'; if(pText){ const lblRun=document.querySelector('[data-i18n="status.running"]'); pText.textContent=(lblRun?lblRun.textContent:'Running')+' '+pct+'%'; pText.className=''; } if(btnCancel) btnCancel.style.display='inline-block'; return; }
   if(st.diff){ bar.style.visibility='visible'; span.style.width='100%'; if(pText && !st.statusMessage){ const lblDone=document.querySelector('[data-i18n="status.complete"]'); pText.textContent=lblDone?lblDone.textContent:'Complete'; pText.className=''; } if(btnCancel) btnCancel.style.display='none'; setTimeout(()=>{ const cur=State.get(); if(!cur.running && !cur.importing){ bar.style.visibility='hidden'; span.style.width='0%'; } },1500); return; }
   // idle
   if(!st.importing && !st.running){ bar.style.visibility='hidden'; span.style.width='0%'; if(pText){ if(st.statusMessage){ pText.textContent=st.statusMessage; pText.className=(st.statusKind==='warn'?'status-warn': st.statusKind==='error'?'status-error':''); } else { const lblIdle=document.querySelector('[data-i18n="status.idle"]'); pText.textContent=lblIdle?lblIdle.textContent:'Idle'; pText.className=''; } } if(btnCancel) btnCancel.style.display='none'; }
 });

// Sidebar collapse feature
(function(){
  const body=document.body;
  function setCollapsed(on){
    body.classList.toggle('sidebar-collapsed', !!on);
    const tBtn=document.getElementById('btnToggleSidebar');
  // Support possible duplicate markup: pick icon inside button
  const btn=document.getElementById('btnToggleSidebar');
    if(tBtn){
  const hideTitle=document.querySelector('[data-i18n-title="btn.hidePanel"]')?.getAttribute('title') || document.querySelector('[data-i18n="btn.hidePanel"]')?.textContent || 'Скрыть панель';
  const showTitle=document.querySelector('[data-i18n-title="btn.showPanel"]')?.getAttribute('title') || document.querySelector('[data-i18n="btn.showPanel"]')?.textContent || 'Показать панель';
  if(on){ tBtn.title=showTitle; tBtn.setAttribute('aria-label', showTitle); }
  else { tBtn.title=hideTitle; tBtn.setAttribute('aria-label', hideTitle); }
    }
  }
  function toggle(){ setCollapsed(!document.body.classList.contains('sidebar-collapsed')); }
  document.addEventListener('click', e=>{
    if(e.target && (e.target.id==='btnToggleSidebar' || (e.target.closest && e.target.closest('#btnToggleSidebar')))){ toggle(); }
  });
  document.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey) && e.key==='\"'){ toggle(); }});
  // Auto show button & collapse after run starts first time; hide/reset on clear imports
  let autoCollapsed=false;
  State.subscribe(st=>{
    const tBtn=document.getElementById('btnToggleSidebar');
    if(!tBtn) return;
    if(st.running && !autoCollapsed){ setTimeout(()=>{ setCollapsed(true); }, 80); autoCollapsed=true; }
  });
  // Expose reset for Clear Imports (ui.js can call window.PluginActions.resetSidebarState())
  function resetSidebarState(){
    const tBtn=document.getElementById('btnToggleSidebar');
  setCollapsed(false);
  autoCollapsed=false;
  }
  window.PluginActions = window.PluginActions || {}; window.PluginActions.resetSidebarState = resetSidebarState;
  // Initial state: ensure not collapsed AND sync icon explicitly
  setCollapsed(false);
  // Force icon reset if mismatch
  // Icons handled purely by CSS classes now
})();

})(window);
