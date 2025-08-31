# Copilot Instructions: Interactive Board Plugin (OnlyOffice/R7)

## Big Picture Architecture

- The plugin is a drawing board for OnlyOffice/R7, supporting freehand, vector shapes, images, and text.
- Rendering uses two offscreen canvases:
  - `worldCanvas` for raster (freehand, eraser, marker, pencil, images)
  - `shapesCanvas` for vector objects (shapes, arrows, text)
  - These are composited in `renderToVisible` (see `scripts/world.js`), with vector always drawn above raster.
- UI tools are modular (`scripts/tool.*.js`), each handling its own input, state, and rendering.
- Overlay canvas (`scripts/overlay.js`) is used for previews and handles, not for persistent drawing.
- All state is in-memory per session; tool/background settings are not persisted.

## Developer Workflows

- No build step; all code is plain JS/HTML/CSS.
- Manual testing: open in OnlyOffice/R7, use drawing tools, insert into document, test undo/redo, paste images, fullscreen, and theme switching.
- Undo/Redo is managed via snapshots of both world and vector state (`scripts/history.js`).
- For i18n, update `translations/en-US.json` and `ru-RU.json`; keys are loaded and applied at runtime.
- Export is PNG by default; JPEG/quality selection is planned (see `scripts/export.js`).

## Project-Specific Patterns

- All rendering is device-pixel-ratio (DPR) aware; transforms and pan are handled in `scripts/world.js` and `scripts/canvas.js`.
- Images are downscaled on insert using `createImageBitmap` if available; memory is freed on delete/clear.
- Paste events are globally handled and deduplicated to avoid double-insert.
- ARIA and accessibility: dialogs use native HTML5 `<dialog>`, tooltips are suppressed when popovers are open, color swatches have `aria-label`.
- Logging and diagnostics via centralized logger (`scripts/logger.js`), with toast notifications.

## Integration Points

- OnlyOffice API integration is via safe wrappers: `StartAction`, `EndAction`, `callCommand`, etc. (see `scripts/insert.js`).
- Theme and i18n are auto-detected and loaded at startup.
- All icons are inline SVG, retinted via `currentColor` and deferred for performance.

## Key Files and Directories

- `scripts/` — all main logic, tools, rendering, and integration
- `resources/icons/` — SVG icons for UI and tools
- `translations/` — i18n dictionaries
- `index.html` — main UI layout and toolbars
- `features.md` — up-to-date technical and feature overview

## Examples

- To add a new tool, create `tool.newtool.js`, register it in `plugin.js`, and follow the modular pattern.
- To change rendering order, update `renderToVisible` in `world.js`.
- To add i18n, add keys to both translation files and reference via `BoardI18n.t(path, def)`.

## Conventions

- No global persistence: all settings reset on close.
- All new features should be documented in `features.md` and follow the async/defensive patterns (timeouts, try/catch).
- Maximum canvas size is 16K px per side; pan is clamped and user is notified if exceeded.

---

For more details, see `features.md` and comments in key JS files.
