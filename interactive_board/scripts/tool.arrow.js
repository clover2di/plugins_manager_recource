'use strict';

(function initArrow(global){
  function drawArrow(ctx, x1, y1, x2, y2, strokeStyle, lineWidth){
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const headLen = Math.max(8, (lineWidth || 4) * 3);
    const baseX = x2 - ux * headLen, baseY = y2 - uy * headLen;
    // shaft
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(baseX, baseY); ctx.stroke();
    // head (triangle)
    const wing = headLen * 0.6;
    const nx = -uy, ny = ux; // normal
    const pLx = baseX + nx * wing, pLy = baseY + ny * wing;
    const pRx = baseX - nx * wing, pRy = baseY - ny * wing;
    ctx.beginPath();
    ctx.moveTo(x2, y2); ctx.lineTo(pLx, pLy); ctx.lineTo(pRx, pRy); ctx.closePath();
    const prev = ctx.fillStyle; ctx.fillStyle = strokeStyle || ctx.strokeStyle; ctx.fill(); ctx.fillStyle = prev;
  }

  const ToolArrow = {
    name: 'arrow',
    start(state, ctx, pos){
      state.__arrowStart = pos; state.__arrowLast = null;
      if (global.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear();
    },
    draw(state, ctx, last, pos){
      const s = state.__arrowStart; if (!s || !pos) return;
      state.__arrowLast = pos;
      const octx = global.BoardOverlay && BoardOverlay.getContext ? BoardOverlay.getContext() : null;
      if (!octx) return;
      try { BoardOverlay.clear(); } catch(_) {}
      octx.save();
      const color = (state.toolSettings && state.toolSettings.arrow && state.toolSettings.arrow.color) ? state.toolSettings.arrow.color : state.color;
      const sw = (state.toolSettings && state.toolSettings.arrow && typeof state.toolSettings.arrow.width === 'number') ? state.toolSettings.arrow.width : state.width;
      octx.globalCompositeOperation = 'source-over';
      octx.strokeStyle = color; octx.lineWidth = sw || 4; octx.lineJoin = 'round'; octx.lineCap = 'round';
      drawArrow(octx, s.x, s.y, pos.x, pos.y, octx.strokeStyle, octx.lineWidth);
      octx.restore();
      // refresh visible
      try { if (global.BoardWorld && BoardWorld.renderToVisible) { const vis = document.getElementById('boardCanvas'); const vctx = vis && vis.getContext ? vis.getContext('2d') : null; if (vctx) BoardWorld.renderToVisible(vctx); } } catch(_) {}
    },
    end(state, ctx){
      const s = state.__arrowStart; const l = state.last || state.__arrowLast; if (!s || !l) { state.__arrowStart = null; state.__arrowLast = null; return; }
      try { if (global.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear(); } catch(_) {}
      const dctx = (global.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : ((global.BoardWorld && BoardWorld.getDrawContext) ? BoardWorld.getDrawContext() : ctx);
      dctx.save();
      const color = (state.toolSettings && state.toolSettings.arrow && state.toolSettings.arrow.color) ? state.toolSettings.arrow.color : state.color;
      const sw = (state.toolSettings && state.toolSettings.arrow && typeof state.toolSettings.arrow.width === 'number') ? state.toolSettings.arrow.width : state.width;
      dctx.globalCompositeOperation = 'source-over';
      dctx.strokeStyle = color; dctx.lineWidth = sw || 4; dctx.lineJoin = 'round'; dctx.lineCap = 'round'; dctx.globalAlpha = 1;
      drawArrow(dctx, s.x, s.y, l.x, l.y, dctx.strokeStyle, dctx.lineWidth);
      dctx.restore();
      // store vector shape as 'arrow'
      try {
        const cx = (s.x + l.x) / 2, cy = (s.y + l.y) / 2;
        const dx = l.x - s.x, dy = l.y - s.y; const dist = Math.max(1, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const stroke = color; const width = sw || 4;
        global.BoardVector = global.BoardVector || { list: [], add(ss){ this.list.push(ss); } };
        global.BoardVector.add({ id: Date.now()+Math.random(), kind: 'arrow', cx, cy, radius: dist/2, angle, stroke, width });
      } catch(_) {}
      state.__arrowStart = null; state.__arrowLast = null;
    }
  };

  global.BoardToolArrow = ToolArrow;
})(typeof window !== 'undefined' ? window : this);
