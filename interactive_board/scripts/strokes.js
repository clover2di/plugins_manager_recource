'use strict';

(function initStrokes(global){
  // Tile-based raster cache for vector strokes (pencil/marker/eraser)
  // Coordinates are in CSS pixels (world space). We render into tile canvases scaled by DPR.
  const DEFAULT_TILE_CSS = 256; // tile size in CSS px

  const BoardStrokes = {
    _list: [], // each stroke: { id, type: 'pencil'|'marker'|'erase', color, width, alpha, points:[{x,y},...], bbox:{x0,y0,x1,y1} }
    _tiles: new Map(), // key: `${tx},${ty}` -> { canvas, ctx, tx, ty }
    _tileCss: DEFAULT_TILE_CSS,
    _dpr: Math.max(1, (global.devicePixelRatio||1)),
    _tilePx: DEFAULT_TILE_CSS * Math.max(1, (global.devicePixelRatio||1)),

    setDpr(dpr){
      dpr = Math.max(1, dpr||1);
      if (this._dpr === dpr) return;
      this._dpr = dpr;
      this._tilePx = Math.floor(this._tileCss * this._dpr);
      // Rebuild tiles since scale changed
      this._rebuildAllTiles();
    },

    clear(){
      this._list = [];
      this._tiles.clear();
    },

    getList(){
      try { return (typeof structuredClone === 'function') ? structuredClone(this._list) : JSON.parse(JSON.stringify(this._list)); } catch(_) { return this._list.slice(); }
    },

    setList(list){
      try { this._list = (typeof structuredClone === 'function') ? structuredClone(list||[]) : JSON.parse(JSON.stringify(list||[])); } catch(_) { this._list = Array.isArray(list) ? list.slice() : []; }
      this._rebuildAllTiles();
    },

    addStroke(stroke){
      const s = this._normalizeStroke(stroke);
      if (!s || !s.points || s.points.length < 2) return;
      this._list.push(s);
      this._rasterizeStrokeToTiles(s);
    },

    // For live erasing during drag (optional): rasterize without storing
    rasterizeLive(stroke){
      const s = this._normalizeStroke(stroke);
      if (!s || !s.points || s.points.length < 2) return;
      this._rasterizeStrokeToTiles(s);
    },

    drawVisible(visCtx, viewW, viewH, dpr, pan){
      if (!visCtx) return;
      const tCss = this._tileCss;
      const pxScale = Math.max(1, dpr||this._dpr);
      // compute visible world rect in CSS
      const x0 = Math.floor(pan.x||0);
      const y0 = Math.floor(pan.y||0);
      const x1 = x0 + Math.ceil(viewW||0);
      const y1 = y0 + Math.ceil(viewH||0);
      const tx0 = Math.floor(x0 / tCss);
      const ty0 = Math.floor(y0 / tCss);
      const tx1 = Math.floor((x1 - 1) / tCss);
      const ty1 = Math.floor((y1 - 1) / tCss);
      visCtx.save();
      visCtx.setTransform(1,0,0,1,0,0);
      for (let ty = ty0; ty <= ty1; ty++){
        for (let tx = tx0; tx <= tx1; tx++){
          const tile = this._tiles.get(tx + ',' + ty);
          if (!tile || !tile.canvas) continue;
          const cssX = tx * tCss;
          const cssY = ty * tCss;
          const dx = Math.floor((cssX - x0) * pxScale);
          const dy = Math.floor((cssY - y0) * pxScale);
          const dw = this._tilePx;
          const dh = this._tilePx;
          try { visCtx.drawImage(tile.canvas, 0, 0, dw, dh, dx, dy, dw, dh); } catch(_){}
        }
      }
      visCtx.restore();
    },

    _normalizeStroke(st){
      if (!st) return null;
      const type = (st.type==='erase'||st.type==='marker') ? st.type : 'pencil';
      const color = String(st.color||'#000');
      const width = Math.max(1, +st.width||4);
      const alpha = (type==='marker') ? (typeof st.alpha === 'number' ? Math.max(0, Math.min(1, st.alpha)) : 0.5) : 1;
      const pts = Array.isArray(st.points) ? st.points.map(p=>({ x:+p.x, y:+p.y })) : [];
      if (pts.length < 2) return null;
      const bbox = this._bboxOfPoints(pts, width);
      return { id: st.id || (Date.now()+Math.random()), type, color, width, alpha, points: pts, bbox };
    },

    _bboxOfPoints(pts, width){
      let x0=+Infinity, y0=+Infinity, x1=-Infinity, y1=-Infinity;
      for (let i=0;i<pts.length;i++){ const p=pts[i]; if (p.x<x0) x0=p.x; if (p.y<y0) y0=p.y; if (p.x>x1) x1=p.x; if (p.y>y1) y1=p.y; }
      const pad = Math.max(2, width/2 + 2);
      return { x0: Math.floor(x0 - pad), y0: Math.floor(y0 - pad), x1: Math.ceil(x1 + pad), y1: Math.ceil(y1 + pad) };
    },

    _tileKey(tx,ty){ return tx + ',' + ty; },

    _getOrCreateTile(tx, ty){
      const key = this._tileKey(tx,ty);
      let t = this._tiles.get(key);
      if (t) return t;
      const can = document.createElement('canvas');
      can.width = this._tilePx;
      can.height = this._tilePx;
      const ctx = (function(c){ try { return c.getContext('2d', { willReadFrequently: true }); } catch(_) { return c.getContext('2d'); } })(can);
      if (ctx) {
        // Map world CSS coordinates into tile-local space: scale by DPR, then translate tile origin
        ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        ctx.translate(-tx * this._tileCss, -ty * this._tileCss);
      }
      t = { canvas: can, ctx, tx, ty };
      this._tiles.set(key, t);
      return t;
    },

    _iterTilesForBBox(bbox, fn){
      const tCss = this._tileCss;
      const tx0 = Math.floor(bbox.x0 / tCss), ty0 = Math.floor(bbox.y0 / tCss);
      const tx1 = Math.floor((bbox.x1 - 1) / tCss), ty1 = Math.floor((bbox.y1 - 1) / tCss);
      for (let ty = ty0; ty <= ty1; ty++){
        for (let tx = tx0; tx <= tx1; tx++) fn(tx,ty);
      }
    },

    _rasterizeStrokeToTiles(stroke){
      const self = this;
      this._iterTilesForBBox(stroke.bbox, function(tx,ty){
        const tile = self._getOrCreateTile(tx,ty);
        const ctx = tile.ctx; if (!ctx) return;
        ctx.save();
        // Clip to tile's CSS rect for minor overdraw control
        const x0 = tx * self._tileCss, y0 = ty * self._tileCss;
        ctx.beginPath(); ctx.rect(x0, y0, self._tileCss, self._tileCss); ctx.clip();
        if (stroke.type === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.globalAlpha = 1;
          ctx.lineWidth = Math.max(1, stroke.width);
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color;
          ctx.globalAlpha = stroke.alpha || 1;
          ctx.lineWidth = Math.max(1, stroke.width);
        }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Draw smoothed path
        const pts = stroke.points;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i=1;i<pts.length-1;i++){
          const p0 = pts[i], p1 = pts[i+1];
          const mx = (p0.x + p1.x) * 0.5, my = (p0.y + p1.y) * 0.5;
          ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
        }
        const last = pts[pts.length-1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        ctx.restore();
      });
    },

    _rebuildAllTiles(){
      this._tiles.clear();
      for (let i=0;i<this._list.length;i++) this._rasterizeStrokeToTiles(this._list[i]);
    }
  };

  global.BoardStrokes = BoardStrokes;
})(typeof window !== 'undefined' ? window : this);
