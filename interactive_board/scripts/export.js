'use strict';

(function initExport(global){
  function getCompositeDataURL(type = 'image/png', quality) {
    const canvas = document.getElementById('boardCanvas');
    const bg = document.getElementById('boardBg');
    if (!canvas) return null;
    const off = document.createElement('canvas');
    off.width = canvas.width; off.height = canvas.height;
    const oc = off.getContext('2d');
    if (bg && bg.width && bg.height) oc.drawImage(bg, 0, 0);
    oc.drawImage(canvas, 0, 0);
    return off.toDataURL(type, quality);
  }
  global.BoardExport = { getCompositeDataURL };
})(typeof window !== 'undefined' ? window : this);
