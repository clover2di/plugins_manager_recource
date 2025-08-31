/**
 * @fileoverview CSV diff report exporter (replaces XLSX export to avoid picker issues)
 */
(function(window){
 'use strict';
 function tr(k, fb){ const el=document.querySelector(`[data-i18n="${k}"]`); return el? el.textContent.trim(): (fb||k); }
 const CAT_LABEL_KEYS={ value:'legend.valueChange', formula:'legend.formulaChange', formulaToValue:'legend.formulaToValue', valueToFormula:'legend.valueToFormula', type:'legend.typeChange', format:'legend.formatChange', 'inserted-row':'legend.insertedRow','deleted-row':'legend.deletedRow','inserted-col':'legend.insertedCol','deleted-col':'legend.deletedCol' };
 function colName(c){ let s=''; c++; while(c>0){ let m=(c-1)%26; s=String.fromCharCode(65+m)+s; c=Math.floor((c-1)/26); } return s; }
 function a1(c,r){ return colName(c)+(r+1); }
 function pickVisibleCategories(){ const boxes=[...document.querySelectorAll('.cat-filter')]; if(!boxes.length) return null; const enabled=boxes.filter(cb=>cb.checked).map(cb=>cb.getAttribute('data-cat')).filter(Boolean); if(!enabled.length||enabled.length===boxes.length) return null; return new Set(enabled); }
 // Russian localization cache
 let RU_DICT=null; let RU_LOADING=null;
 async function ensureRu(){ if(RU_DICT) return RU_DICT; if(RU_LOADING) return RU_LOADING; RU_LOADING = fetch('translations/ru.json').then(r=>r.ok? r.json():{}).catch(()=>({})).then(obj=>{ RU_DICT=obj; return RU_DICT; }); return RU_LOADING; }
 function trRu(k, fb){ if(RU_DICT && RU_DICT[k]) return RU_DICT[k]; return fb||k; }
 function buildSummary(diff, visibleCats, t){ const stats=diff.stats||{}, meta=diff.meta||{}; const metrics=(meta&&meta.metrics)||{}; const total=(diff.raw||[]).filter(d=>!visibleCats||visibleCats.has(d.type)).length; const ORDER=['value','formula','formulaToValue','valueToFormula','type','format','inserted-row','deleted-row','inserted-col','deleted-col']; const rows=[]; rows.push([t('report.summary.title','Сводка сравнения')]); rows.push([]); rows.push([t('report.summary.base','База'), meta.base||'']); rows.push([t('report.summary.target','Цель'), meta.target||'']); rows.push([t('report.summary.generated','Сгенерировано (ISO)'), meta.generated||'']); if(meta.durationMs!=null) rows.push([t('report.summary.duration','Длительность (мс)'), meta.durationMs]); rows.push([t('report.summary.totalDiffRows','Всего строк различий'), total]);
  if(metrics && Object.keys(metrics).length){ rows.push([]); rows.push([t('report.summary.metrics','Метрики')]); rows.push([t('report.summary.cellsCompared','Сравнено ячеек'), metrics.cellsCompared||0]); rows.push([t('report.summary.changedCells','Изменённых ячеек'), metrics.changedCells||0]); rows.push([t('report.summary.changedCellsPct','% изменённых'), metrics.changedCellsPct!=null? (metrics.changedCellsPct*100).toFixed(2)+'%':'']); rows.push([t('report.summary.structuralDiffs','Структурные различия'), metrics.structuralDiffs||0]); rows.push([t('report.summary.diffDensity','Плотность различий'), metrics.diffDensity!=null? (metrics.diffDensity*100).toFixed(2)+'%':'']); rows.push([t('report.summary.baseSize','Размер базы (R x C)'), (metrics.baseRows||0)+' x '+(metrics.baseCols||0)]); rows.push([t('report.summary.targetSize','Размер цели (R x C)'), (metrics.targetRows||0)+' x '+(metrics.targetCols||0)]); }
  rows.push([]); rows.push([t('report.summary.col.category','Категория'), t('report.summary.col.label','Метка'), t('report.summary.col.count','Кол-во'), t('report.summary.col.percent','% строк diff')]); ORDER.forEach(cat=>{ if(visibleCats && !visibleCats.has(cat)) return; const cnt=stats[cat]||0; const pct= total? (cnt/total*100).toFixed(2)+'%':'0%'; rows.push([cat, t(CAT_LABEL_KEYS[cat], cat), cnt, pct]); }); const legacy=['rowInserted','rowDeleted','colInserted','colDeleted']; if(legacy.some(k=>stats[k]>0)){ rows.push([]); rows.push([t('report.summary.legacy','Legacy счётчики')]); legacy.forEach(k=> rows.push([k,'',stats[k]||0])); } return rows; }
 function normVal(v){ if(v===null||v===undefined) return '<NULL>'; if(v==='') return '<EMPTY>'; return v; }
 function detectType(v){ if(v===null||v===undefined) return 'null'; if(v==='') return 'empty'; if(typeof v==='number') return 'number'; if(typeof v==='boolean') return 'boolean'; if(typeof v==='string'){ if(!isNaN(Number(v)) && v.trim()!=='') return 'number(str)'; if(/^=/.test(v)) return 'formula-like'; return 'string'; } return typeof v; }
 function buildDiff(diff, visibleCats, t){
		 const header=[
			 t('report.header.type','Тип'),
			 t('report.header.typeLabel','Категория'),
			 t('report.header.cell','Ячейка'),
			 t('report.header.from','Из'),
			 t('report.header.to','В'),
			 t('report.header.fromType','Тип (из)'),
			 t('report.header.toType','Тип (в)'),
			 t('report.header.formulaBase','Формула (база)'),
			 t('report.header.formulaTarget','Формула (цель)'),
			 t('report.header.delta','Δ'),
			 t('report.header.deltaPct','Δ %'),
			 t('report.header.note','Примечание')
		 ];
	 const rows=[header];
	 (diff.raw||[]).forEach(d=>{
		 if(visibleCats && !visibleCats.has(d.type)) return;
		 let addr='';
		 if(d.r!=null && d.c!=null) addr=a1(d.c,d.r); else if(d.type==='inserted-row'||d.type==='deleted-row') addr=t('report.label.row','Строка')+' '+(d.r+1); else if(d.type==='inserted-col'||d.type==='deleted-col') addr=t('report.label.col','Столбец')+' '+colName(d.c);
		 const typeLabel=t(CAT_LABEL_KEYS[d.type]||'', d.type);
		const rawFrom = d.from==null?null:d.from; const rawTo=d.to==null?null:d.to;
		const fromVal=normVal(rawFrom); const toVal=normVal(rawTo);
		const fromType=detectType(rawFrom); const toType=detectType(rawTo);
		 let delta=''; let deltaPct='';
		 const aNum = (typeof d.from==='number')? d.from: (typeof d.from==='string' && d.from.trim()!=='' && !isNaN(Number(d.from))? Number(d.from): null);
		 const bNum = (typeof d.to==='number')? d.to: (typeof d.to==='string' && d.to.trim()!=='' && !isNaN(Number(d.to))? Number(d.to): null);
		 if(aNum!=null && bNum!=null){ const dlt=bNum - aNum; delta=String(dlt); if(aNum!==0){ deltaPct=( (dlt / Math.abs(aNum)) *100).toFixed(2)+'%'; } else if(bNum!==0){ deltaPct='INF'; } else { deltaPct='0%'; } }
		 let note='';
		 if(d.note) note=d.note; else if(d.type==='inserted-row') note=t('note.insertedRow','вставлена строка'); else if(d.type==='deleted-row') note=t('note.deletedRow','удалена строка'); else if(d.type==='inserted-col') note=t('note.insertedCol','вставлен столбец'); else if(d.type==='deleted-col') note=t('note.deletedCol','удалён столбец');
		rows.push([d.type, typeLabel, addr, fromVal, toVal, fromType, toType, d.baseFormula||'', d.targetFormula||'', delta, deltaPct, note]);
	 });
	 return rows;
 }
 function toCsv(sections){ const SEP=';'; function esc(v){ if(v==null) v=''; v=String(v); if(/["\n\r;]/.test(v)){ v='"'+v.replace(/"/g,'""')+'"'; } return v; } const lines=[]; sections.forEach((sec,i)=>{ if(i>0) lines.push(''); sec.forEach(row=> lines.push(row.map(esc).join(SEP))); }); return '\uFEFF'+lines.join('\r\n'); }
 async function exportReportXlsx(){ const st=State.get(); if(!st.diff){ PluginActions && PluginActions._pushUserMessage && PluginActions._pushUserMessage('warn', tr('msg.noDiff','Нет данных для экспорта')); return; } if(exportReportXlsx._busy) return; exportReportXlsx._busy=true; const btn=document.getElementById('btnReport'); if(btn) btn.disabled=true; try { await ensureRu(); const t=trRu; const diff=st.diff; const visibleCats=pickVisibleCategories(); const csv=toCsv([buildSummary(diff,visibleCats,t), buildDiff(diff,visibleCats,t)]); const blob=new Blob([csv], {type:'text/csv;charset=utf-8'}); const ts=new Date().toISOString().replace(/[:]/g,'-'); const suggested=`otchet_diff_${diff.meta.base}_vs_${diff.meta.target}_${ts}.csv`; const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=suggested; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },1500); PluginActions._pushUserMessage && PluginActions._pushUserMessage('info', trRu('report.msg.csvExported','CSV отчет экспортирован')); } catch(err){ Logger.error('Export CSV failed', err); PluginActions._pushUserMessage && PluginActions._pushUserMessage('error', trRu('msg.exportFailed','Ошибка экспорта')); } finally { exportReportXlsx._busy=false; if(btn) btn.disabled=!State.get().diff; } }
 window.PluginActions = window.PluginActions || {}; window.PluginActions.exportReportXlsx = exportReportXlsx;
})(window);
