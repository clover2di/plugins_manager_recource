'use strict';

(function initCanvasMenu(global){
  // Minimal self-contained canvas context menu. Exposes init(canvas, opts)
  // mkItem will be defined inside buildMenu so it can access the created menu and hide it on click

  function buildMenu(id, tr, actions, toolsQuick, toolLabels, state, helpers){
    if (document.getElementById(id)) return document.getElementById(id);
    const menu = document.createElement('div');
    menu.id = id;
    menu.setAttribute('role','menu');
  // Static visuals (position, size, colors, padding, etc.) are handled in CSS
  // Keep only dynamic positioning/visibility in JS (left/top/display are set when showing/hiding)
    
    // create items with behavior; rely on CSS for visuals
      // create items with behavior; rely on CSS for visuals
  // Paste is unlocked by default; clicking the Paste item calls the provided
  // actions.paste() directly. We keep diagnostics but avoid synthetic key events.

      function mkItem(text, key, cb) {
      const it = document.createElement('div');
      it.className = 'context-item';
      it.setAttribute('role','menuitem');
      it.tabIndex = -1;
      it.textContent = text;
      it.dataset.key = key || '';
      it.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('contextMenu.click', key || it.dataset.key); else console.debug && console.debug('contextMenu.click', key || it.dataset.key); } catch(_){ }
        try { hideMenu(menu); } catch(_){ }
        try {
            // Special-case paste: attempt to simulate Ctrl+V (best-effort with fallbacks)
            if ((key || it.dataset.key) === 'paste') {
              try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('contextMenu.paste.invoke'); else console.debug && console.debug('contextMenu.paste.invoke'); } catch(_){ }
                try {
                  if (typeof cb === 'function') {
                    try {
                      const res = cb();
                      try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('contextMenu.paste.result', res); else console.debug && console.debug('contextMenu.paste.result', res); } catch(_){}
                    } catch(err) { try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('contextMenu.paste.error', err && err.message); else console.warn && console.warn('contextMenu.paste.error', err); } catch(_){} }
                  } else {
                    try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('contextMenu.paste.missingCb'); else console.warn && console.warn('contextMenu.paste.missingCb'); } catch(_){ }
                  }
                } catch(err) { try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('contextMenu.paste.error', err && err.message); else console.warn && console.warn('contextMenu.paste.error', err); } catch(_){} }
            } else {
              cb && cb();
            }
        } catch(err){ try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('contextMenu.cb.error', err && err.message); else console.warn && console.warn('contextMenu.cb.error', err); } catch(_){} }
      });
      return it;
    }
  // Actions
  menu.appendChild(mkItem(tr('actions.undo','Undo'), 'undo', actions.undo));
  menu.appendChild(mkItem(tr('actions.redo','Redo'), 'redo', actions.redo));
  // create paste item and keep a reference so we can enable/disable it
  const pasteItem = mkItem(tr('actions.paste','Paste'), 'paste', actions.paste);
  menu.appendChild(pasteItem);
  // Extra safety: ensure paste item always invokes the provided paste action directly
  try {
    pasteItem.addEventListener('click', function(ev){
      try { ev.preventDefault(); ev.stopPropagation(); } catch(_){}
      try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('contextMenu.paste.directInvoke'); else console.debug && console.debug('contextMenu.paste.directInvoke'); } catch(_){ }
      try {
        if (actions && typeof actions.paste === 'function') {
          try { actions.paste(); } catch(err) { try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('contextMenu.paste.direct.error', err && err.message); else console.warn && console.warn('contextMenu.paste.direct.error', err); } catch(_){} }
        } else {
          try { document.execCommand && document.execCommand('paste'); } catch(_){}
        }
      } catch(_){}
    });
  } catch(_){}

    // separator
    const sep = document.createElement('div'); sep.style.height = '1px'; sep.style.margin = '6px 0'; sep.style.background = 'var(--border-color)'; menu.appendChild(sep);

    // Tools
    toolsQuick.forEach(tk => {
      menu.appendChild(mkItem(toolLabels[tk] || tk, 'tool_' + tk, () => {
        try {
          // set active tool state
          state.tool = tk === 'cursor' ? 'cursor' : tk;
          if (helpers && typeof helpers.applyToolSettingsFromStore === 'function') helpers.applyToolSettingsFromStore(state.tool);
          // compute toolbar button id (e.g. 'pencil' -> 'toolPencil')
          try {
            var btnId = 'tool' + (state.tool.charAt(0).toUpperCase() + state.tool.slice(1));
          } catch(_) { var btnId = '' }
          if (helpers && typeof helpers.updateActive === 'function') try { helpers.updateActive(btnId); } catch(_){}
          if (helpers && typeof helpers.updateBottomActive === 'function') try { helpers.updateBottomActive(btnId); } catch(_){}
          if (helpers && helpers.ToolsUI && typeof helpers.ToolsUI.syncSelections === 'function') try { helpers.ToolsUI.syncSelections(state); } catch(_){}
          if (helpers && typeof helpers.applyCanvasCursor === 'function') helpers.applyCanvasCursor();
          // Do not open tool popovers when selecting from context menu; only set the tool and update UI state
        } catch(_){ }
      }));
    });

    // Keep Paste enabled by default (unlocked). The menu will still attempt to
    // detect clipboard content for diagnostics but will not disable the item.
    menu._updatePasteAvailability = async function(){
      if (!pasteItem) return;
      try {
        let available = false;
        if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
          try {
            const items = await navigator.clipboard.read();
            if (items && items.length) {
              for (const it of items) {
                const types = it.types || [];
                for (const t of types) {
                  if (String(t).startsWith('image/')) { available = true; break; }
                }
                if (available) break;
              }
            }
          } catch(_) { /* ignore permission errors */ }
        }
        if (!available && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
          try {
            const text = await navigator.clipboard.readText();
            if (text && String(text).trim().length > 0) available = true;
          } catch(_) { /* ignore */ }
        }
        try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('contextMenu.pasteAvailability', available); else console.debug && console.debug('contextMenu.pasteAvailability', available); } catch(_){ }
        // Always keep paste enabled visually and for interaction
        pasteItem.removeAttribute('aria-disabled');
        pasteItem.style.opacity = '';
        pasteItem.style.pointerEvents = '';
      } catch(_) {
        // On error, still ensure paste is interactive
        try { pasteItem.removeAttribute('aria-disabled'); pasteItem.style.opacity = ''; pasteItem.style.pointerEvents = ''; } catch(_){ }
      }
    };

    document.body.appendChild(menu);
    return menu;
  }

  function showMenu(menu, x, y){
    if (!menu) return;
  try { if (typeof menu._updatePasteAvailability === 'function') menu._updatePasteAvailability(); } catch(_){}
  menu.style.left = (x + 2) + 'px';
  menu.style.top = (y + 2) + 'px';
  menu.style.display = 'block';
  try { window.__ibContextMenuOpenedAt = Date.now(); } catch(_) {}
  // Do not autofocus any menu item to avoid accidental highlight; keep keyboard focus handling optional
    // only hide when pointerdown occurs outside the menu
    const onKey = (e) => { if (e.key === 'Escape') { hideMenu(menu); document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKey); } };
    const onPointerDown = (ev) => {
      try {
        if (!menu.contains(ev.target)) {
          hideMenu(menu);
          document.removeEventListener('pointerdown', onPointerDown);
          document.removeEventListener('keydown', onKey);
        }
      } catch(_) {
        // fallback: always remove handlers if something goes wrong
        hideMenu(menu);
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
  }
  function hideMenu(menu){ if (!menu) return; menu.style.display = 'none'; }

  function init(canvas, opts){
    if (!canvas) return;
    const id = opts && opts.id ? opts.id : 'boardContextMenu';
    const tr = (opts && opts.tr) ? opts.tr : function(k,d){return d;};
    const actions = opts && opts.actions ? opts.actions : { undo: ()=>{}, redo: ()=>{}, paste: ()=>{} };
    const toolsQuick = opts && opts.toolsQuick ? opts.toolsQuick : ['cursor','pencil','marker','shapes','arrow','text','eraser'];
    const toolLabels = opts && opts.toolLabels ? opts.toolLabels : {};
    const state = opts && opts.state ? opts.state : (window.boardState || {});
    const helpers = opts && opts.helpers ? opts.helpers : {};

    const menu = buildMenu(id, tr, actions, toolsQuick, toolLabels, state, helpers);
    canvas.addEventListener('contextmenu', function(e){ try { e.preventDefault(); } catch(_){}; showMenu(menu, e.clientX, e.clientY); return false; });
    return { menu, show: (x,y)=>showMenu(menu,x,y), hide: ()=>hideMenu(menu) };
  }

  global.CanvasMenu = { init };
})(typeof window !== 'undefined' ? window : this);
