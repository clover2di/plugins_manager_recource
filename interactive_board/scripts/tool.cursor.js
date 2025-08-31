'use strict';

(function initCursor(global){
  // Inline SVG path for delete icon (trash can) for instant render
  const DELETE_SVG_PATH = "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z";
  // Simple in-memory vector model of shapes drawn via Shapes tool
  global.BoardVector = global.BoardVector || {
  list: [], // each: circle/line/arrow/star/triangle/square: {id, kind, cx, cy, radius, angle, stroke, width}; rect: {id, kind:'rect', cx, cy, rx, ry, angle, stroke, width}
    add(shape){ this.list.push(shape); },
    clear(){
      // Free image resources before clearing
      try {
        for (var i = 0; i < this.list.length; i++) {
          var s = this.list[i];
          if (s && s.kind === 'image') {
            try { freeImageResources(s); } catch(_) {}
          }
        }
      } catch(_) {}
      this.list.length = 0;
    },
  hitTest(x, y){
      // prioritise last drawn (top-most)
      for (let i = this.list.length - 1; i >= 0; i--) {
        const s = this.list[i];
        if (s.kind === 'text') {
          const a = s.angle || 0; const cs = Math.cos(-a), sn = Math.sin(-a);
          const lx = (x - s.cx) * cs - (y - s.cy) * sn;
          const ly = (x - s.cx) * sn + (y - s.cy) * cs;
          const hw = (s.w || 0) / 2, hh = (s.h || 0) / 2;
          const pad = 6;
          if (Math.abs(lx) <= hw + pad && Math.abs(ly) <= hh + pad) return s;
          continue;
        }
        if (s.kind === 'image') {
          const a = s.angle || 0; const cs = Math.cos(-a), sn = Math.sin(-a);
          const lx = (x - s.cx) * cs - (y - s.cy) * sn;
          const ly = (x - s.cx) * sn + (y - s.cy) * cs;
          const hw = Math.max(1, s.rx), hh = Math.max(1, s.ry);
          if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return s;
          continue;
        }
        if (s.kind === 'circle') {
          const dx = x - s.cx, dy = y - s.cy; if (Math.hypot(dx,dy) <= s.radius + Math.max(6, s.width)) return s;
        } else if (s.kind === 'line' || s.kind === 'arrow') {
          // distance to segment
          const ux = Math.cos(s.angle), uy = Math.sin(s.angle);
          const p1 = { x: s.cx - ux * s.radius, y: s.cy - uy * s.radius };
          const p2 = { x: s.cx + ux * s.radius, y: s.cy + uy * s.radius };
          const dx = p2.x - p1.x, dy = p2.y - p1.y; const len2 = dx*dx + dy*dy;
          const t = Math.max(0, Math.min(1, ((x - p1.x)*dx + (y - p1.y)*dy) / (len2||1)));
          const px = p1.x + t*dx, py = p1.y + t*dy; if (Math.hypot(x-px, y-py) <= Math.max(6, s.width+2)) return s;
        } else if (s.kind === 'rect') {
          // axis-aligned rectangle hit test
          const x0 = s.cx - s.rx, y0 = s.cy - s.ry, x1 = s.cx + s.rx, y1 = s.cy + s.ry;
          if (x >= x0 - Math.max(6, s.width) && x <= x1 + Math.max(6, s.width) && y >= y0 - Math.max(6, s.width) && y <= y1 + Math.max(6, s.width)) return s;
        } else {
          // approximate by rotated square bounding circle
          const dx = x - s.cx, dy = y - s.cy; if (Math.hypot(dx,dy) <= s.radius + Math.max(8, s.width)) return s;
        }
      }
      return null;
    }
  };

  function freeImageResources(s){
    try {
      if (!s || s.kind !== 'image') return;
      var src = s.__image;
      // Close ImageBitmap if present
      try { if (src && typeof src.close === 'function') src.close(); } catch(_) {}
      // If not an ImageBitmap, optionally create and close one to hint the decoder to release resources
      if (!(src && typeof src.close === 'function')) {
        try {
          if (src && typeof createImageBitmap === 'function') {
            // Fire-and-forget; closing immediately
            createImageBitmap(src).then(function(bmp){ try { bmp && bmp.close && bmp.close(); } catch(_){} }).catch(function(){});
          }
        } catch(_) {}
      }
      // Revoke any blob URL
      try { if (s.__imageUrl) URL.revokeObjectURL(s.__imageUrl); } catch(_) {}
      // Help GC by detaching HTMLImageElement source
      try { if (src && src.tagName === 'IMG') src.src = ''; } catch(_) {}
      // Null out refs
      s.__image = null; s.__imageUrl = null;
    } catch(_) {}
  }

  // Ensure BoardVector.clear always frees image resources, even if BoardVector was defined earlier
  try {
    if (global.BoardVector) {
      const orig = global.BoardVector.clear;
      global.BoardVector.clear = function(){
        try {
          const arr = this && Array.isArray(this.list) ? this.list : (global.BoardVector && global.BoardVector.list) || [];
          for (var i = 0; i < arr.length; i++) {
            var s = arr[i]; if (s && s.kind === 'image') { try { freeImageResources(s); } catch(_){} }
          }
        } catch(_){}
        if (typeof orig === 'function') { try { orig.call(this); return; } catch(_){} }
        try { if (this && this.list) this.list.length = 0; } catch(_){}
      };
    }
  } catch(_){}

  function drawSelection(octx, s, opt){
    if (!s || !octx) return;
    opt = opt || {};
    const dash = [6,6];
    octx.save();
    octx.setLineDash(dash);
    octx.lineDashOffset = 0;
    octx.strokeStyle = '#4098ff';
    octx.lineWidth = 1;
    // draw bounding box based on kind
  const cx = s.cx, cy = s.cy, r = s.radius;
    if (s.kind === 'line' || s.kind === 'arrow') {
      const ux = Math.cos(s.angle), uy = Math.sin(s.angle);
      const p1 = { x: cx - ux * r, y: cy - uy * r };
      const p2 = { x: cx + ux * r, y: cy + uy * r };
      drawHandles(octx, [p1, p2]);
    } else if (s.kind === 'rect') {
      const pts = [
        { x: s.cx - s.rx, y: s.cy - s.ry },
        { x: s.cx + s.rx, y: s.cy - s.ry },
        { x: s.cx + s.rx, y: s.cy + s.ry },
        { x: s.cx - s.rx, y: s.cy + s.ry }
      ];
      octx.beginPath(); octx.moveTo(pts[0].x, pts[0].y); for (let i=1;i<pts.length;i++) octx.lineTo(pts[i].x, pts[i].y); octx.closePath(); octx.stroke();
      drawHandles(octx, pts);
    } else if (s.kind === 'image') {
      const a = s.angle || 0;
      const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      const hw = Math.max(1, s.rx), hh = Math.max(1, s.ry);
      const pts = [ rot(-hw,-hh), rot(hw,-hh), rot(hw,hh), rot(-hw,hh) ];
      octx.beginPath(); octx.moveTo(pts[0].x, pts[0].y); for (let i=1;i<pts.length;i++) octx.lineTo(pts[i].x, pts[i].y); octx.closePath(); octx.stroke();
      drawHandles(octx, pts);
      // rotation handle
      const topCenter = rot(0, -hh);
      const far = rot(0, -hh - 24);
      octx.setLineDash([]);
      octx.beginPath(); octx.moveTo(topCenter.x, topCenter.y); octx.lineTo(far.x, far.y); octx.stroke();
      octx.beginPath(); octx.arc(far.x, far.y, 6, 0, Math.PI*2); octx.stroke();
    } else if (s.kind === 'text') {
      const hw = (s.w||0)/2, hh = (s.h||0)/2; const a = s.angle || 0;
      const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      const pts = [ rot(-hw,-hh), rot(hw,-hh), rot(hw,hh), rot(-hw,hh) ];
      octx.beginPath(); octx.moveTo(pts[0].x, pts[0].y); for (let i=1;i<pts.length;i++) octx.lineTo(pts[i].x, pts[i].y); octx.closePath(); octx.stroke();
      drawHandles(octx, pts);
    } else {
      const box = [
        { x: cx - r, y: cy - r }, { x: cx + r, y: cy - r },
        { x: cx + r, y: cy + r }, { x: cx - r, y: cy + r }
      ];
      // rotate by angle
      const cs = Math.cos(s.angle||0), sn = Math.sin(s.angle||0);
      const rot = (p)=>({ x: cx + (p.x-cx)*cs - (p.y-cy)*sn, y: cy + (p.x-cx)*sn + (p.y-cy)*cs });
      const pts = box.map(rot);
      octx.beginPath(); octx.moveTo(pts[0].x, pts[0].y); for (let i=1;i<pts.length;i++) octx.lineTo(pts[i].x, pts[i].y); octx.closePath(); octx.stroke();
      drawHandles(octx, pts);
    }
    // draw delete button if requested
  if (opt.showDelete) drawDeleteButton(octx, s);
    octx.restore();
  }

  function drawHandles(octx, points){
    octx.save();
    octx.setLineDash([]);
    octx.strokeStyle = '#4098ff';
    octx.fillStyle = '#ffffff';
    const size = 6;
    points.forEach(p => {
      octx.beginPath();
      octx.rect(p.x - size/2, p.y - size/2, size, size);
      octx.fill();
      octx.stroke();
    });
    octx.restore();
  }

  function getDeleteButtonCenter(s){
    const cx = s.cx, cy = s.cy, r = s.radius, a = s.angle || 0;
    let corner;
    if (s.kind === 'image') {
      // choose the top-right corner of the rotated rectangle and offset outward
      const hw = Math.max(1, s.rx), hh = Math.max(1, s.ry);
      const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      const pts = [ rot(-hw,-hh), rot(hw,-hh), rot(hw,hh), rot(-hw,hh) ];
      corner = pts.reduce((best, p)=>{
        if (!best) return p;
        if (p.y < best.y - 1e-6) return p;
        if (Math.abs(p.y - best.y) <= 1e-6 && p.x > best.x) return p;
        return best;
      }, null);
      const dirx = corner.x - cx, diry = corner.y - cy;
      const len = Math.max(1, Math.hypot(dirx, diry));
      const offImg = Math.max(16, Math.max(hw, hh) * 0.12);
      return { x: corner.x + (dirx/len) * offImg, y: corner.y + (diry/len) * offImg };
    }
    if (s.kind === 'text') {
      const hw = (s.w||0)/2, hh = (s.h||0)/2;
      const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      const pts = [ rot(-hw,-hh), rot(hw,-hh), rot(hw,hh), rot(-hw,hh) ];
      corner = pts.reduce((best, p)=>{
        if (!best) return p;
        if (p.y < best.y - 1e-6) return p;
        if (Math.abs(p.y - best.y) <= 1e-6 && p.x > best.x) return p;
        return best;
      }, null);
      const dirx = corner.x - cx, diry = corner.y - cy;
      const len = Math.max(1, Math.hypot(dirx, diry));
      const off = Math.max(16, Math.max(hw, hh) * 0.2);
      return { x: corner.x + (dirx/len) * off, y: corner.y + (diry/len) * off };
    }
    if (s.kind === 'arrow') {
      // Place near the tail endpoint (opposite of head)
      const ux = Math.cos(a), uy = Math.sin(a);
      const tail = { x: cx - ux * r, y: cy - uy * r };
      const dirx = tail.x - cx, diry = tail.y - cy; // from center to tail
      const len = Math.max(1, Math.hypot(dirx, diry));
      const off = Math.max(16, r * 0.12);
      return { x: tail.x + (dirx/len) * off, y: tail.y + (diry/len) * off };
    } else if (s.kind === 'line') {
      // use top-right of the line's AABB
      const ux = Math.cos(a), uy = Math.sin(a);
      const p1 = { x: cx - ux * r, y: cy - uy * r };
      const p2 = { x: cx + ux * r, y: cy + uy * r };
      const minx = Math.min(p1.x, p2.x), maxx = Math.max(p1.x, p2.x);
      const miny = Math.min(p1.y, p2.y), maxy = Math.max(p1.y, p2.y);
      corner = { x: maxx, y: miny };
    } else if (s.kind === 'rect') {
      // top-right corner of axis-aligned rect
      corner = { x: s.cx + s.rx, y: s.cy - s.ry };
      const dirx = corner.x - cx, diry = corner.y - cy;
      const len = Math.max(1, Math.hypot(dirx, diry));
      const offRect = Math.max(16, Math.max(s.rx, s.ry) * 0.2);
      return { x: corner.x + (dirx/len) * offRect, y: corner.y + (diry/len) * offRect };
    } else {
      // top-right of rotated square
      const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      const pts = [rot(-r,-r), rot(r,-r), rot(r,r), rot(-r,r)];
      // pick the one with smallest y; if tie, with largest x
      corner = pts.reduce((best, p)=>{
        if (!best) return p;
        if (p.y < best.y - 1e-6) return p;
        if (Math.abs(p.y - best.y) <= 1e-6 && p.x > best.x) return p;
        return best;
      }, null);
    }
    // offset a bit outward from center along the direction to the corner
    const dirx = corner.x - cx, diry = corner.y - cy;
    const len = Math.max(1, Math.hypot(dirx, diry));
    const off = Math.max(16, r * 0.12);
    return { x: corner.x + (dirx/len) * off, y: corner.y + (diry/len) * off };
  }

  function drawDeleteButton(octx, s){
    let c = getDeleteButtonCenter(s);
    // Clamp within visible viewport with small margin so it doesn't fly off-screen
    try {
      const wrap = document.getElementById('canvasWrapper');
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        const pad = 14; // half icon + some padding
        const minX = pad, minY = pad;
        const maxX = r.width - pad, maxY = r.height - pad;
        c = { x: Math.max(minX, Math.min(c.x, maxX)), y: Math.max(minY, Math.min(c.y, maxY)) };
      }
    } catch(_){ }
    const size = 24; const rad = 5; // square size and corner radius
    const x = c.x - size/2, y = c.y - size/2;
    octx.save();
    octx.setLineDash([]);
    // rounded square background
    octx.beginPath();
    roundRectPath(octx, x, y, size, size, rad);
    octx.fillStyle = '#ffffff'; octx.strokeStyle = '#4098ff'; octx.lineWidth = 1;
    octx.fill(); octx.stroke();
    // icon: draw inline SVG path scaled into 14x14 box
    const isz = 14;
    if (typeof Path2D !== 'undefined') {
      const path = new Path2D(DELETE_SVG_PATH);
      octx.save();
      octx.translate(c.x - isz/2, c.y - isz/2);
      octx.scale(isz/960, isz/960);
      octx.translate(0, 960); // map viewBox (0,-960)-(960,0) to (0,0)-(isz,isz)
      octx.fillStyle = '#3A3A3A';
      octx.fill(path);
      octx.restore();
    } else {
      // simple fallback X
      octx.beginPath(); octx.moveTo(c.x-5, c.y-5); octx.lineTo(c.x+5, c.y+5); octx.moveTo(c.x+5, c.y-5); octx.lineTo(c.x-5, c.y+5); octx.strokeStyle = '#3A3A3A'; octx.stroke();
    }
    octx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r){
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
  }

  function isPointInDeleteButton(s, x, y){
    let c = getDeleteButtonCenter(s);
    try {
      const wrap = document.getElementById('canvasWrapper');
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        const pad = 14;
        const minX = pad, minY = pad;
        const maxX = r.width - pad, maxY = r.height - pad;
        c = { x: Math.max(minX, Math.min(c.x, maxX)), y: Math.max(minY, Math.min(c.y, maxY)) };
      }
    } catch(_){ }
    const size = 24, rad = 5; const hw = size/2, hh = size/2;
    const ax = Math.abs(x - c.x), ay = Math.abs(y - c.y);
    if (ax <= hw - rad && ay <= hh - rad) return true; // inside core rect
    const dx = Math.max(0, ax - (hw - rad));
    const dy = Math.max(0, ay - (hh - rad));
    return (dx*dx + dy*dy) <= rad*rad;
  }

  const ToolCursor = {
    name: 'cursor',
    _sel: null,
    _mode: 'idle', // idle | drag | resize
    _handleIndex: -1,
  _rotBase: 0,
  _rotStart: 0,
    // rAF throttling for overlay redraws
    _raf: 0,
    _needsOverlay: false,
    redrawSelection(){
      try {
        // If no selection, just clear overlay immediately
        if (!this._sel) {
          try { if (window.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear(); } catch(_){}
          return;
        }
        this._needsOverlay = true;
        if (this._raf) return; // already scheduled
        const raf = (global.requestAnimationFrame || global.setTimeout);
        this._raf = raf(() => {
          this._raf = 0;
          if (!this._needsOverlay) return;
          this._needsOverlay = false;
          try {
            if (window.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear();
            const octx = BoardOverlay.getContext ? BoardOverlay.getContext() : null;
            if (octx && this._sel) drawSelection(octx, this._sel, { showDelete: this._mode !== 'resize' });
          } catch(_){}
          // ensure visible refresh
          try {
            const vis = document.getElementById('boardCanvas');
            const vctx = vis && vis.getContext ? vis.getContext('2d') : null;
            if (vctx && global.BoardWorld && BoardWorld.renderToVisible) BoardWorld.renderToVisible(vctx);
          } catch(_){ }
        });
      } catch(_){ }
    },
    clearSelection(){
      this._sel = null; this._mode = 'idle'; this._handleIndex = -1;
      try { if (window.BoardOverlay && BoardOverlay.clear) BoardOverlay.clear(); } catch(_) {}
    },
  start(state, ctx, pos){
      // if clicked delete on current selection, delete and exit
      if (this._sel && isPointInDeleteButton(this._sel, pos.x, pos.y)) {
  try { if (global.BoardHistory && BoardHistory.snapshot) BoardHistory.snapshot(); } catch(_){}
  // free resources if image
  try { if (this._sel && this._sel.kind === 'image') freeImageResources(this._sel); } catch(_) {}
        const arr = global.BoardVector.list;
        const idx = arr.indexOf(this._sel);
        if (idx >= 0) arr.splice(idx, 1);
        // redraw shapes and clear overlay
        if (global.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
        const sctx2 = global.BoardWorld && BoardWorld.getShapesCtx ? BoardWorld.getShapesCtx() : null;
        if (sctx2) redrawAllShapes(sctx2, global.BoardVector.list);
        this.clearSelection();
        return;
      }
      // try handles first (so corners beyond radius still work)
      let sel = null, hIdx = -1;
      const list = (global.BoardVector && global.BoardVector.list) ? global.BoardVector.list : [];
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        const handles = getHandlesPoints(s);
        const idx = handles.findIndex(p => Math.hypot(pos.x - p.x, pos.y - p.y) <= 12);
        if (idx >= 0) { sel = s; hIdx = idx; break; }
      }
      if (sel) {
        this._sel = sel;
        if (sel.kind === 'text') {
          // allow rotation via handles, drag otherwise
          if (hIdx >= 0) { this._mode = 'resize'; this._handleIndex = hIdx; }
          else { this._mode = 'drag'; this._handleIndex = -1; }
        } else if (sel.kind === 'image' && hIdx === 4) {
          // rotation handle index is 4
          this._mode = 'rotate'; this._handleIndex = 4;
          this._rotBase = sel.angle || 0; this._rotStart = Math.atan2(pos.y - sel.cy, pos.x - sel.cx);
        } else {
          this._mode = 'resize'; this._handleIndex = hIdx;
        }
  // snapshot once at mutation start for undo/redo
  try { if (global.BoardHistory && BoardHistory.snapshot) BoardHistory.snapshot(); } catch(_){}
      } else {
        // fallback to shape body hit
        const hit = global.BoardVector.hitTest(pos.x, pos.y);
  this._sel = hit; this._mode = hit ? 'drag' : 'idle'; this._handleIndex = -1;
  if (hit) { try { if (global.BoardHistory && BoardHistory.snapshot) BoardHistory.snapshot(); } catch(_){} }
      }
      // draw selection
  this.redrawSelection();
  // Do not open Text popover when selecting text with Cursor
  if (!this._sel || this._sel.kind !== 'text') if (window.ToolsUI) {
        // Close text popover and unhighlight button when selecting non-text or empty
        ToolsUI.toggleTextPopover && ToolsUI.toggleTextPopover(false);
        const btn = document.getElementById('toolText');
        if (btn) btn.classList.remove('selected');
  }
    },
    draw(state, ctx, last, pos){
      if (!this._sel) return;
      if ((this._mode === 'drag' || this._mode === 'resize') && last && pos) {
        const dx = pos.x - last.x, dy = pos.y - last.y;
        if (this._mode === 'drag') {
          this._sel.cx += dx; this._sel.cy += dy;
        } else if (this._mode === 'resize') {
          const s = this._sel;
          if (s.kind === 'text') {
            // rotate-only for text: keep radius, update angle based on dragged handle
            const ang0 = s.angle || 0;
            const dxw = pos.x - s.cx, dyw = pos.y - s.cy;
            const cs = Math.cos(-ang0), sn = Math.sin(-ang0);
            // local cursor pos (unused for final angle, but keep similar flow)
            const lx = dxw * cs - dyw * sn; const ly = dxw * sn + dyw * cs;
            const idx = (this._handleIndex >= 0 && this._handleIndex < 4) ? this._handleIndex : 0;
            const cornerDirs = [ {x:-1,y:-1}, {x:1,y:-1}, {x:1,y:1}, {x:-1,y:1} ];
            const dir = cornerDirs[idx];
            const rFix = Math.max(1, s.radius || 20);
            const tx = dir.x * rFix, ty = dir.y * rFix; // target local corner at fixed radius
            const cs2 = Math.cos(ang0), sn2 = Math.sin(ang0);
            const wx = tx * cs2 - ty * sn2; const wy = tx * sn2 + ty * cs2; // world point given current angle
            const angToCursor = Math.atan2(pos.y - s.cy, pos.x - s.cx);
            const angToCorner = Math.atan2(wy, wx);
            s.angle += (angToCursor - angToCorner);
          } else {
          if (s.kind === 'line' || s.kind === 'arrow') {
            const ux = Math.cos(s.angle), uy = Math.sin(s.angle);
            let p1 = { x: s.cx - ux * s.radius, y: s.cy - uy * s.radius };
            let p2 = { x: s.cx + ux * s.radius, y: s.cy + uy * s.radius };
            if (this._handleIndex === 0) p1 = { x: pos.x, y: pos.y }; else p2 = { x: pos.x, y: pos.y };
            const ndx = p2.x - p1.x, ndy = p2.y - p1.y;
            const dist = Math.max(1, Math.hypot(ndx, ndy));
            s.cx = (p1.x + p2.x) / 2; s.cy = (p1.y + p2.y) / 2;
            s.radius = dist / 2; s.angle = Math.atan2(ndy, ndx);
          } else if (s.kind === 'rect') {
            // Resize rect by dragging a corner; keep opposite corner fixed
            const corners = [
              {x: s.cx - s.rx, y: s.cy - s.ry}, // tl
              {x: s.cx + s.rx, y: s.cy - s.ry}, // tr
              {x: s.cx + s.rx, y: s.cy + s.ry}, // br
              {x: s.cx - s.rx, y: s.cy + s.ry}  // bl
            ];
            const idx = Math.max(0, Math.min(3, this._handleIndex|0));
            const opp = corners[(idx + 2) % 4];
            // New center is midpoint between dragged point and opposite corner
            s.cx = (pos.x + opp.x) / 2; s.cy = (pos.y + opp.y) / 2;
            s.rx = Math.max(1, Math.abs(pos.x - opp.x) / 2);
            s.ry = Math.max(1, Math.abs(pos.y - opp.y) / 2);
          } else if (s.kind === 'image') {
            // Resize preserving aspect using local coordinates
            const idx = Math.max(0, Math.min(3, this._handleIndex|0));
            const a = s.angle || 0; const cs = Math.cos(-a), sn = Math.sin(-a);
            // local position of cursor
            const lx = (pos.x - s.cx) * cs - (pos.y - s.cy) * sn;
            const ly = (pos.x - s.cx) * sn + (pos.y - s.cy) * cs;
            const signX = (idx === 1 || idx === 2) ? 1 : -1; // tr or br => +x
            const signY = (idx === 2 || idx === 3) ? 1 : -1; // br or bl => +y
            const oppx = -signX * Math.max(1, s.rx);
            const oppy = -signY * Math.max(1, s.ry);
            let dx = lx - oppx, dy = ly - oppy;
            const asp = s.__aspect || (Math.max(1, s.rx) / Math.max(1, s.ry));
            // adjust dx,dy to respect aspect
            if (Math.abs(dx) / asp > Math.abs(dy)) {
              dy = Math.sign(dy||1) * Math.abs(dx) / asp;
            } else {
              dx = Math.sign(dx||1) * Math.abs(dy) * asp;
            }
            const nx = oppx + dx, ny = oppy + dy;
            // new center in local coords
            const cxL = (nx + oppx) / 2, cyL = (ny + oppy) / 2;
            // half sizes
            let rx = Math.max(1, Math.abs(nx - oppx) / 2);
            let ry = Math.max(1, Math.abs(ny - oppy) / 2);
            // clamp to visible viewport (approximate, ignores rotation)
            try {
              const wrap = document.getElementById('canvasWrapper');
              if (wrap) {
                const rect = wrap.getBoundingClientRect();
                const maxW = Math.max(1, rect.width * 0.95);
                const maxH = Math.max(1, rect.height * 0.95);
                const scale = Math.min(1, maxW / (rx*2), maxH / (ry*2));
                rx = Math.max(1, rx * scale);
                ry = Math.max(1, ry * scale);
              }
            } catch(_){}
            // back to world
            const cs2 = Math.cos(a), sn2 = Math.sin(a);
            const dxW = cxL * cs2 - cyL * sn2;
            const dyW = cxL * sn2 + cyL * cs2;
            s.cx += dxW; s.cy += dyW;
            s.rx = rx; s.ry = ry;
          } else {
            // Compute cursor vector in local coordinates of shape (unrotate by current angle)
            const ang0 = s.angle || 0;
            const dxw = pos.x - s.cx, dyw = pos.y - s.cy;
            const cs = Math.cos(-ang0), sn = Math.sin(-ang0);
            const lx = dxw * cs - dyw * sn; // local x
            const ly = dxw * sn + dyw * cs; // local y
            // For a corner handle, the target local corner is one of (-r,-r),(r,-r),(r,r),(-r,r)
            const idx = (this._handleIndex >= 0 && this._handleIndex < 4) ? this._handleIndex : 0;
            const cornerDirs = [ {x:-1,y:-1}, {x:1,y:-1}, {x:1,y:1}, {x:-1,y:1} ];
            const dir = cornerDirs[idx];
            // New radius is the max of |lx|,|ly| projected along the corner direction to keep square aspect
            const rNew = Math.max(1, Math.max(Math.abs(lx), Math.abs(ly)));
            s.radius = rNew;
            // Update angle so that the dragged corner aligns with cursor direction: angle = world angle of vector from center to target local corner
            const tx = dir.x * rNew, ty = dir.y * rNew;
            const cs2 = Math.cos(ang0), sn2 = Math.sin(ang0);
            const wx = tx * cs2 - ty * sn2; const wy = tx * sn2 + ty * cs2; // world point given current angle
            const angToCursor = Math.atan2(pos.y - s.cy, pos.x - s.cx);
            const angToCorner = Math.atan2(wy, wx);
            s.angle += (angToCursor - angToCorner);
          }
          }
        }
        // redraw shapes layer
        if (global.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
        const sctx = global.BoardWorld && BoardWorld.getShapesCtx ? BoardWorld.getShapesCtx() : null;
        if (sctx) redrawAllShapes(sctx, global.BoardVector.list);
  // schedule overlay + visible refresh
  this.redrawSelection();
      }
      else if (this._mode === 'rotate' && pos) {
        const s = this._sel; if (!s) return;
        const cur = Math.atan2(pos.y - s.cy, pos.x - s.cx);
        s.angle = this._rotBase + (cur - this._rotStart);
        if (global.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
        const sctx = global.BoardWorld && BoardWorld.getShapesCtx ? BoardWorld.getShapesCtx() : null;
        if (sctx) redrawAllShapes(sctx, global.BoardVector.list);
        // schedule overlay + visible refresh
        this.redrawSelection();
      }
    },
    end(state, ctx){
      this._mode = 'idle'; this._handleIndex = -1;
      // cancel pending rAF
      if (this._raf) {
        try { (global.cancelAnimationFrame || global.clearTimeout)(this._raf); } catch(_){}
        this._raf = 0; this._needsOverlay = false;
      }
      // final redraw to reflect end-state
      this.redrawSelection();
    },
    deleteSelection(){
      try {
        if (!this._sel) return false;
        // take snapshot for undo
        try { if (global.BoardHistory && BoardHistory.snapshot) BoardHistory.snapshot(); } catch(_){ }
        const sel = this._sel;
        const arr = (global.BoardVector && BoardVector.list) ? BoardVector.list : null;
        if (!arr) return false;
        const idx = arr.indexOf(sel);
        if (idx < 0) return false;
  // free resources if image
  try { if (sel && sel.kind === 'image') freeImageResources(sel); } catch(_) {}
        arr.splice(idx, 1);
        // redraw shapes layer and clear selection/overlay
        try { if (global.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer(); } catch(_){ }
        const sctx = global.BoardWorld && BoardWorld.getShapesCtx ? BoardWorld.getShapesCtx() : null;
        if (sctx) redrawAllShapes(sctx, global.BoardVector.list);
        this.clearSelection();
        // toast
        try {
          const t = (global.BoardI18n && BoardI18n.t) ? BoardI18n.t : function(){ return 'Deleted selection'; };
          const msg = t('toast.deleted_selection', 'Deleted selection');
          if (global.IBLogger && IBLogger.toast) IBLogger.toast(msg, 'info');
        } catch(_){ }
        return true;
      } catch(_){ return false; }
    }
  };

  function redrawAllShapes(ctx, list){
    list.forEach(s => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = s.stroke; ctx.lineWidth = s.width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const cx=s.cx, cy=s.cy, r=s.radius, a=s.angle||0;
      const rot = (px,py)=>{ const dx=px-cx, dy=py-cy; const cs=Math.cos(a), sn=Math.sin(a); return {x:cx+dx*cs-dy*sn,y:cy+dx*sn+dy*cs}; };
      if (s.kind==='line'){
        const ux=Math.cos(a), uy=Math.sin(a); const p1={x:cx-ux*r,y:cy-uy*r}, p2={x:cx+ux*r,y:cy+uy*r};
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      } else if (s.kind==='rect'){
        const x0 = s.cx - s.rx, y0 = s.cy - s.ry;
        ctx.strokeRect(x0, y0, s.rx * 2, s.ry * 2);
      } else if (s.kind==='image'){
        // draw image centered at (cx,cy) with half-sizes rx,ry and rotation a
        const img = s.__image;
        if (img && (img.width || img.naturalWidth)) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a || 0);
          const w = Math.max(1, Math.round(s.rx * 2));
          const h = Math.max(1, Math.round(s.ry * 2));
          ctx.drawImage(img, -w/2, -h/2, w, h);
          ctx.restore();
        }
      } else if (s.kind==='text'){
        // Draw multiline text with Arial at given fontSize, rotated by s.angle
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a || 0);
        ctx.translate(-(s.w||0)/2, -(s.h||0)/2);
        const fs = Math.max(8, s.fontSize || 20);
        ctx.fillStyle = s.color || '#222';
        const fw = s.bold ? '700' : '400';
        const fi = s.italic ? 'italic ' : '';
        ctx.font = `${fi}${fw} ${fs}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        const lines = String(s.text||'').split(/\r?\n/);
        const lh = Math.max(1, Math.floor(fs * 1.2));
        let yy = 0; for (const ln of lines){
          ctx.fillText(ln, 0, yy);
          if (s.underline) {
            const w = ctx.measureText(ln).width;
            const uy = yy + fs; // baseline + small offset
            ctx.save(); ctx.strokeStyle = s.color || '#222'; ctx.lineWidth = Math.max(1, Math.round(fs/12));
            ctx.beginPath(); ctx.moveTo(0, uy); ctx.lineTo(w, uy); ctx.stroke(); ctx.restore();
          }
          yy += lh;
        }
        ctx.restore();
      } else if (s.kind==='arrow'){
        // draw an arrow using center, radius and angle
        const ux=Math.cos(a), uy=Math.sin(a);
        const p1={x:cx-ux*r,y:cy-uy*r}, p2={x:cx+ux*r,y:cy+uy*r};
        // shaft ends slightly before p2 to leave room for head
        const headLen = Math.max(8, (s.width||4) * 3);
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        const hx = (p2.x - p1.x) / len, hy = (p2.y - p1.y) / len;
        const bx = p2.x - hx * headLen, by = p2.y - hy * headLen;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(bx, by); ctx.stroke();
        const wing = headLen * 0.6; const nx = -hy, ny = hx;
        const pLx = bx + nx * wing, pLy = by + ny * wing;
        const pRx = bx - nx * wing, pRy = by - ny * wing;
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(pLx, pLy); ctx.lineTo(pRx, pRy); ctx.closePath();
        const prev = ctx.fillStyle; ctx.fillStyle = s.stroke; ctx.fill(); ctx.fillStyle = prev;
      } else if (s.kind==='circle'){
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      } else if (s.kind==='square'){
        const half=r; const base=[{x:cx-half,y:cy-half},{x:cx+half,y:cy-half},{x:cx+half,y:cy+half},{x:cx-half,y:cy+half}].map(p=>rot(p.x,p.y));
        strokePoly(ctx, base);
      } else if (s.kind==='triangle'){
        const rr=r; const base=[{x:cx,y:cy-rr},{x:cx-rr*Math.cos(Math.PI/6),y:cy+rr*Math.sin(Math.PI/6)},{x:cx+rr*Math.cos(Math.PI/6),y:cy+rr*Math.sin(Math.PI/6)}].map(p=>rot(p.x,p.y));
        strokePoly(ctx, base);
      } else if (s.kind==='star'){
        const points=5, rO=r, rI=rO*0.5; const pts=[]; for(let i=0;i<points*2;i++){ const rr2=(i%2===0)?rO:rI; const aa=-Math.PI/2+i*Math.PI/points; const px=cx+rr2*Math.cos(aa), py=cy+rr2*Math.sin(aa); pts.push(rot(px,py)); }
        strokePoly(ctx, pts);
      }
      ctx.restore();
    });
  }

  function strokePoly(ctx, pts){ if(!pts.length) return; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.stroke(); }

  function getHandlesPoints(s){
    const cx = s.cx, cy = s.cy, r = s.radius, a = s.angle || 0;
    if (s.kind === 'line' || s.kind === 'arrow') {
      const ux = Math.cos(a), uy = Math.sin(a);
      const p1 = { x: cx - ux * r, y: cy - uy * r };
      const p2 = { x: cx + ux * r, y: cy + uy * r };
      return [p1, p2];
    } else if (s.kind === 'rect') {
      return [
        { x: cx - s.rx, y: cy - s.ry },
        { x: cx + s.rx, y: cy - s.ry },
        { x: cx + s.rx, y: cy + s.ry },
        { x: cx - s.rx, y: cy + s.ry }
      ];
    } else if (s.kind === 'image') {
      const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      const hw = Math.max(1, s.rx), hh = Math.max(1, s.ry);
      const pts = [ rot(-hw,-hh), rot(hw,-hh), rot(hw,hh), rot(-hw,hh) ];
      const rotHandle = rot(0, -hh - 24);
      return pts.concat([rotHandle]);
    }
    if (s.kind === 'text') {
      const hw = (s.w||0)/2, hh = (s.h||0)/2; const cs = Math.cos(a), sn = Math.sin(a);
      const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
      return [ rot(-hw,-hh), rot(hw,-hh), rot(hw,hh), rot(-hw,hh) ];
    }
    const cs = Math.cos(a), sn = Math.sin(a);
    const rot = (dx, dy)=>({ x: cx + dx*cs - dy*sn, y: cy + dx*sn + dy*cs });
    return [rot(-r,-r), rot(r,-r), rot(r,r), rot(-r,r)];
  }

  global.BoardToolCursor = ToolCursor;
  // Expose a redraw helper on BoardVector for other tools to reuse
  try {
    global.BoardVector = global.BoardVector || { list: [] };
    if (!global.BoardVector.redrawAll) {
      global.BoardVector.redrawAll = function(ctx){ redrawAllShapes(ctx, this.list || []); };
    }
  } catch(_){ }
})(typeof window !== 'undefined' ? window : this);
