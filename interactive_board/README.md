Interactive Board plugin (OnlyOffice/R7)

Overview
- Draw on a canvas (pen/eraser, color, width) and insert the result into Word/Sheets/Slides.
- Complies with flexible window and async/callCommand patterns from the project standards.

Usage
- In the left panel: Clear, Color, Width, and Pen/Eraser tools.
- Click the plugin’s Insert button (toolbar) to paste the drawing into the document. Close with the window control.

Notes
- Icons are placeholders; replace PNGs in resources/icons/light|dark with actual images before packaging.
- I18n files in translations/ (en-US.json, ru-RU.json) load automatically based on locale.
- Insertion is editor-aware: Document, Spreadsheet, and Presentation are supported via feature detection.
