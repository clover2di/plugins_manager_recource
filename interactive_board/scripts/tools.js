'use strict';

(function initToolsUI(global){
  function $(id){ return document.getElementById(id); }
  function tr(path, def){
    try { return (global.BoardI18n && typeof global.BoardI18n.t === 'function') ? global.BoardI18n.t(path, def) : def; } catch(_) { return def; }
  }

  const palette = [
    '#2c2d2f','#cfd1d7','#ffffff','#f05c45','#ffa001','#ffb981',
    '#ffd65d','#c3f080','#43cc4d','#22ceee','#7beadc','#42d7a6',
    '#9edcff','#4c92ff','#7772f9','#b885ff','#d3b3ff','#fea4a5'
  ];
  const sizeSvgs = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960"><path d="M199-199q-9-9-9-21t9-21l520-520q9-9 21-9t21 9q9 9 9 21t-9 21L241-199q-9 9-21 9t-21-9Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960"><path d="M212-212q-11-11-11-28t11-28l480-480q11-12 27.5-12t28.5 12q11 11 11 28t-11 28L268-212q-11 11-28 11t-28-11Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960"><path d="M218-218q-17-17-17-42t17-42l440-440q17-18 42-17.5t42 17.5q17 17 17.5 42T742-658L302-218q-17 17-42 17.5T218-218Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960"><path d="M229-229q-29-29-29-71t29-71l360-360q29-29 71-29t71 29q29 29 29 71t-29 71L371-229q-29 29-71 29t-71-29Z"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960"><path d="M235-235q-35-35-35-85t35-85l320-320q35-35 85-35t85 35q35 35 35 85t-35 85L405-235q-35 35-85 35t-85-35Z"/></svg>'
  ];

  function tintSizeIcons(rowEl, hex){
    if (!rowEl) return;
    rowEl.querySelectorAll('.size-btn').forEach(btn => {
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.style.color = hex;
        svg.querySelectorAll('path,rect,circle,polygon,ellipse,line,polyline').forEach(el => {
          try { el.setAttribute('fill', hex); el.setAttribute('stroke', hex); } catch(_){}
        });
      } else { btn.style.color = hex; }
    });
  }

  // --- Persistence helpers disabled by product decision ---
  function loadTextSettings(){ return null; }
  function saveTextSettings(_settings){ /* no-op: do not persist settings across sessions */ }

  function togglePopover(id, open){
    const pop = $(id);
    if (!pop) return;
    const show = !!open;
    pop.setAttribute('aria-hidden', show ? 'false' : 'true');
    pop.style.display = show ? 'block' : 'none';
  updateTooltipSuppression();
  }

  function setBackgroundButtonActive(isActive) {
    const b = $('toolBackground');
    if (!b) return;
    b.classList.toggle('selected', !!isActive);
    b.setAttribute('aria-pressed', !!isActive ? 'true' : 'false');
    b.setAttribute('aria-expanded', !!isActive ? 'true' : 'false');
  }

  function initOutsideClose(popId, btnId, onClose){
    document.addEventListener('pointerdown', (ev) => {
      const pop = $(popId); const btn = $(btnId);
      if (!pop || !btn) return;
      if (pop.getAttribute('aria-hidden') === 'true') return;
      const inside = pop.contains(ev.target) || btn.contains(ev.target);
      if (!inside) onClose(false);
    }, true);
  }

  // Prevent popovers from closing when clicking inside their empty space
  function hardenPopoversAgainstInsideClicks(){
    const ids = ['pencilPopover','markerPopover','eraserPopover','shapesPopover','arrowPopover','textPopover','backgroundPopover'];
    ids.forEach(id => {
      const pop = $(id);
      if (!pop || pop.dataset.hardened === '1') return;
      // Stop pointerdown bubbling to any global outside-close listeners
      pop.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); }, true);
      pop.dataset.hardened = '1';
    });
  }

  // Unified popover control
  function closeAllPopovers() {
    togglePopover('pencilPopover', false);
    togglePopover('markerPopover', false);
    togglePopover('eraserPopover', false);
    togglePopover('shapesPopover', false);
    togglePopover('arrowPopover', false);
  togglePopover('textPopover', false);
    togglePopover('backgroundPopover', false);
    setBackgroundButtonActive(false);
  updateTooltipSuppression();
  }

  function openForTool(tool) {
    // Close others first, then open the requested tool's popover
    closeAllPopovers();
    switch (tool) {
      case 'pencil': togglePopover('pencilPopover', true); break;
      case 'marker': togglePopover('markerPopover', true); break;
      case 'eraser': togglePopover('eraserPopover', true); break;
      case 'shapes': togglePopover('shapesPopover', true); break;
  case 'arrow':  togglePopover('arrowPopover', true); break;
  case 'text':   togglePopover('textPopover', true); break;
  case 'cursor': /* do not open text popover here */ break;
      default: /* no popover */ break;
    }
    updateTooltipSuppression();
  }

  // --- Tooltip suppression when any popover is open ---
  function anyPopoverOpen(){
    try { return !!document.querySelector('.tool-popover[aria-hidden="false"]'); } catch(_) { return false; }
  }
  function disableTitleTooltips(){
    try {
      const els = document.querySelectorAll('[title]');
      els.forEach(el => {
        const t = el.getAttribute('title');
        if (t != null && t !== '' && !el.hasAttribute('data-title-saved')) {
          el.setAttribute('data-title-saved', t);
          el.removeAttribute('title');
        }
      });
    } catch(_){ }
  }
  function enableTitleTooltips(){
    try {
      const els = document.querySelectorAll('[data-title-saved]');
      els.forEach(el => {
        const t = el.getAttribute('data-title-saved');
        el.removeAttribute('data-title-saved');
        if (t != null) el.setAttribute('title', t);
      });
    } catch(_){ }
  }
  function updateTooltipSuppression(){
    if (anyPopoverOpen()) disableTitleTooltips(); else enableTitleTooltips();
  }

  function buildPencilUI(state, applyCursor){
    const grid = $('pencilColorGrid');
    if (grid && grid.children.length === 0) {
      palette.forEach((hex) => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch'; sw.style.backgroundColor = hex;
        try { sw.dataset.hex = String(hex).toLowerCase(); } catch(_) {}
  sw.setAttribute('role','button'); sw.setAttribute('tabindex','0'); sw.setAttribute('aria-label', (tr('aria.colors','Colors') + ' ' + hex));
        sw.addEventListener('click', () => {
          state.color = hex;
          // persist per-tool color
          state.toolSettings = state.toolSettings || {}; state.toolSettings.pencil = state.toolSettings.pencil || {};
          state.toolSettings.pencil.color = hex;
          grid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          sw.classList.add('selected');
          tintSizeIcons($('pencilSizeRow'), hex);
          tintSizeIcons($('markerSizeRow'), hex);
        });
        if (state.color && state.color.toLowerCase() === hex.toLowerCase()) sw.classList.add('selected');
        grid.appendChild(sw);
      });
      // Default: select first color if none selected
      if (!grid.querySelector('.color-swatch.selected') && grid.firstElementChild) {
        const first = grid.firstElementChild;
        const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
        first.classList.add('selected');
        if (firstHex) {
          state.toolSettings = state.toolSettings || {}; state.toolSettings.pencil = state.toolSettings.pencil || {};
          state.toolSettings.pencil.color = firstHex;
          if (state.tool === 'pencil') state.color = firstHex;
          tintSizeIcons($('pencilSizeRow'), firstHex);
          tintSizeIcons($('markerSizeRow'), firstHex);
        }
      }
    }
    const sizeRow = $('pencilSizeRow');
    if (sizeRow && sizeRow.children.length === 0) {
      const sizes = [2,4,6,8,12];
      sizes.forEach((w, idx) => {
        const btn = document.createElement('button');
        btn.className = 'size-btn'; btn.type = 'button';
  btn.innerHTML = sizeSvgs[idx]; btn.setAttribute('aria-label', (tr('aria.stroke_width','Stroke width') + ' ' + w));
        btn.addEventListener('click', () => {
          state.width = w;
          // persist per-tool width
          state.toolSettings = state.toolSettings || {}; state.toolSettings.pencil = state.toolSettings.pencil || {};
          state.toolSettings.pencil.width = w;
          sizeRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          if (state.tool === 'pencil' && typeof applyCursor === 'function') applyCursor();
        });
        if (state.width === w) btn.classList.add('selected');
        sizeRow.appendChild(btn);
      });
      tintSizeIcons(sizeRow, state.color);
    }
  }

  function buildMarkerUI(state, applyCursor){
    const markerGrid = $('markerColorGrid');
    if (markerGrid && markerGrid.children.length === 0) {
      palette.forEach((hex) => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch'; sw.style.backgroundColor = hex;
        try { sw.dataset.hex = String(hex).toLowerCase(); } catch(_) {}
  sw.setAttribute('role','button'); sw.setAttribute('tabindex','0'); sw.setAttribute('aria-label', (tr('aria.colors','Colors') + ' ' + hex));
        sw.addEventListener('click', () => {
          state.color = hex;
          // persist per-tool color
          state.toolSettings = state.toolSettings || {}; state.toolSettings.marker = state.toolSettings.marker || {};
          state.toolSettings.marker.color = hex;
          markerGrid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          sw.classList.add('selected');
          tintSizeIcons($('markerSizeRow'), hex);
        });
        if (state.color && state.color.toLowerCase() === hex.toLowerCase()) sw.classList.add('selected');
        markerGrid.appendChild(sw);
      });
      // Default: select first color if none selected
      if (!markerGrid.querySelector('.color-swatch.selected') && markerGrid.firstElementChild) {
        const first = markerGrid.firstElementChild;
        const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
        first.classList.add('selected');
        if (firstHex) {
          state.toolSettings = state.toolSettings || {}; state.toolSettings.marker = state.toolSettings.marker || {};
          state.toolSettings.marker.color = firstHex;
          if (state.tool === 'marker') state.color = firstHex;
          tintSizeIcons($('markerSizeRow'), firstHex);
        }
      }
    }
    const markerSizeRow = $('markerSizeRow');
    if (markerSizeRow && markerSizeRow.children.length === 0) {
      const sizes = [12,16,24,32,48];
      sizes.forEach((w, idx) => {
        const btn = document.createElement('button');
        btn.className = 'size-btn'; btn.type = 'button';
  btn.innerHTML = sizeSvgs[idx]; btn.setAttribute('aria-label', (tr('aria.stroke_width','Stroke width') + ' ' + w));
        btn.addEventListener('click', () => {
          state.width = w;
          // persist per-tool width
          state.toolSettings = state.toolSettings || {}; state.toolSettings.marker = state.toolSettings.marker || {};
          state.toolSettings.marker.width = w;
          markerSizeRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          if (state.tool === 'marker' && typeof applyCursor === 'function') applyCursor();
        });
  if (state.width === w) btn.classList.add('selected');
        markerSizeRow.appendChild(btn);
      });
      tintSizeIcons(markerSizeRow, state.color);
    }
  }

  function buildArrowUI(state, applyCursor){
    const grid = document.getElementById('arrowColorGrid');
    if (grid && grid.children.length === 0) {
      palette.forEach((hex) => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch'; sw.style.backgroundColor = hex;
        try { sw.dataset.hex = String(hex).toLowerCase(); } catch(_) {}
  sw.setAttribute('role','button'); sw.setAttribute('tabindex','0'); sw.setAttribute('aria-label', (tr('aria.colors','Colors') + ' ' + hex));
        sw.addEventListener('click', () => {
          state.color = hex;
          state.toolSettings = state.toolSettings || {}; state.toolSettings.arrow = state.toolSettings.arrow || {};
          state.toolSettings.arrow.color = hex;
          grid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          sw.classList.add('selected');
          tintSizeIcons(document.getElementById('arrowSizeRow'), hex);
        });
        if (state.color && state.color.toLowerCase() === hex.toLowerCase()) sw.classList.add('selected');
        grid.appendChild(sw);
      });
      if (!grid.querySelector('.color-swatch.selected') && grid.firstElementChild) {
        const first = grid.firstElementChild;
        const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
        first.classList.add('selected');
        if (firstHex) {
          state.toolSettings = state.toolSettings || {}; state.toolSettings.arrow = state.toolSettings.arrow || {};
          state.toolSettings.arrow.color = firstHex;
          if (state.tool === 'arrow') state.color = firstHex;
          tintSizeIcons(document.getElementById('arrowSizeRow'), firstHex);
        }
      }
    }
    const sizeRow = document.getElementById('arrowSizeRow');
    if (sizeRow && sizeRow.children.length === 0) {
      const sizes = [2,4,6,8,12];
      sizes.forEach((w, idx) => {
        const btn = document.createElement('button');
        btn.className = 'size-btn'; btn.type = 'button';
  btn.innerHTML = sizeSvgs[idx]; btn.setAttribute('aria-label', (tr('aria.stroke_width','Stroke width') + ' ' + w));
        btn.addEventListener('click', () => {
          state.width = w;
          state.toolSettings = state.toolSettings || {}; state.toolSettings.arrow = state.toolSettings.arrow || {};
          state.toolSettings.arrow.width = w;
          sizeRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          if (state.tool === 'arrow' && typeof applyCursor === 'function') applyCursor();
        });
        if (state.width === w) btn.classList.add('selected');
        sizeRow.appendChild(btn);
      });
      tintSizeIcons(sizeRow, (state.toolSettings && state.toolSettings.arrow && state.toolSettings.arrow.color) ? state.toolSettings.arrow.color : state.color);
    }
  }

  function buildShapesUI(state, applyCursor){
    const grid = $('shapesColorGrid');
    if (grid && grid.children.length === 0) {
      palette.forEach((hex) => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch'; sw.style.backgroundColor = hex;
        try { sw.dataset.hex = String(hex).toLowerCase(); } catch(_) {}
  sw.setAttribute('role','button'); sw.setAttribute('tabindex','0'); sw.setAttribute('aria-label', (tr('aria.colors','Colors') + ' ' + hex));
        sw.addEventListener('click', () => {
          state.color = hex;
          state.toolSettings = state.toolSettings || {}; state.toolSettings.shapes = state.toolSettings.shapes || {};
          state.toolSettings.shapes.color = hex;
          grid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          sw.classList.add('selected');
          tintSizeIcons($('shapesRow'), hex);
        });
        if (state.color && state.color.toLowerCase() === hex.toLowerCase()) sw.classList.add('selected');
        grid.appendChild(sw);
      });
      if (!grid.querySelector('.color-swatch.selected') && grid.firstElementChild) {
        const first = grid.firstElementChild;
        const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
        first.classList.add('selected');
        if (firstHex) {
          state.toolSettings = state.toolSettings || {}; state.toolSettings.shapes = state.toolSettings.shapes || {};
          state.toolSettings.shapes.color = firstHex;
          if (state.tool === 'shapes') state.color = firstHex;
          tintSizeIcons($('shapesRow'), firstHex);
        }
      }
    }

  const row = $('shapesRow');
  if (row && row.children.length === 0) {
      const items = [
        { id: 'line' },
        { id: 'circle' },
        { id: 'triangle' },
        { id: 'square' },
        { id: 'star' }
      ];
      const shapeSvgs = {
        line: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M160-440v-80h640v80H160Z"/></svg>',
        circle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>',
        triangle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="m80-160 400-640 400 640H80Zm144-80h512L480-650 224-240Zm256-205Z"/></svg>',
        square: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M120-120v-720h720v720H120Zm80-80h560v-560H200v560Zm0 0v-560 560Z"/></svg>',
        star: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/></svg>'
      };
      const current = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.kind) ? state.toolSettings.shapes.kind : 'square';
      items.forEach((it) => {
  const btn = document.createElement('button');
  btn.className = 'size-btn'; btn.type = 'button';
  btn.dataset.shapeId = it.id;
  const shapeTitle = tr('shapes.'+it.id, it.id);
  btn.setAttribute('aria-label', shapeTitle);
        // Inline SVG icon using currentColor
        try {
          const tpl = document.createElement('template');
          tpl.innerHTML = (shapeSvgs[it.id] || '').trim();
          const svg = tpl.content.firstElementChild;
          if (svg) { btn.appendChild(svg); }
        } catch(_) {}
        btn.addEventListener('click', () => {
          row.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          state.toolSettings = state.toolSettings || {}; state.toolSettings.shapes = state.toolSettings.shapes || {};
          state.toolSettings.shapes.kind = it.id;
        });
        if (it.id === current) btn.classList.add('selected');
        row.appendChild(btn);
      });
  // No dynamic mount needed for inline SVG
      // Tint icons to the color picked in the Shapes popover by default
      tintSizeIcons(row, (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.color) ? state.toolSettings.shapes.color : state.color);
    }
  }

  function buildEraserUI(state, applyCursor){
    const row = $('eraserSizeRow');
    if (row && row.children.length === 0) {
      const sizes = [4,8,12,16,24];
      sizes.forEach((w, idx) => {
        const btn = document.createElement('button');
        btn.className = 'size-btn'; btn.type = 'button';
  btn.innerHTML = sizeSvgs[idx]; btn.setAttribute('aria-label', (tr('aria.eraser_width','Eraser width') + ' ' + w));
        btn.addEventListener('click', () => {
          state.width = w;
          // persist per-tool width
          state.toolSettings = state.toolSettings || {}; state.toolSettings.eraser = state.toolSettings.eraser || {};
          state.toolSettings.eraser.width = w;
          row.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          if (state.tool === 'eraser' && typeof applyCursor === 'function') applyCursor();
        });
        if (state.width === w) btn.classList.add('selected');
        row.appendChild(btn);
      });
      // eraser icons don't need tinting
    }
  }

  function buildTextUI(state, applyCursor){
    // Load persisted settings once and merge into current state
    state.toolSettings = state.toolSettings || {};
    const savedText = loadTextSettings();
    if (!state.toolSettings.text) state.toolSettings.text = {};
    if (savedText) {
      // Only assign known properties
      const dst = state.toolSettings.text;
      if (savedText.color) dst.color = savedText.color;
      if (savedText.fontSize) dst.fontSize = savedText.fontSize;
      if (typeof savedText.bold === 'boolean') dst.bold = savedText.bold;
      if (typeof savedText.italic === 'boolean') dst.italic = savedText.italic;
      if (typeof savedText.underline === 'boolean') dst.underline = savedText.underline;
    }
    // Popover: color grid
    const grid = $('textColorGrid');
    if (grid) {
      // ensure larger spacing below the palette before the next row
      grid.style.marginBottom = '24px';
    }
    if (grid && grid.children.length === 0) {
      palette.forEach((hex) => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch'; sw.style.backgroundColor = hex;
        try { sw.dataset.hex = String(hex).toLowerCase(); } catch(_) {}
  sw.setAttribute('role','button'); sw.setAttribute('tabindex','0'); sw.setAttribute('aria-label', (tr('aria.text_color','Text color') + ' ' + hex));
        sw.addEventListener('click', () => {
          // persist and apply
          state.color = hex;
          state.toolSettings = state.toolSettings || {}; state.toolSettings.text = state.toolSettings.text || {};
          state.toolSettings.text.color = hex;
          saveTextSettings(state.toolSettings.text);
          grid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          sw.classList.add('selected');
          // apply to selected text shape if any
          const sel = window.BoardToolCursor && BoardToolCursor._sel && BoardToolCursor._sel.kind==='text' ? BoardToolCursor._sel : null;
          if (sel) {
            sel.color = hex;
            // no remeasure needed for color only
            if (window.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
            const sctx=(window.BoardWorld&&BoardWorld.getShapesCtx)?BoardWorld.getShapesCtx():null;
            if (sctx && window.BoardVector && BoardVector.redrawAll) BoardVector.redrawAll(sctx);
            if (window.BoardToolCursor && BoardToolCursor.redrawSelection) BoardToolCursor.redrawSelection();
          }
          // apply live to editor if present
          const ed = window.BoardToolText && BoardToolText._editor ? BoardToolText._editor : null;
          if (ed) { ed.style.color = hex; setTimeout(()=>{ try { ed.focus(); } catch(_){} }, 0); }
        });
        if (state.color && state.color.toLowerCase() === hex.toLowerCase()) sw.classList.add('selected');
        grid.appendChild(sw);
      });
      if (!grid.querySelector('.color-swatch.selected') && grid.firstElementChild) {
        const first = grid.firstElementChild;
        const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
        first.classList.add('selected');
        if (firstHex) {
          state.toolSettings = state.toolSettings || {}; state.toolSettings.text = state.toolSettings.text || {};
          state.toolSettings.text.color = firstHex;
          if (state.tool === 'text') state.color = firstHex;
          saveTextSettings(state.toolSettings.text);
        }
      }
    }
    // Popover: text size via dropdown
    const sizeRow = $('textSizeRow');
    if (sizeRow && !sizeRow.querySelector('#textSizeSelect')) {
      const sizes = [8,9,11,12,14,16,18,20,22,24,26,28,36,48,72];
      const select = document.createElement('select');
  select.id = 'textSizeSelect';
  select.setAttribute('aria-label', tr('aria.text_size','Text size'));
  // keep it compact to fit one line with style buttons; same height as buttons
  select.style.width = '64px';
  select.style.height = '28px';
  select.style.lineHeight = '28px';
  select.style.padding = '2px 6px';
  select.style.boxSizing = 'border-box';
  // allow CSS width control; no minWidth here
      sizes.forEach((w)=>{
        const opt = document.createElement('option');
        opt.value = String(w);
        opt.textContent = String(w); // compact label to fit inline
        select.appendChild(opt);
      });
      // initial value from tool settings or default
      const init = (state.toolSettings && state.toolSettings.text && state.toolSettings.text.fontSize) || 20;
      select.value = String(init);
  select.addEventListener('change', () => {
        const w = parseInt(select.value, 10) || 20;
        state.toolSettings = state.toolSettings || {}; state.toolSettings.text = state.toolSettings.text || {};
        state.toolSettings.text.fontSize = w;
        saveTextSettings(state.toolSettings.text);
        // Apply to selected text if any
        const sel = window.BoardToolCursor && BoardToolCursor._sel && BoardToolCursor._sel.kind==='text' ? BoardToolCursor._sel : null;
        if (sel) {
          sel.fontSize = w;
          // remeasure bounds for selection hitbox
          try {
            const sctx=(window.BoardWorld&&BoardWorld.getShapesCtx)?BoardWorld.getShapesCtx():null;
            if (sctx && window.BoardVector && window.BoardToolText && BoardToolText._remeasure) {
              BoardToolText._remeasure(sel, sctx);
            }
          } catch(_){}
          if (window.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
          const sctx2=(window.BoardWorld&&BoardWorld.getShapesCtx)?BoardWorld.getShapesCtx():null;
          if (sctx2 && window.BoardVector && BoardVector.redrawAll) BoardVector.redrawAll(sctx2);
          if (window.BoardToolCursor && BoardToolCursor.redrawSelection) BoardToolCursor.redrawSelection();
        }
        // Apply live to editor
  const ed = window.BoardToolText && BoardToolText._editor ? BoardToolText._editor : null;
  if (ed) { ed.style.fontSize = w + 'px'; setTimeout(()=>{ try { ed.focus(); } catch(_){} }, 0); }
      });
      sizeRow.appendChild(select);
    }
    // Popover: style buttons
    const row = $('textStyleRow');
    if (row && row.children.length === 0) {
      const btns = [
        { id: 'bold', label: 'B', style: 'font-weight:700;' },
        { id: 'italic', label: 'I', style: 'font-style:italic;' },
        { id: 'underline', label: 'U', style: 'text-decoration:underline;' }
      ];
      btns.forEach(it => {
        const b = document.createElement('button');
        b.className = 'size-btn'; b.type = 'button'; b.setAttribute('aria-pressed','false');
        b.setAttribute('aria-label', tr('text.'+it.id, it.id));
    // Stable key for sync
    b.dataset.styleId = it.id;
        const span = document.createElement('span'); span.textContent = it.label; span.style.cssText = 'font-size:14px;'+it.style;
        b.appendChild(span);
        b.addEventListener('click', () => {
          state.toolSettings = state.toolSettings || {}; state.toolSettings.text = state.toolSettings.text || {};
          const cur = !!state.toolSettings.text[it.id];
          state.toolSettings.text[it.id] = !cur;
          b.classList.toggle('selected', !cur);
          b.setAttribute('aria-pressed', !cur ? 'true' : 'false');
          saveTextSettings(state.toolSettings.text);
          // apply to selected text shape
          const sel = window.BoardToolCursor && BoardToolCursor._sel && BoardToolCursor._sel.kind==='text' ? BoardToolCursor._sel : null;
          if (sel) {
            sel[it.id] = !cur;
            // remeasure bounds because font metrics may change
            try {
              const sctx=(window.BoardWorld&&BoardWorld.getShapesCtx)?BoardWorld.getShapesCtx():null;
              if (sctx && window.BoardVector && window.BoardToolText && BoardToolText._remeasure) {
                BoardToolText._remeasure(sel, sctx);
              }
            } catch(_){}
            if (window.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
            const sctx2=(window.BoardWorld&&BoardWorld.getShapesCtx)?BoardWorld.getShapesCtx():null;
            if (sctx2 && window.BoardVector && BoardVector.redrawAll) BoardVector.redrawAll(sctx2);
            if (window.BoardToolCursor && BoardToolCursor.redrawSelection) BoardToolCursor.redrawSelection();
          }
          // apply live to editor
          const ed = window.BoardToolText && BoardToolText._editor ? BoardToolText._editor : null;
          if (ed) {
            if (it.id === 'bold') ed.style.fontWeight = state.toolSettings.text.bold ? '700' : '400';
            if (it.id === 'italic') ed.style.fontStyle = state.toolSettings.text.italic ? 'italic' : 'normal';
            if (it.id === 'underline') ed.style.textDecoration = state.toolSettings.text.underline ? 'underline' : 'none';
      // keep editor active for continuous typing
      setTimeout(()=>{ try { ed.focus(); } catch(_){} }, 0);
          }
        });
        // initial pressed state from saved/current settings
        const flags = (state.toolSettings && state.toolSettings.text) ? state.toolSettings.text : {};
        const on = !!flags[it.id];
        if (on) b.classList.add('selected');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        row.appendChild(b);
      });
      // merge style buttons into one row with size select
      try {
        const sizeRowEl = document.getElementById('textSizeRow');
        if (sizeRowEl) {
          sizeRowEl.style.display = 'flex';
          sizeRowEl.style.alignItems = 'center';
          sizeRowEl.style.gap = '8px';
          sizeRowEl.style.width = '100%';
          sizeRowEl.style.flexWrap = 'nowrap';
          sizeRowEl.style.justifyContent = 'flex-start';
          // move all style buttons after the select
          while (row.firstChild) {
            const btn = row.firstChild;
            sizeRowEl.appendChild(btn);
          }
          row.style.display = 'none';
          // normalize style buttons size to match select height
          Array.from(sizeRowEl.querySelectorAll('button.size-btn')).forEach(b => {
            b.style.width = '28px';
            b.style.height = '28px';
            b.style.display = 'inline-flex';
            b.style.alignItems = 'center';
            b.style.justifyContent = 'center';
            const sp = b.querySelector('span'); if (sp) sp.style.lineHeight = '1';
          });
        }
      } catch(_){}
    }
    // No bottom inspector in popover mode
  }

  function buildBackgroundUI(){
    const row = document.getElementById('backgroundRow');
    if (!row || row.children.length) return;

    // Prevent outside-close when interacting inside the background popover
    const pop = document.getElementById('backgroundPopover');
    if (pop) {
      // Prevent outside-close (document pointerdown) from firing, but allow click handlers on children
      pop.addEventListener('pointerdown', (e)=> e.stopPropagation(), true);
    }

  // selection state (no persistence): default to 'base' every session
  let selectedId = 'base';

    // Color swatches row above icons
  const colorRow = document.createElement('div');
  colorRow.className = 'color-row';
  colorRow.style.display = 'flex';
  colorRow.style.gap = '6px';
  colorRow.style.marginBottom = '12px';
  colorRow.style.justifyContent = 'flex-start';
    ['pointerdown','mousedown','click','touchstart'].forEach(evt => colorRow.addEventListener(evt, e => e.stopPropagation()));
    const colors = ['#9aa1a8','#d0d5d8', '#0b4ea2','#8cb6ff', '#b71c1c','#ff8a80']; // gray dark/light, blue dark/light, red dark/light
    const current = (window.BoardBackground && BoardBackground.getPatternColor) ? BoardBackground.getPatternColor() : colors[1];
    colors.forEach(hex => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'color-swatch';
      sw.style.width = '20px';
      sw.style.height = '20px';
      sw.style.borderRadius = '4px';
      sw.style.border = '1px solid rgba(0,0,0,0.15)';
      sw.style.background = hex;
      if (String(current).toLowerCase() === hex.toLowerCase()) sw.classList.add('selected');
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        Array.from(colorRow.children).forEach(el => el.classList.remove('selected'));
        sw.classList.add('selected');
        if (window.BoardBackground && BoardBackground.setPatternColor) BoardBackground.setPatternColor(hex);
      });
      colorRow.appendChild(sw);
    });
    const popEl = document.getElementById('backgroundPopover');
    if (popEl) popEl.insertBefore(colorRow, row);

    const items = [
      { id: 'base',   onClick: ()=> setSel('base', ()=> BoardBackground && BoardBackground.set && BoardBackground.set('plain')) },
      { id: 'dot',    onClick: ()=> setSel('dot',  ()=> BoardBackground && BoardBackground.set && BoardBackground.set('dots')) },
      { id: 'grid',   onClick: ()=> setSel('grid', ()=> BoardBackground && BoardBackground.set && BoardBackground.set('grid')) },
      { id: 'lines',  onClick: ()=> setSel('lines',()=> BoardBackground && BoardBackground.set && BoardBackground.set('ruled')) }
    ];

    const btnMap = new Map();

  function setSel(id, apply){
      btnMap.forEach((b, key)=> b.classList.toggle('selected', key === id));
      if (typeof apply === 'function') apply();
    }

  // Upload option removed: no file input, no handler

    // Inline SVGs for background options using currentColor
    const bgSvgs = {
      base:  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0 0v-560 560Z"/></svg>',
      dot:   '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M300-240q25 0 42.5-17.5T360-300q0-25-17.5-42.5T300-360q-25 0-42.5 17.5T240-300q0 25 17.5 42.5T300-240Zm0-360q25 0 42.5-17.5T360-660q0-25-17.5-42.5T300-720q-25 0-42.5 17.5T240-660q0 25 17.5 42.5T300-600Zm0 180q25 0 42.5-17.5T360-480q0-25-17.5-42.5T300-540q-25 0-42.5 17.5T240-480q0 25 17.5 42.5T300-420Zm360 180q25 0 42.5-17.5T720-300q0-25-17.5-42.5T660-360q-25 0-42.5 17.5T600-300q0 25 17.5 42.5T660-240Zm0-360q25 0 42.5-17.5T720-660q0-25-17.5-42.5T660-720q-25 0-42.5 17.5T600-660q0 25 17.5 42.5T660-600ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Zm460 340q25 0 42.5-17.5T720-480q0-25-17.5-42.5T660-540q-25 0-42.5 17.5T600-480q0 25 17.5 42.5T660-420ZM480-600q25 0 42.5-17.5T540-660q0-25-17.5-42.5T480-720q-25 0-42.5 17.5T420-660q0 25 17.5 42.5T480-600Zm0 360q25 0 42.5-17.5T540-300q0-25-17.5-42.5T480-360q-25 0-42.5 17.5T420-300q0 25 17.5 42.5T480-240Zm0-180q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Z"/></svg>',
      grid:  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h133v-133H200v133Zm213 0h134v-133H413v133Zm214 0h133v-133H627v133ZM200-413h133v-134H200v134Zm213 0h134v-134H413v134Zm214 0h133v-134H627v134ZM200-627h133v-133H200v133Zm213 0h134v-133H413v133Zm214 0h133v-133H627v133Z"/></svg>',
      lines: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="M760-360v-80H200v80h560Zm0-160v-80H200v80h560Zm0-160v-80H200v80h560ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm560-80v-80H200v80h560Z"/></svg>'
    };

    items.forEach(it => {
  const btn = document.createElement('button');
  btn.className = 'size-btn'; btn.type = 'button';
  const title = tr('background.'+it.id, it.id);
  btn.setAttribute('aria-label', title);
      // Inline SVG icon using currentColor
      try {
        const tpl = document.createElement('template');
        tpl.innerHTML = (bgSvgs[it.id] || '').trim();
        const svg = tpl.content.firstElementChild;
        if (svg) { btn.appendChild(svg); }
      } catch(_) {}
      // prevent popover from closing when selecting
      btn.addEventListener('pointerdown', (e)=> e.stopPropagation());
      btn.addEventListener('click', (e)=> { e.stopPropagation(); it.onClick(); });
      if (selectedId === it.id) btn.classList.add('selected');
      btnMap.set(it.id, btn);
      row.appendChild(btn);
    });

    // Scale slider under icons
  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'bg-scale-row';
    // prevent outside-close when interacting with the slider area
    ['pointerdown','mousedown','click','touchstart'].forEach(evt => {
      sliderWrap.addEventListener(evt, (e)=> e.stopPropagation());
    });

    const slider = document.createElement('input');
    slider.type = 'range';
  slider.min = '50';
  slider.max = '300';
  slider.step = '50';
  const initScale = (window.BoardBackground && BoardBackground.getScale) ? BoardBackground.getScale() : 1.0;
    slider.value = String(Math.round(initScale * 100));
  slider.style.flex = '1';
    ['pointerdown','mousedown','click','touchstart'].forEach(evt => {
      slider.addEventListener(evt, (e)=> e.stopPropagation());
    });

  const valueView = document.createElement('span');
  valueView.className = 'bg-scale-value';
    valueView.textContent = slider.value + '%';
    ['pointerdown','mousedown','click','touchstart'].forEach(evt => {
      valueView.addEventListener(evt, (e)=> e.stopPropagation());
    });

    slider.addEventListener('input', () => {
      const pct = Math.max(50, Math.min(300, parseInt(slider.value || '100', 10)));
      valueView.textContent = pct + '%';
      if (window.BoardBackground && BoardBackground.setScale) {
        BoardBackground.setScale(pct / 100);
      }
    });

    sliderWrap.appendChild(slider);
    sliderWrap.appendChild(valueView);
  const popContent = document.getElementById('backgroundPopover');
  if (popContent) popContent.appendChild(sliderWrap);
  // No dynamic mount needed for inline SVG
  }

  function init(state, applyCursor){
    buildPencilUI(state, applyCursor);
    buildMarkerUI(state, applyCursor);
    buildEraserUI(state, applyCursor);
  buildShapesUI(state, applyCursor);
  buildArrowUI(state, applyCursor);
    buildTextUI(state, applyCursor);
    buildBackgroundUI();
  // Ensure all popovers ignore clicks on their empty space
  hardenPopoversAgainstInsideClicks();
    // outside-close handlers
  initOutsideClose('pencilPopover','toolPencil', (o)=>togglePopover('pencilPopover', o));
  initOutsideClose('markerPopover','toolMarker', (o)=>togglePopover('markerPopover', o));
  initOutsideClose('eraserPopover','toolEraser', (o)=>togglePopover('eraserPopover', o));
  initOutsideClose('shapesPopover','toolShapes', (o)=>togglePopover('shapesPopover', o));
  initOutsideClose('arrowPopover','toolArrow', (o)=>togglePopover('arrowPopover', o));
  // Close Text popover on outside click
  initOutsideClose('textPopover','toolText', (o)=>togglePopover('textPopover', o));
  // When background popover closes by outside click, also clear button highlight
  initOutsideClose('backgroundPopover','toolBackground', (o)=>{ togglePopover('backgroundPopover', o); setBackgroundButtonActive(o); });
  }

  global.ToolsUI = {
    init,
    togglePencilPopover: (open)=>togglePopover('pencilPopover', open),
    toggleMarkerPopover: (open)=>togglePopover('markerPopover', open),
    toggleEraserPopover: (open)=>togglePopover('eraserPopover', open),
  toggleBackgroundPopover: (open)=>{
      togglePopover('backgroundPopover', open);
      setBackgroundButtonActive(!!open);
      if (open) {
        try {
          const pop = document.getElementById('backgroundPopover');
          if (window.Icons && Icons.mount) Icons.mount(pop || document);
          if (window.Icons && Icons.retint) Icons.retint(pop || document);
        } catch(_) {}
      }
    },
    toggleShapesPopover: (open)=>togglePopover('shapesPopover', open),
  toggleArrowPopover: (open)=>togglePopover('arrowPopover', open),
  toggleTextPopover: (open)=>togglePopover('textPopover', open),
  // no text inspector in popover mode
  closeAllPopovers,
  openForTool,
    refreshThemeAssets: () => {
      try {
        if (window.Icons && Icons.mount) Icons.mount(document);
        if (window.Icons && Icons.retint) Icons.retint(document);
      } catch(_) {}
    },
    // Sync UI selections to current state for per-tool settings
    syncSelections: (state) => {
      try {
        // Pencil UI
        const pRow = $('pencilSizeRow');
        if (pRow) {
          pRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          const sizes = [2,4,6,8,12];
          const idx = sizes.indexOf(state.width);
          if (idx >= 0 && pRow.children[idx]) pRow.children[idx].classList.add('selected');
          tintSizeIcons(pRow, state.color);
        }
        const pGrid = $('pencilColorGrid');
        if (pGrid) {
          pGrid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          const ts = state.toolSettings || {};
          let desired = (ts.pencil && ts.pencil.color) ? String(ts.pencil.color).toLowerCase() : String(state.color || '').toLowerCase();
          let found = false;
          Array.from(pGrid.children).forEach(sw => {
            const h = (sw.dataset && sw.dataset.hex) ? sw.dataset.hex.toLowerCase() : '';
            if (h === desired) { sw.classList.add('selected'); found = true; }
          });
          if (!found && pGrid.firstElementChild) {
            const first = pGrid.firstElementChild;
            first.classList.add('selected');
            const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
            if (firstHex) {
              state.toolSettings = state.toolSettings || {}; state.toolSettings.pencil = state.toolSettings.pencil || {};
              state.toolSettings.pencil.color = firstHex;
              if (state.tool === 'pencil') state.color = firstHex;
              tintSizeIcons(pRow, firstHex);
            }
          }
        }
        // Marker UI
        const mRow = $('markerSizeRow');
        if (mRow) {
          mRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          const sizesM = [12,16,24,32,48];
          const idxM = sizesM.indexOf(state.width);
          if (idxM >= 0 && mRow.children[idxM]) mRow.children[idxM].classList.add('selected');
          tintSizeIcons(mRow, state.color);
        }
        const mGrid = $('markerColorGrid');
        if (mGrid) {
          mGrid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          const ts = state.toolSettings || {};
          let desiredM = (ts.marker && ts.marker.color) ? String(ts.marker.color).toLowerCase() : String(state.color || '').toLowerCase();
          let foundM = false;
          Array.from(mGrid.children).forEach(sw => {
            const h = (sw.dataset && sw.dataset.hex) ? sw.dataset.hex.toLowerCase() : '';
            if (h === desiredM) { sw.classList.add('selected'); foundM = true; }
          });
          if (!foundM && mGrid.firstElementChild) {
            const first = mGrid.firstElementChild;
            first.classList.add('selected');
            const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
            if (firstHex) {
              state.toolSettings = state.toolSettings || {}; state.toolSettings.marker = state.toolSettings.marker || {};
              state.toolSettings.marker.color = firstHex;
              if (state.tool === 'marker') state.color = firstHex;
              tintSizeIcons(mRow, firstHex);
            }
          }
        }
        // Eraser UI
        const eRow = $('eraserSizeRow');
        if (eRow) {
          eRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          const sizesE = [4,8,12,16,24];
          const idxE = sizesE.indexOf(state.width);
          if (idxE >= 0 && eRow.children[idxE]) eRow.children[idxE].classList.add('selected');
        }
        // Arrow UI
        const aRow = document.getElementById('arrowSizeRow');
        if (aRow) {
          aRow.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          const sizesA = [2,4,6,8,12];
          const idxA = sizesA.indexOf(state.width);
          if (idxA >= 0 && aRow.children[idxA]) aRow.children[idxA].classList.add('selected');
          const gridA = document.getElementById('arrowColorGrid');
          if (gridA) {
            gridA.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
            const ts = state.toolSettings || {}; let desired = (ts.arrow && ts.arrow.color) ? String(ts.arrow.color).toLowerCase() : String(state.color || '').toLowerCase();
            let found = false;
            Array.from(gridA.children).forEach(sw => {
              const h = (sw.dataset && sw.dataset.hex) ? sw.dataset.hex.toLowerCase() : '';
              if (h === desired) { sw.classList.add('selected'); found = true; }
            });
            if (!found && gridA.firstElementChild) {
              const first = gridA.firstElementChild; first.classList.add('selected');
              const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
              if (firstHex) { state.toolSettings = state.toolSettings || {}; state.toolSettings.arrow = state.toolSettings.arrow || {}; state.toolSettings.arrow.color = firstHex; if (state.tool === 'arrow') state.color = firstHex; }
            }
          }
        }
        // Shapes UI
        const shapesRowEl = $('shapesRow');
        if (shapesRowEl) {
          shapesRowEl.querySelectorAll('.size-btn').forEach(el => el.classList.remove('selected'));
          const want = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.kind) ? state.toolSettings.shapes.kind : 'square';
          let found = false;
          Array.from(shapesRowEl.children).forEach(btn => {
            const sid = (btn.dataset && btn.dataset.shapeId) ? btn.dataset.shapeId : (btn.getAttribute('aria-label') || '');
            if (sid === want) { btn.classList.add('selected'); found = true; }
          });
          if (!found) {
            // fallback to 'square' or first
            let target = Array.from(shapesRowEl.children).find(btn => (btn.getAttribute('aria-label') || '') === 'square') || shapesRowEl.firstElementChild;
            if (target) {
              target.classList.add('selected');
              const lbl = target.getAttribute('aria-label') || 'square';
              state.toolSettings = state.toolSettings || {}; state.toolSettings.shapes = state.toolSettings.shapes || {};
              state.toolSettings.shapes.kind = lbl;
            }
          }
          const scolor = (state.toolSettings && state.toolSettings.shapes && state.toolSettings.shapes.color) ? state.toolSettings.shapes.color : state.color;
          tintSizeIcons(shapesRowEl, scolor);
        }

        // Shapes color grid selection
        const sGrid = $('shapesColorGrid');
        if (sGrid) {
          sGrid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
          const ts = state.toolSettings || {}; const sc = ts.shapes && ts.shapes.color ? String(ts.shapes.color).toLowerCase() : String(state.color || '').toLowerCase();
          let foundS = false;
          Array.from(sGrid.children).forEach(sw => {
            const h = (sw.dataset && sw.dataset.hex) ? sw.dataset.hex.toLowerCase() : '';
            if (h === sc) { sw.classList.add('selected'); foundS = true; }
          });
          if (!foundS && sGrid.firstElementChild) {
            const first = sGrid.firstElementChild;
            first.classList.add('selected');
            const firstHex = (first.dataset && first.dataset.hex) ? first.dataset.hex : null;
            if (firstHex) {
              state.toolSettings = state.toolSettings || {}; state.toolSettings.shapes = state.toolSettings.shapes || {};
              state.toolSettings.shapes.color = firstHex;
              if (state.tool === 'shapes') state.color = firstHex;
              if (shapesRowEl) tintSizeIcons(shapesRowEl, firstHex);
            }
          }
        }
        // Sync Text popover with current selection or defaults
        const sel = window.BoardToolCursor && BoardToolCursor._sel && BoardToolCursor._sel.kind === 'text' ? BoardToolCursor._sel : null;
        const targetColor = sel ? (sel.color || state.color) : (state.toolSettings && state.toolSettings.text && state.toolSettings.text.color) ? state.toolSettings.text.color : state.color;
        const textGridEl = $('textColorGrid');
        if (textGridEl) {
          textGridEl.querySelectorAll('.color-swatch').forEach(el => {
            el.classList.toggle('selected', (el.dataset && el.dataset.hex) ? el.dataset.hex.toLowerCase() === String(targetColor||'').toLowerCase() : false);
          });
        }
  let textStyleRowEl = $('textStyleRow');
  // if style row hidden/empty, use size row as unified container
  if (!textStyleRowEl || !textStyleRowEl.children.length) textStyleRowEl = $('textSizeRow');
  if (textStyleRowEl) {
          const flags = sel || (state.toolSettings && state.toolSettings.text) || {};
          Array.from(textStyleRowEl.children).forEach(btn => {
            const id = (btn.dataset && btn.dataset.styleId) ? btn.dataset.styleId : null;
            if (id) btn.classList.toggle('selected', !!flags[id]);
          });
        }
        const textSizeRowEl = $('textSizeRow');
        if (textSizeRowEl) {
          const select = textSizeRowEl.querySelector('#textSizeSelect');
          if (select) {
            const cur = sel ? (sel.fontSize || 20) : ((state.toolSettings && state.toolSettings.text && state.toolSettings.text.fontSize) || 20);
            select.value = String(cur);
          }
        }
      } catch(_) {}
    }
  };
})(typeof window !== 'undefined' ? window : this);
