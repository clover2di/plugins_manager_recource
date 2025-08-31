'use strict';

(function initMarker(global){
  // Draw a smooth rounded dot at the given position
  function drawDot(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, size / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const DIST_THRESH = 1.5;
  let last = null;
  let pts = [];
  let _raf = 0;
  let _dirty = false;

  function _renderOverlayPath(state){
    const octx = BoardOverlay && BoardOverlay.getContext ? BoardOverlay.getContext() : null;
    if (!octx) return;
    octx.save();
    octx.clearRect(0,0, octx.canvas.width, octx.canvas.height);
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    octx.strokeStyle = state.color;
    octx.lineWidth = state.width;
    octx.globalAlpha = 0.5;
    octx.beginPath();
    if (pts.length > 0) {
      octx.moveTo(pts[0].x, pts[0].y);
      for (var i=1;i<pts.length-1;i++){
        var p0 = pts[i], p1 = pts[i+1];
        var mx = (p0.x + p1.x) * 0.5, my = (p0.y + p1.y) * 0.5;
        octx.quadraticCurveTo(p0.x, p0.y, mx, my);
      }
      var lastPt = pts[pts.length-1];
      octx.lineTo(lastPt.x, lastPt.y);
      octx.stroke();
    }
    octx.restore();
  }
  function _schedule(state){
    if (_raf) { _dirty = true; return; }
    _dirty = false;
    _raf = requestAnimationFrame(function(){
      try { _renderOverlayPath(state); } finally { _raf = 0; if (_dirty) _schedule(state); }
    });
  }

  const ToolMarker = {
    name: 'marker',
    start(state, ctx, pos) {
      last = pos;
      pts = [pos];
      const octx = BoardOverlay && BoardOverlay.getContext ? BoardOverlay.getContext() : null;
      if (octx) {
        octx.save();
        octx.clearRect(0,0, octx.canvas.width, octx.canvas.height);
        octx.lineCap = 'round';
        octx.lineJoin = 'round';
        octx.strokeStyle = state.color;
        octx.lineWidth = state.width;
        octx.globalAlpha = 0.5;
        drawDot(octx, pos.x, pos.y, state.width, state.color, 0.5);
        octx.restore();
      }
    },
    draw(state, ctx, prev, pos) {
      if (!last) last = prev || pos;
      // downsample points to reduce overdraw
      if (pts.length===0 || Math.hypot(pos.x-(pts[pts.length-1].x), pos.y-(pts[pts.length-1].y)) >= DIST_THRESH){
        pts.push(pos);
      }
  // Отрисовываем оверлей не чаще одного раза за кадр
  _schedule(state);
      last = pos;
    },
    end(state, ctx) {
      // Commit vector stroke to tile cache with alpha 0.5
      try {
        if (pts && pts.length >= 2 && global.BoardStrokes && typeof BoardStrokes.addStroke === 'function') {
          const alpha = 0.5;
          BoardStrokes.addStroke({ type: 'marker', color: state.color, width: state.width, alpha, points: pts });
        }
      } catch(_){}
      try { if (global.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear(); } catch(_){}
      last = null;
      pts = [];
  if (_raf) { cancelAnimationFrame(_raf); _raf = 0; _dirty = false; }
    }
  };
  global.BoardToolMarker = ToolMarker;
})(typeof window !== 'undefined' ? window : this);
