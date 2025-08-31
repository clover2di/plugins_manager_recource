'use strict';

(function initGlobals() {
  if (typeof window !== 'undefined') {
  // Effective DPR cap for performance: can be tuned between 1.5 and 2.0
  if (typeof window.__IB_DPR_CAP__ !== 'number') window.__IB_DPR_CAP__ = 2.0;
    window.boardState = window.boardState || {
      color: '#1f75fe',
      width: 4,
      tool: 'pencil',
      drawing: false,
      last: null,
      start: null,
      toolSettings: {
        pencil: { color: '#1f75fe', width: 4 },
        marker: { color: '#1f75fe', width: 32 },
        eraser: { width: 12 },
        shapes: { color: '#1f75fe', kind: 'square', width: 4 },
        text: { color: '#1f75fe', fontSize: 20, bold: false, italic: false, underline: false }
      }
    };
    window.i18n = window.i18n || { lang: 'en-US', dict: null };
  }
})();

function $(id) { return document.getElementById(id); }

// Prevent double initialization across host/init and standalone fallback
window.__IB_BOOTSTRAPPED__ = window.__IB_BOOTSTRAPPED__ || false;
function __ib_bootstrapOnce() {
  if (window.__IB_BOOTSTRAPPED__) return;
  window.__IB_BOOTSTRAPPED__ = true;
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('bootstrap:start'); } catch(_) {}
  try { if (typeof refreshThemeIcons === 'function') refreshThemeIcons(); } catch(_){ }
  try { if (window.BoardBackground && typeof BoardBackground.init === 'function') BoardBackground.init(); } catch(_){ }
  try { setupCanvas(); } catch(_) {}
  try { loadTranslationsForHost(); } catch(_) {}
  try { runFeatureAudit(); } catch(_) {}
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('bootstrap:done'); } catch(_) {}
}

