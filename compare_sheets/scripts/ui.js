/** UI bindings */
(function(window){
 'use strict';
 // === Helper DOM ===
 function qs(id){ return document.getElementById(id); }
 const baseSel=()=>qs('baseSheetSelect');
 const targetSel=()=>qs('targetSheetSelect');
 const baseFileLabel=()=>qs('baseFileNameLabel');
 const targetFileLabel=()=>qs('targetFileNameLabel');
 const sideMeta={
      base:{ fileName:null, sheetOrder:[], sheetMap:{} },
      target:{ fileName:null, sheetOrder:[], sheetMap:{} }
 };

 // Disable upload buttons while imports present
 function updateUploadButtons(){
      try {
           const st = (window.State && State.get && State.get())? State.get(): {};
           const disabled = !!st.lockUploads;
           ['btnUploadBase','btnUploadTarget','btnUseCurrentBase','btnUploadFileBase','btnUseCurrentTarget','btnUploadFileTarget'].forEach(id=>{
                const el=document.getElementById(id); if(!el) return;
                // Only disable the two main icon buttons + dropdown items; do NOT disable selects here
                el.disabled=disabled;
                const cont=el.closest('.upload-menu-container');
                if(cont){ cont.classList.toggle('disabled', disabled); if(disabled) cont.classList.remove('open'); }
                if(disabled){
                     const msg = (window.__i18n && (window.__i18n['hint.clearBeforeImport'] || window.__i18n['hint.clearImportsFirst'] || window.__i18n['msg.importBlocked'])) || 'Очистите импорт, чтобы загрузить новые листы';
                     // store message on container so hover works even if button disabled
                     if(id==='btnUploadBase' || id==='btnUploadTarget'){
                          if(cont){ cont.setAttribute('data-disabled-hint', msg); }
                          el.classList.add('upload-disabled-hint');
                          el.removeAttribute('title');
                          el.removeAttribute('aria-label');
                          const bindTarget = cont || el;
                          if(!bindTarget._hintBound){
                               bindTarget._hintBound=true;
                               const showTip = (ev)=>{
                                    if(!el.disabled) return;
                                    const hovered = document.elementFromPoint(ev.clientX, ev.clientY);
                                    if(hovered!==el && !el.contains(hovered)) return;
                                    let tip=document.getElementById('uploadDisabledHint');
                                    if(!tip){ tip=document.createElement('div'); tip.id='uploadDisabledHint'; tip.className='floating-hint'; document.body.appendChild(tip); }
                                    tip.style.transform='none'; // absolute, no centering
                                    const text = (cont && cont.getAttribute('data-disabled-hint')) || el.getAttribute('data-disabled-hint') || msg;
                                    tip.textContent=text;
                                    const pageX = ev.pageX || (ev.clientX + window.scrollX);
                                    const pageY = ev.pageY || (ev.clientY + window.scrollY);
                                    const offsetX = -12; // show to the left
                                    const offsetY = 14;
                                    let leftPos = (pageX + offsetX - tip.offsetWidth);
                                    if(leftPos < window.scrollX + 4) leftPos = window.scrollX + 4;
                                    tip.style.left = leftPos + 'px';
                                    tip.style.top = (pageY + offsetY) + 'px';
                                    tip.style.opacity='1';
                               };
                               bindTarget.addEventListener('mouseenter', showTip);
                               bindTarget.addEventListener('mousemove', (ev)=>{
                                    const tip=document.getElementById('uploadDisabledHint');
                                    if(!el.disabled){ if(tip) tip.style.opacity='0'; return; }
                                    const hovered = document.elementFromPoint(ev.clientX, ev.clientY);
                                    if(hovered===el || el.contains(hovered)){
                                         if(tip && tip.style.opacity==='1'){
                                              // update position
                                              const pageX = ev.pageX || (ev.clientX + window.scrollX);
                                              const pageY = ev.pageY || (ev.clientY + window.scrollY);
                                              const offsetX2 = -12;
                                              const offsetY2 = 14;
                                              let leftPos2 = (pageX + offsetX2 - tip.offsetWidth);
                                              if(leftPos2 < window.scrollX + 4) leftPos2 = window.scrollX + 4;
                                              tip.style.left = leftPos2 + 'px';
                                              tip.style.top = (pageY + offsetY2) + 'px';
                                         } else {
                                              showTip(ev);
                                         }
                                    } else if(tip){ tip.style.opacity='0'; }
                               });
                               bindTarget.addEventListener('mouseleave', ()=>{
                                    const tip=document.getElementById('uploadDisabledHint'); if(tip){ tip.style.opacity='0'; }
                               });
                          }
                     }
                } else {
                     if(cont){ cont.removeAttribute('data-disabled-hint'); }
                     el.classList.remove('upload-disabled-hint');
                     // Suppress tooltips for main icon & file upload buttons when unlocked
                     if(id==='btnUploadBase' || id==='btnUploadTarget' || id==='btnUploadFileBase' || id==='btnUploadFileTarget'){
                          el.removeAttribute('title');
                          el.removeAttribute('aria-label');
                     } else {
                          const origKey = el.getAttribute('data-i18n-title');
                          if(origKey && window.__i18n && window.__i18n[origKey]){
                               el.setAttribute('title', window.__i18n[origKey]);
                               el.setAttribute('aria-label', window.__i18n[origKey]);
                          } else {
                               el.removeAttribute('title'); el.removeAttribute('aria-label');
                          }
                     }
                }
           });
      } catch(_e){}
 }

 // === Virtual sheet store & persistence keys ===
 const virtualSheets = {}; // { sheetName: {maxR,maxC,rows:[[{v,f,t}]]} }
 window.VirtualSheets = virtualSheets; // expose for debugging
 const VIRTUAL_STORE_KEY = 'compareTables_virtualSheets_v1';
 const OPTIONS_STORE_KEY = 'compareTables_options_v1';
 const CATS_STORE_KEY = 'compareTables_categories_v1'; // deprecated (no persistence now)
 const SELECTION_STORE_KEY = 'compareTables_selection_v1'; // store {base,target}
 const _MIGRATION_FLAG = 'compareTables_storage_migrated_v1';

 function storage(){ return (function(){ try { if(window.localStorage){ return window.localStorage; } } catch(e){} return window.sessionStorage; })(); }
 function migrateIfNeeded(){
      try {
           const s=storage();
           if(!s) return;
           if(s.getItem(_MIGRATION_FLAG)) return; // already migrated
           // Migrate known keys (selection persistence reintroduced)
           const pairs=[VIRTUAL_STORE_KEY, OPTIONS_STORE_KEY, CATS_STORE_KEY, SELECTION_STORE_KEY];
           pairs.forEach(k=>{ try { if(typeof localStorage!=='undefined' && localStorage && !localStorage.getItem(k) && sessionStorage.getItem(k)){ localStorage.setItem(k, sessionStorage.getItem(k)); } } catch(_e){} });
           s.setItem(_MIGRATION_FLAG,'1');
      } catch(e){ /* ignore */ }
 }

// Persistence disabled – always start with empty virtual sheet set
function persistVirtualSheets(){ /* disabled */ }
function restoreVirtualSheets(){ return []; }
 function persistOptions(opts){ try { storage().setItem(OPTIONS_STORE_KEY, JSON.stringify(opts)); } catch(e){} }
 function restoreOptions(){ try { const raw=storage().getItem(OPTIONS_STORE_KEY); if(!raw) return null; return JSON.parse(raw); } catch(e){ return null; } }
function persistCategories(_cats){ /* disabled persistence (legend selection not persisted) */ }
function restoreCategories(){ return null; }
function persistSelection(_sel){ /* disabled */ }
function restoreSelection(){ return null; }

 // === Render & State Binding (custom limited to imported file sheets) ===
 function updateSideSelect(kind){
     const sel = kind==='base'? baseSel(): targetSel();
     const meta = sideMeta[kind];
     const fileLabel = kind==='base'? baseFileLabel(): targetFileLabel();
     if(!sel) return;
     sel.innerHTML=''; sel.disabled=true; // keep disabled until populated
     if(meta.fileName){
          meta.sheetOrder.forEach(sh=>{ const o=document.createElement('option'); o.value=sh; o.textContent=sh; sel.appendChild(o); });
          // enable will happen after value selection below
          if(fileLabel){
               fileLabel.textContent=''; // will set after selection below via updateDynamicLabel
               fileLabel.classList.add('visible');
          }
          const st=State.get();
          const virtWanted = (kind==='base'? st.base: st.target);
          if(virtWanted){
               const found = Object.entries(meta.sheetMap).find(([disp,v])=>v===virtWanted);
               if(found) sel.value=found[0];
          }
          if(!sel.value && sel.options.length){
               const st2=State.get();
               const hasSel = kind==='base'? !!st2.base: !!st2.target;
               if(!hasSel){
                    sel.selectedIndex=0;
                    const virt=meta.sheetMap[sel.options[0].value];
                    if(kind==='base') State.set({ base:virt }); else State.set({ target:virt });
               }
          }
     // Enable only if options exist
     if(sel.options.length>0) sel.disabled=false;
          // After selection decisions, update label text
          updateDynamicBookSheetLabel(kind);
     } else {
          sel.disabled=true;
          if(fileLabel){ fileLabel.textContent=''; fileLabel.classList.remove('visible'); }
          // Ensure placeholder label (Источник 1/2) shown even with no file imported yet
          updateDynamicBookSheetLabel(kind);
     }
 }

// Build truncated book name + sheet name label: show start & end of long names
function truncateMiddle(name, maxLen){
     if(!name) return '';
     if(name.length<=maxLen) return name;
     const keep = maxLen-3; if(keep<4) return name.slice(0,maxLen); // fallback
     const first = Math.ceil(keep/2);
     const last = keep-first;
     return name.slice(0,first)+'…'+name.slice(name.length-last);
}
function stripExtension(fileName){ return fileName? fileName.replace(/\.[^.]+$/,''): fileName; }
function updateDynamicBookSheetLabel(kind){
     const meta=sideMeta[kind];
     const sel = kind==='base'? baseSel(): targetSel();
     const labelEl = kind==='base'? document.querySelector('label[for="baseSheetSelect"]'): document.querySelector('label[for="targetSheetSelect"]');
     if(!labelEl) return;
     const fileOriginal = stripExtension(meta && meta.fileName? meta.fileName: '');
     if(!fileOriginal){
          // i18n placeholders
          const ph1 = (window.__i18n && window.__i18n['placeholder.source1']) || 'Источник 1';
          const ph2 = (window.__i18n && window.__i18n['placeholder.source2']) || 'Источник 2';
          labelEl.textContent = kind==='base'? ph1: ph2; return;
     }
     labelEl.classList.add('visible');
     // Set full name first
     labelEl.textContent = fileOriginal;
     labelEl.classList.add('visible');
     // Match label width to select (if available) for fitting
     try {
          if(sel && sel.offsetWidth){
               labelEl.style.display='inline-block';
               labelEl.style.maxWidth = sel.offsetWidth + 'px';
               // If overflows, iteratively middle-truncate to fit
               if(labelEl.scrollWidth > labelEl.clientWidth){
                    // Heuristic initial target length proportional to available space
                    let full = fileOriginal;
                    let approxLen = Math.max(6, Math.floor(full.length * (labelEl.clientWidth / labelEl.scrollWidth)) - 1);
                    // Clamp
                    if(approxLen > full.length) approxLen = full.length;
                    // Binary style narrowing
                    let low=6, high=approxLen, best=approxLen;
                    function apply(len){ return truncateMiddle(full, len); }
                    // Ensure high not zero
                    if(high < 6) high = Math.min(12, full.length);
                    for(let i=0;i<20;i++){
                         const mid = Math.max(low, Math.min(high, Math.floor((low+high)/2)));
                         labelEl.textContent = apply(mid);
                         if(labelEl.scrollWidth <= labelEl.clientWidth){ best = mid; low = mid+1; }
                         else { high = mid-1; }
                         if(low>high) break;
                    }
                    labelEl.textContent = apply(best);
               }
          }
     } catch(_e){}
}
function renderSheets(){ updateSideSelect('base'); updateSideSelect('target'); }
// MutationObserver removed – selects are managed only by internal code now
function startSelectObservers(){}
function bindState(){ State.subscribe(st=>{ const btnRun=qs('btnRun'), btnReport=qs('btnReport'), btnExport=qs('btnExportJson'); const hasDiff=!!st.diff; if(btnRun) btnRun.disabled=st.running; if(btnReport) btnReport.disabled=!hasDiff; if(btnExport) btnExport.disabled=!hasDiff; /* progress text managed in plugin.js to avoid conflicts */ }); }
// Manage clear imports button enablement
State.subscribe(st=>{ const btnClr=qs('btnClearImports'); if(btnClr){ const virtNames = Object.keys(window.VirtualSheets||{}); btnClr.disabled = virtNames.length===0 || st.importing || st.running; } });
// Enforce disabled state after any potential external re-enable glitches
function enforceClearImportsDisabled(){ const btnClr=qs('btnClearImports'); if(!btnClr) return; const virtNames=Object.keys(window.VirtualSheets||{}); if(!virtNames.length && !btnClr.disabled) btnClr.disabled=true; }
State.subscribe(()=> enforceClearImportsDisabled());
State.subscribe(st=>{ const blocker=document.getElementById('uiBlocker'); if(blocker){ if(st.importing){ blocker.classList.add('active'); } else { blocker.classList.remove('active'); } }
     const modal=document.getElementById('sheetSelectModal'); const modalOpen = modal && !modal.classList.contains('hidden');
     if(st.importing){
          document.querySelectorAll('button,select,input').forEach(el=>{
               const isModalChild = modalOpen && modal.contains(el);
               if(isModalChild){
                    // Force enable modal interactive elements
                    el.disabled=false; el.removeAttribute('data-prev-disabled');
               } else {
                    if(!el.hasAttribute('data-prev-disabled')) el.setAttribute('data-prev-disabled', el.disabled? '1':'0');
                    el.disabled=true;
               }
          });
     } else {
          document.querySelectorAll('button,select,input').forEach(el=>{
               const prev=el.getAttribute('data-prev-disabled');
               if(prev!==null){ el.disabled = prev==='1'; el.removeAttribute('data-prev-disabled'); }
               else if(el.id!=='btnReport' && el.id!=='btnExportJson' && el.id!=='btnClearImports'){
                    // Generic enable for ordinary controls; skip special buttons with their own logic
                    el.disabled=false;
               }
          });
     }
});
function collectOptions(){ return { ignoreCase:qs('optIgnoreCase')?.checked, trim:qs('optTrim')?.checked, compareFormatting:qs('optFormat')?.checked }; }
function attachHandlers(){ const opts=['optIgnoreCase','optTrim','optFormat']; const run=qs('btnRun'), report=qs('btnReport'), exportBtn=qs('btnExportJson'); run&&run.addEventListener('click', ()=>window.PluginActions.startCompare()); report&&report.addEventListener('click', ()=>{ if(window.PluginActions.exportReportXlsx) window.PluginActions.exportReportXlsx(); else if(window.PluginActions.insertReport) window.PluginActions.insertReport(); }); exportBtn&&exportBtn.addEventListener('click', ()=>window.PluginActions.exportJSON()); opts.forEach(id=>{ const el=qs(id); el&&el.addEventListener('change', ()=>{ const o=collectOptions(); State.set({ options:o }); persistOptions(o); }); });
     const clr=qs('btnClearImports'); if(clr){ clr.addEventListener('click', ()=>{ if(clr.disabled) return; clearImportedSheets(); }); }
      // Map display sheet name -> virtual sheet id on change
      baseSel()?.addEventListener('change', ()=>{ const disp=baseSel().value||null; const virt=disp? (sideMeta.base.sheetMap[disp]||null): null; State.set({ base:virt }); persistSelection({ base:State.get().base, target:State.get().target }); });
     targetSel()?.addEventListener('change', ()=>{ const disp=targetSel().value||null; const virt=disp? (sideMeta.target.sheetMap[disp]||null): null; State.set({ target:virt }); persistSelection({ base:State.get().base, target:State.get().target }); });
     // Update dynamic labels on selection changes
     baseSel()?.addEventListener('change', ()=>updateDynamicBookSheetLabel('base'));
     targetSel()?.addEventListener('change', ()=>updateDynamicBookSheetLabel('target'));
      // Category checkbox change: update state and only refresh legend (no auto compare)
      document.addEventListener('change', e=>{ if(e.target && e.target.classList && e.target.classList.contains('cat-filter')){ const all=[...document.querySelectorAll('.cat-filter')]; const active=all.filter(cb=>cb.checked).map(cb=>cb.getAttribute('data-cat')); const normalized=(active.length===0||active.length===all.length)? null: active; State.set({ enabledCategories: normalized }); persistCategories(normalized); if(window.PluginActions && window.PluginActions.refreshLegend) window.PluginActions.refreshLegend(); // auto re-run diff if possible
           const st=State.get(); if(window.PluginActions && window.PluginActions.startCompare && st.base && st.target && !st.running){ window.PluginActions.startCompare(); }
      } }); }
 // Legend action buttons
 document.addEventListener('click', e=>{
     const id=e.target && (e.target.id || (e.target.closest && e.target.closest('button') && e.target.closest('button').id));
     if(!id) return;
     if(id==='btnCatSelectAll'){ const boxes=[...document.querySelectorAll('.cat-filter')]; boxes.forEach(b=>b.checked=true); State.set({ enabledCategories:null }); persistCategories(null); }
    else if(id==='btnCatClearAll'){ const boxes=[...document.querySelectorAll('.cat-filter')]; boxes.forEach(b=>b.checked=false); State.set({ enabledCategories:null }); persistCategories(null); }
       else if(id==='btnCatReset'){ const boxes=[...document.querySelectorAll('.cat-filter')]; boxes.forEach(b=>b.checked=true); // reset selection
            // Clear diff & preview
            const diffEl=document.getElementById('diffContainer'); if(diffEl) diffEl.innerHTML='';
            const previewWrap=document.getElementById('sheetPreviewWrapper'); if(previewWrap) previewWrap.classList.add('hidden');
            const syncRow=document.getElementById('previewControlsRow'); const syncCb=document.getElementById('chkSyncScroll'); if(syncRow){ syncRow.classList.remove('active'); } if(syncCb){ syncCb.checked=false; }
            // Hide & reset search bar
            const sb=document.getElementById('diffSearchBar'); if(sb) sb.classList.add('hidden');
            const sf=document.getElementById('diffSearchFields'); if(sf) sf.classList.add('hidden');
            const si=document.getElementById('diffSearchInput'); if(si) si.value='';
            const scnt=document.getElementById('diffSearchCount'); if(scnt) scnt.textContent='0/0';
            if(window.__diffSearchState){ window.__diffSearchState.query=''; window.__diffSearchState.matches=[]; window.__diffSearchState.index=-1; }
            State.set({ enabledCategories:null, diff:null, highlightApplied:false, statusMessage:null, statusKind:null }); persistCategories(null);
            document.querySelectorAll('.cat-count').forEach(sp=>{ sp.textContent=''; sp.style.display='none'; });
            if(window.PluginActions && window.PluginActions.resetLegend) window.PluginActions.resetLegend();
            if(window.PluginActions && window.PluginActions.refreshLegend) window.PluginActions.refreshLegend(); }
 });

 // === Type helpers & parsers ===
 function inferType(v){ if(v===''||v==null) return 'empty'; if(!isNaN(Number(v))) return 'number'; if(/^(\d{4}-\d{2}-\d{2})$/.test(v)) return 'date'; return 'string'; }
 function parseCSV(text){ const rows=text.split(/\r?\n/); const matrix=rows.filter(r=>r.trim().length>0).map(r=>r.split(/,|;|\t/));
  if(matrix.length>10000){ throw new Error('ROW_LIMIT_EXCEEDED'); }
  return { maxR:matrix.length, maxC:matrix[0]?matrix[0].length:0, rows:matrix.map(r=> r.map(v=>({v:v,f:null,t:inferType(v)}))) }; }
 function decodeBestCsv(arrayBuffer){ const encodings=['utf-8','windows-1251','koi8-r','ibm866','iso-8859-5']; const bytes=new Uint8Array(arrayBuffer); if(bytes.length>=3 && bytes[0]===0xEF && bytes[1]===0xBB && bytes[2]===0xBF){ try { return new TextDecoder('utf-8').decode(bytes);}catch(_){} } const results=[]; encodings.forEach(enc=>{ try{ const dec=new TextDecoder(enc); const text=dec.decode(bytes); results.push(scoreDecoded(text,enc)); }catch(e){} }); if(!results.length){ try { return new TextDecoder().decode(bytes);}catch(e){ return ''; } } results.sort((a,b)=>{ if(b.cyrRatio!==a.cyrRatio) return b.cyrRatio-a.cyrRatio; if(a.repl!==b.repl) return a.repl-b.repl; return a.mojibake-b.mojibake; }); return results[0].text; }
 function scoreDecoded(text,enc){ const total=(text.match(/[A-Za-z\u0400-\u04FF]/g)||[]).length; const cyr=(text.match(/[\u0400-\u04FF]/g)||[]).length; const repl=(text.match(/[\uFFFD\?]/g)||[]).length; const mojibake=(text.match(/[ÃÂÐÑ][\x80-\xBF]?/g)||[]).length; const cyrRatio=total? cyr/total:0; return { text: text, enc, cyrRatio, repl, mojibake }; }
 const _WorkbookCache=new Map();
 async function parseBinaryWorkbook(arrayBuffer,fileName){
     if(!window.XLSX){
          try { Logger.info('Loading XLSX parser'); await loadScriptOnce('vendor/xlsx.full.min.js'); } catch(e){ Logger.error('Parser load failed', e); throw e; }
     }
     if(!window.XLSX) throw new Error('Parser library not available');
     const data=new Uint8Array(arrayBuffer); let wb;
     try { wb=XLSX.read(data,{type:'array', cellDates:true}); } catch(e){ Logger.error('XLSX.read failed', e); throw e; }
     const sheets={};
     function mapType(cell){ if(!cell) return 'empty'; if(cell.f) return (cell.t==='n'||cell.t==='d')? 'number':'formula'; switch(cell.t){ case 'n': return 'number'; case 'd': return 'date'; case 'b': return 'boolean'; case 'e': return 'error'; case 's': default: return inferType(cell.v); } }
     let sheetIndex=0;
     for(const n of wb.SheetNames){ try {
               const ws=wb.Sheets[n]; if(!ws||!ws['!ref']){ sheets[n]={ maxR:0,maxC:0, rows:[] }; continue; }
               const range=XLSX.utils.decode_range(ws['!ref']); const maxR=range.e.r - range.s.r + 1; const maxC=range.e.c - range.s.c + 1;
               if(maxR>10000){ sheets[n]={ maxR:0,maxC:0, rows:[] }; Logger.warn('Skipped sheet due to row limit', {sheet:n, rows:maxR}); continue; }
               const rows=[];
               for(let r=0;r<maxR;r++){
                    const rowArr=[];
                    for(let c=0;c<maxC;c++){
                         const addr=XLSX.utils.encode_cell({r:range.s.r + r, c:range.s.c + c});
                         const cell=ws[addr];
                         if(cell){
                              let v=cell.v; const f=cell.f||null; const t=mapType(cell);
                              if(cell.t==='d' && v instanceof Date){ v=v.toISOString().split('T')[0]; }
                              rowArr.push({v,f,t});
                         } else { rowArr.push({v:null,f:null,t:'empty'}); }
                    }
                    rows.push(rowArr);
                    if(r % 200 === 0){ // yield to UI thread & report progress
                         const totalEst = wb.SheetNames.length; const baseProgress = sheetIndex/totalEst; const local = (r+1)/maxR; const overall = Math.min(0.99, baseProgress + local*(1/totalEst)); State.set({ progress: overall }); await new Promise(rf=>setTimeout(rf)); }
               }
               sheets[n]={ maxR, maxC, rows };
               sheetIndex++;
               State.set({ progress: Math.min(0.99, sheetIndex / wb.SheetNames.length) });
          } catch(e){ Logger.error('Sheet parse failed', n, e); }
     }
     return { sheetNames: wb.SheetNames, sheets };
 }
 function loadScriptOnce(primary){
  const sources = Array.isArray(primary)? primary: [primary];
     return new Promise((resolve,reject)=>{
          function tryNext(i){
               if(i>=sources.length){ return reject(new Error('All script sources failed: '+sources.join(', '))); }
               const src=sources[i];
               if(document.querySelector('script[data-src="'+src+'"]')){ // already loading/loaded
                    // Wait a tick to ensure onload maybe already fired
                    setTimeout(()=>resolve(),50);
                    return;
               }
               const s=document.createElement('script'); s.src=src; s.dataset.src=src; s.onload=()=>resolve(); s.onerror=()=>{ Logger.warn('Script load failed', src); tryNext(i+1); }; document.head.appendChild(s);
          }
          tryNext(0);
     });
 }

 // === Import logic ===
function importSheet(kind,file){ if(State.get().importing) return; const importingLabel=(document.querySelector('[data-i18n="status.importing"]')?.textContent)||'Importing...'; State.set({ importing:true, statusMessage:importingLabel, statusKind:null, progress:0 });
     // Mark import dirty if a diff already exists (will require clear before next Run)
     try { const st=State.get(); if(st.diff){ State.set({ importDirtyForRun:true }); } } catch(_e){}
     // remember previous disabled states
     document.querySelectorAll('button,select,input').forEach(el=>{ if(!el.hasAttribute('data-prev-disabled')) el.setAttribute('data-prev-disabled', el.disabled? '1':'0'); el.disabled=true; });
     function finishImport(success){ const completeLabel=(document.querySelector('[data-i18n="msg.importComplete"]')?.textContent)||'Import complete'; const st=State.get(); State.set({ importing:false, statusMessage: success? completeLabel: null, progress: success? 1:0 }); setTimeout(()=>{ const cur=State.get(); if(!cur.running && !cur.importing && !cur.statusMessage){ const idleLbl=document.querySelector('[data-i18n="status.idle"]')?.textContent||'Idle'; State.set({ statusMessage:idleLbl }); } },1600); document.querySelectorAll('button,select,input').forEach(el=>{ const prev=el.getAttribute('data-prev-disabled'); if(prev!==null){ el.disabled = prev==='1'; el.removeAttribute('data-prev-disabled'); } });
          // Force-enable sheet selects if they now have options (override previous disabled snapshot)
          ['baseSheetSelect','targetSheetSelect'].forEach(id=>{ const sel=document.getElementById(id); if(sel && sel.options && sel.options.length>0){ sel.disabled=false; } }); }
     const ext=(file.name.split('.').pop()||'').toLowerCase(); const baseName=file.name.replace(/\.[^.]+$/,''); const prefix=kind==='base'? 'Imported_Base_':'Imported_Target_'; let label=prefix+baseName; const stNow=State.get(); let counter=2; while(stNow.sheets.includes(label)){ label=prefix+baseName+'_'+counter++; } function resetFileInput(k){ try { (k==='base'? qs('fileBase'):qs('fileTarget')).value=''; }catch(e){} } function pushImportMessage(kindMsg,key,fallback){ if(window.PluginActions && window.PluginActions._pushUserMessage){ const sel=document.querySelector('[data-i18n="'+key+'"]'); const msg= sel? sel.textContent : fallback; window.PluginActions._pushUserMessage(kindMsg,msg||fallback); } }
                                   if(['csv','txt'].includes(ext)){ const reader=new FileReader(); reader.onload=e=>{ try { const text=decodeBestCsv(e.target.result); const lines=text.split(/\r?\n/); const total=lines.length||1; const chunk=20; // progress step
                                              for(let i=0;i<lines.length;i+=chunk){ State.set({ progress: Math.min(0.99, i/total) }); }
                                              const snap=parseCSV(text); registerVirtual(label,snap,kind,{ fileName:file.name, sheetName: baseName }); pushImportMessage('info','msg.importComplete','Import complete'); finishImport(true); } catch(err){ if(err && err.message==='ROW_LIMIT_EXCEEDED'){ pushImportMessage('error','msg.rowLimit','Row limit exceeded (10000)'); } else { Logger.error('Import failed', err); pushImportMessage('error','msg.importFailed','Import failed'); } finishImport(false); } finally { resetFileInput(kind); } }; reader.onerror=()=>{ Logger.error('File read error'); pushImportMessage('error','msg.fileReadError','File read error'); resetFileInput(kind); finishImport(false); }; reader.readAsArrayBuffer(file); }
                                                  else if(['xls','xlsx','xlsm','xlsb','ods','fods'].includes(ext)){ const reader=new FileReader(); reader.onload=async e=>{ try { if(!window.XLSX){ try { await loadScriptOnce([
                                             'vendor/xlsx.full.min.js',
                                             'vendor/xlsx.mini.min.js',
                                             // Additional CDN fallbacks
                                             'https://unpkg.com/xlsx@0.19.3/dist/xlsx.full.min.js',
                                             'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.19.3/xlsx.full.min.js',
                                             'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js'
                                        ]); } catch(eLoad){ pushImportMessage('error','msg.xlsxLibLoadFailed','XLSX library load failed');
                                        if(window.State){ const el=document.querySelector('[data-i18n="msg.xlsxLibLoadFailed"]'); State.set({ statusMessage: el?el.textContent:'Failed to load XLSX parser', statusKind:'error' }); }
                                        throw eLoad; } }
                         if(!window.XLSX){ pushImportMessage('error','msg.xlsxLibMissing','XLSX library missing'); if(window.State){ const el2=document.querySelector('[data-i18n="msg.xlsxLibMissing"]'); State.set({ statusMessage: el2?el2.textContent:'XLSX parser not available', statusKind:'error' }); } return; }
                              // Basic capability check (mini builds sometimes lack certain utilities)
                              if(!window.XLSX.utils || !window.XLSX.read){ const diag='XLSX library present but incomplete'; Logger.error(diag); pushImportMessage('error','msg.xlsxLibMissing','XLSX library missing'); if(window.State){ State.set({ statusMessage: diag, statusKind:'error' }); } return; }
                    const sig=file.name+':'+(file.size||0); let wbBundle=_WorkbookCache.get(sig); if(!wbBundle){ wbBundle=await parseBinaryWorkbook(e.target.result,file.name); _WorkbookCache.set(sig, wbBundle); }
               const importableNames=wbBundle.sheetNames.filter(n=> wbBundle.sheets[n] && wbBundle.sheets[n].maxR>0);
               const skipped=wbBundle.sheetNames.filter(n=> wbBundle.sheets[n] && wbBundle.sheets[n].maxR===0);
               showSheetSelectionModal(importableNames,(chosen)=>{ if(!chosen){ finishImport(false); return; } const selected=chosen && chosen.length? chosen: importableNames; const batch=[]; selected.forEach(sn=>{ const snap=wbBundle.sheets[sn]; const uniqueLabel=ensureUniqueLabel(label+'_'+sn); batch.push({uniqueLabel,snap,sn}); }); let done=0; const totalSel=batch.length||1; batch.forEach(item=>{ registerVirtual(item.uniqueLabel,item.snap,kind,{ fileName:file.name, sheetName:item.sn }, true); done++; if(done%1===0){ State.set({ progress: Math.min(0.99, done/totalSel) }); } }); renderSheets(); let msg = selected.length+' sheets imported'; if(skipped.length) msg += ', '+skipped.length+' skipped (>10000 rows)'; pushImportMessage('info','msg.workbookImported', msg); finishImport(true); }); } catch(err){ Logger.error('Workbook import failed', err); pushImportMessage('error','msg.importFailed','Import failed'); finishImport(false); } finally { resetFileInput(kind); } }; reader.onerror=()=>{ Logger.error('File read error'); pushImportMessage('error','msg.fileReadError','File read error'); resetFileInput(kind); finishImport(false); }; reader.readAsArrayBuffer(file); }
  else { Logger.warn('Unsupported extension', ext); }
 }
 function ensureUniqueLabel(base){ let candidate=base; let c=2; const stNow=State.get(); while(stNow.sheets.includes(candidate)){ candidate=base+'_'+c++; } return candidate; }

 // === Sheet selection modal ===
function showSheetSelectionModal(sheetNames,onDone){ const modal=qs('sheetSelectModal'); if(!modal){ onDone(sheetNames); return; } const listDiv=qs('sheetSelectList'); listDiv.innerHTML=''; sheetNames.forEach(n=>{ const id='shsel_'+n.replace(/[^A-Za-z0-9_]/g,'_'); const lbl=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.value=n; cb.checked=true; lbl.appendChild(cb); const span=document.createElement('span'); span.textContent=n; lbl.appendChild(span); listDiv.appendChild(lbl); }); function cleanup(){ ['btnSheetSelectOk','btnSheetSelectCancel','btnSheetSelectAll','btnSheetSelectNone'].forEach(id=>{ const el=qs(id); if(el){ const clone=el.cloneNode(true); clone.disabled=false; clone.removeAttribute('data-prev-disabled'); el.parentNode.replaceChild(clone, el); } }); }
     function closeOnly(){ modal.classList.add('hidden'); cleanup(); }
     function okH(){ const chosen=[...listDiv.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value); closeOnly(); onDone(chosen); }
     function cancelH(){ closeOnly(); onDone(null); }
     function allH(){ listDiv.querySelectorAll('input[type=checkbox]').forEach(i=>i.checked=true); }
     function noneH(){ listDiv.querySelectorAll('input[type=checkbox]').forEach(i=>i.checked=false); }
     ['btnSheetSelectOk','btnSheetSelectCancel','btnSheetSelectAll','btnSheetSelectNone'].forEach(id=>{ const b=qs(id); if(b){ b.disabled=false; b.removeAttribute('data-prev-disabled'); }});
     qs('btnSheetSelectOk').addEventListener('click',okH); qs('btnSheetSelectCancel').addEventListener('click',cancelH); qs('btnSheetSelectAll').addEventListener('click',allH); qs('btnSheetSelectNone').addEventListener('click',noneH); modal.classList.remove('hidden'); }

function registerVirtual(name,snap,kind, meta, skipRender){
     // meta: { fileName, sheetName }
     virtualSheets[name]=snap;
     const st=State.get();
     const sheets = st.sheets.includes(name)? st.sheets.slice(): st.sheets.concat([name]);
     const sm = sideMeta[kind];
     if(!sm.fileName || (meta && meta.fileName && meta.fileName!==sm.fileName)){
          sm.fileName = meta? meta.fileName: 'File';
          sm.sheetOrder=[]; sm.sheetMap={};
     }
     const displaySheet = meta && meta.sheetName? meta.sheetName: name;
     if(!sm.sheetOrder.includes(displaySheet)) sm.sheetOrder.push(displaySheet);
     sm.sheetMap[displaySheet]=name;
     const current=State.get();
     const patch={ sheets };
     if(kind==='base'){
          if(!current.base){ patch.base=name; }
          if(meta && meta.fileName){ patch.baseOriginalFile = meta.fileName; }
     } else {
          if(!current.target){ patch.target=name; }
          if(meta && meta.fileName){ patch.targetOriginalFile = meta.fileName; }
     }
     State.set(patch);
     if(!skipRender) renderSheets();
     else { // ensure label updated when skipping render batch logic elsewhere
          updateDynamicBookSheetLabel(kind);
     }
     // Explicitly enable the corresponding select after virtual registration
     try {
          const sel = (kind==='base')? baseSel(): targetSel();
          if(sel && sel.options && sel.options.length>0){ sel.disabled=false; }
     } catch(_e){}
     persistVirtualSheets();
     Logger.info('Imported sheet', name, {kind, rows:snap.maxR, cols:snap.maxC, meta});
     startSelectObservers();
     updateUploadButtons(); // will only disable if lockUploads already set
}

 // === Upload buttons ===
function hookUploads(){
     const fBase=qs('fileBase'), fTarget=qs('fileTarget');
     if(fBase){ fBase.addEventListener('change', ()=>{ if(fBase.files&&fBase.files[0]) importSheet('base', fBase.files[0]); }); }
     if(fTarget){ fTarget.addEventListener('change', ()=>{ if(fTarget.files&&fTarget.files[0]) importSheet('target', fTarget.files[0]); }); }
     // Click bindings on icon buttons removed (dropdown now controls file dialog)
}
 // Enhanced upload with dropdown (current file / upload file)
     function hookUploadMenus(){
      function closeAll(){ document.querySelectorAll('.upload-menu-container.open').forEach(c=>c.classList.remove('open')); }
      // Only hover opens, click does nothing now
     ['btnUploadBase','btnUploadTarget'].forEach(id=>{ const btn=qs(id); if(btn){ btn.addEventListener('mouseenter', ()=>{ if(btn.disabled) return; const cont=btn.closest('.upload-menu-container'); if(cont && !cont.classList.contains('disabled')){ document.querySelectorAll('.upload-menu-container.open').forEach(c=>{ if(c!==cont) c.classList.remove('open'); }); cont.classList.add('open'); } }); btn.addEventListener('click', e=>{ if(btn.disabled){ e.preventDefault(); return; } e.preventDefault(); /* no action on click per requirement */ }); }});
      document.addEventListener('click', e=>{ if(!e.target.closest('.upload-menu-container')) closeAll(); });
     // Auto close when mouse leaves container
     document.querySelectorAll('.upload-menu-container').forEach(cont=>{
          let hideTimer=null;
          cont.addEventListener('mouseleave', ()=>{ hideTimer=setTimeout(()=>{ cont.classList.remove('open'); },150); });
          cont.addEventListener('mouseenter', ()=>{ if(hideTimer){ clearTimeout(hideTimer); hideTimer=null; } });
     });
      // Action buttons
      const useCurrentBase=qs('btnUseCurrentBase');
      const useCurrentTarget=qs('btnUseCurrentTarget');
      const uploadFileBase=qs('btnUploadFileBase');
      const uploadFileTarget=qs('btnUploadFileTarget');
      const fBase=qs('fileBase');
      const fTarget=qs('fileTarget');
      if(uploadFileBase&&fBase) uploadFileBase.addEventListener('click', ()=>{ fBase.click(); });
      if(uploadFileTarget&&fTarget) uploadFileTarget.addEventListener('click', ()=>{ fTarget.click(); });
           async function importCurrent(kind){
                try {
                     // Mark dirty if diff already existed
                     try { const st=State.get(); if(st.diff){ State.set({ importDirtyForRun:true }); } } catch(_e){}
                     // Wait for API readiness (up to ~10s, adaptive)
                     let guard=0; while(!API.isReady() && guard<200){ if(guard===0){ Logger.info('Waiting for API readiness...'); } await new Promise(r=>setTimeout(r,50)); guard++; if(guard%40===0) Logger.info('Still waiting for API... '+(guard*50)+'ms'); }
                     // Diagnostics message before proceeding
                     try {
                          const diagArea=document.getElementById('messageArea');
                          if(diagArea){
                               const span=document.createElement('span');
                               span.className='msg-info';
                               const ascPresent=!!(window.Asc && window.Asc.plugin);
                               const r7=window.R7API; const mode=r7? (r7._mock? 'mock':'real'):'absent';
                               span.textContent='API статус: Asc='+(ascPresent?'yes':'no')+', R7API='+mode+'; попытки '+guard;
                               diagArea.appendChild(span);
                          }
                     } catch(_e){}
                     if(!API.isReady()){
                          Logger.warn('API not ready for current file import');
                          const apiMsg=(document.querySelector('[data-i18n="msg.apiNotReady"]')?.textContent)||'API not ready';
                          State.set({ statusMessage: apiMsg, statusKind:'error' });
                          if(window.PluginActions && window.PluginActions._pushUserMessage){ window.PluginActions._pushUserMessage('warn', apiMsg); }
                          return;
                     }
                     let sheetNames = [];
                     try { sheetNames = await window.R7API.getSheetsList(); } catch(e){ Logger.error('List sheets failed', e); }
                     if((!sheetNames || !sheetNames.length)){
                          // Fallback: try active sheet only
                          let active=null; try { active=await API.getActiveSheet(); } catch(_e){}
                          if(active) sheetNames=[active];
                     }
                     if(!sheetNames || !sheetNames.length){
                          Logger.warn('No sheets in current workbook');
                          const noSheetsMsg=(document.querySelector('[data-i18n="msg.noCurrentSheets"]')?.textContent)||'No sheets in current workbook';
                          State.set({ statusMessage:noSheetsMsg, statusKind:'warn' });
                          if(window.PluginActions && window.PluginActions._pushUserMessage){ window.PluginActions._pushUserMessage('warn', noSheetsMsg); }
                          return;
                     }
                     // Begin importing state with localized status
                     const importingLabel=(document.querySelector('[data-i18n="msg.currentImportStarting"]')?.textContent) || (document.querySelector('[data-i18n="status.importing"]')?.textContent) || 'Importing...';
                     const prevDisabled=[];
                     document.querySelectorAll('button,select,input').forEach(el=>{ prevDisabled.push([el, el.disabled]); el.disabled=true; });
                     State.set({ importing:true, statusMessage:importingLabel, statusKind:null, progress:0 });
                     const imported=[]; const total=sheetNames.length;
                     for(let i=0;i<sheetNames.length;i++){
                          const sheetName=sheetNames[i];
                          let snapRes=null;
                          try { snapRes = await window.R7API.getSheetSnapshot(sheetName); } catch(e){ Logger.error('Snapshot failed', sheetName, e); }
                          if(snapRes){
                               const baseLabel=(kind==='base'? 'Current_Base_':'Current_Target_')+ sheetName;
                               let finalLabel=baseLabel;
                               const snap={ maxR:snapRes.maxR, maxC:snapRes.maxC, rows:snapRes.rows };
                               if(virtualSheets[baseLabel]){
                                    virtualSheets[baseLabel]=snap;
                                    if(!State.get().sheets.includes(baseLabel)){ State.set({ sheets:[...State.get().sheets, baseLabel] }); }
                               } else {
                                    finalLabel=ensureUniqueLabel(baseLabel);
                                    let docName='Current';
                                    try { docName = await window.R7API.getDocumentName() || 'Current'; } catch(_e){}
                                    registerVirtual(finalLabel, snap, kind, { fileName:docName, sheetName });
                               }
                               imported.push(finalLabel);
                          }
                          State.set({ progress: Math.min(0.99, (i+1)/total) });
                          await new Promise(r=>setTimeout(r)); // yield
                     }
                     const stNow=State.get();
                     if(kind==='base' && !stNow.base && imported[0]) State.set({ base: imported[0] });
                     if(kind==='target' && !stNow.target && imported[0]) State.set({ target: imported[0] });
                     renderSheets();
                     let doneLabel=(document.querySelector('[data-i18n="msg.importComplete"]')?.textContent)||'Import complete';
                     if(imported.length===0){
                          doneLabel=(document.querySelector('[data-i18n="msg.currentImportNone"]')?.textContent)||'No sheets imported';
                          State.set({ importing:false, statusMessage: doneLabel, statusKind:'warn', progress:1 });
                     } else {
                          // Append count if translation with placeholder exists
                          const countTpl=(document.querySelector('[data-i18n="msg.currentImportDone"]')?.textContent)||null;
                          if(countTpl && countTpl.includes('{count}')){ doneLabel=countTpl.replace('{count}', imported.length); }
                          else doneLabel=doneLabel + ' ('+ imported.length +')';
                          State.set({ importing:false, statusMessage: doneLabel, progress:1 });
                     }
                     setTimeout(()=>{ const cur=State.get(); if(!cur.running && !cur.importing){ const idleLbl=document.querySelector('[data-i18n="status.idle"]')?.textContent||'Idle'; State.set({ statusMessage: idleLbl }); } },1600);
                     prevDisabled.forEach(([el,val])=>{ try { el.disabled=val; } catch(_e){} });
                     const cont=(kind==='base'? qs('btnUploadBase'):qs('btnUploadTarget'))?.closest('.upload-menu-container'); if(cont) cont.classList.remove('open');
                     if(window.PluginActions && window.PluginActions._pushUserMessage){ window.PluginActions._pushUserMessage(imported.length? 'info':'warn', doneLabel); }
                     Logger.info('Imported current workbook sheets as '+kind, {count:imported.length, imported});
                } catch(e){
                     Logger.error('Import current workbook failed', e);
                     const errLabel=(document.querySelector('[data-i18n="msg.currentImportFailed"]')?.textContent)||'Current workbook import failed';
                     State.set({ importing:false, statusMessage: errLabel, statusKind:'error' });
                     if(window.PluginActions && window.PluginActions._pushUserMessage){ window.PluginActions._pushUserMessage('error', errLabel); }
                }
           }
      if(useCurrentBase) useCurrentBase.addEventListener('click', ()=>importCurrent('base'));
      if(useCurrentTarget) useCurrentTarget.addEventListener('click', ()=>importCurrent('target'));
 }

function clearImportedSheets(){
          const imported = Object.keys(virtualSheets);
          if(!imported.length){ Logger && Logger.info && Logger.info('Clear imports: nothing to clear'); return; }
          Logger && Logger.info && Logger.info('Clearing imported virtual sheets', {count:imported.length, imported});
     // Remove virtual sheet entries
     imported.forEach(n=>{ delete virtualSheets[n]; });
     persistVirtualSheets();
     // Reset side meta (so selects render empty for imported files)
     if(sideMeta && sideMeta.base){ sideMeta.base.fileName=null; sideMeta.base.sheetOrder=[]; sideMeta.base.sheetMap={}; }
     if(sideMeta && sideMeta.target){ sideMeta.target.fileName=null; sideMeta.target.sheetOrder=[]; sideMeta.target.sheetMap={}; }
     const st=State.get();
     // Keep original workbook sheets (those still in st.sheets but not in imported list)
     const remainingSheets = st.sheets.filter(n=>!imported.includes(n));
     const patch={ sheets: remainingSheets, base:null, target:null };
     // Clear diff & related status because selections invalidated
     patch.diff=null; patch.statusMessage=null; patch.statusKind=null;
     patch.importDirtyForRun=false;
     patch.lockUploads=false; // allow new uploads after full clear
     State.set(patch);
     // Clear previews & diff container
     const diffEl=document.getElementById('diffContainer'); if(diffEl) diffEl.innerHTML='';
     const previewWrap=document.getElementById('sheetPreviewWrapper'); if(previewWrap) previewWrap.classList.add('hidden');
     const syncRow=document.getElementById('previewControlsRow'); const syncCb=document.getElementById('chkSyncScroll'); if(syncRow){ syncRow.classList.remove('active'); } if(syncCb){ syncCb.checked=false; }
          // Force clear selects immediately (avoid relying only on renderSheets timing)
          const bSel = baseSel && baseSel(); if(bSel){ bSel.innerHTML=''; bSel.disabled=true; }
          const tSel = targetSel && targetSel(); if(tSel){ tSel.innerHTML=''; tSel.disabled=true; }
          const bLbl = baseFileLabel && baseFileLabel(); if(bLbl){ bLbl.textContent=''; bLbl.classList.remove('visible'); }
          const tLbl = targetFileLabel && targetFileLabel(); if(tLbl){ tLbl.textContent=''; tLbl.classList.remove('visible'); }
          renderSheets();
          // Disable clear button until new imports appear
          const btnClr = document.getElementById('btnClearImports'); if(btnClr){ btnClr.disabled=true; }
          // Reset legend counters & visual dimming
          try {
               document.querySelectorAll('#legendSection .cat-count').forEach(sp=>{ sp.textContent=''; sp.style.display='none'; });
               document.querySelectorAll('#legendSection li.legend-dim').forEach(li=>li.classList.remove('legend-dim'));
          } catch(_e){}
     // Notify user
          if(window.PluginActions && window.PluginActions._pushUserMessage){
               const el=document.querySelector('[data-i18n="msg.importCleared"]');
               const msg= el? el.textContent: 'Импорт очищен';
               window.PluginActions._pushUserMessage('info', msg);
          }
     // Reset sidebar (show panel, hide toggle button) via plugin exposed action
     try { if(window.PluginActions && window.PluginActions.resetSidebarState){ window.PluginActions.resetSidebarState(); } } catch(_e){}
     // Re-enable upload buttons
     updateUploadButtons();
}
window.clearImportedSheets = clearImportedSheets;

// Soft reset for new import: clear diff, legend counts, search, keep imports
window.__softResetForNewImport = function(){
     try {
          const diffEl=document.getElementById('diffContainer'); if(diffEl) diffEl.innerHTML='';
          const previewWrap=document.getElementById('sheetPreviewWrapper'); if(previewWrap) previewWrap.classList.add('hidden');
          const syncRow=document.getElementById('previewControlsRow'); const syncCb=document.getElementById('chkSyncScroll'); if(syncRow){ syncRow.classList.remove('active'); } if(syncCb){ syncCb.checked=false; }
          const sb=document.getElementById('diffSearchBar'); if(sb) sb.classList.add('hidden');
          const sf=document.getElementById('diffSearchFields'); if(sf) sf.classList.add('hidden');
          const si=document.getElementById('diffSearchInput'); if(si) si.value='';
          const scnt=document.getElementById('diffSearchCount'); if(scnt) scnt.textContent='0/0';
          if(window.__diffSearchState){ window.__diffSearchState.query=''; window.__diffSearchState.matches=[]; window.__diffSearchState.index=-1; }
          document.querySelectorAll('.cat-filter').forEach(cb=>cb.checked=true);
          document.querySelectorAll('.cat-count').forEach(sp=>{ sp.textContent=''; sp.style.display='none'; });
          const st=State.get(); State.set({ diff:null, statusMessage:null, statusKind:null, enabledCategories:null, highlightApplied:false, importDirtyForRun:false });
          if(window.PluginActions && window.PluginActions.resetLegend) window.PluginActions.resetLegend();
     } catch(_e){}
};

 // === Init ===
 async function waitForAPIReady(){ let guard=0; while(!API.isReady() && guard<200){ await new Promise(r=>setTimeout(r,50)); guard++; } }
 // Re-init helpers removed (repeated init disabled by request)
 async function init(){
      // Early guard to prevent race double-init (Asc.plugin.init + DOMContentLoaded)
      if(window.__UIInitStarted){ Logger.info('UI init skipped (already initialized)'); return; }
      window.__UIInitStarted=true;
      Logger.info('UI init start (first run)');
     try { window.addEventListener('r7api:real-ready', ()=>{ Logger.info('Editor API ready'); API._ready=true; setTimeout(async ()=>{ try { const sheets=await API.listSheets(); if(sheets && sheets.length){ State.set({ sheets }); renderSheets(); } } catch(e){ Logger.error('Refresh after API ready failed', e); } }, 200); }); } catch(_e){}
     // (flag already set at start)
     migrateIfNeeded();
     // Clear any previously persisted data to enforce clean start
     try { const s=storage(); if(s&&s.removeItem){ s.removeItem(VIRTUAL_STORE_KEY); s.removeItem(SELECTION_STORE_KEY); } } catch(e){}
      bindState();
     startSelectObservers();
      // Subscribe guard: restore virtual sheets if some external action wiped them
      State.subscribe(st=>{
           if(window.__sheetGuarding) return;
           const virtNames=Object.keys(virtualSheets);
           if(!virtNames.length) return;
           const missing=virtNames.filter(v=>!st.sheets.includes(v));
           if(missing.length){
                try {
                     window.__sheetGuarding=true;
                     const union=[...st.sheets];
                     missing.forEach(v=>union.push(v));
                     Logger.warn('Sheet guard restored missing virtual sheets', {missing, before:st.sheets});
                     State.set({ sheets:union });
                     renderSheets();
                } finally { window.__sheetGuarding=false; }
           }
      });
      attachHandlers();
     hookUploads();
     hookUploadMenus();
     function applyApiButtonState(){
          const ready=API.isReady();
          ['btnUseCurrentBase','btnUseCurrentTarget'].forEach(id=>{ const btn=document.getElementById(id); if(!btn) return; const tip=document.querySelector('[data-i18n="msg.apiLater"]')?.textContent || 'Будет добавлено позднее'; if(!ready){ btn.disabled=true; btn.classList.add('disabled-api'); btn.title=tip; btn.setAttribute('aria-label', tip); } else { btn.disabled=false; btn.classList.remove('disabled-api'); if(btn.dataset._origTitle) { btn.title=btn.dataset._origTitle; btn.setAttribute('aria-label', btn.dataset._origTitle); } }
          });
     }
     applyApiButtonState();
     window.addEventListener('r7api:real-ready', ()=> setTimeout(()=>applyApiButtonState(),50));
      Logger.info('UI init start');
      await waitForAPIReady();
      try {
           let sheets=await API.listSheets();
           let active=await API.getActiveSheet();
           if(!active || !sheets.includes(active)) active=null;
           const prev=State.get(); // should be empty first run
           const restoredOpts=restoreOptions();
           const initState={ sheets };
           initState.base=null;
           initState.target=null;
           if(restoredOpts) initState.options=restoredOpts; // options may still persist if desired
           State.set(initState);
           // initial empty (wait for import)
           renderSheets();
           if(restoredOpts){
                if(qs('optIgnoreCase')) qs('optIgnoreCase').checked=!!restoredOpts.ignoreCase;
                if(qs('optTrim')) qs('optTrim').checked=!!restoredOpts.trim;
                if(qs('optFormat')) qs('optFormat').checked=!!restoredOpts.compareFormatting;
                if(qs('optTolerance')) qs('optTolerance').value=restoredOpts.tolerance||0;
           }
      } catch(e){ Logger.error('Sheet list failed', e); }
     // Remove mock timeout handling (mock mode removed)
 }
 // Watchdog removed per user request
 if(document.readyState==='complete' || document.readyState==='interactive'){ setTimeout(()=>{ if(!window.__UIInitStarted) init(); },200); } else { document.addEventListener('DOMContentLoaded', ()=>{ if(!window.__UIInitStarted) init(); }); }
 window.UI=window.UI||{}; window.UI.init=init;
 // Initial state for upload buttons
 updateUploadButtons();
 // Subscribe to state changes to refresh upload button lock
 State.subscribe(()=> updateUploadButtons());
})(window);
