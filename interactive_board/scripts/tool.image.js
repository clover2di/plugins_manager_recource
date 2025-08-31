'use strict';

(function initImage(global){
  const MAX_DIM = 2048; // upper bound, will adapt to viewport as well

  function pickTargetSize(srcW, srcH){
    // Fit to viewport with margin, and cap by MAX_DIM
    const wrap = document.getElementById('canvasWrapper');
    const rect = wrap ? wrap.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const fitMargin = 0.9;
    const maxW = Math.max(1, Math.floor(rect.width * fitMargin));
    const maxH = Math.max(1, Math.floor(rect.height * fitMargin));
    const cap = Math.min(MAX_DIM, Math.max(maxW, maxH));
    const scale = Math.min(1, cap / Math.max(srcW, srcH));
    return { w: Math.max(1, Math.round(srcW * scale)), h: Math.max(1, Math.round(srcH * scale)) };
  }

  async function downscaleImageAny(img){
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const tgt = pickTargetSize(w, h);
    if (tgt.w >= w && tgt.h >= h) return { bitmap: null, canvas: null, width: w, height: h };
    // Prefer createImageBitmap for off-thread decode/resize
    try {
      if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(img, { resizeWidth: tgt.w, resizeHeight: tgt.h, resizeQuality: 'high' });
        return { bitmap: bmp, canvas: null, width: tgt.w, height: tgt.h };
      }
    } catch(_) { /* fallback below */ }
    // Fallback: canvas downscale
    const c = document.createElement('canvas');
    c.width = tgt.w; c.height = tgt.h;
    const cctx = c.getContext('2d');
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(img, 0, 0, tgt.w, tgt.h);
    return { bitmap: null, canvas: c, width: tgt.w, height: tgt.h };
  }

  function centerInVisible(width, height){
    const wrap = document.getElementById('canvasWrapper');
    const rect = wrap ? wrap.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left:0, top:0 };
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return { cx, cy, vw: rect.width, vh: rect.height };
  }

  function fileToImage(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
  img.onload = () => resolve({ img, url });
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }

  async function handleFiles(list){
    if (!list || !list.length) return;
    const file = list[0];
    try {
      const { img, url } = await fileToImage(file);
      let w = img.naturalWidth, h = img.naturalHeight;
      let source = img;
      const scaled = await downscaleImageAny(img);
      if (scaled.bitmap) { source = scaled.bitmap; w = scaled.width; h = scaled.height; }
      else if (scaled.canvas) { source = scaled.canvas; w = scaled.width; h = scaled.height; }
      else {
        // No resize performed; try to create an ImageBitmap to free the blob URL
        try {
          if (typeof createImageBitmap === 'function') {
            const bmp = await createImageBitmap(img);
            if (bmp) source = bmp;
          }
  } catch(_) { /* keep original img if bitmap not available */ }
      }
      // If the rendering source no longer depends on the blob URL, revoke it to avoid leaks
      if (source !== img) {
        try { URL.revokeObjectURL(url); } catch(_) {}
        try { img.src = ''; } catch(_) {}
      }
      const pos = centerInVisible(w, h);
      // Fit into viewport with small margin (90%)
      const fitMargin = 0.9;
      const maxW = Math.max(1, Math.floor((pos.vw || window.innerWidth) * fitMargin));
      const maxH = Math.max(1, Math.floor((pos.vh || window.innerHeight) * fitMargin));
      const fitScale = Math.min(1, maxW / w, maxH / h);
      const drawW = Math.round(w * fitScale);
      const drawH = Math.round(h * fitScale);
      const shape = {
        id: 'img_' + Date.now(),
        kind: 'image',
        cx: pos.cx,
        cy: pos.cy,
        rx: Math.round(drawW/2),
        ry: Math.round(drawH/2),
        angle: 0,
        stroke: '#00000000',
        width: 0,
  __image: source,
  __imageUrl: (source === img) ? url : null,
        __isImage: true,
        __aspect: Math.max(1e-3, w / Math.max(1, h))
      };
      global.BoardVector = global.BoardVector || { list: [], add(s){ this.list.push(s); }, clear(){ this.list.length=0; } };
      try { if (global.BoardHistory && BoardHistory.snapshot) BoardHistory.snapshot(); } catch(_){ }
      global.BoardVector.add(shape);
      try {
        if (global.BoardWorld && BoardWorld.clearShapesLayer) BoardWorld.clearShapesLayer();
        const sctx = global.BoardWorld && BoardWorld.getShapesCtx ? BoardWorld.getShapesCtx() : null;
        if (sctx && global.BoardVector && typeof global.BoardVector.redrawAll === 'function') {
          global.BoardVector.redrawAll(sctx);
        }
        // Ensure the visible canvas updates immediately
        try {
          const vis = document.getElementById('boardCanvas');
          const vctx = vis && vis.getContext ? vis.getContext('2d') : null;
          if (vctx && global.BoardWorld && BoardWorld.renderToVisible) BoardWorld.renderToVisible(vctx);
        } catch(_){ }
      } catch(_){ }
    } catch(e) {
      // ignore
    }
  }

  function handlePasteEvent(e){
    try {
  // Ensure this handler runs only once per paste (we register on both window-capture and document-bubble)
  if (e && e.__ibPasteSeen) return;
  try { e.__ibPasteSeen = true; } catch(_) {}
      // Do not intercept when a text editor or input is focused
      const ae = document.activeElement;
      const isForm = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable === true);
      const isTextEditor = !!(global.BoardToolText && BoardToolText._editor && (ae === BoardToolText._editor || (BoardToolText._editor.contains && BoardToolText._editor.contains(ae))));
      if (isForm || isTextEditor) return;
      const cd = e.clipboardData || global.clipboardData;
      if (!cd) return;
      let file = null;
      if (cd.files && cd.files.length) {
        // Some browsers expose pasted images as files
        for (let i=0; i<cd.files.length; i++) {
          const f = cd.files[i];
          if (f && /^image\//i.test(f.type)) { file = f; break; }
        }
      }
      if (!file && cd.items && cd.items.length) {
        for (let i=0; i<cd.items.length; i++) {
          const it = cd.items[i];
          if (it && it.kind === 'file' && /^image\//i.test(it.type || '')) { file = it.getAsFile && it.getAsFile(); if (file) break; }
        }
      }
      if (file) {
  try { e.preventDefault(); } catch(_) {}
  try { if (e.stopPropagation) e.stopPropagation(); } catch(_) {}
        handleFiles([file]);
        return;
      }
      // Fallback: try data URLs from HTML or plain text (e.g., copied <img src="data:...">)
      function extractDataUrl(str){
        try {
          const m1 = str.match(/<img\s+[^>]*src=["'](data:image\/[a-zA-Z0-9.+-]+;base64,[^"'>\s]+)["']/i);
          if (m1 && m1[1]) return m1[1];
          const m2 = str.match(/\b(data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+)\b/);
          if (m2 && m2[1]) return m2[1];
        } catch(_) {}
        return null;
      }
      const tryHtml = Array.from(cd.items || []).find(it => it.kind === 'string' && (it.type === 'text/html'));
      const tryText = Array.from(cd.items || []).find(it => it.kind === 'string' && (it.type === 'text/plain'));
      if (tryHtml && tryHtml.getAsString) {
        tryHtml.getAsString((html) => {
          const dataUrl = extractDataUrl(html || '');
          if (dataUrl) {
            try {
              fetch(dataUrl).then(r=>r.blob()).then(blob=>{ handleFiles([blob]); }).catch(()=>{});
            } catch(_){}
          }
        });
        return;
      }
      if (tryText && tryText.getAsString) {
        tryText.getAsString((txt) => {
          const dataUrl = extractDataUrl(txt || '');
          if (dataUrl) {
            try {
              fetch(dataUrl).then(r=>r.blob()).then(blob=>{ handleFiles([blob]); }).catch(()=>{});
            } catch(_){}
          }
        });
        return;
      }
    } catch(_) { }
  }

  function openFileDialog(){
    // Detect if we are in fullscreen before opening the file picker
    function isFullscreen(){
      try {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      } catch(_) { return false; }
    }
    function requestFS(el){
      try {
        var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (typeof fn === 'function') fn.call(el);
      } catch(_) { /* ignore */ }
    }
    const wasFS = isFullscreen();
    const fsTarget = document.documentElement;
    let restored = false;
    const cleanupRestoreListeners = ()=>{
      try { window.removeEventListener('focus', onFocusRestore, true); } catch(_){}
      try { document.removeEventListener('pointerdown', onPointerRestore, true); } catch(_){}
    };
    const doRestore = (preferGesture)=>{
      if (!wasFS || restored) return;
      if (!isFullscreen()) {
        requestFS(fsTarget);
      }
      restored = isFullscreen();
      if (restored || preferGesture) cleanupRestoreListeners();
    };
    const onFocusRestore = ()=>{ setTimeout(()=>doRestore(false), 0); };
    const onPointerRestore = ()=>{ doRestore(true); };
    if (wasFS) {
      // If we were fullscreen, try to restore on focus back and ensure success on next user gesture
      try { window.addEventListener('focus', onFocusRestore, true); } catch(_){}
      try { document.addEventListener('pointerdown', onPointerRestore, true); } catch(_){}
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      handleFiles(input.files);
      // Try restoring fullscreen right after selection as well
      if (wasFS) setTimeout(()=>doRestore(false), 0);
      setTimeout(() => input.remove(), 0);
    });
    // Some browsers fire 'cancel' when file dialog is closed without selection
    try { input.addEventListener('cancel', () => { if (wasFS) setTimeout(()=>doRestore(false), 0); }); } catch(_){}
    document.body.appendChild(input);
    input.click();
  }

  const ToolImage = {
    name: 'image',
    start(){ openFileDialog(); },
    draw(){}, end(){},
  };

  global.BoardToolImage = ToolImage;
  // Programmatic paste helper: try Clipboard API (preferred) or fallback to dispatching a paste event
  try {
    global.BoardToolImage.pasteFromClipboard = async function pasteFromClipboard() {
      try {
        try {
          if (window.IBLogger && IBLogger.debug) IBLogger.debug('pasteFromClipboard: start read()'); else console.debug && console.debug('pasteFromClipboard: start read()');
        } catch(_){}
        if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
          try {
            const items = await navigator.clipboard.read();
            try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('pasteFromClipboard: items read', items && items.length); else console.debug && console.debug('pasteFromClipboard: items read', items && items.length); } catch(_){}
            const files = [];
            for (const it of items) {
              try {
                const types = it.types || [];
                try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('pasteFromClipboard: item types', types); else console.debug && console.debug('pasteFromClipboard: item types', types); } catch(_){}
                for (const t of types) {
                  if (String(t).startsWith('image/')) {
                    try {
                      const blob = await it.getType(t);
                      if (blob) {
                        try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('pasteFromClipboard: got blob', blob.type, blob.size); else console.debug && console.debug('pasteFromClipboard: got blob', blob.type, blob.size); } catch(_){}
                        files.push(blob);
                      }
                    } catch(err) { try { console.warn && console.warn('pasteFromClipboard: getType failed', err && err.message); } catch(_){} }
                  }
                }
              } catch(_) {}
            }
            if (files.length) {
              try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('pasteFromClipboard: handling files', files.length); else console.debug && console.debug('pasteFromClipboard: handling files', files.length); } catch(_){}
              handleFiles(files);
              return true;
            }
            return false;
          } catch(err) {
            try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('pasteFromClipboard: read() failed', err && err.message); else console.warn && console.warn('pasteFromClipboard: read() failed', err); } catch(_){}
          }
        }
      } catch(_) {}
      // Fallback: attempt to dispatch a paste event (best-effort, may not carry clipboard data)
      try {
        try { if (window.IBLogger && IBLogger.debug) IBLogger.debug('pasteFromClipboard: dispatching paste event fallback'); else console.debug && console.debug('pasteFromClipboard: dispatching paste event fallback'); } catch(_){}
        const ev = new Event('paste', { bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
        return true;
      } catch(err) { try { if (window.IBLogger && IBLogger.warn) IBLogger.warn('pasteFromClipboard: fallback dispatch failed', err && err.message); else console.warn && console.warn('pasteFromClipboard: fallback dispatch failed', err); } catch(_){}; return false; }
    };
  } catch(_) {}
  // Global paste handler for images
  try { document.addEventListener('paste', handlePasteEvent, false); } catch(_){}
  // Using a single bubble-phase listener to avoid duplicate events
})(typeof window !== 'undefined' ? window : this);
