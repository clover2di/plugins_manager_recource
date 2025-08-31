'use strict';

(function initIcons(global){
  const ICONS_DIR = 'resources/icons/';

  function toEl(html){
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  async function fetchSvg(name){
    const url = ICONS_DIR + name + '.svg';
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Icon fetch failed: ' + name);
    const text = await res.text();
    return text;
  }

  function sanitizeToCurrentColor(svgEl){
    if (!svgEl || svgEl.tagName.toLowerCase() !== 'svg') return svgEl;
    // Remove hardcoded fills/strokes in children to allow currentColor
    svgEl.querySelectorAll('[fill]').forEach(n => {
      if (n.getAttribute('fill') !== 'none') n.removeAttribute('fill');
    });
    svgEl.querySelectorAll('[stroke]').forEach(n => {
      if (n.getAttribute('stroke') !== 'none') n.removeAttribute('stroke');
    });
    // Ensure viewBox preserved; set fill/stroke on root to currentColor
    svgEl.setAttribute('fill', 'currentColor');
    svgEl.setAttribute('stroke', 'currentColor');
    // Normalize size handled via CSS; keep width/height attributes if present
    return svgEl;
  }

  // Re-sanitize already-mounted icons to adopt currentColor (useful after code updates)
  function retintAll(root){
    const scope = root || document;
    // Apply to all inline SVGs in the plugin DOM, not only data-icon ones
    const nodes = scope.querySelectorAll('svg');
    nodes.forEach(target => {
      try {
        // Remove inline fills/strokes from children
        target.querySelectorAll('[fill]').forEach(n => { if (n.getAttribute('fill') !== 'none') n.removeAttribute('fill'); });
        target.querySelectorAll('[stroke]').forEach(n => { if (n.getAttribute('stroke') !== 'none') n.removeAttribute('stroke'); });
        // Also scrub inline style fill/stroke if present
        target.querySelectorAll('[style]').forEach(n => {
          const s = n.getAttribute('style') || '';
          const cleaned = s
            .replace(/(^|;\s*)fill:\s*#[0-9a-fA-F]{3,8}\s*(;|$)/g, '$1')
            .replace(/(^|;\s*)stroke:\s*#[0-9a-fA-F]{3,8}\s*(;|$)/g, '$1')
            .replace(/;;+/g, ';')
            .replace(/^;|;$/g, '');
          if (cleaned !== s) {
            if (cleaned) n.setAttribute('style', cleaned); else n.removeAttribute('style');
          }
        });
        // Ensure root uses currentColor
        target.setAttribute('fill', 'currentColor');
        target.setAttribute('stroke', 'currentColor');
  // Ensure SVG itself inherits text color from its parent
  const curStyle = target.getAttribute('style') || '';
  if (!/(^|;\s*)color\s*:/.test(curStyle)) target.setAttribute('style', (curStyle ? curStyle + '; ' : '') + 'color: inherit');
      } catch(_) { /* ignore */ }
    });
  }

  async function mountOne(target){
    if (!target || target.dataset.iconMounted === '1') return;
    const name = target.getAttribute('data-icon');
    if (!name) return;
    try {
      const raw = await fetchSvg(name);
      const tmp = toEl(raw);
      const svg = sanitizeToCurrentColor(tmp);
      // Copy viewBox to target svg and transplant children
      if (svg && svg.getAttribute('viewBox')) target.setAttribute('viewBox', svg.getAttribute('viewBox'));
      // Clear target children and adopt new nodes
      while (target.firstChild) target.removeChild(target.firstChild);
      Array.from(svg.childNodes).forEach(ch => target.appendChild(ch.cloneNode(true)));
      // Ensure target root uses currentColor so icons adapt to theme
      try {
        target.setAttribute('fill', 'currentColor');
        target.setAttribute('stroke', 'currentColor');
  const curStyle = target.getAttribute('style') || '';
  if (!/(^|;\s*)color\s*:/.test(curStyle)) target.setAttribute('style', (curStyle ? curStyle + '; ' : '') + 'color: inherit');
        if (!target.getAttribute('focusable')) target.setAttribute('focusable', 'false');
        if (!target.getAttribute('aria-hidden')) target.setAttribute('aria-hidden', 'true');
      } catch(_) {}
      target.dataset.iconMounted = '1';
    } catch(_){ /* ignore */ }
  }

  async function mountAll(root){
    const scope = root || document;
    const nodes = scope.querySelectorAll('svg[data-icon]:not([data-icon-mounted="1"])');
    await Promise.all(Array.from(nodes).map(mountOne));
  }

  function create(name, className){
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-icon', name);
    if (className) svg.setAttribute('class', className);
    return svg;
  }

  document.addEventListener('DOMContentLoaded', () => { mountAll(); retintAll(); });

  global.Icons = { mount: mountAll, create, retint: retintAll };
})(typeof window !== 'undefined' ? window : this);
