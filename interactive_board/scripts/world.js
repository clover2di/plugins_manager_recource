'use strict';

(function initWorld(global){
  let worldCanvas = null;
  let worldCtx = null;
  let shapesCanvas = null;
  let shapesCtx = null;
  let dpr = 1;
  let viewW = 0;
  let viewH = 0;
  let panX = 0; // in CSS px
  let panY = 0; // in CSS px
  const MAX_SIDE_PX = 16384; // hard upper bound per side in device pixels
  let _limitNotified = false;

  // Create a 2D context requesting willReadFrequently when available.
  // This can significantly speed up repeated getImageData/readback operations
  // in browsers that honor the hint. Falls back to plain getContext if not supported.
  function create2dContext(canvas, wantWillRead = true) {
    if (!canvas || !canvas.getContext) return null;
    if (wantWillRead) {
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) return ctx;
      } catch (e) {
        // ignore and fallback
      }
    }
    return canvas.getContext('2d');
  }

  function notifyLimitOnce(){
    if (_limitNotified) return; _limitNotified = true;
    try {
      if (global.IBLogger && IBLogger.warn) {
        IBLogger.warn('World size limit reached (', MAX_SIDE_PX, 'px). Panning will be constrained.');
      }
      if (global.IBLogger && IBLogger.toast) {
        IBLogger.toast('Достигнут предел размера холста (16К px). Панорамирование будет ограничено.', 'warn');
      }
    } catch(_){}
  }

  function createWorld(wCss, hCss) {
  const MULT = 2; // initial world is 2x viewport (reduced from 3x)
    let wPx = Math.max(1, Math.floor(wCss * dpr * MULT));
    let hPx = Math.max(1, Math.floor(hCss * dpr * MULT));
    if (wPx > MAX_SIDE_PX || hPx > MAX_SIDE_PX) { wPx = Math.min(wPx, MAX_SIDE_PX); hPx = Math.min(hPx, MAX_SIDE_PX); notifyLimitOnce(); }
  const off = document.createElement('canvas');
  off.width = wPx; off.height = hPx;
  const ctx = create2dContext(off, true);
  // init to transparent
  if (ctx) ctx.clearRect(0, 0, wPx, hPx);
    return { off, ctx };
  }

  function init(wCss, hCss, _dpr) {
  // Use the same effective DPR cap as the visible canvas to keep scales consistent
  var cap = (global.__IB_DPR_CAP__ && typeof global.__IB_DPR_CAP__ === 'number') ? global.__IB_DPR_CAP__ : 2.0;
  dpr = Math.min(cap, Math.max(1, _dpr || (window.devicePixelRatio || 1)));
    viewW = Math.max(1, Math.floor(wCss));
    viewH = Math.max(1, Math.floor(hCss));
  const { off, ctx } = createWorld(viewW, viewH);
    worldCanvas = off; worldCtx = ctx;
  // create shapes layer same size as world
  shapesCanvas = document.createElement('canvas');
  shapesCanvas.width = off.width; shapesCanvas.height = off.height;
  shapesCtx = create2dContext(shapesCanvas, true);
  if (shapesCtx) shapesCtx.clearRect(0, 0, shapesCanvas.width, shapesCanvas.height);
    // center viewport in world
    const worldWCss = worldCanvas.width / dpr;
    const worldHCss = worldCanvas.height / dpr;
    panX = Math.floor((worldWCss - viewW) / 2);
    panY = Math.floor((worldHCss - viewH) / 2);
  try { if (global.BoardStrokes && typeof BoardStrokes.setDpr === 'function') BoardStrokes.setDpr(dpr); } catch(_){}
  }

  // Ensure world exists and sized; returns true if ready
  function ensureInitialized(wCss, hCss, _dpr) {
    if (!worldCanvas || !worldCtx) {
      init(wCss, hCss, _dpr);
      return true;
    }
    onResize(wCss, hCss, _dpr);
    return true;
  }

  // Copy current visible canvas into the world at current pan
  function ingestVisibleFrom(canvas, _dpr) {
    if (!canvas || !worldCtx) return;
    const dprNow = Math.max(1, _dpr || (window.devicePixelRatio || 1));
    const p = getPan();
    worldCtx.save();
    worldCtx.setTransform(1,0,0,1,0,0);
    try { worldCtx.drawImage(canvas, Math.floor((p.x || 0) * dprNow), Math.floor((p.y || 0) * dprNow)); } catch(_) {}
    worldCtx.restore();
  }

  // Clear both world and shapes layers fully
  function clearAll() {
    if (worldCtx && worldCanvas) {
      worldCtx.save(); worldCtx.setTransform(1,0,0,1,0,0);
      worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
      worldCtx.restore();
    }
  clearShapesLayer();
  try { if (global.BoardStrokes && typeof BoardStrokes.clear === 'function') BoardStrokes.clear(); } catch(_){}
  }

  function ensureCapacity(marginCss = 200) {
    if (!worldCanvas) return;
    const worldWCss = worldCanvas.width / dpr;
    const worldHCss = worldCanvas.height / dpr;
    let simW = worldWCss;
    let simH = worldHCss;
    let simPanX = panX;
    let simPanY = panY;
    const needLeft = () => simPanX < marginCss;
    const needTop = () => simPanY < marginCss;
    const needRight = () => (simPanX + viewW) > (simW - marginCss);
    const needBottom = () => (simPanY + viewH) > (simH - marginCss);
    let grew = false;
    let blockedW = false, blockedH = false;
    // simulate growth until margins satisfied on all sides
    let guard = 0;
    while ((needLeft() || needTop() || needRight() || needBottom()) && guard++ < 20) {
      if ((needLeft() || needRight()) && !blockedW) {
        let newW = simW * 2;
        if (Math.floor(newW * dpr) > MAX_SIDE_PX) { blockedW = true; newW = simW; }
        const dxCss = (newW - simW) / 2;
        simPanX += dxCss;
        simW = newW;
        if (!blockedW) grew = true;
      }
      if ((needTop() || needBottom()) && !blockedH) {
        let newH = simH * 2;
        if (Math.floor(newH * dpr) > MAX_SIDE_PX) { blockedH = true; newH = simH; }
        const dyCss = (newH - simH) / 2;
        simPanY += dyCss;
        simH = newH;
        if (!blockedH) grew = true;
      }
      if ((blockedW || blockedH) && (needLeft() || needTop() || needRight() || needBottom())) {
        // We can no longer grow; stop simulation
        break;
      }
    }
    if (!grew) {
      // Could not grow, likely due to cap; clamp pan inside world margins and notify
      const maxPanX = Math.max(marginCss, (worldCanvas.width / dpr) - marginCss - viewW);
      const maxPanY = Math.max(marginCss, (worldCanvas.height / dpr) - marginCss - viewH);
      panX = Math.max(marginCss, Math.min(panX, maxPanX));
      panY = Math.max(marginCss, Math.min(panY, maxPanY));
      if (blockedW || blockedH) notifyLimitOnce();
      return;
    }
    let newW = Math.floor(simW * dpr);
    let newH = Math.floor(simH * dpr);
    const capW = Math.min(newW, MAX_SIDE_PX);
    const capH = Math.min(newH, MAX_SIDE_PX);
    if (capW < newW || capH < newH) { newW = capW; newH = capH; notifyLimitOnce(); }
    const grown = document.createElement('canvas');
    grown.width = newW; grown.height = newH;
  const gctx = create2dContext(grown, true);
  const grownShapes = document.createElement('canvas');
  grownShapes.width = newW; grownShapes.height = newH;
  const gsctx = create2dContext(grownShapes, true);
    // place old world centered in new world
    const dx = Math.floor((newW - worldCanvas.width) / 2);
    const dy = Math.floor((newH - worldCanvas.height) / 2);
    gctx.drawImage(worldCanvas, dx, dy);
    if (shapesCanvas) gsctx.drawImage(shapesCanvas, dx, dy);
    // update pan to account for new placement (convert dx/dy to CSS px)
    panX += dx / dpr;
    panY += dy / dpr;
    worldCanvas = grown; worldCtx = gctx;
    shapesCanvas = grownShapes; shapesCtx = gsctx;
  try { if (global.IBLogger && IBLogger.debug) IBLogger.debug('world.grew', { w: newW, h: newH, dpr }); } catch(_){}
  }

  function setPan(xCss, yCss) {
    panX = Math.floor(xCss);
    panY = Math.floor(yCss);
    ensureCapacity();
  // Clamp pan inside world after capacity adjustments
  const marginCss = 200;
  const maxPanX = Math.max(marginCss, (worldCanvas.width / dpr) - marginCss - viewW);
  const maxPanY = Math.max(marginCss, (worldCanvas.height / dpr) - marginCss - viewH);
  panX = Math.max(marginCss, Math.min(panX, maxPanX));
  panY = Math.max(marginCss, Math.min(panY, maxPanY));
  }

  function panBy(dxCss, dyCss) {
    setPan(panX + dxCss, panY + dyCss);
  }

  function onResize(newViewW, newViewH, newDpr) {
    viewW = Math.max(1, Math.floor(newViewW));
    viewH = Math.max(1, Math.floor(newViewH));
    if (newDpr && newDpr !== dpr) {
      var cap = (global.__IB_DPR_CAP__ && typeof global.__IB_DPR_CAP__ === 'number') ? global.__IB_DPR_CAP__ : 2.0;
      newDpr = Math.min(cap, Math.max(1, newDpr));
      // Reinitialize world on DPR change (rare)
      const old = worldCanvas; const oldCtx = worldCtx;
      const oldImg = old ? oldCtx.getImageData(0, 0, old.width, old.height) : null;
      const oldShapes = shapesCanvas; const oldShapesCtx = shapesCtx;
      const oldShapesImg = oldShapes ? oldShapesCtx.getImageData(0, 0, oldShapes.width, oldShapes.height) : null;
  dpr = newDpr;
      const { off, ctx } = createWorld(viewW, viewH);
      worldCanvas = off; worldCtx = ctx;
  shapesCanvas = document.createElement('canvas');
  shapesCanvas.width = off.width; shapesCanvas.height = off.height;
  shapesCtx = create2dContext(shapesCanvas, true);
  if (shapesCtx) shapesCtx.clearRect(0, 0, shapesCanvas.width, shapesCanvas.height);
      if (old && oldImg) {
        // draw old image 1:1
        worldCtx.putImageData(oldImg, 0, 0);
      }
      if (oldShapes && oldShapesImg) {
        shapesCtx.putImageData(oldShapesImg, 0, 0);
      }
  try { if (global.BoardStrokes && typeof BoardStrokes.setDpr === 'function') BoardStrokes.setDpr(dpr); } catch(_){}
    }
    ensureCapacity();
  }

  function getDrawContext() {
    if (!worldCtx) return null;
    // Prepare transform: scale for DPR, then translate by pan in CSS px
    worldCtx.setTransform(dpr, 0, 0, dpr, Math.floor(panX * dpr), Math.floor(panY * dpr));
    return worldCtx;
  }

  function renderToVisible(visCtx) {
  if (!worldCanvas || !visCtx) return;
  ensureCapacity();
  const maxX = Math.max(0, worldCanvas.width - Math.floor(viewW * dpr));
  const maxY = Math.max(0, worldCanvas.height - Math.floor(viewH * dpr));
  const sx = Math.max(0, Math.min(Math.floor(panX * dpr), maxX));
  const sy = Math.max(0, Math.min(Math.floor(panY * dpr), maxY));
  const sw = Math.min(worldCanvas.width - sx, Math.floor(viewW * dpr));
  const sh = Math.min(worldCanvas.height - sy, Math.floor(viewH * dpr));
    // Clear visible (work in device px)
    visCtx.save();
    visCtx.setTransform(1,0,0,1,0,0);
    visCtx.clearRect(0, 0, visCtx.canvas.width, visCtx.canvas.height);
    // Сначала рисуем worldCanvas (растровые), затем тайлы штрихов (strokes), затем shapesCanvas (векторные)
    visCtx.drawImage(worldCanvas, sx, sy, sw, sh, 0, 0, Math.floor(viewW * dpr), Math.floor(viewH * dpr));
    try {
      if (global.BoardStrokes && typeof BoardStrokes.drawVisible === 'function') {
        BoardStrokes.drawVisible(visCtx, viewW, viewH, dpr, { x: panX, y: panY });
      }
    } catch(_){}
    if (shapesCanvas) {
      visCtx.drawImage(shapesCanvas, sx, sy, sw, sh, 0, 0, Math.floor(viewW * dpr), Math.floor(viewH * dpr));
    }
    visCtx.restore();
  }

  function getPan() { return { x: panX, y: panY }; }
  function getWorldCanvas() { return worldCanvas; }
  function getWorldCtx() { return worldCtx; }
  function getShapesCtx() {
    if (!shapesCtx) return null;
    shapesCtx.setTransform(dpr, 0, 0, dpr, Math.floor(panX * dpr), Math.floor(panY * dpr));
    return shapesCtx;
  }
  function clearShapesLayer() {
    if (!shapesCanvas || !shapesCtx) return;
    shapesCtx.save();
    shapesCtx.setTransform(1,0,0,1,0,0);
    shapesCtx.clearRect(0, 0, shapesCanvas.width, shapesCanvas.height);
    shapesCtx.restore();
  }

  function clearStrokesLayer(){ try { if (global.BoardStrokes && BoardStrokes.clear) BoardStrokes.clear(); } catch(_){} }

  global.BoardWorld = { init, onResize, ensureInitialized, ingestVisibleFrom, clearAll, getDrawContext, getShapesCtx, clearShapesLayer, renderToVisible, setPan, panBy, getPan, getWorldCanvas, getWorldCtx, clearStrokesLayer };
})(typeof window !== 'undefined' ? window : this);
