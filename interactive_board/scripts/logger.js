'use strict';

(function initLogger(global){
  var container = null;
  var LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
  var _level = (function(){
    try {
      // Priority: explicit window var -> localStorage -> default 'info'
      if (global.IB_LOG_LEVEL && LEVELS[String(global.IB_LOG_LEVEL).toLowerCase()]) {
        return LEVELS[String(global.IB_LOG_LEVEL).toLowerCase()];
      }
      var saved = (global.localStorage && localStorage.getItem('IB_LOG_LEVEL')) || '';
      if (saved && LEVELS[String(saved).toLowerCase()]) return LEVELS[String(saved).toLowerCase()];
    } catch(_){}
    return LEVELS.info;
  })();
  function _lvlEnabled(lvl){ return lvl >= _level; }
  function setLevel(lvl){
    try {
      var key = (typeof lvl === 'string') ? lvl.toLowerCase() : lvl;
      if (typeof key === 'string' && LEVELS[key]) { _level = LEVELS[key]; localStorage.setItem('IB_LOG_LEVEL', key); return true; }
      if (typeof key === 'number') { _level = key; localStorage.setItem('IB_LOG_LEVEL', String(key)); return true; }
    } catch(_){}
    return false;
  }
  function getLevel(){
    try {
      var found = Object.keys(LEVELS).find(function(k){ return LEVELS[k] === _level; });
      return found || String(_level);
    } catch(_) { return String(_level); }
  }
  function ensureContainer(){
    if (container) return container;
    container = document.createElement('div');
    container.id = 'ib_toast_container';
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.bottom = '12px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    // ARIA: container is polite by default; individual toasts can override
    try {
      container.setAttribute('role', 'region');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      container.setAttribute('aria-label', 'Notifications');
    } catch(_) {}
    document.body.appendChild(container);
    return container;
  }
  function makeToast(msg, kind){
    try {
      var wrap = ensureContainer();
      var el = document.createElement('div');
      // ARIA: use alert/assertive for errors, status/polite otherwise
      if (kind === 'error') {
        el.setAttribute('role', 'alert');
        el.setAttribute('aria-live', 'assertive');
      } else if (kind === 'warn') {
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
      } else {
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
      }
      el.setAttribute('aria-atomic', 'true');
      el.style.maxWidth = '360px';
      el.style.padding = '10px 12px';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      el.style.font = '13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
      el.style.color = '#0b0b0c';
      el.style.background = kind === 'error' ? '#ffd9d4' : (kind === 'warn' ? '#fff4d6' : '#e9f7df');
      el.textContent = String(msg || '')
        .replace(/\s+/g,' ')
        .trim()
        .slice(0, 500);
      wrap.appendChild(el);
      setTimeout(function(){ try { el.remove(); } catch(_){} }, 2500);
    } catch(_){}
  }

  var bridge = null; // optional external sink
  function setBridge(fn){ bridge = (typeof fn === 'function') ? fn : null; }
  function _out(levelName, args){
    var lvl = LEVELS[levelName] || LEVELS.info;
    if (!_lvlEnabled(lvl)) return;
    try { (console[levelName] || console.log).apply(console, args); } catch(_){ }
    if (bridge) { try { bridge(levelName, Array.prototype.slice.call(args)); } catch(_){} }
  }

  var Logger = {
    setBridge: setBridge,
    setLevel: setLevel,
    getLevel: getLevel,
    debug: function(){ _out('debug', arguments); },
    info: function(){ _out('info', arguments); },
    warn: function(){ _out('warn', arguments); },
    error: function(){ _out('error', arguments); },
    toast: function(message, kind){ makeToast(message, kind || 'info'); }
  };

  global.IBLogger = Logger;
})(typeof window !== 'undefined' ? window : this);
