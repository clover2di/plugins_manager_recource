'use strict';

(function initCursors(global){
  function makeCircleCursor(diameterPx) {
    var size = Math.max(1, Math.round(diameterPx));
    var off = document.createElement('canvas');
    off.width = size; off.height = size;
    var c = off.getContext('2d');
    c.clearRect(0, 0, size, size);
    c.strokeStyle = '#3a3a3a';
    c.lineWidth = 1;
    c.beginPath();
    var r = Math.max(0.5, size / 2 - 0.5);
    c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    c.stroke();
    var url = off.toDataURL('image/png');
    var hotspot = Math.floor(size / 2);
    return 'url(' + url + ') ' + hotspot + ' ' + hotspot + ', auto';
  }

  function makeDashedCircleCursor(diameterPx) {
    var size = Math.max(1, Math.round(diameterPx));
    var off = document.createElement('canvas');
    off.width = size; off.height = size;
    var c = off.getContext('2d');
    c.clearRect(0, 0, size, size);
    c.strokeStyle = '#3a3a3a';
    c.lineWidth = 1;
    if (typeof c.setLineDash === 'function') c.setLineDash([3, 3]);
    c.beginPath();
    var r = Math.max(0.5, size / 2 - 0.5);
    c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    c.stroke();
    var url = off.toDataURL('image/png');
    var hotspot = Math.floor(size / 2);
    return 'url(' + url + ') ' + hotspot + ' ' + hotspot + ', auto';
  }

  function makeRoundedSquareCursor(sizePx) {
    var s = Math.max(1, Math.round(sizePx));
    var off = document.createElement('canvas');
    off.width = s; off.height = s;
    var c = off.getContext('2d');
    c.clearRect(0, 0, s, s);
    c.strokeStyle = '#3a3a3a';
    c.lineWidth = 1;
    var r = Math.max(1, Math.round(Math.min(6, s / 3)));
    var inset = 0.5;
    var w = s - inset * 2; var h = s - inset * 2;
    var x = inset; var y = inset;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.stroke();
    var url = off.toDataURL('image/png');
    var hotspot = Math.floor(s / 2);
    return 'url(' + url + ') ' + hotspot + ' ' + hotspot + ', auto';
  }

  function applyCursor(canvas, state) {
    if (!canvas || !state) return;
    if (state.tool === 'pencil') {
      canvas.style.cursor = makeCircleCursor(state.width);
    } else if (state.tool === 'marker') {
      canvas.style.cursor = makeRoundedSquareCursor(state.width);
    } else if (state.tool === 'eraser') {
      // Match the actual eraser stroke width (eraser uses width*2)
      canvas.style.cursor = makeDashedCircleCursor(Math.max(1, state.width * 2));
    } else if (state.tool === 'hand') {
      // Use grab/grabbing depending on drawing state
      canvas.style.cursor = state.drawing ? 'grabbing' : 'grab';
    } else {
      canvas.style.cursor = 'auto';
    }
  }

  global.BoardCursors = { makeCircleCursor, makeDashedCircleCursor, makeRoundedSquareCursor, applyCursor };
})(typeof window !== 'undefined' ? window : this);
