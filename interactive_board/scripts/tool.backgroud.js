'use strict';

(function initBackground(global){
  // Persistence disabled by product decision: no localStorage keys
  const patterns = ['plain', 'grid', 'dots', 'ruled'];
  let idx = 0;
  let userScale = 1.0; // default 100%
  let patternColor = '#d0d5d8'; // default pattern color (light gray)

  function $(id){ return document.getElementById(id); }

  function getCtx() {
    const bg = $('boardBg');
    if (!bg) return null;
    return bg.getContext('2d');
  }

  function resize() {
    const wrap = $('canvasWrapper');
    const bg = $('boardBg');
    if (!wrap || !bg) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = wrap.clientWidth || 1;
    const h = wrap.clientHeight || 1;
    bg.width = Math.floor(w * dpr);
    bg.height = Math.floor(h * dpr);
    bg.style.width = w + 'px';
    bg.style.height = h + 'px';
    const ctx = bg.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function clear(ctx) {
    if (!ctx || !ctx.canvas) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  function getPan() {
    try {
      if (global.BoardWorld && typeof BoardWorld.getPan === 'function') {
        return BoardWorld.getPan();
      }
    } catch(_) {}
    return { x: 0, y: 0 };
  }

  function drawPlain(ctx) {
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }

  function drawGrid(ctx) {
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);
    const step = Math.max(4, 40 * userScale); // scaled step
    const pan = getPan();
    // modulo offset so pattern scrolls with pan without gaps
    const ox = ((- (pan.x || 0)) % step + step) % step;
    const oy = ((- (pan.y || 0)) % step + step) % step;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 1;
    for (let x = ox; x <= w + step; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = oy; y <= h + step; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  function drawDots(ctx) {
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);
    const step = Math.max(4, 24 * userScale); // px scaled
    const pan = getPan();
    const ox = ((- (pan.x || 0)) % step + step) % step;
    const oy = ((- (pan.y || 0)) % step + step) % step;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = patternColor;
    const r = Math.max(0.5, 1.25 * Math.sqrt(userScale));
    for (let y = oy; y <= h + step; y += step) {
      for (let x = ox; x <= w + step; x += step) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawRuled(ctx) {
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const step = Math.max(4, 32 * userScale);
    const pan = getPan();
    const oy = ((- (pan.y || 0)) % step + step) % step;
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 1;
    for (let y = oy; y <= h + step; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // margin line
    ctx.strokeStyle = patternColor;
    const margin = Math.max(8, 64 * userScale);
    const mx = margin - (pan.x || 0);
    if (mx >= -step && mx <= w + step) { ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.stroke(); }
  }

  // Image upload background removed

  function draw() {
    const ctx = getCtx(); if (!ctx) return;
    clear(ctx);
    const type = patterns[idx] || 'plain';
    switch (type) {
      case 'grid': return drawGrid(ctx);
      case 'dots': return drawDots(ctx);
      case 'ruled': return drawRuled(ctx);
      default: return drawPlain(ctx);
    }
  }

  function cycle() {
  idx = (idx + 1) % patterns.length;
  draw();
  }

  function set(type) {
    const i = patterns.indexOf(type);
  if (i >= 0) { idx = i; draw(); }
  }

  // setImage removed

  function setScale(s) {
    const ns = Number(s);
    if (!isFinite(ns)) return;
    userScale = Math.max(0.1, Math.min(3, ns));
    draw();
  }

  function getScale() { return userScale; }

  function setPatternColor(hex) {
    if (typeof hex !== 'string') return;
    const v = hex.trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return;
    patternColor = v;
    draw();
  }

  function getPatternColor() { return patternColor; }

  function init() {
  // Start with defaults every session (no persistence)
  idx = 0; // 'plain'
  userScale = 1.0;
  patternColor = '#d0d5d8';
    resize();
    window.addEventListener('resize', resize);
  }

  // Expose redraw to allow panning tools to trigger re-render
  function redraw() { draw(); }

  global.BoardBackground = { init, cycle, set, setScale, getScale, setPatternColor, getPatternColor, resize, redraw };
})(typeof window !== 'undefined' ? window : this);
