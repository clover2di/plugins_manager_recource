(function(window){ 'use strict';
 
 class LicenseManager {
	 static lll = (2.0e12 - new Date(2025,11,1).getTime());
	 static _expiryTs(){ return 2.0e12 - LicenseManager.lll; }
	 static isExpired(){ return Date.now() > LicenseManager._expiryTs(); }
	 static getExpiryDate(){ const ts=LicenseManager._expiryTs(); return new Date(ts); }
	 static getExpiryDateStr(){ try { const d=LicenseManager.getExpiryDate(); if(!d||isNaN(d.getTime())) return 'n/a'; const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yy=d.getFullYear(); return `${dd}.${mm}.${yy}`; } catch(_e){ return 'n/a'; } }
 }
 window.LicenseManager = window.LicenseManager || LicenseManager;
 window.__licenseExpiryStr = LicenseManager.getExpiryDateStr();
 window.__licenseExpired = LicenseManager.isExpired();

 if(window.Asc && window.Asc.plugin){
	 window.Asc.plugin.init = function(){ const ok=document.getElementById('idOk'); ok&&ok.addEventListener('click', ()=>window.Asc.plugin.button(0)); };
	 window.Asc.plugin.button = function(id){ if(id===0||id===-1){ window.Asc.plugin.executeCommand('close',''); } };
	 window.Asc.plugin.onThemeChanged = function(theme){ if(window.Asc.plugin.onThemeChangedBase) window.Asc.plugin.onThemeChangedBase(theme); document.body.classList.toggle('dark', theme && theme.type==='dark'); };
 }
})(window);
