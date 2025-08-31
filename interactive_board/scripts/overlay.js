'use strict';

(function initOverlay(global){
  var overlay = null;
  var octx = null;
  var lastW = 0, lastH = 0, lastDpr = 1;

  function ensureOverlay(wrapper, dpr, w, h) {
    if (!wrapper) return;
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'boardOverlay';
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '1';
      overlay.style.opacity = '1';
      wrapper.appendChild(overlay);
      octx = overlay.getContext('2d');
    }
    if (!octx) octx = overlay.getContext('2d');
    overlay.width = Math.floor(w * dpr);
    overlay.height = Math.floor(h * dpr);
    overlay.style.width = w + 'px';
    overlay.style.height = h + 'px';
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastW = w; lastH = h; lastDpr = dpr;
  }

  function clear() {
    if (overlay && octx) octx.clearRect(0, 0, overlay.width, overlay.height);
    if (overlay) overlay.style.opacity = '1';
  }

  function getContext() { return octx; }
  function getCanvas() { return overlay; }
  function getMetrics() { return { w: lastW, h: lastH, dpr: lastDpr }; }

  global.BoardOverlay = {
    ensureOverlay: ensureOverlay,
    clear: clear,
    getContext: getContext,
    getCanvas: getCanvas,
    getMetrics: getMetrics
  };
})(typeof window !== 'undefined' ? window : this);
