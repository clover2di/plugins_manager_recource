Required library: SheetJS full build.

Download (choose ONE source):
   https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js
   or
   https://unpkg.com/xlsx@0.19.3/dist/xlsx.full.min.js

Save as exactly: vendor/xlsx.full.min.js

Why full build: minimal / mini builds may omit features (dates, formulas) needed by this plugin.

Removed files:
   mini_excel.css / mini_excel.js / xlsx.mini.min.js (not referenced by code, unnecessary).

After placing file: reload plugin window and retry .xlsx import.

If import still fails:
   1. Open browser dev tools console, check for errors containing 'XLSX'.
   2. Ensure filename is correct and not blocked by CSP.
   3. Check file size (>700KB typical). Very small size means wrong file.

Optional integrity check (PowerShell example):
   Get-FileHash vendor\xlsx.full.min.js -Algorithm SHA256

End.
