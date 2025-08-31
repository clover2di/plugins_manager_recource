'use strict';

(function initCanvas(global){
  function setupCanvas(applyCursor) {
    const canvas = document.getElementById('boardCanvas');
    // Prefer willReadFrequently for canvases that perform repeated readbacks (getImageData).
    let ctx = null;
    try {
      // Try fast path: opaque, low-latency; keep willReadFrequently when supported
      ctx = canvas.getContext('2d', { alpha: false, desynchronized: true, willReadFrequently: true })
         || canvas.getContext('2d', { alpha: false, desynchronized: true })
         || canvas.getContext('2d', { willReadFrequently: true })
         || canvas.getContext('2d');
    } catch (e) {
      try { ctx = canvas.getContext('2d', { alpha: false }); } catch(_) { ctx = canvas.getContext('2d'); }
    }
    const wrap = document.getElementById('canvasWrapper');
    const state = window.boardState;

    function resizeCanvas() {
      // Cap effective DPR for performance
      const cap = (window.__IB_DPR_CAP__ && typeof window.__IB_DPR_CAP__ === 'number') ? window.__IB_DPR_CAP__ : 2.0;
      const dpr = Math.min(cap, Math.max(1, window.devicePixelRatio || 1));
      const w = wrap.clientWidth || 1;
      const h = wrap.clientHeight || 1;

      // Snapshot/restore only when World is not used; with World we re-render from offscreen.
      let prevW = canvas.width;
      let prevH = canvas.height;
      let prevCanvas = null;
      const useWorld = !!(window.BoardWorld && typeof BoardWorld.renderToVisible === 'function');
      if (!useWorld && prevW && prevH) {
        try {
          const img = ctx.getImageData(0, 0, prevW, prevH);
          prevCanvas = document.createElement('canvas');
          prevCanvas.width = prevW; prevCanvas.height = prevH;
          prevCanvas.getContext('2d').putImageData(img, 0, 0);
        } catch (_) {}
      }

      // Apply new size and DPR transform
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Restore only in non-World mode; with World we will render below
      if (!useWorld && prevCanvas) {
        try {
          ctx.save();
          // draw in device pixel space to avoid DPR scaling
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(prevCanvas, 0, 0);
          ctx.restore();
        } catch (_) {}
      }
      if (window.BoardOverlay && typeof BoardOverlay.ensureOverlay === 'function') {
        BoardOverlay.ensureOverlay(wrap, dpr, w, h);
      }
      // ensure background matches size
      if (window.BoardBackground && typeof BoardBackground.resize === 'function') {
        BoardBackground.resize();
      }
    }
    // Debounced resize to avoid excessive redraws
    var __resizeTimer = null;
    function debouncedResize(){
      if (__resizeTimer) { clearTimeout(__resizeTimer); }
    __resizeTimer = setTimeout(function(){ resizeCanvas(); if (window.BoardWorld && BoardWorld.renderToVisible) BoardWorld.renderToVisible(ctx); }, 120);
    }
    resizeCanvas();
    window.addEventListener('resize', debouncedResize);
    if (typeof applyCursor === 'function') applyCursor();
    return { canvas, ctx, resizeCanvas };
  }
  global.BoardCanvas = { setupCanvas };
})(typeof window !== 'undefined' ? window : this);
