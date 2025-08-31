'use strict';

(function initEraser(global){
  const DIST_THRESH = 1.75;
  let _pts = [];
  let _raf = 0;
  let _dirty = false;
  let _state = null;
  function _len(a,b){ const dx=b.x-a.x, dy=b.y-a.y; return Math.hypot(dx,dy); }
  function _schedulePresent(){
    if (_raf) { _dirty = true; return; }
    _dirty = false;
    _raf = (global.requestAnimationFrame||global.setTimeout)(function(){
      try {
        if (global.BoardWorld && BoardWorld.renderToVisible) {
          const vis = document.getElementById('boardCanvas');
          const vctx = vis && vis.getContext ? vis.getContext('2d') : null;
          if (vctx) BoardWorld.renderToVisible(vctx);
        }
      } finally { _raf = 0; if (_dirty) _schedulePresent(); }
    });
  }
  const ToolEraser = {
    name: 'eraser',
    start(state, ctx, pos) { _state = state; _pts.length = 0; _pts.push({ x: pos.x, y: pos.y }); },
    draw(state, ctx, last, pos) {
      if (typeof last === 'object' && last) { if (_pts.length === 0) _pts.push({ x: last.x, y: last.y }); }
      const lp = _pts[_pts.length-1] || last || pos;
      if (_len(lp, pos) >= DIST_THRESH) _pts.push({ x: pos.x, y: pos.y });
      // Optionally, live-rasterize erase to tiles for immediate feedback
      try {
        if (_pts.length >= 2 && global.BoardStrokes && typeof BoardStrokes.rasterizeLive === 'function') {
          BoardStrokes.rasterizeLive({ type: 'erase', width: state.width * 2, points: _pts });
        }
      } catch(_){}
      _schedulePresent();
    },
    end(state, ctx) {
      try {
        if (_pts.length >= 2 && global.BoardStrokes && typeof BoardStrokes.addStroke === 'function') {
          BoardStrokes.addStroke({ type: 'erase', width: state.width * 2, points: _pts });
        }
      } catch(_){}
      _pts.length=0; if (_raf) { try { (global.cancelAnimationFrame||global.clearTimeout)(_raf); } catch(_){} _raf=0; } _dirty=false; _state=null; }
  };
  global.BoardToolEraser = ToolEraser;
})(typeof window !== 'undefined' ? window : this);
