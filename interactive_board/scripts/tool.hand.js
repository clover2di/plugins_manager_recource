'use strict';

(function initHand(global){
  let last = null;

  const ToolHand = {
    name: 'hand',
    start(state, ctx, pos) {
      last = pos;
      // On start, switch to grabbing cursor via BoardCursors (state.drawing already true)
      try {
        const canvas = document.getElementById('boardCanvas');
        if (global.BoardCursors && canvas) BoardCursors.applyCursor(canvas, state);
      } catch(_) {}
    },
    draw(state, ctx, prev, pos) {
      if (!last || !global.BoardWorld) return;
      const dx = pos.x - last.x;
      const dy = pos.y - last.y;
      global.BoardWorld.panBy(-dx, -dy);
  // Redraw background to reflect new pan offset
  try { if (global.BoardBackground && typeof BoardBackground.redraw === 'function') BoardBackground.redraw(); } catch(_) {}
      // Always render to the visible canvas context (not the world draw context)
      try {
        const canvas = document.getElementById('boardCanvas');
        if (canvas) {
          const visCtx = canvas.getContext('2d');
          global.BoardWorld.renderToVisible(visCtx);
        }
      } catch (_) {}
      last = pos;
    },
    end(state, ctx) {
      last = null;
      // Ensure final frame is rendered to visible after panning ends
      try {
        const canvas = document.getElementById('boardCanvas');
        if (canvas && global.BoardWorld) {
          const visCtx = canvas.getContext('2d');
          global.BoardWorld.renderToVisible(visCtx);
        }
      } catch (_) {}
  // Final background sync
  try { if (global.BoardBackground && typeof BoardBackground.redraw === 'function') BoardBackground.redraw(); } catch(_) {}
      try {
        const canvas = document.getElementById('boardCanvas');
        if (global.BoardCursors && canvas) BoardCursors.applyCursor(canvas, state);
      } catch(_) {}
    }
  };

  global.BoardToolHand = ToolHand;
})(typeof window !== 'undefined' ? window : this);
