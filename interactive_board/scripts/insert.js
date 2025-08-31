'use strict';

(function initInsert(global){
  function insertAsImage() {
  const canvas = document.getElementById('boardCanvas');
  const dataUrl = (window.BoardExport && BoardExport.getCompositeDataURL) ? BoardExport.getCompositeDataURL('image/png') : null;
  if (!dataUrl || !canvas) return;
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('insert.start', { w: canvas && canvas.width, h: canvas && canvas.height }); } catch(_) {}
  // Ensure Asc.scope exists (safety for non-OnlyOffice host or tests)
  if (!window.Asc) window.Asc = { scope: {} };
  if (!window.Asc.scope) window.Asc.scope = {};
  Asc.scope.img = dataUrl;
  // Clamp reported canvas size to reasonable bounds to avoid absurd EMU conversions
  const clampedW = Math.max(1, Math.min(16000, canvas.width || 1));
  const clampedH = Math.max(1, Math.min(16000, canvas.height || 1));
  Asc.scope.canvasSize = { w: clampedW, h: clampedH };
  // Start a short transactional action to keep UX consistent
  try { if (window.Asc.plugin && typeof window.Asc.plugin.executeMethod === 'function') window.Asc.plugin.executeMethod('StartAction', ['Block', 18]); } catch(e) { try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('insert.startAction_fail', e && e.message); } catch(_) {} }
  window.Asc.plugin.callCommand(function () {
      try {
  function pxToEmu(px) { return Math.max(1, Math.floor(px * 9525)); }
        var wEmu = pxToEmu(Asc.scope.canvasSize.w);
        var hEmu = pxToEmu(Asc.scope.canvasSize.h);
        if (typeof Api.GetDocument === 'function') {
          var oDoc = Api.GetDocument();
          var p = Api.CreateParagraph();
          var img = Api.CreateImage(Asc.scope.img, wEmu, hEmu);
          p.AddDrawing(img);
          oDoc.Push(p);
          Asc.scope.result = { ok: true, target: 'word' }; return;
        }
        if (typeof Api.GetPresentation === 'function') {
          var pres = Api.GetPresentation();
          var slide = pres.GetCurrentSlide ? pres.GetCurrentSlide() : (pres.GetSlide ? pres.GetSlide(0) : null);
          if (!slide && typeof Api.GetActiveSlide === 'function') slide = Api.GetActiveSlide();
          var imgS = Api.CreateImage(Asc.scope.img, wEmu, hEmu);
          if (slide && typeof slide.AddObject === 'function') { slide.AddObject(imgS); Asc.scope.result = { ok: true, target: 'slide' }; return; }
        }
        if (typeof Api.GetActiveSheet === 'function') {
          var ws = Api.GetActiveSheet(); var row = 1, col = 1;
          try { if (typeof Api.GetActiveCell === 'function') { var cell = Api.GetActiveCell(); if (cell) { row = cell.GetRow ? cell.GetRow() : row; col = cell.GetCol ? cell.GetCol() : col; } } } catch (eSel) {}
          if (ws && typeof ws.AddImage === 'function') { ws.AddImage(Asc.scope.img, wEmu, hEmu, col, 0, row, 0); Asc.scope.result = { ok: true, target: 'cell' }; return; }
        }
  Asc.scope.result = { ok: false, error: 'Unknown editor or unsupported API' };
  } catch (e) { Asc.scope.result = { ok: false, error: e && e.message }; try { if (window.IBLogger && IBLogger.error) IBLogger.error('insert.exec_error', e && e.stack ? e.stack : e && e.message); } catch(_) {} }
    }, false, true, function () {
      try { if (window.Asc.plugin && typeof window.Asc.plugin.executeMethod === 'function') window.Asc.plugin.executeMethod('EndAction', ['Block', 18]); } catch(e) { try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('insert.endAction_fail', e && e.message); } catch(_) {} }
      var r = Asc.scope.result;
    try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('insert.result', r); } catch(_) {}
        if (r && r.ok) {
          if (window.IBLogger && IBLogger.toast) {
            var T = (window.BoardI18n && BoardI18n.t) ? BoardI18n.t : function(_,d){return d;};
            var key = r.target === 'word' ? 'toast.insert.word' : r.target === 'cell' ? 'toast.insert.cell' : r.target === 'slide' ? 'toast.insert.slide' : 'toast.insert.ok';
            var msg = T(key, 'Inserted');
            IBLogger.toast(msg, 'info');
          }
      } else {
          if (window.IBLogger && IBLogger.toast) {
            var T2 = (window.BoardI18n && BoardI18n.t) ? BoardI18n.t : function(_,d){return d;};
            var base = T2('toast.insert.error', 'Failed to insert image');
            IBLogger.toast(base + (r && r.error ? ': ' + r.error : ''), 'error');
          }
      }
    });
  }
  global.BoardInsert = { insertAsImage };
})(typeof window !== 'undefined' ? window : this);
