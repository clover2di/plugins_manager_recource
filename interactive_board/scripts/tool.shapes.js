'use strict';

(function initShapes(global){
  function drawArrow(ctx, fromX, fromY, toX, toY) {
    var headLength = 10;
    var angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(toX, toY);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  function drawLine(ctx, s, e) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }

  function drawCircle(ctx, s, e) {
    var x = Math.min(s.x, e.x);
    var y = Math.min(s.y, e.y);
    var w = Math.abs(e.x - s.x);
    var h = Math.abs(e.y - s.y);
    var r = Math.min(w, h) / 2;
    var cx = x + r;
    var cy = y + r;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawSquare(ctx, s, e) {
    var x0 = s.x, y0 = s.y, x1 = e.x, y1 = e.y;
    var w = x1 - x0; var h = y1 - y0;
    var size = Math.min(Math.abs(w), Math.abs(h));
    var x = w >= 0 ? x0 : x0 - size;
    var y = h >= 0 ? y0 : y0 - size;
    ctx.strokeRect(x, y, size, size);
  }

  function drawTriangle(ctx, s, e) {
    // Equilateral triangle inscribed in circle within bounding square
    var x = Math.min(s.x, e.x);
    var y = Math.min(s.y, e.y);
    var w = Math.abs(e.x - s.x);
    var h = Math.abs(e.y - s.y);
    var size = Math.min(w, h);
    var cx = x + size / 2;
    var cy = y + size / 2;
    var r = size / 2;
    var angles = [-90, 150, 30].map(a => a * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(cx + r * Math.cos(angles[0]), cy + r * Math.sin(angles[0]));
    ctx.lineTo(cx + r * Math.cos(angles[1]), cy + r * Math.sin(angles[1]));
    ctx.lineTo(cx + r * Math.cos(angles[2]), cy + r * Math.sin(angles[2]));
    ctx.closePath();
    ctx.stroke();
  }

  function drawRegularPolygon(ctx, s, e, n) {
    var x = Math.min(s.x, e.x);
    var y = Math.min(s.y, e.y);
    var w = Math.abs(e.x - s.x);
    var h = Math.abs(e.y - s.y);
    var size = Math.min(w, h);
    var cx = x + size / 2;
    var cy = y + size / 2;
    var r = size / 2;
    var startAngle = -Math.PI / 2; // top
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var ang = startAngle + i * 2 * Math.PI / n;
      var px = cx + r * Math.cos(ang);
      var py = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawStar(ctx, s, e, points) {
    points = points || 5;
    var x = Math.min(s.x, e.x);
    var y = Math.min(s.y, e.y);
    var w = Math.abs(e.x - s.x);
    var h = Math.abs(e.y - s.y);
    var size = Math.min(w, h);
    var cx = x + size / 2;
    var cy = y + size / 2;
    var rOuter = size / 2;
    var rInner = rOuter * 0.5; // typical ratio
    var startAngle = -Math.PI / 2;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = (i % 2 === 0) ? rOuter : rInner;
      var ang = startAngle + i * Math.PI / points;
      var px = cx + r * Math.cos(ang);
      var py = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  const ToolShapes = {
    name: 'shapes',
    start(state, ctx, pos) {
      state.__shapeStart = pos;
  state.__shapeLast = null;
      // clear overlay at start of drag
      try { if (global.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear(); } catch(_) {}
    },
    draw(state, ctx, last, pos) {
      const c = state.__shapeStart; if (!c || !pos) return;
  // remember last cursor position for commit
  state.__shapeLast = pos;
      // live preview on overlay
      const octx = global.BoardOverlay && BoardOverlay.getContext ? BoardOverlay.getContext() : null;
      if (!octx) return;
      try { BoardOverlay.clear(); } catch(_) {}
      octx.save();
      const color = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.color) ? state.toolSettings.shapes.color : state.color;
      const sw = (state.toolSettings && state.toolSettings.shapes && typeof state.toolSettings.shapes.width === 'number') ? state.toolSettings.shapes.width : state.width;
      octx.globalCompositeOperation = 'source-over';
      octx.strokeStyle = color;
      octx.lineWidth = sw || 4;
      octx.lineJoin = 'round';
      octx.lineCap = 'round';
      const kind = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.kind) ? state.toolSettings.shapes.kind : 'square';
      // center-based drawing
      const angle = Math.atan2(pos.y - c.y, pos.x - c.x);
      const dx = pos.x - c.x, dy = pos.y - c.y;
      const radius = Math.max(1, Math.hypot(dx, dy));
      const cx = c.x, cy = c.y;

      function rot(px, py) {
        const dx = px - cx, dy = py - cy;
        const cs = Math.cos(angle), sn = Math.sin(angle);
        return { x: cx + dx * cs - dy * sn, y: cy + dx * sn + dy * cs };
      }

      function strokePoly(pts) {
        if (!pts.length) return;
        octx.beginPath();
        octx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) octx.lineTo(pts[i].x, pts[i].y);
        octx.closePath();
        octx.stroke();
      }

      if (kind === 'line') {
        // For line, draw from drag start to current cursor (not from center)
        octx.beginPath();
        octx.moveTo(c.x, c.y);
        octx.lineTo(pos.x, pos.y);
        octx.stroke();
      } else if (kind === 'circle') {
        octx.beginPath();
        octx.arc(cx, cy, radius, 0, Math.PI * 2);
        octx.stroke();
      } else if (kind === 'square') {
        // Draw axis-aligned rectangle instead of square
        const x = Math.min(c.x, pos.x);
        const y = Math.min(c.y, pos.y);
        const w = Math.abs(pos.x - c.x);
        const h = Math.abs(pos.y - c.y);
        octx.strokeRect(x, y, w, h);
      } else if (kind === 'triangle') {
        const r = radius;
        const base = [
          { x: cx, y: cy - r }, // top
          { x: cx - r * Math.cos(Math.PI/6), y: cy + r * Math.sin(Math.PI/6) },
          { x: cx + r * Math.cos(Math.PI/6), y: cy + r * Math.sin(Math.PI/6) }
        ].map(p => rot(p.x, p.y));
        strokePoly(base);
      } else if (kind === 'star') {
        const points = 5;
        const rOuter = radius;
        const rInner = rOuter * 0.5;
        const pts = [];
        for (let i = 0; i < points * 2; i++) {
          const r = (i % 2 === 0) ? rOuter : rInner;
          const a = -Math.PI/2 + i * Math.PI / points;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          const pr = rot(px, py);
          pts.push(pr);
        }
        strokePoly(pts);
      }
      octx.restore();
  // refresh visible
  try { if (global.BoardWorld && BoardWorld.renderToVisible) { const vis = document.getElementById('boardCanvas'); const vctx = vis && vis.getContext ? vis.getContext('2d') : null; if (vctx) BoardWorld.renderToVisible(vctx); } } catch(_) {}
    },
    end(state, ctx) {
  const c = state.__shapeStart; const l = state.last || state.__shapeLast; if (!c || !l) { state.__shapeStart = null; state.__shapeLast = null; return; }
      // clear preview
      try { if (global.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear(); } catch(_) {}
  // draw onto shapes layer if available
  const dctx = (global.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : ((global.BoardWorld && BoardWorld.getDrawContext) ? BoardWorld.getDrawContext() : ctx);
      dctx.save();
      dctx.globalCompositeOperation = 'source-over';
      dctx.strokeStyle = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.color) ? state.toolSettings.shapes.color : state.color;
      // prefer shapes-specific width if present, else fall back to state.width
      var sw = (state.toolSettings && state.toolSettings.shapes && typeof state.toolSettings.shapes.width === 'number') ? state.toolSettings.shapes.width : state.width;
      dctx.lineWidth = sw || 4;
      dctx.lineJoin = 'round';
      dctx.lineCap = 'round';
      dctx.globalAlpha = 1;
  var kind = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.kind) ? state.toolSettings.shapes.kind : 'square';
  // draw with rotation similar to preview (center-based)
  const angle = Math.atan2(l.y - c.y, l.x - c.x);
  const dx = l.x - c.x, dy = l.y - c.y;
  const radius = Math.max(1, Math.hypot(dx, dy));
  const cx = c.x, cy = c.y;
      function rot(px, py) {
        const dx = px - cx, dy = py - cy;
        const cs = Math.cos(angle), sn = Math.sin(angle);
        return { x: cx + dx * cs - dy * sn, y: cy + dx * sn + dy * cs };
      }
      function strokePolyCtx(pts) {
        if (!pts.length) return;
        dctx.beginPath();
        dctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) dctx.lineTo(pts[i].x, pts[i].y);
        dctx.closePath();
        dctx.stroke();
      }
      if (kind === 'line') {
        // Commit a simple line from start to last position
        dctx.beginPath();
        dctx.moveTo(c.x, c.y);
        dctx.lineTo(l.x, l.y);
        dctx.stroke();
      } else if (kind === 'circle') {
        dctx.beginPath();
        dctx.arc(cx, cy, radius, 0, Math.PI * 2);
        dctx.stroke();
  } else if (kind === 'square') {
        // Commit axis-aligned rectangle to shapes layer
        const x = Math.min(c.x, l.x);
        const y = Math.min(c.y, l.y);
        const w = Math.abs(l.x - c.x);
        const h = Math.abs(l.y - c.y);
        dctx.strokeRect(x, y, w, h);
      } else if (kind === 'triangle') {
        const r = radius;
        const base = [
          { x: cx, y: cy - r },
          { x: cx - r * Math.cos(Math.PI/6), y: cy + r * Math.sin(Math.PI/6) },
          { x: cx + r * Math.cos(Math.PI/6), y: cy + r * Math.sin(Math.PI/6) }
        ].map(p => rot(p.x, p.y));
        strokePolyCtx(base);
      } else if (kind === 'star') {
        const points = 5;
        const rOuter = radius;
        const rInner = rOuter * 0.5;
        const pts = [];
        for (let i = 0; i < points * 2; i++) {
          const r = (i % 2 === 0) ? rOuter : rInner;
          const a = -Math.PI/2 + i * Math.PI / points;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          const pr = rot(px, py);
          pts.push(pr);
        }
        strokePolyCtx(pts);
      } else {
        // fallback
        drawSquare(dctx, c, l);
      }
      dctx.restore();
      // Store vector shape for later cursor interactions
      try {
        const kindStored = kind;
        if (kindStored === 'square') {
          // Store as rectangle (kind 'rect') with center, rx, ry, angle 0
          const cxStore = (c.x + l.x) / 2;
          const cyStore = (c.y + l.y) / 2;
          const rx = Math.abs(l.x - c.x) / 2;
          const ry = Math.abs(l.y - c.y) / 2;
          const strokeStored = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.color) ? state.toolSettings.shapes.color : state.color;
          const widthStored = (state.toolSettings && state.toolSettings.shapes && typeof state.toolSettings.shapes.width === 'number') ? state.toolSettings.shapes.width : (state.width || 4);
          global.BoardVector = global.BoardVector || { list: [], add(s){ this.list.push(s); } };
          global.BoardVector.add({ id: Date.now()+Math.random(), kind: 'rect', cx: cxStore, cy: cyStore, rx: Math.max(1, rx), ry: Math.max(1, ry), angle: 0, stroke: strokeStored, width: widthStored });
        } else {
          const angleStored = Math.atan2(l.y - c.y, l.x - c.x);
          const dist = Math.max(1, Math.hypot(l.x - c.x, l.y - c.y));
          let cxStore = c.x, cyStore = c.y, rStore = dist;
          if (kindStored === 'line') { cxStore = (c.x + l.x)/2; cyStore = (c.y + l.y)/2; rStore = dist/2; }
          const strokeStored = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.color) ? state.toolSettings.shapes.color : state.color;
          const widthStored = (state.toolSettings && state.toolSettings.shapes && typeof state.toolSettings.shapes.width === 'number') ? state.toolSettings.shapes.width : (state.width || 4);
          global.BoardVector = global.BoardVector || { list: [], add(s){ this.list.push(s); } };
          global.BoardVector.add({ id: Date.now()+Math.random(), kind: kindStored, cx: cxStore, cy: cyStore, radius: rStore, angle: angleStored, stroke: strokeStored, width: widthStored });
        }
      } catch(_) {}
  state.__shapeStart = null; state.__shapeLast = null;
    }
  };

  const ToolArrow = {
    name: 'arrow',
    start(state, ctx, pos) { state.__arrowStart = pos; },
    draw(state, ctx, last, pos) { /* live preview could be implemented later */ },
    end(state, ctx) {
      const s = state.__arrowStart; const l = state.last; if (!s || !l) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = state.color;
      ctx.lineWidth = state.width;
      ctx.globalAlpha = 1;
      drawArrow(ctx, s.x, s.y, l.x, l.y);
      state.__arrowStart = null;
    }
  };

  global.BoardToolShapes = ToolShapes;
  global.BoardToolArrow = ToolArrow;
})(typeof window !== 'undefined' ? window : this);
