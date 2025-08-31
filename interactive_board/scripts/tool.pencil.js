'use strict';

(function initPencil(global){
  // Vector stroke recording + tile raster commit
  const DIST_THRESH = 1.75; // CSS px downsample threshold
  let _pts = [];
  let _raf = 0;
  let _dirty = false;
  let _state = null;

  function _len(a,b){ const dx=b.x-a.x, dy=b.y-a.y; return Math.hypot(dx,dy); }
  function _scheduleRedraw(){
    if (_raf) { _dirty = true; return; }
    _dirty = false;
    _raf = (global.requestAnimationFrame||global.setTimeout)(function(){
      try {
        // Present visible to show overlay/background changes
        if (global.BoardWorld && BoardWorld.renderToVisible) {
          const vis = document.getElementById('boardCanvas');
          const vctx = vis && vis.getContext ? vis.getContext('2d') : null;
          if (vctx) BoardWorld.renderToVisible(vctx);
        }
      } finally { _raf = 0; if (_dirty) _scheduleRedraw(); }
    });
  }
  const ToolPencil = {
    name: 'pencil',
    start(state, ctx, pos) {
      _state = state;
      _pts.length = 0;
      _pts.push({ x: pos.x, y: pos.y });
    },
    draw(state, ctx, last, pos) {
      if (typeof last === 'object' && last) { if (_pts.length === 0) _pts.push({ x: last.x, y: last.y }); }
      try {
        const ev = state.__lastEvent;
        if (ev && typeof ev.getCoalescedEvents === 'function') {
          const list = ev.getCoalescedEvents();
          for (let i=0;i<list.length;i++){
            const p = list[i]; const np = { x: p.clientX, y: p.clientY };
            const lp = _pts[_pts.length-1] || np; if (_len(lp,np) >= DIST_THRESH) _pts.push(np);
          }
        }
      } catch(_){}
      const lp = _pts[_pts.length-1] || last || pos;
      if (_len(lp, pos) >= DIST_THRESH) _pts.push({ x: pos.x, y: pos.y });
  // Live rasterize into tiles for immediate feedback
  try { if (_pts.length >= 2 && global.BoardStrokes && typeof BoardStrokes.rasterizeLive === 'function') BoardStrokes.rasterizeLive({ type: 'pencil', color: state.color, width: state.width, alpha: 1, points: _pts }); } catch(_){}
      _scheduleRedraw();
    },
    end(state, ctx) {
      try {
        if (_pts.length >= 2 && global.BoardStrokes && typeof BoardStrokes.addStroke === 'function') {
          BoardStrokes.addStroke({ type: 'pencil', color: state.color, width: state.width, alpha: 1, points: _pts });
        }
      } catch(_){}
      _pts.length = 0; if (_raf) { try { (global.cancelAnimationFrame||global.clearTimeout)(_raf); } catch(_){} _raf = 0; }
      _dirty = false; _state = null;
    }
  };
  global.BoardToolPencil = ToolPencil;
})(typeof window !== 'undefined' ? window : this);