function setupCanvas() {
  const canvas = $('boardCanvas');
  const ctx = canvas.getContext('2d');
  const state = window.boardState;

  function applyCanvasCursor() {
    if (!canvas) return;
    if (window.BoardCursors && typeof BoardCursors.applyCursor === 'function') {
      BoardCursors.applyCursor(canvas, state);
    } else {
      canvas.style.cursor = 'auto';
    }
  }

  if (window.BoardCanvas && typeof BoardCanvas.setupCanvas === 'function') {
    try {
      const res = BoardCanvas.setupCanvas(applyCanvasCursor) || {};
      if (res && res.ctx) { try { /* replace local ctx with managed one */ ctx = res.ctx; } catch(_) {} }
      if (typeof res.resizeCanvas === 'function') window.__boardResize = res.resizeCanvas;
    } catch(_) { /* continue wiring UI even if canvas setup fails */ }
  }

  if (window.BoardHistory && typeof window.BoardHistory.init === 'function') {
    try {
      const overlayClear = (window.BoardOverlay && typeof BoardOverlay.clear === 'function') ? BoardOverlay.clear : null;
      window.BoardHistory.init(canvas, ctx, overlayClear);
    } catch(_) { /* keep going */ }
  }

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  function ensureWorld() {
    const wrap = document.getElementById('canvasWrapper');
  // Align DPR with the cap used by visible canvas
  const cap = (window.__IB_DPR_CAP__ && typeof window.__IB_DPR_CAP__ === 'number') ? window.__IB_DPR_CAP__ : 2.0;
  const dpr = Math.min(cap, Math.max(1, window.devicePixelRatio || 1));
    if (wrap && window.BoardWorld) {
      BoardWorld.ensureInitialized(wrap.clientWidth, wrap.clientHeight, dpr);
      presentNow();
    }
  }
  try { ensureWorld(); } catch(_) {}
  // Ensure a second pass after layout settles
  try { setTimeout(function(){ try { ensureWorld(); } catch(_) {} }, 0); } catch(_) {}
  window.addEventListener('resize', ensureWorld);

  // Present only once per animation frame to reduce overdraw and jank
  let __presentPending = false;
  let __presentTimer = 0;
  let __lastPresentMs = 0;
  function presentNow(){
    if (!window.BoardWorld || !BoardWorld.renderToVisible) return;
    try { BoardWorld.renderToVisible(ctx); } finally {
      __presentPending = false;
      __presentTimer && clearTimeout(__presentTimer);
      __presentTimer = 0;
      __lastPresentMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }
  }
  function schedulePresent(){
    if (!window.BoardWorld || !BoardWorld.renderToVisible) return;
    // If rAF exists, coalesce to one callback. Also set a timeout fallback in case rAF stalls.
    if (typeof requestAnimationFrame === 'function') {
      if (__presentPending) return;
      __presentPending = true;
      requestAnimationFrame(function(){ presentNow(); });
      // Watchdog fallback: ensure we still present if rAF doesn't fire soon
      if (!__presentTimer) {
        __presentTimer = setTimeout(function(){ if (__presentPending) presentNow(); }, 64);
      }
      return;
    }
    // Fallback without rAF: throttle to ~60fps using time-based gate
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - __lastPresentMs >= 16) return presentNow();
    if (!__presentTimer) {
      __presentTimer = setTimeout(function(){ presentNow(); }, Math.max(0, 16 - (now - __lastPresentMs)));
    }
  }

  // Initialize external CanvasMenu module (if available) for canvas context menu
  try {
    if (window.CanvasMenu && typeof window.CanvasMenu.init === 'function') {
      // translation function for CanvasMenu (falls back to identity)
      const trFn = (window.BoardI18n && BoardI18n.t) ? BoardI18n.t : function(k,d){ return d; };
      const toolLabels = {
        cursor: trFn('bottom.cursor', 'Cursor'),
        pencil: trFn('tools.pencil', 'Pencil'),
        marker: trFn('tools.marker', 'Marker'),
        shapes: trFn('tools.shapes', 'Shapes'),
        arrow: trFn('tools.arrow', 'Arrow'),
        text: trFn('tools.text', 'Text'),
        eraser: trFn('tools.eraser', 'Eraser')
      };
      CanvasMenu.init(canvas, {
        id: 'boardContextMenu',
        tr: trFn,
        actions: {
          undo: () => { if (window.BoardHistory) BoardHistory.undo(); },
          redo: () => { if (window.BoardHistory) BoardHistory.redo(); },
          paste: () => { if (window.BoardToolImage && typeof BoardToolImage.pasteFromClipboard === 'function') BoardToolImage.pasteFromClipboard(); else try { document.execCommand('paste'); } catch(_){} }
        },
        toolsQuick: ['cursor','pencil','marker','shapes','arrow','text','eraser'],
        toolLabels: toolLabels,
        state: state,
        helpers: { applyToolSettingsFromStore, updateActive, updateBottomActive, applyCanvasCursor, ToolsUI: window.ToolsUI }
      });
    }
  } catch(_) {}

  const RIGHT_TOOLS = new Set(['pencil', 'marker', 'eraser', 'shapes', 'arrow', 'text']);

  const start = (e) => {
  try { state.__lastEvent = e; } catch(_) {}
    // Only start drawing on primary (left) mouse button or touch
    try {
      // For mouse events, ignore right (2) and middle (1) buttons
      if (typeof e.button === 'number') {
        if (e.button === 2) return; // right button: show context menu only
        if (e.button === 1) { try { e.preventDefault(); e.stopPropagation(); } catch(_){}; return; } // middle: ignore
      }
    } catch(_) {}
    try {
      // If a context menu was opened very recently, ignore this click to avoid double-action (right-click may trigger both)
      const t = window.__ibContextMenuOpenedAt || 0;
      if (t && (Date.now() - t) < 300) return;
    } catch(_){}
    try { e.preventDefault(); } catch(_){}
    state.drawing = true;
    const pos = getPos(e);
    state.last = pos;
    state.start = pos;
    if (RIGHT_TOOLS.has(state.tool) && window.BoardHistory) {
      window.BoardHistory.snapshot();
    }
  const toolMod = getActiveTool();
  const wctxMaybe = (window.BoardWorld && typeof BoardWorld.getDrawContext === 'function') ? BoardWorld.getDrawContext() : null;
  const drawCtx = wctxMaybe || ctx;
  if (toolMod && toolMod.start) toolMod.start(state, drawCtx, pos);
  schedulePresent();
  };

  const draw = (e) => {
    if (!state.drawing) return;
  try { state.__lastEvent = e; } catch(_) {}
    const pos = getPos(e);
    const toolMod = getActiveTool();
    const wctxMaybe = (window.BoardWorld && typeof BoardWorld.getDrawContext === 'function') ? BoardWorld.getDrawContext() : null;
    const drawCtx = wctxMaybe || ctx;
    if (toolMod && toolMod.draw) toolMod.draw(state, drawCtx, state.last, pos);
  if (state.tool !== 'hand') schedulePresent();
    state.last = pos;
  };

  const end = () => {
    if (!state.drawing) return;
    state.drawing = false;
    state.last = null;
    const toolMod = getActiveTool();
    const wctxMaybe = (window.BoardWorld && typeof BoardWorld.getDrawContext === 'function') ? BoardWorld.getDrawContext() : null;
    const drawCtx = wctxMaybe || ctx;
    if (toolMod && toolMod.end) toolMod.end(state, drawCtx);
  if (state.tool !== 'hand') schedulePresent();
    state.start = null;
  };

  if (canvas) {
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end);
  }

  const tools = [
    { id: 'toolPencil', tool: 'pencil' },
    { id: 'toolMarker', tool: 'marker' },
    { id: 'toolShapes', tool: 'shapes' },
    { id: 'toolArrow', tool: 'arrow' },
    { id: 'toolText', tool: 'text' },
    { id: 'toolEraser', tool: 'eraser' }
  ];
  function applyToolSettingsFromStore(tool){
    const ts = state.toolSettings || {};
    if (tool === 'pencil' && ts.pencil){
      if (typeof ts.pencil.color === 'string') state.color = ts.pencil.color;
      if (typeof ts.pencil.width === 'number') state.width = ts.pencil.width;
    } else if (tool === 'marker' && ts.marker){
      if (typeof ts.marker.color === 'string') state.color = ts.marker.color;
      if (typeof ts.marker.width === 'number') state.width = ts.marker.width;
    } else if (tool === 'eraser' && ts.eraser){
      if (typeof ts.eraser.width === 'number') state.width = ts.eraser.width;
    } else if (tool === 'shapes' && ts.shapes){
      if (typeof ts.shapes.color === 'string') state.color = ts.shapes.color;
      if (typeof ts.shapes.width === 'number') state.width = ts.shapes.width;
    } else if (tool === 'text' && ts.text) {
      if (typeof ts.text.color === 'string') state.color = ts.text.color;
    }
  }
  function updateActive(btnId) {
    tools.forEach(t => {
      const b = $(t.id);
      if (b) {
        const isSel = t.id === btnId;
        b.classList.toggle('selected', isSel);
        b.setAttribute('aria-pressed', isSel ? 'true' : 'false');
      }
    });
  }
  tools.forEach(t => {
    const b = $(t.id);
    if (b) {
      b.setAttribute('role', 'button');
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (state.tool === 'marker' && t.tool !== 'marker' && window.BoardOverlay && BoardOverlay.clear) {
          BoardOverlay.clear();
        }
        if (state.tool === 'cursor' && t.tool !== 'cursor' && window.BoardToolCursor && typeof BoardToolCursor.clearSelection === 'function') {
          BoardToolCursor.clearSelection();
        }
        state.tool = t.tool;
        applyToolSettingsFromStore(state.tool);
        if (window.ToolsUI && ToolsUI.syncSelections) ToolsUI.syncSelections(state);
        if (typeof updateBottomActive === 'function') updateBottomActive('');
        updateActive(t.id);
        if (window.ToolsUI && ToolsUI.openForTool) {
          ToolsUI.openForTool(t.tool);
          b.setAttribute('aria-expanded', ['pencil','marker','eraser','shapes','arrow','text'].includes(t.tool) ? 'true' : 'false');
        }
        applyCanvasCursor();
      });
    }
  });

  const bottomButtons = [
    { id: 'toolCursor', tool: 'cursor' },
    { id: 'toolHand', tool: 'hand' },
    { id: 'toolUpload', tool: 'upload' },
    { id: 'toolBackground', tool: 'background' },
    { id: 'toolClear', tool: 'clear' }
  ];

  function updateBottomActive(btnId) {
    bottomButtons.forEach(t => {
      const b = $(t.id);
      if (b) {
        const isSel = t.id === btnId;
        b.classList.toggle('selected', isSel);
        b.setAttribute('aria-pressed', isSel ? 'true' : 'false');
      }
    });
  }

  bottomButtons.forEach(t => {
    const b = $(t.id);
    if (!b) return;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', async () => {
      if (state.tool === 'marker' && t.tool !== 'marker' && window.BoardOverlay && BoardOverlay.clear) {
        BoardOverlay.clear();
      }
      if (t.tool === 'upload') {
        // invoke image tool once (fallback to legacy upload if present)
        const tool = window.BoardToolImage || window.BoardToolUpload;
        if (tool && typeof tool.start === 'function') {
          try { tool.start(); } catch(_) {}
        }
        return;
      }
      if (t.tool === 'background') {
        if (window.ToolsUI && ToolsUI.toggleBackgroundPopover) {
          const pop = document.getElementById('backgroundPopover');
          const isOpen = pop && pop.getAttribute('aria-hidden') === 'false';
          if (ToolsUI.closeAllPopovers) ToolsUI.closeAllPopovers();
          ToolsUI.toggleBackgroundPopover(!isOpen);
        }
        return;
      }
      if (t.tool === 'clear') {
        const dlg = document.getElementById('confirmClearDialog');
        const yes = document.getElementById('confirmClearYes');
        const no = document.getElementById('confirmClearNo');
        if (dlg && typeof dlg.showModal === 'function' && yes && no) {
          // Accessibility: focus trap + autofocus + return focus
          const opener = b;
          function getFocusable(container){
            try {
              return Array.prototype.slice.call(container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              )).filter(function(el){ return !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'); });
            } catch(_) { return []; }
          }
          function trapKeydown(e){
            if (e.key !== 'Tab') return;
            const focusables = getFocusable(dlg);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
              if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
          }
          const onClose = (val) => {
            try { dlg.close(); } catch(_){ }
            yes.removeEventListener('click', onYes);
            no.removeEventListener('click', onNo);
            dlg.removeEventListener('close', onCloseEvt);
            dlg.removeEventListener('keydown', trapKeydown);
            // return focus to opener
            try { if (opener && typeof opener.focus === 'function') opener.focus(); } catch(_) {}
          };
          const onCloseEvt = () => {};
          const onYes = (e) => {
            try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch(_) {}
            ctx.save();
            ctx.setTransform(1,0,0,1,0,0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
            try { if (window.BoardWorld && BoardWorld.clearAll) BoardWorld.clearAll(); } catch(_) { }
            try { if (window.BoardWorld && BoardWorld.clearStrokesLayer) BoardWorld.clearStrokesLayer(); } catch(_) { }
            try { if (window.BoardVector && typeof BoardVector.clear === 'function') BoardVector.clear(); } catch(_) { }
            try { if (window.BoardBackground && typeof BoardBackground.redraw === 'function') BoardBackground.redraw(); } catch(_) { }
            try { if (window.BoardToolCursor && typeof BoardToolCursor.clearSelection === 'function') BoardToolCursor.clearSelection(); } catch(_) { }
            try { if (window.BoardOverlay && typeof BoardOverlay.clear === 'function') BoardOverlay.clear(); } catch(_) { }
            if (window.BoardHistory && typeof window.BoardHistory.reset === 'function') {
              window.BoardHistory.reset();
            }
            try { if (window.BoardWorld && typeof BoardWorld.renderToVisible === 'function') schedulePresent(); } catch(_) { }
            onClose('yes');
          };
          const onNo = (e) => { try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch(_) {} onClose('no'); };
          yes.addEventListener('click', onYes);
          no.addEventListener('click', onNo);
          dlg.addEventListener('close', onCloseEvt);
          dlg.addEventListener('keydown', trapKeydown);
          try {
            // ARIA metadata and autofocus
            dlg.setAttribute('role','dialog');
            dlg.setAttribute('aria-modal','true');
            yes.setAttribute('autofocus','');
            dlg.showModal();
            // focus primary
            setTimeout(function(){ try { yes.focus(); } catch(_){} }, 0);
          } catch(_){ }
        }
        return;
      }
      state.tool = t.tool;
      updateBottomActive(t.id);
      updateActive('');
      applyCanvasCursor();
    });
  });

  const act = {
    undo: $('toolUndo'),
    redo: $('toolRedo'),
    save: $('toolSave'),
    fullscreen: $('toolFullscreen'),
    close: $('toolClose')
  };
  if (act.undo) act.undo.addEventListener('click', () => { if (window.BoardHistory) window.BoardHistory.undo(); schedulePresent(); });
  if (act.redo) act.redo.addEventListener('click', () => { if (window.BoardHistory) window.BoardHistory.redo(); schedulePresent(); });
  if (act.save) act.save.addEventListener('click', () => {
    const url = (window.BoardExport && BoardExport.getCompositeDataURL) ? BoardExport.getCompositeDataURL('image/png') : null;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = 'board.png';
    document.body.appendChild(a); a.click(); a.remove();
  });
  function updateUndoRedoButtons(state) {
    const cu = state && typeof state.canUndo === 'boolean' ? state.canUndo : (window.BoardHistory && BoardHistory.canUndo ? BoardHistory.canUndo() : false);
    const cr = state && typeof state.canRedo === 'boolean' ? state.canRedo : (window.BoardHistory && BoardHistory.canRedo ? BoardHistory.canRedo() : false);
    if (act.undo) {
      act.undo.disabled = !cu;
      act.undo.style.opacity = cu ? '1' : '0.5';
      act.undo.setAttribute('aria-disabled', (!cu).toString());
    }
    if (act.redo) {
      act.redo.disabled = !cr;
      act.redo.style.opacity = cr ? '1' : '0.5';
      act.redo.setAttribute('aria-disabled', (!cr).toString());
    }
  }
  if (window.BoardHistory && BoardHistory.setOnChange) {
    BoardHistory.setOnChange(updateUndoRedoButtons);
    updateUndoRedoButtons({ canUndo: BoardHistory.canUndo ? BoardHistory.canUndo() : false, canRedo: BoardHistory.canRedo ? BoardHistory.canRedo() : false });
  }
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  }
  function updateFullscreenIcon() {
    if (!act.fullscreen) return;
  const svg = act.fullscreen.querySelector('svg.icon');
  if (!svg) return;
  const onPath = 'M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z';
  const offPath = 'M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z';
  const want = isFullscreen() ? offPath : onPath;
  const d = svg.querySelector('path');
  if (d) d.setAttribute('d', want);
  }
  if (act.fullscreen) {
    act.fullscreen.addEventListener('click', () => {
      const el = document.documentElement;
      try {
        if (!isFullscreen()) {
          var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
          try { if (typeof req === 'function') req.call(el); } catch(_) {}
        } else {
          var ex = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          try { if (typeof ex === 'function') ex.call(document); } catch(_) {}
        }
      } catch (_) {}
      setTimeout(updateFullscreenIcon, 0);
    });
    document.addEventListener('fullscreenchange', updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
    document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
    document.addEventListener('MSFullscreenChange', updateFullscreenIcon);
    updateFullscreenIcon();
  }
  if (act.close) act.close.addEventListener('click', () => {
    const dlg = document.getElementById('confirmCloseDialog');
    const yes = document.getElementById('confirmCloseYes');
    const no = document.getElementById('confirmCloseNo');
    if (dlg && typeof dlg.showModal === 'function' && yes && no) {
      const opener = act.close;
      const getFocusable = (container) => {
        try { return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')); } catch(_) { return []; }
      };
      const trapKeydown = (e) => {
        if (e.key !== 'Tab') return;
        const focusables = getFocusable(dlg);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      const cleanup = () => {
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
        dlg.removeEventListener('close', onCloseEvt);
        dlg.removeEventListener('keydown', trapKeydown);
        try { if (opener && typeof opener.focus === 'function') opener.focus(); } catch(_) {}
      };
      const onCloseEvt = () => { cleanup(); };
      const onYes = (e) => {
        try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch(_) {}
        try { if (window.Asc && Asc.plugin && typeof Asc.plugin.button === 'function') { Asc.plugin.button(-1); return; } } catch(_) {}
        try { if (window.Asc && Asc.plugin && typeof Asc.plugin.executeCommand === 'function') Asc.plugin.executeCommand('close', ''); } catch(_) {}
        try { dlg.close(); } catch(_) {}
        cleanup();
      };
  const onNo = (e) => { try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch(_) {} try { dlg.close(); } catch(_) {}; cleanup(); };
      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
      dlg.addEventListener('close', onCloseEvt);
      dlg.addEventListener('keydown', trapKeydown);
      try {
        dlg.setAttribute('role','dialog');
        dlg.setAttribute('aria-modal','true');
        yes.setAttribute('autofocus','');
        dlg.showModal();
        setTimeout(function(){ try { yes.focus(); } catch(_){} }, 0);
      } catch(_) {}
      return;
    }
    // Fallback: no dialog available -> direct close
    try { if (window.Asc && Asc.plugin && typeof Asc.plugin.button === 'function') { Asc.plugin.button(-1); return; } } catch(_) {}
    try { if (window.Asc && Asc.plugin && typeof Asc.plugin.executeCommand === 'function') Asc.plugin.executeCommand('close', ''); } catch(_) {}
  });
  updateActive('toolPencil');
  applyCanvasCursor();

  // Keyboard: Delete/Backspace deletes selected shape in Cursor tool
  try {
    document.addEventListener('keydown', function(e){
      const k = e.key;
      if (k !== 'Delete' && k !== 'Backspace') return;
      // only when Cursor is active
      if (!state || state.tool !== 'cursor') return;
      if (!window.BoardToolCursor || typeof BoardToolCursor.deleteSelection !== 'function') return;
      const deleted = BoardToolCursor.deleteSelection();
      if (deleted) {
        e.preventDefault();
        try {
          const tr = (window.BoardI18n && BoardI18n.t) ? BoardI18n.t : function(_, d){ return d; };
          const hint = tr('hint.delete', 'Delete');
          // Optional: could show a subtle hint toast that Delete key works
          if (window.IBLogger && IBLogger.debug) IBLogger.debug('key.delete', hint);
        } catch(_) { }
      }
    });
  } catch(_){ }

  function getActiveTool() {
    switch (state.tool) {
      case 'pencil': return window.BoardToolPencil;
      case 'marker': return window.BoardToolMarker;
      case 'eraser': return window.BoardToolEraser;
      case 'shapes': return window.BoardToolShapes;
      case 'arrow': return window.BoardToolArrow;
      case 'text': return window.BoardToolText;
      case 'hand': return window.BoardToolHand;
      case 'cursor': return window.BoardToolCursor;
      default: return null;
    }
  }

  if (window.ToolsUI && typeof ToolsUI.init === 'function') {
    ToolsUI.init(state, applyCanvasCursor);
  }
}

function runFeatureAudit(){
  try {
    var g = (typeof window !== 'undefined') ? window : this;
    var caps = {
      env: {
        ua: (function(){ try { return navigator.userAgent; } catch(_) { return ''; } })(),
        lang: (function(){ try { return navigator.language || navigator.userLanguage || ''; } catch(_) { return ''; } })(),
        dpr: (function(){ try { return window.devicePixelRatio || 1; } catch(_) { return 1; } })()
      },
      browser: {
        fetch: !!g.fetch,
        AbortController: (typeof g.AbortController === 'function'),
        requestIdleCallback: (typeof g.requestIdleCallback === 'function'),
        createImageBitmap: (typeof g.createImageBitmap === 'function'),
        Path2D: (typeof g.Path2D === 'function'),
        OffscreenCanvas: (typeof g.OffscreenCanvas === 'function')
      },
      storage: {
        localStorage: (function(){ try { var k='__ib_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; } catch(_) { return false; } })()
      },
      onlyoffice: (function(){
        var p = (g.Asc && g.Asc.plugin) ? g.Asc.plugin : {};
        return {
          present: !!(g.Asc && g.Asc.plugin),
          button: typeof p.button === 'function',
          executeCommand: typeof p.executeCommand === 'function',
          getLocale: typeof p.getLocale === 'function',
          getUrl: typeof p.getUrl === 'function',
          callCommand: typeof p.callCommand === 'function',
          executeMethod: typeof p.executeMethod === 'function',
          resizeWindow: typeof p.resizeWindow === 'function'
        };
      })(),
      board: {
        world: !!g.BoardWorld,
        overlay: !!g.BoardOverlay,
        history: !!g.BoardHistory,
        vector: !!g.BoardVector,
        i18n: !!g.BoardI18n
      }
    };
    try {
      if (g.IBLogger && IBLogger.info) IBLogger.info('featureAudit', caps); else console.log('featureAudit', caps);
    } catch(_) { try { console.log('featureAudit', caps); } catch(__){} }
    g.__IB_FEATURE_AUDIT__ = caps;
  } catch(_) {}
}

async function loadTranslationsForHost() {
  try {
    let raw = null;
    try { if (window.Asc && Asc.plugin && typeof Asc.plugin.getLocale === 'function') raw = Asc.plugin.getLocale(); } catch(_) {}
    if (!raw) { try { raw = navigator.language || navigator.userLanguage; } catch(_) { raw = 'en-US'; } }
    const norm = String(raw || 'en-US').replace('_','-').toLowerCase();
    let locale = norm.startsWith('ru') ? 'ru-RU' : 'en-US';

    let dict = null;
    async function tryFetch(lc){
      const rel = 'translations/' + lc + '.json';
      let lastErr = null;
      const logger = (window.IBLogger || {});
      const attemptFetch = async (url, timeoutMs) => {
        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const t = (timeoutMs && ctrl) ? setTimeout(() => { try { ctrl.abort(); } catch(_){} }, timeoutMs) : null;
        try {
          logger.debug && logger.debug('i18n: fetching', url, 'timeout=', timeoutMs);
          const res = await fetch(url, { cache: 'no-cache', signal: ctrl ? ctrl.signal : undefined });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return await res.json();
        } finally { if (t) clearTimeout(t); }
      };
      // strategy: relative -> getUrl(abs) with retries 2x and timeouts
      const candidates = [ rel ];
      try {
        if (window.Asc && Asc.plugin && typeof Asc.plugin.getUrl === 'function') {
          const abs = Asc.plugin.getUrl(rel);
          if (abs) candidates.push(abs);
        }
      } catch(eUrl){ lastErr = eUrl; }
      const timeouts = [4000, 6000];
      for (let i = 0; i < candidates.length; i++) {
        for (let r = 0; r < timeouts.length; r++) {
          try { return await attemptFetch(candidates[i], timeouts[r]); }
          catch(e) { lastErr = e; logger.warn && logger.warn('i18n: fetch attempt failed', candidates[i], e && e.message); }
        }
      }
      throw lastErr || new Error('i18n fetch failed');
    }

    try {
      dict = await tryFetch(locale);
    } catch(err1) {
      try {
        const alt = 'en-US';
        dict = await tryFetch(alt);
        locale = alt;
      } catch(err2) {
        // попытка взять из localStorage последний успешный словарь
        try {
          const cached = localStorage.getItem('IB_I18N_LAST');
          if (cached) {
            dict = JSON.parse(cached);
            (window.IBLogger && IBLogger.warn) && IBLogger.warn('i18n: using cached dictionary');
          } else {
            dict = { title: 'Interactive Board' }; // минимальный безопасный запасной вариант
          }
        } catch(_) { dict = { title: 'Interactive Board' }; }
      }
    }

    window.i18n = window.i18n || {}; window.i18n.lang = locale; window.i18n.dict = dict || {};
    try { localStorage.setItem('IB_I18N_LAST', JSON.stringify(window.i18n.dict)); } catch(_){ }
    try { document.documentElement.setAttribute('lang', locale.split('-')[0]); } catch(_) {}
    if (dict && window.BoardI18n && typeof BoardI18n.applyI18n === 'function') {
      BoardI18n.applyI18n(dict);
    }
    try {
      var tr = (window.BoardI18n && BoardI18n.t) ? BoardI18n.t : function(_, d){ return d; };
      var mapRight = [
        ['toolPencil','tools.pencil'],
        ['toolMarker','tools.marker'],
        ['toolShapes','tools.shapes'],
        ['toolArrow','tools.arrow'],
        ['toolText','tools.text'],
        ['toolEraser','tools.eraser']
      ];
      mapRight.forEach(function(m){
        var el = document.getElementById(m[0]); if (!el) return;
        var val = tr(m[1], el.getAttribute('title') || '');
        if (val) { el.setAttribute('title', val); el.setAttribute('aria-label', val); }
      });
      var mapBottom = [
        ['toolCursor','bottom.cursor'],
        ['toolHand','bottom.hand'],
        ['toolUpload','bottom.image'],
        ['toolBackground','bottom.background'],
        ['toolClear','bottom.clear']
      ];
      mapBottom.forEach(function(m){
        var el = document.getElementById(m[0]); if (!el) return;
        var val = tr(m[1], el.getAttribute('title') || '');
        if (val) { el.setAttribute('title', val); el.setAttribute('aria-label', val); }
      });
      var actionsEl = document.getElementById('bottomActions');
      if (actionsEl) actionsEl.setAttribute('aria-label', tr('aria.actions', actionsEl.getAttribute('aria-label') || 'Actions'));
      var mapActions = [
        ['toolUndo','actions.undo'],
        ['toolRedo','actions.redo'],
        ['toolSave','actions.save'],
        ['toolFullscreen','actions.fullscreen'],
        ['toolClose','actions.close']
      ];
      mapActions.forEach(function(m){
        var el = document.getElementById(m[0]); if (!el) return;
        var val = tr(m[1], el.getAttribute('title') || '');
        if (val) { el.setAttribute('title', val); el.setAttribute('aria-label', val); }
      });
      var ariaPairs = [
        ['pencilColorGrid','aria.colors'],
        ['pencilSizeRow','aria.stroke_width'],
        ['markerColorGrid','aria.colors'],
        ['markerSizeRow','aria.stroke_width'],
        ['shapesRow','aria.shapes'],
        ['textColorGrid','aria.text_color'],
        ['textSizeRow','aria.text_size'],
        ['textStyleRow','aria.text_style'],
        ['eraserSizeRow','aria.eraser_width'],
        ['backgroundRow','aria.background_types']
      ];
      ariaPairs.forEach(function(p){
        var el = document.getElementById(p[0]); if (!el) return;
        var val = tr(p[1], el.getAttribute('aria-label') || '');
        if (val) el.setAttribute('aria-label', val);
      });
      var ttl = document.getElementById('confirmClearTitle');
      var body = document.querySelector('#confirmClearDialog .modal-body');
      var yes = document.getElementById('confirmClearYes');
      var no = document.getElementById('confirmClearNo');
      if (ttl) ttl.textContent = tr('dialog.confirm', ttl.textContent || '');
      if (body) body.textContent = tr('dialog.clear_body', body.textContent || '');
      if (yes) yes.textContent = tr('dialog.yes', yes.textContent || '');
      if (no) no.textContent = tr('dialog.no', no.textContent || '');
  // Close dialog i18n
  var ttlC = document.getElementById('confirmCloseTitle');
  var bodyC = document.getElementById('confirmCloseBody');
  var yesC = document.getElementById('confirmCloseYes');
  var noC = document.getElementById('confirmCloseNo');
  if (ttlC) ttlC.textContent = tr('dialog.confirm', ttlC.textContent || '');
  if (bodyC) bodyC.textContent = tr('dialog.close_body', bodyC.textContent || '');
  if (yesC) yesC.textContent = tr('dialog.yes', yesC.textContent || '');
  if (noC) noC.textContent = tr('dialog.no', noC.textContent || '');
  void tr('toast.deleted_selection', 'Deleted selection');
  } catch(_){ }
  } catch(_) {}
}

document.addEventListener('DOMContentLoaded', function(){
  // Standalone fallback: initialize if host won't
  __ib_bootstrapOnce();
});
// If the script loads after DOMContentLoaded, run immediately
try {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    __ib_bootstrapOnce();
  }
} catch(_) {}

window.Asc = window.Asc || {}; window.Asc.plugin = window.Asc.plugin || {};
window.Asc.plugin.init = function () {
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('Asc.plugin.init: start'); } catch(_) {}
  try { window.Asc.plugin.resizeWindow(900, 600, 900, 600, 0, 0); } catch(_) {}
  __ib_bootstrapOnce();
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('Asc.plugin.init: done'); } catch(_) {}
};

window.Asc.plugin.button = function (id) {
  if (id === 0) {
    if (window.BoardInsert && typeof BoardInsert.insertAsImage === 'function') {
      BoardInsert.insertAsImage();
    }
  } else if (id === -1) {
    this.executeCommand('close', '');
  }
};

window.Asc.plugin.onThemeChanged = function (theme) {
  try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('theme.changed', theme && theme.type); } catch(_) {}
  if (typeof window.Asc.plugin.onThemeChangedBase === 'function') {
    window.Asc.plugin.onThemeChangedBase(theme);
  }
    try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('plugin.themeChanged', theme && theme.type); } catch(_) {}
  const isDark = theme && theme.type && String(theme.type).toLowerCase().includes('dark');
  document.body.classList.toggle('theme-type-dark', !!isDark);
  try { if (typeof refreshThemeIcons === 'function') refreshThemeIcons(); } catch(_){ }
  try {
    const pop = document.getElementById('backgroundPopover');
    if (pop && window.ToolsUI && ToolsUI.toggleBackgroundPopover) {
      const wasOpen = pop.getAttribute('aria-hidden') === 'false';
      if (wasOpen) { ToolsUI.toggleBackgroundPopover(false); ToolsUI.toggleBackgroundPopover(true); }
    }
  } catch(_){ }
};

window.onresize = function () {
  // handled in setupCanvas via event listener
};

function refreshThemeIcons(){
  try {
  // Mount icons immediately so they appear with primary render
  if (window.Icons && Icons.mount) Icons.mount(document);
  // Defer retinting and theme asset refresh until the browser is idle (or next tick)
  var _idle = (typeof requestIdleCallback === 'function')
    ? function(fn){ try { requestIdleCallback(fn, { timeout: 200 }); } catch(_) { setTimeout(fn, 0); } }
    : function(fn){ setTimeout(fn, 0); };
  _idle(function(){
    try { if (window.Icons && Icons.retint) Icons.retint(document); } catch(_) {}
    try { if (window.ToolsUI && typeof ToolsUI.refreshThemeAssets === 'function') ToolsUI.refreshThemeAssets(); } catch(_) {}
    try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('icons.retint:deferred'); } catch(_) {}
  });
  } catch(_){ }
}
