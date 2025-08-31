'use strict';

(function initTextTool(global){
  function $(id){ return document.getElementById(id); }

  // Minimal in-place text editor overlay
  function createEditor(x, y, initial, color){
    const input = document.createElement('textarea');
    input.className = 'ib-text-editor';
  input.value = initial || '';
  input.style.position = 'absolute';
  input.style.left = `${Math.round(x)}px`;
  input.style.top = `${Math.round(y)}px`;
    input.style.minWidth = '80px';
    input.style.minHeight = '28px';
    input.style.padding = '4px 6px';
    input.style.border = '1px solid #4098ff';
    input.style.borderRadius = '4px';
    input.style.background = '#fff';
  // initialize font properties from tool settings if available
  const st = (window.boardState && window.boardState.toolSettings && window.boardState.toolSettings.text) ? window.boardState.toolSettings.text : {};
  const fs = Math.max(8, st.fontSize || 20);
  const fw = st.bold ? '700' : '400';
  const fi = st.italic ? 'italic ' : '';
  input.style.font = `${fi}${fw} ${fs}px Arial, sans-serif`;
  input.style.textDecoration = st.underline ? 'underline' : 'none';
    input.style.lineHeight = '1.2';
    input.style.color = color || '#222';
  input.style.zIndex = '10';
    input.style.resize = 'both';
    input.style.outline = 'none';
  input.style.textAlign = 'left';
    input.setAttribute('rows', '1');
    input.setAttribute('spellcheck', 'false');
    // Placeholder visual
    if (!initial) {
      input.placeholder = 'Введите текст';
    }
    return input;
  }

  function canvasToLocalXY(wrapperEl, x, y){
    // Positions within the wrapper (assumed positioned ancestor)
    return { left: x, top: y };
  }

  function normalizeTextShape(s){
    // Default structure for text vector shape
    return {
      id: s.id || (Date.now()+Math.random()),
      kind: 'text',
      cx: s.cx|0, cy: s.cy|0,
      text: String(s.text||''),
      color: s.color || '#222',
      angle: +s.angle || 0,
      // Use radius as half-diagonal for selection like other shapes
      radius: Math.max(8, +s.radius || Math.ceil(Math.hypot((s.w||0),(s.h||0))/2)),
      width: 1,
      fontSize: Math.max(8, +s.fontSize || 20),
      fontFamily: 'Arial, sans-serif',
  bold: !!s.bold,
  italic: !!s.italic,
  underline: !!s.underline,
      w: Math.max(20, +s.w || 80),
      h: Math.max(20, +s.h || 24)
    };
  }

  function measureMultiline(ctx, text, font){
    ctx.save(); ctx.font = font; ctx.textBaseline = 'top';
    const lines = String(text||'').split(/\r?\n/);
    let w = 0; let h = 0;
    const metrics = [];
    // extract font px robustly (e.g., "italic 700 20px Arial")
    const mpx = /([0-9]+)px/.exec(font); const fontPx = mpx ? Math.max(8, parseInt(mpx[1], 10) || 20) : 20;
    lines.forEach((ln) => {
      const m = ctx.measureText(ln);
      const ascent = (typeof m.actualBoundingBoxAscent === 'number') ? m.actualBoundingBoxAscent : fontPx * 0.8;
      const descent = (typeof m.actualBoundingBoxDescent === 'number') ? m.actualBoundingBoxDescent : fontPx * 0.2;
      const lh = Math.max(1, (ascent + descent)); // keep float to avoid cumulative rounding inflation
      metrics.push({ width: m.width, height: lh, ascent, descent });
      w = Math.max(w, m.width);
      h += lh;
    });
    ctx.restore();
    return { width: Math.ceil(w), height: Math.ceil(h), metrics, fontPx };
  }

  function remeasureTextShape(ctx, s){
    if (!s || s.kind !== 'text' || !ctx) return;
    const fw = s.bold ? '700' : '400';
    const fi = s.italic ? 'italic ' : '';
  const px = Math.max(8, s.fontSize||20);
  const font = `${fi}${fw} ${px}px Arial, sans-serif`;
  const m = measureMultiline(ctx, String(s.text||''), font);
  s.w = Math.max(20, m.width);
  s.h = Math.max(20, m.height);
    s.radius = Math.ceil(Math.hypot(s.w, s.h)/2);
  }

  function drawTextShape(ctx, s){
    const cs = Math.cos(s.angle||0), sn = Math.sin(s.angle||0);
    ctx.save();
    ctx.translate(s.cx, s.cy);
    ctx.rotate(s.angle||0);
    ctx.translate(-s.w/2, -s.h/2);
    ctx.fillStyle = s.color;
    const fw = s.bold ? '700' : '400';
    const fi = s.italic ? 'italic ' : '';
    ctx.font = `${fi}${fw} ${s.fontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    const lines = String(s.text||'').split(/\r?\n/);
    let y = 0;
    for (const ln of lines) {
      const m = ctx.measureText(ln);
      const ascent = (typeof m.actualBoundingBoxAscent === 'number') ? m.actualBoundingBoxAscent : s.fontSize * 0.8;
      const descent = (typeof m.actualBoundingBoxDescent === 'number') ? m.actualBoundingBoxDescent : s.fontSize * 0.2;
      const lh = Math.max(1, Math.ceil(ascent + descent));
      ctx.fillText(ln, 0, y);
      // underline support at baseline
      if (s.underline) {
        const uw = m.width;
        const baselineY = y + ascent;
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1, Math.round(s.fontSize * 0.06));
        ctx.beginPath();
        ctx.moveTo(0, baselineY + 1);
        ctx.lineTo(uw, baselineY + 1);
        ctx.stroke();
        ctx.restore();
      }
      y += lh;
    }
    ctx.restore();
  }

  const ToolText = {
    name: 'text',
    _editor: null,
    _suppressNext: false,
  _remeasure: remeasureTextShape,
    start(state, ctx, pos){
      if (this._suppressNext) { this._suppressNext = false; return; }
  // Commit any previous editor first
      if (this._editor) {
        this._commitFromEditor(ctx, state);
        // Do not create a new editor on the same click
        this._suppressNext = true;
        return;
      }
  const canvas = $('boardCanvas');
  const wrap = document.getElementById('canvasWrapper');
  const page = canvasToLocalXY(wrap, pos.x, pos.y);
      const color = (state.toolSettings && state.toolSettings.text && state.toolSettings.text.color) ? state.toolSettings.text.color : (state.color || '#222');
      const editor = createEditor(page.left, page.top, '', color);
  (wrap || document.body).appendChild(editor);
      editor.focus();
      // Keep text popover open while editing and reflect current settings
      if (window.ToolsUI) {
        ToolsUI.openForTool && ToolsUI.openForTool('text');
        ToolsUI.syncSelections && ToolsUI.syncSelections(window.boardState || {});
      }
      this._editor = editor;
      // Close on Enter (with Ctrl+Enter for newline) or blur or outside click
      const finish = () => { this._commitFromEditor(ctx, state); };
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); finish(); }
        if (e.key === 'Escape') { e.preventDefault(); this._cancelEditor(); }
      });
  // Do not auto-finish on blur; only explicit Enter or outside click commits
      // outside click closes editor
      const onDocDown = (e) => {
        if (!this._editor) { document.removeEventListener('pointerdown', onDocDown, true); return; }
        if (e.target === this._editor) return;
        // ignore clicks inside the text popover to keep editing
        const pop = document.getElementById('textPopover');
  if (pop && pop.contains(e.target)) return;
        document.removeEventListener('pointerdown', onDocDown, true);
        // Suppress creating a new editor for this click
        this._suppressNext = true;
        finish();
        // Optional: auto-select the new text after commit so it stays visible to the user
        try {
          const list = (global.BoardVector && global.BoardVector.list) ? global.BoardVector.list : [];
          const last = list[list.length-1];
          if (last && last.kind === 'text' && global.BoardToolCursor) {
            BoardToolCursor._sel = last; BoardToolCursor._mode = 'drag'; BoardToolCursor._handleIndex = -1;
            const octx = (global.BoardOverlay && BoardOverlay.getContext) ? BoardOverlay.getContext() : null;
            if (octx) { BoardOverlay.clear(); }
            if (octx) { const showDelete = true; const sel = BoardToolCursor._sel; const md = BoardToolCursor._mode; drawSelection(octx, sel, { showDelete: md !== 'resize' }); }
          }
        } catch(_){}
      };
      document.addEventListener('pointerdown', onDocDown, true);
      ['pointerdown','mousedown','click','touchstart'].forEach(evt => {
        editor.addEventListener(evt, (ev)=> ev.stopPropagation());
      });
    },
    draw(state, ctx){ /* no-op while typing */ },
    end(){ /* handled by blur/enter */ },

    _cancelEditor(){
      if (this._editor) { this._editor.remove(); this._editor = null; }
    },

    _commitFromEditor(ctx, state){
      const ed = this._editor; if (!ed) return;
  const text = ed.value.replace(/\r?\n/g, '\n').replace(/\s+$/,'');
      const style = window.getComputedStyle(ed);
      const fontSizePx = parseInt(style.fontSize, 10) || 20;
      const color = style.color || (state.color || '#222');
      const rect = ed.getBoundingClientRect();
      const canvas = $('boardCanvas');
      const cRect = canvas.getBoundingClientRect();
      // Build font with flags before measuring
      const flags = (state.toolSettings && state.toolSettings.text) ? state.toolSettings.text : {};
      const fwM = flags.bold ? '700' : '400';
      const fiM = flags.italic ? 'italic ' : '';
      const fontM = `${fiM}${fwM} ${fontSizePx}px Arial, sans-serif`;
      // Measure using rendering metrics
      const sctxMeasure = (global.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : ctx;
      const measured = sctxMeasure ? measureMultiline(sctxMeasure, text, fontM) : { width: ed.clientWidth, height: ed.clientHeight };
      // Anchor shape to editor's top-left plus measured size/2 to avoid center shift from textarea box metrics
      const tlx = rect.left - cRect.left;
      const tly = rect.top - cRect.top;
      const cx = Math.round(tlx + (measured.width||0) / 2);
      const cy = Math.round(tly + (measured.height||0) / 2);
      ed.remove(); this._editor = null;
      if (!text) return;
      // Create vector shape
      const sctx = (global.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : ctx;
      if (!sctx) return;
      const fw = flags.bold ? '700' : '400';
      const fi = flags.italic ? 'italic ' : '';
      const font = `${fi}${fw} ${fontSizePx}px Arial, sans-serif`;
      // measured already computed above for cx/cy; reuse
      const shape = normalizeTextShape({
        cx, cy,
        text, color,
        fontSize: fontSizePx,
        w: measured.width, h: measured.height,
        radius: Math.ceil(Math.hypot(measured.width, measured.height)/2),
        bold: !!flags.bold, italic: !!flags.italic, underline: !!flags.underline
      });
      global.BoardVector = global.BoardVector || { list: [], add(ss){ this.list.push(ss); } };
      if (!global.BoardVector.add) { global.BoardVector.add = function(ss){ this.list.push(ss); }; }
      global.BoardVector.add(shape);
      // Redraw vector shapes layer
      if (global.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
      const rctx = (global.BoardWorld && BoardWorld.getShapesCtx) ? BoardWorld.getShapesCtx() : ctx;
      if (rctx) {
        if (typeof global.BoardVector.redrawAll === 'function') {
          global.BoardVector.redrawAll(rctx);
        } else {
          drawTextShape(rctx, shape);
        }
      }
      // Ensure the visible canvas shows the updated shapes layer immediately
      try {
        const visCanvas = document.getElementById('boardCanvas');
        const visCtx = visCanvas ? visCanvas.getContext('2d') : null;
        if (visCtx && global.BoardWorld && typeof BoardWorld.renderToVisible === 'function') {
          BoardWorld.renderToVisible(visCtx);
        }
      } catch(_) {}
      // Reveal and position Text Inspector under created text
      try {
        if (window.ToolsUI && ToolsUI.showTextInspector) {
          const wrap = document.getElementById('canvasWrapper');
          const r = wrap ? wrap.getBoundingClientRect() : { left:0, top:0 };
          const px = r.left + shape.cx;
          const py = r.top + shape.cy + Math.max(shape.h?shape.h/2:shape.radius||20, 20) + 10;
          ToolsUI.showTextInspector(true);
          const insp = document.getElementById('textInspector');
          if (insp) { insp.style.position='absolute'; insp.style.left=`${Math.round(px)}px`; insp.style.top=`${Math.round(py)}px`; insp.style.display='flex'; }
          ToolsUI.syncSelections && ToolsUI.syncSelections(window.boardState || {});
        }
      } catch(_) {}
    }
  };

  // Extend cursor selection & redraw paths to support 'text'
  try {
    // Monkey-patch redraw function if available later
    const patch = () => {
      if (!global.BoardVector || !global.BoardVector.list) return;
      const original = global.BoardVector.redrawAll;
      global.BoardVector.redrawAll = function(ctx){
        const list = this.list || [];
        if (!ctx) return;
        list.forEach((s) => {
          if (s.kind === 'text') drawTextShape(ctx, s);
        });
        if (typeof original === 'function') original.call(this, ctx);
      };
    };
    // Attempt now and again after load
    patch();
    window.addEventListener('load', patch);
  } catch(_){ }

  global.BoardToolText = ToolText;
})(typeof window !== 'undefined' ? window : this);
