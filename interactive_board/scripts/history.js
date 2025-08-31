'use strict';

// BoardHistory: simple canvas undo/redo manager
// Usage:
//   BoardHistory.init(canvas, ctx, overlayClearFn?)
//   BoardHistory.snapshot()
//   BoardHistory.undo()
//   BoardHistory.redo()
//   BoardHistory.reset()
(function initBoardHistory() {
  if (typeof window === 'undefined') return;
  const LIMIT = 50;
  // Avoid capturing full pixel snapshots for extremely large canvases (device-px).
  // Area threshold chosen to limit memory usage during snapshots (approx 4096x4096).
  const MAX_SNAPSHOT_PIXELS = 4096 * 4096;
  let undoStack = [];
  let redoStack = [];
  let _canvas = null;
  let _ctx = null;
  let _overlayClear = null;
  let _onChange = null;

  function init(canvas, ctx, overlayClear) {
    _canvas = canvas || null;
    _ctx = ctx || null;
    _overlayClear = typeof overlayClear === 'function' ? overlayClear : null;
    reset();
  }

  function setOnChange(cb) {
    _onChange = typeof cb === 'function' ? cb : null;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  function _notify() {
    try {
      if (_onChange) _onChange({ canUndo: canUndo(), canRedo: canRedo() });
    } catch (_) {}
  }

  function _captureWorld() {
    try {
      if (window.BoardWorld && typeof BoardWorld.getWorldCanvas === 'function') {
  const wCan = BoardWorld.getWorldCanvas();
  // Prefer willReadFrequently for readback-heavy contexts, but fall back if not supported
  const wCtx = wCan && wCan.getContext ? (function(c){ try { return c.getContext('2d', { willReadFrequently: true }) || c.getContext('2d'); } catch(e){ return c.getContext('2d'); } })(wCan) : null;
  const sCtx = (window.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : null;
        const sCan = sCtx && sCtx.canvas ? sCtx.canvas : null;
  // Capture a lightweight snapshot of the vector model to keep logic in sync with pixels
        let vec = null;
        try {
          if (window.BoardVector && Array.isArray(BoardVector.list)) {
            // Prefer structuredClone to get a deep, non-shared copy when available.
            if (typeof structuredClone === 'function') {
              try { vec = structuredClone(BoardVector.list); } catch (_) { vec = null; }
            }
            // Fallback to JSON deep clone if structuredClone isn't available.
            if (!vec) {
              try { vec = JSON.parse(JSON.stringify(BoardVector.list)); } catch (_) { vec = null; }
            }
          }
        } catch(_) { vec = null; }
        // Capture strokes vector list (pencil/marker/eraser)
        let strokes = null;
        try {
          if (window.BoardStrokes && typeof BoardStrokes.getList === 'function') {
            strokes = BoardStrokes.getList();
          }
        } catch(_) { strokes = null; }
        if (wCan && wCtx) {
          let wImg = null;
          try {
            const area = (wCan.width >>> 0) * (wCan.height >>> 0);
            if (area > MAX_SNAPSHOT_PIXELS) {
              try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('history.snapshot.skip_pixels', { w: wCan.width, h: wCan.height, area }); } catch(_) {}
              wImg = null;
            } else {
              wImg = wCtx.getImageData(0, 0, wCan.width, wCan.height);
            }
          } catch (e) { wImg = null; }
          // We prefer restoring shapes by redrawing from vec to keep model and pixels consistent.
          // Keep sImg only as a fallback if vec is unavailable.
          const sImg = (!vec && sCtx && sCan) ? sCtx.getImageData(0, 0, sCan.width, sCan.height) : null;
          return { wImg, sImg, vec, strokes, wSize: { w: wCan.width, h: wCan.height }, sSize: sCan ? { w: sCan.width, h: sCan.height } : null };
        }
      }
    } catch(_) {}
    // Fallback: capture visible canvas
    try {
      if (_ctx && _canvas) {
        const vis = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);
        return { visImg: vis, visSize: { w: _canvas.width, h: _canvas.height } };
      }
    } catch(_) {}
    return null;
  }

  function snapshot() {
    const cap = _captureWorld();
    if (!cap) return;
    undoStack.push(cap);
    if (undoStack.length > LIMIT) undoStack.shift();
    // invalidate redo on new operation
    redoStack.length = 0;
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('history.snapshot', { undo: undoStack.length, redo: redoStack.length }); } catch(_) {}
    _notify();
  }

  function _restoreSnapshot(snap) {
    if (!snap) return;
    try {
      if (_overlayClear) _overlayClear();
  try { if (window.BoardToolCursor && typeof BoardToolCursor.clearSelection === 'function') BoardToolCursor.clearSelection(); } catch(_) {}
      if (snap.wImg && window.BoardWorld && typeof BoardWorld.getWorldCanvas === 'function') {
        const wCan = BoardWorld.getWorldCanvas();
        const wCtx = wCan && wCan.getContext ? wCan.getContext('2d') : null;
        if (wCtx) {
          wCtx.save(); wCtx.setTransform(1,0,0,1,0,0);
          wCtx.clearRect(0, 0, wCan.width, wCan.height);
          wCtx.putImageData(snap.wImg, 0, 0);
          wCtx.restore();
        }
  const sCtx = (window.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : null;
        const sCan = sCtx && sCtx.canvas ? sCtx.canvas : null;
        if (sCtx && sCan) {
          // Clear with identity transform
          sCtx.save(); sCtx.setTransform(1,0,0,1,0,0);
          sCtx.clearRect(0, 0, sCan.width, sCan.height);
          sCtx.restore();
          let restoredFromVec = false;
          try {
            if (snap.vec && window.BoardVector) {
              const clone = snap.vec.map(s => ({ ...s }));
              BoardVector.list = clone;
              if (typeof BoardVector.redrawAll === 'function') {
                // Redraw with current pan/DPR transform already set on sCtx
                BoardVector.redrawAll(sCtx);
                restoredFromVec = true;
              }
            }
          } catch(_) { restoredFromVec = false; }
          if (!restoredFromVec && snap.sImg) {
            // Fallback: blit saved pixels under identity transform
            sCtx.save(); sCtx.setTransform(1,0,0,1,0,0);
            sCtx.putImageData(snap.sImg, 0, 0);
            sCtx.restore();
          }
        }
        // Restore strokes vector list and rebuild tile cache
        try {
          if (snap.strokes && window.BoardStrokes) {
            if (typeof BoardStrokes.setList === 'function') {
              BoardStrokes.setList(snap.strokes);
            } else if (typeof BoardStrokes.clear === 'function') {
              BoardStrokes.clear();
              // naive: add each stroke back
              if (typeof BoardStrokes.addStroke === 'function') {
                for (var i=0;i<snap.strokes.length;i++) BoardStrokes.addStroke(snap.strokes[i]);
              }
            }
          }
        } catch(_){}
        // re-render world into visible canvas
        if (window.BoardWorld && typeof BoardWorld.renderToVisible === 'function' && _ctx) {
          BoardWorld.renderToVisible(_ctx);
        }
        return;
      }
      // Fallback to visible restore
      if (_ctx && _canvas && snap.visImg) {
        _ctx.putImageData(snap.visImg, 0, 0);
      }
    } catch (_) {}
  }

  function undo() {
    if (!undoStack.length) return;
    try {
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('history.undo'); } catch(_) {}
      const current = _captureWorld();
      if (current) redoStack.push(current);
      const prev = undoStack.pop();
      _restoreSnapshot(prev);
      _notify();
    } catch (_) {}
  }

  function redo() {
    if (!redoStack.length) return;
    try {
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('history.redo'); } catch(_) {}
      const current = _captureWorld();
      if (current) undoStack.push(current);
      const next = redoStack.pop();
      _restoreSnapshot(next);
      _notify();
    } catch (_) {}
  }

  function reset() {
    undoStack.length = 0;
    redoStack.length = 0;
  try { if (window.BoardStrokes && typeof BoardStrokes.clear === 'function') BoardStrokes.clear(); } catch(_){}
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('history.reset'); } catch(_) {}
    _notify();
  }

  window.BoardHistory = { init, snapshot, undo, redo, reset, canUndo, canRedo, setOnChange };
})();
