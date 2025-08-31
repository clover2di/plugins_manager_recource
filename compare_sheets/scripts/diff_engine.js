/** Diff engine implementation */
(function(window){
 'use strict';
 class DiffEngine {
   constructor(opts){ this.opts=opts||{}; this._cancelRef={canceled:false}; }
   cancel(){ this._cancelRef.canceled=true; }
  _normFormula(f){ if(f==null) return f; return String(f).replace(/\s+/g,'').toUpperCase(); }
  _rawFormula(f){ return f==null? null: String(f); }
  async snapshotSheet(sheetName){
    if(window.VirtualSheets && window.VirtualSheets[sheetName]){ const vs=window.VirtualSheets[sheetName];
      const rows = vs.rows.map(row=> row.map(cell=>{ if(cell.t) return cell; const v=cell.v; let t=null; if(v===''||v==null){ t='empty'; } else if(!isNaN(Number(v))){ t='number'; cell={...cell, v:Number(v)}; } else if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)){ t='date'; } else { t=typeof v; } return {...cell, t}; }));
      return { name:sheetName, rows, maxR:vs.maxR, maxC:vs.maxC, virtual:true }; }
     if(window.R7API && window.R7API.getSheetSnapshot){ return await window.R7API.getSheetSnapshot(sheetName); }
     // fallback (legacy)
     return new Promise((resolve,reject)=>{ window.Asc.plugin.callCommand(function(){ try { var sheet = Api.GetSheet(sheetName); if(!sheet){ Asc.scope._snapErr='SHEET_NOT_FOUND'; return; } var usedRange=sheet.GetUsedRange(); var maxR=usedRange?usedRange.GetRowCount():0; var maxC=usedRange?usedRange.GetColCount():0; var rows=[]; for(var r=0;r<maxR;r++){ var rowArr=[]; for(var c=0;c<maxC;c++){ var cell=sheet.GetCells(r,c); var val=null,f=null,t=null; try{f=cell.GetFormula&&cell.GetFormula();}catch(e){} try{val=cell.GetValue&&cell.GetValue();}catch(e){} try{t=cell.GetValueType&&cell.GetValueType();}catch(e){} rowArr.push({v:val,f:f||null,t:t||null}); } rows.push(rowArr);} Asc.scope._sheetSnapshot={ name:sheetName, rows:rows, maxR:maxR, maxC:maxC }; } catch(e){ Asc.scope._snapErr=e.message; } },()=>{ if(Asc.scope._snapErr) reject(new Error(Asc.scope._snapErr)); else resolve(Asc.scope._sheetSnapshot); }); });
   }
   _normString(str){ if(str==null) return str; if(this.opts.trim && typeof str==='string') str=str.trim(); if(this.opts.ignoreCase && typeof str==='string') str=str.toLowerCase(); return str; }
  _compareValues(a,b){ if(a===b) return true; if(typeof a==='number' && typeof b==='number'){ return a===b; } return false; }
  _cellFormatSignature(cell){ return ''; } // disabled until implemented
  async compareSheets(baseName,targetName,progressCb){
     const startTs=Date.now();
     const baseSnap = await this.snapshotSheet(baseName);
     const targetSnap = await this.snapshotSheet(targetName);
  const afterSnapshotTs = Date.now();
     const maxR = Math.max(baseSnap.maxR, targetSnap.maxR);
     const maxC = Math.max(baseSnap.maxC, targetSnap.maxC);
  const enabled = Array.isArray(this.opts.enabledCategories)? this.opts.enabledCategories.filter(Boolean): null; // null => all
  function isCat(cat){ if(!enabled || !enabled.length) return true; return enabled.includes(cat); }
  const diffs=[]; const stats={ value:0, formula:0, formulaToValue:0, valueToFormula:0, type:0, format:0,
    'inserted-row':0,'deleted-row':0,'inserted-col':0,'deleted-col':0,
    // legacy keys kept for backward compatibility with report sheet
    rowInserted:0,rowDeleted:0,colInserted:0,colDeleted:0 };
  // Track structural row/col indices (for skipping cell-level comparisons)
  const structRowsInserted=new Set();
  const structRowsDeleted=new Set();
  const structColsInserted=new Set();
  const structColsDeleted=new Set();
     // Structural high-level
  // Record structural size deltas (stats only for now; detailed diffs added later)
  if(isCat('inserted-row') && baseSnap.maxR < targetSnap.maxR){ const n=(targetSnap.maxR - baseSnap.maxR); stats['inserted-row']+=n; stats.rowInserted+=n; for(let r=baseSnap.maxR;r<targetSnap.maxR;r++){ structRowsInserted.add(r); } }
  if(isCat('deleted-row') && baseSnap.maxR > targetSnap.maxR){ const n=(baseSnap.maxR - targetSnap.maxR); stats['deleted-row']+=n; stats.rowDeleted+=n; for(let r=targetSnap.maxR;r<baseSnap.maxR;r++){ structRowsDeleted.add(r); } }
  if(isCat('inserted-col') && baseSnap.maxC < targetSnap.maxC){ const n=(targetSnap.maxC - baseSnap.maxC); stats['inserted-col']+=n; stats.colInserted+=n; for(let c=baseSnap.maxC;c<targetSnap.maxC;c++){ structColsInserted.add(c); } }
  if(isCat('deleted-col') && baseSnap.maxC > targetSnap.maxC){ const n=(baseSnap.maxC - targetSnap.maxC); stats['deleted-col']+=n; stats.colDeleted+=n; for(let c=targetSnap.maxC;c<baseSnap.maxC;c++){ structColsDeleted.add(c); } }
     // Heuristic internal row insert/delete detection by look-ahead one row
     const baseRowHashes = []; const targetRowHashes=[];
     for(let r=0;r<baseSnap.maxR;r++){ baseRowHashes[r]=(baseSnap.rows[r]||[]).map(c=> c.f?'='+c.f: (c.v==null?'':String(c.v)) ).join('\u0001'); }
     for(let r=0;r<targetSnap.maxR;r++){ targetRowHashes[r]=(targetSnap.rows[r]||[]).map(c=> c.f?'='+c.f: (c.v==null?'':String(c.v)) ).join('\u0001'); }
     let i=0,j=0; while(i<baseRowHashes.length && j<targetRowHashes.length){
       if(baseRowHashes[i]===targetRowHashes[j]){ i++; j++; continue; }
  if(isCat('inserted-row') && baseRowHashes[i]===targetRowHashes[j+1]){ diffs.push({ type:'inserted-row', r:j, c:0, from:null, to:'ROW_INSERTED'}); stats['inserted-row']++; stats.rowInserted++; structRowsInserted.add(j); j++; continue; }
  if(isCat('deleted-row') && baseRowHashes[i+1]===targetRowHashes[j]){ diffs.push({ type:'deleted-row', r:i, c:0, from:'ROW_DELETED', to:null}); stats['deleted-row']++; stats.rowDeleted++; structRowsDeleted.add(i); i++; continue; }
       i++; j++; // fallback advance
     }
     // Similar heuristic for columns (hash columns)
     const hashCol = (snap,c)=>{ const parts=[]; for(let r=0;r<snap.maxR;r++){ const cell=snap.rows[r]?snap.rows[r][c]:null; if(!cell){ parts.push(''); continue;} parts.push(cell.f?('='+cell.f):(cell.v==null?'':String(cell.v))); } return parts.join('\u0001'); };
     const baseColHashes=[], targetColHashes=[]; for(let c=0;c<baseSnap.maxC;c++) baseColHashes[c]=hashCol(baseSnap,c); for(let c=0;c<targetSnap.maxC;c++) targetColHashes[c]=hashCol(targetSnap,c);
     i=0; j=0; while(i<baseColHashes.length && j<targetColHashes.length){
       if(baseColHashes[i]===targetColHashes[j]){ i++; j++; continue; }
  if(isCat('inserted-col') && baseColHashes[i]===targetColHashes[j+1]){ diffs.push({ type:'inserted-col', r:0, c:j, from:null, to:'COL_INSERTED'}); stats['inserted-col']++; stats.colInserted++; structColsInserted.add(j); j++; continue; }
  if(isCat('deleted-col') && baseColHashes[i+1]===targetColHashes[j]){ diffs.push({ type:'deleted-col', r:0, c:i, from:'COL_DELETED', to:null}); stats['deleted-col']++; stats.colDeleted++; structColsDeleted.add(i); i++; continue; }
       i++; j++;
     }
     const batchSize=500; let processed=0; const totalCells = maxR*maxC;
     for(let r=0; r<maxR; r++){
       if(this._cancelRef.canceled) return { canceled:true };
       const rowA = baseSnap.rows[r];
       const rowB = targetSnap.rows[r];
       for(let c=0; c<maxC; c++){
        const cellA = rowA? rowA[c]: undefined;
        const cellB = rowB? rowB[c]: undefined;
  // Skip cell-level categories if row/col marked structural (inserted/deleted) OR one side missing
  if(cellA && cellB && !structRowsInserted.has(r) && !structRowsDeleted.has(r) && !structColsInserted.has(c) && !structColsDeleted.has(c)){
        const fA = cellA.f; const fB = cellB.f;
        const hasFA= !!fA; const hasFB= !!fB;
        if(hasFA!==hasFB){
          if(hasFA && !hasFB && isCat('formulaToValue')){ diffs.push({ type:'formulaToValue', r,c, from:this._rawFormula(fA), to:cellB.v, baseFormula:this._rawFormula(fA), targetFormula:null }); stats.formulaToValue++; }
          else if(!hasFA && hasFB && isCat('valueToFormula')){ diffs.push({ type:'valueToFormula', r,c, from:cellA.v, to:this._rawFormula(fB), baseFormula:null, targetFormula:this._rawFormula(fB) }); stats.valueToFormula++; }
        } else if(hasFA && hasFB){
          // Both formulas: compare normalized text
          if(this._normFormula(fA) !== this._normFormula(fB) && isCat('formula')){ diffs.push({ type:'formula', r,c, from:this._rawFormula(fA), to:this._rawFormula(fB), baseFormula:this._rawFormula(fA), targetFormula:this._rawFormula(fB) }); stats.formula++; }
          else if(isCat('value')){
            // Same formula text but value differs (e.g., volatile or external refs)
            const vA=this._normString(cellA.v); const vB=this._normString(cellB.v);
            if(!this._compareValues(vA,vB)){ diffs.push({ type:'value', r,c, from:cellA.v, to:cellB.v, note:'formulaResult', baseFormula:this._rawFormula(fA), targetFormula:this._rawFormula(fB) }); stats.value++; }
          }
        } else { // neither formula
          if(isCat('value')){ const vA=this._normString(cellA.v); const vB=this._normString(cellB.v); if(!(vA==null && vB==null) && !this._compareValues(vA,vB)){ diffs.push({type:'value', r,c, from:cellA.v, to:cellB.v}); stats.value++; } }
        }
          if(cellA.t!==cellB.t && isCat('type')){ diffs.push({ type:'type', r,c, from:cellA.t, to:cellB.t }); stats.type++; }
        }
        // formatting temporarily disabled
         processed++;
         if(processed % batchSize ===0){ progressCb && progressCb(processed/totalCells); await new Promise(rz=>setTimeout(rz)); }
       }
     }
    const afterLoopTs = Date.now();
  // Add tail structural diffs (remaining unmatched size at end) so legend counts reflect size deltas
  if(isCat('inserted-row') && baseSnap.maxR < targetSnap.maxR){ for(let r=baseSnap.maxR; r<targetSnap.maxR; r++){ diffs.push({ type:'inserted-row', r, c:0, from:null, to:'ROW_INSERTED' }); } }
  if(isCat('deleted-row') && baseSnap.maxR > targetSnap.maxR){ for(let r=targetSnap.maxR; r<baseSnap.maxR; r++){ diffs.push({ type:'deleted-row', r, c:0, from:'ROW_DELETED', to:null }); } }
  if(isCat('inserted-col') && baseSnap.maxC < targetSnap.maxC){ for(let c=baseSnap.maxC; c<targetSnap.maxC; c++){ diffs.push({ type:'inserted-col', r:0, c, from:null, to:'COL_INSERTED' }); } }
  if(isCat('deleted-col') && baseSnap.maxC > targetSnap.maxC){ for(let c=targetSnap.maxC; c<baseSnap.maxC; c++){ diffs.push({ type:'deleted-col', r:0, c, from:'COL_DELETED', to:null }); } }
  progressCb && progressCb(1);
  const endTs = Date.now();
  // Diagnostics & metrics
  const cellsCompared = maxR * maxC;
  const changedCells = stats.value + stats.formula + stats.formulaToValue + stats.valueToFormula + stats.type + stats.format;
  const structuralDiffs = stats['inserted-row'] + stats['deleted-row'] + stats['inserted-col'] + stats['deleted-col'];
  const metrics = {
    cellsCompared,
    changedCells,
    changedCellsPct: cellsCompared ? changedCells / cellsCompared : 0,
    structuralDiffs,
    diffDensity: cellsCompared ? changedCells / cellsCompared : 0,
    baseRows: baseSnap.maxR, baseCols: baseSnap.maxC,
    targetRows: targetSnap.maxR, targetCols: targetSnap.maxC
  };
  const timings = {
    snapshotMs: afterSnapshotTs - startTs,
    diffLoopMs: afterLoopTs - afterSnapshotTs,
    totalMs: endTs - startTs
  };
  return { meta:{ base:baseName, target:targetName, generated:new Date().toISOString(), durationMs: endTs-startTs, metrics, timings }, stats, categories: this._groupCategories(diffs), raw: diffs };
   }
   _groupCategories(diffs){
     const catMap={ value:[], formula:[], formulaToValue:[], valueToFormula:[], type:[], format:[], 'inserted-row':[], 'deleted-row':[], 'inserted-col':[], 'deleted-col':[] };
     diffs.forEach(d=>{ if(!catMap[d.type]) catMap[d.type]=[]; catMap[d.type].push(d); });
     return Object.keys(catMap).filter(k=>catMap[k].length).map(k=>({ name:k, items:catMap[k] }));
   }
 }
 window.DiffEngine = DiffEngine;
 const _OriginalSnapshot = window.DiffEngine && window.DiffEngine.prototype.snapshotSheet;
 if(window.DiffEngine){ window.DiffEngine.prototype.snapshotSheet = function(sheetName){
   if(window.VirtualSheets && window.VirtualSheets[sheetName]){ const vs=window.VirtualSheets[sheetName]; return Promise.resolve({ name:sheetName, rows:vs.rows, maxR:vs.maxR, maxC:vs.maxC, virtual:true }); }
   return _OriginalSnapshot.call(this, sheetName);
 }; }
})(window);
