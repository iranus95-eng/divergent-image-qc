/* Divergent — unified theme helper (2026-10-04), pairs with css/theme-pea.css
 * 1. Classifies legacy buttons by their original colour (data-t = primary | secondary | danger | success)
 *    so every menu gets the same flat light-purple buttons without losing meaning (approve / delete / Excel).
 * 2. Replaces gradient fills on module blocks with the flat theme colour (data-t-grad).
 * 3. Document previews (ใบแจ้งหนี้-ใบวางบิล / ใบเสร็จ): +10% over the size the module fits them to.
 * Skips the new shell, the archive UI and anything inside a document paper.
 */
(function () {
  'use strict';
  var SCOPE = '.main-shell, #billingInvoiceV1, #receiptTaxV1, #customerImportV1';
  var SKIP = '#saTop, #saSide, #saBottom, #saHome, #saBar, #daViewer, .da-workspace, [class*="paper"], [class*="pdf"]';

  function rgb(str) {
    var m = String(str || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
  }
  function hsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return { h: h, s: s, l: l };
  }
  function fillColor(cs) {
    var img = cs.backgroundImage;
    if (img && img !== 'none' && /gradient/.test(img)) { var c = rgb(img); if (c) return c; }
    var bg = rgb(cs.backgroundColor);
    return bg && bg.a > .05 ? bg : null;
  }
  function kind(btn) {
    var cls = (btn.className && typeof btn.className === 'string' ? btn.className : '') + ' ' + (btn.id || '');
    var text = (btn.textContent || '').trim();
    if (/(^|[\s_-])tab(s)?([\s_-]|$)|-tab\b|tab-/i.test(cls)) return /\bactive\b|selected/.test(cls) || btn.getAttribute('aria-selected') === 'true' ? 'primary' : 'secondary';
    if (/danger|reject|delete|remove|\bdel\b|clear/i.test(cls) || /^(ลบ|🗑|ไม่อนุมัติ|ล้าง)/.test(text)) return 'danger';
    if (/approve|success|excel|\bline\b|inv-line|report-line/i.test(cls) || /^(อนุมัติ|📗|LINE$)/.test(text)) return 'success';
    if (/\bactive\b/.test(cls)) return 'primary';
    // judge by the button's own colour (read with our styling removed)
    var had = btn.getAttribute('data-t');
    if (had) btn.removeAttribute('data-t');
    var c = fillColor(getComputedStyle(btn));
    if (had) btn.setAttribute('data-t', had);
    if (!c) return 'secondary';
    var x = hsl(c);
    if (x.l > .88 || x.s < .18) return 'secondary';
    if ((x.h >= 340 || x.h <= 15) && x.s > .45) return 'danger';
    if (x.h >= 85 && x.h <= 165 && x.s > .3) return 'success';
    return 'primary';
  }
  function skip(el) { return !!el.closest(SKIP); }

  function markPopups() {
    var pops = document.querySelectorAll('body > [class*="overlay"]:not([data-t-scope]), body > [class*="modal"]:not([data-t-scope]), [id$="Overlay"]:not([data-t-scope]), [id$="Modal"]:not([data-t-scope])');
    for (var i = 0; i < pops.length; i++) if (!pops[i].closest('#daViewer') && !/^sa/.test(pops[i].id || '')) pops[i].setAttribute('data-t-scope', '');
  }
  function classify(rootEl) {
    markPopups();
    var scopes = rootEl ? [rootEl] : document.querySelectorAll(SCOPE + ', [data-t-scope]');
    for (var i = 0; i < scopes.length; i++) {
      var btns = scopes[i].querySelectorAll('button:not([data-t])');
      for (var j = 0; j < btns.length; j++) {
        var b = btns[j];
        if (b.classList.contains('sa-card') || b.classList.contains('da-btn') || skip(b)) { b.setAttribute('data-t-skip', ''); continue; }
        b.setAttribute('data-t', kind(b));
      }
      var blocks = scopes[i].querySelectorAll('div:not([data-t-grad]):not([data-t-g0]),header:not([data-t-grad]):not([data-t-g0]),section:not([data-t-grad]):not([data-t-g0])');
      for (var k = 0; k < blocks.length; k++) {
        var el = blocks[k];
        el.setAttribute('data-t-g0', '');
        var img = getComputedStyle(el).backgroundImage;
        if (!img || img === 'none' || !/gradient/.test(img) || skip(el)) continue;
        var c = rgb(img), light = c && hsl(c).l > .8;
        el.setAttribute('data-t-grad', light ? 'light' : '');
      }
    }
  }
  // buttons whose state class changes (tabs: active / inactive) are re-judged
  function reclassify(btn) { if (btn.hasAttribute('data-t')) btn.setAttribute('data-t', kind(btn)); }

  // ---- previews +10% ----
  var PREVIEWS = [
    { wrap: '#billingInvoiceV1 .bi-preview-wrap', paper: '.bi-paper' },
    { wrap: '#receiptTaxV1 .rt-preview-wrap', paper: '.rt-paper' }
  ];
  function grow() {
    PREVIEWS.forEach(function (p) {
      var wrap = document.querySelector(p.wrap); if (!wrap) return;
      var paper = wrap.querySelector(p.paper); if (!paper) return;
      var z = parseFloat(paper.style.zoom);
      if (!z || !isFinite(z)) return;
      if (paper.dataset.tZoom && Math.abs(z - Number(paper.dataset.tZoom)) < 1e-4) return; // ours
      var maxW = (wrap.clientWidth - 24) / 794;
      var target = Math.max(z, Math.min(z * 1.1, maxW));
      paper.dataset.tZoom = String(target);
      paper.style.zoom = String(target);
      wrap.style.height = Math.ceil(1123 * target + 24) + 'px';
      wrap.style.overflow = 'hidden';
    });
  }

  var t = 0, pendingBtns = [];
  function schedule() { if (!t) t = requestAnimationFrame(function () { t = 0; classify(); grow(); pendingBtns.splice(0).forEach(reclassify); }); }
  function boot() {
    classify(); grow();
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' && m.target.tagName === 'BUTTON' && m.attributeName === 'class') pendingBtns.push(m.target);
      }
      schedule();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
