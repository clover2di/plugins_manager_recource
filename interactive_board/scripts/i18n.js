'use strict';

(function initI18n(global){
  function applyI18n(dict) {
    if (!dict) return;
  try { if (dict.title && typeof dict.title === 'string') { document.title = dict.title; } } catch(_) {}
  }
  function t(path, def){
    try {
      var obj = (global.i18n && global.i18n.dict) ? global.i18n.dict : null;
      if (!obj || !path) return def;
      var parts = String(path).split('.');
      var cur = obj;
      for (var i=0;i<parts.length;i++) {
        if (cur && typeof cur === 'object' && parts[i] in cur) cur = cur[parts[i]]; else return def;
      }
      return (typeof cur === 'string') ? cur : def;
    } catch(_) { return def; }
  }
  global.BoardI18n = { applyI18n: applyI18n, t: t };
})(typeof window !== 'undefined' ? window : this);
