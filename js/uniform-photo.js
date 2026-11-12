// Uniform photo: put an employee's photo under the company uniform jacket (navy / yellow with
// reflective strips), so the 1-inch card photo shows the person wearing the uniform.
//   UniformPhoto.open(file or image URL, { width, height, type, quality }) -> Promise<dataURL | null>
// The person's photo is the bottom layer and the jacket (transparent PNG/WebP, neck cut out) is
// drawn on top, so the head shows through the collar. Drag to move, wheel / pinch / slider to zoom.
(function () {
  'use strict';
  if (window.UniformPhoto) return;

  var U = {
    jacketSrc: './images/uniform-jacket.webp',
    // where the jacket sits in the frame: width as a share of the frame width, neck centre (x share of
    // the jacket image) and the collar's top edge as a share of the frame height
    jacket: { w: 1.06, neckX: 0.492, top: 0.42 }
  };
  var jacketImg = null;
  function loadImg(src) {
    return new Promise(function (ok, bad) {
      var i = new Image();
      i.onload = function () { ok(i); };
      i.onerror = function () { bad(new Error('อ่านรูปไม่ได้')); };
      i.src = src;
    });
  }
  function jacket() { return jacketImg ? Promise.resolve(jacketImg) : loadImg(U.jacketSrc).then(function (i) { jacketImg = i; return i; }); }

  function style() {
    if (document.getElementById('upStyle')) return;
    var s = document.createElement('style'); s.id = 'upStyle';
    s.textContent =
      '.up-back{position:fixed;inset:0;z-index:9999;background:rgba(20,16,30,.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}' +
      '.up-box{background:#fff;color:#1d1730;border-radius:14px;max-width:760px;width:100%;max-height:100%;overflow:auto;padding:18px;display:grid;grid-template-columns:auto 1fr;gap:18px;box-shadow:0 18px 50px rgba(0,0,0,.35)}' +
      '.up-box h3{margin:0 0 4px;font-size:18px}' +
      '.up-stage{position:relative;width:300px;height:375px;max-width:72vw;max-height:90vw;aspect-ratio:4/5;border-radius:6px;overflow:hidden;background:#e9e6ef;touch-action:none;cursor:grab;box-shadow:inset 0 0 0 1px #cfc8da}' +
      '.up-stage.drag{cursor:grabbing}.up-stage canvas{width:100%;height:100%;display:block}' +
      '.up-guide{position:absolute;left:50%;top:7%;width:44%;height:44%;transform:translateX(-50%);border:2px dashed rgba(255,255,255,.85);border-radius:50% 50% 46% 46%;box-shadow:0 0 0 1px rgba(0,0,0,.25);pointer-events:none}' +
      '.up-side{display:flex;flex-direction:column;gap:12px;min-width:0}' +
      '.up-side p{margin:0;color:#5e5470;font-size:13.5px;line-height:1.55}' +
      '.up-row{display:flex;flex-direction:column;gap:4px;font-size:13.5px}' +
      '.up-row input[type=range]{width:100%}' +
      '.up-chk{display:flex;gap:8px;align-items:center;font-size:14px}' +
      '.up-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}' +
      '.up-btn{border:0;border-radius:8px;padding:9px 14px;font:inherit;font-size:14px;cursor:pointer;background:#5b2d91;color:#fff}' +
      '.up-btn.soft{background:#efeaf6;color:#3d2763}' +
      '.up-btn:focus-visible{outline:2px solid #f2b705;outline-offset:2px}' +
      '@media (max-width:620px){.up-box{grid-template-columns:1fr;justify-items:center}.up-side{width:100%}}';
    document.head.appendChild(s);
  }

  // draw: background, person's photo (moved / zoomed / turned), jacket on top
  function draw(g, W, H, photo, t, opts) {
    g.save();
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.translate(W / 2 + t.x * W, H / 2 + t.y * H);
    g.rotate(t.r * Math.PI / 180);
    var s = t.s * W / photo.width;
    g.drawImage(photo, -photo.width * s / 2, -photo.height * s / 2, photo.width * s, photo.height * s);
    g.restore();
    if (opts.wear && jacketImg) {
      var jw = U.jacket.w * W, jh = jw * jacketImg.height / jacketImg.width;
      g.globalAlpha = opts.ghost ? 0.5 : 1;
      g.drawImage(jacketImg, W / 2 - U.jacket.neckX * jw, U.jacket.top * H, jw, jh);
      g.globalAlpha = 1;
    }
  }

  U.open = function (src, o) {
    o = o || {};
    var OW = o.width || 300, OH = o.height || 375;
    style();
    var url = (typeof src === 'string') ? src : URL.createObjectURL(src);
    return Promise.all([loadImg(url), jacket().catch(function () { return null; })]).then(function (r) {
      var photo = r[0];
      return new Promise(function (done) {
        // start: photo as wide as the frame, its top at the frame's top (a head-and-shoulders photo)
        var start = { s: 0.9, x: 0, y: 0, r: 0 };
        start.y = Math.max(-0.5, Math.min(0.5, 0.9 * (photo.height / photo.width) * 0.4 - 0.5 + 0.02));
        var t = Object.assign({}, start), wear = o.wear !== false;
        var back = document.createElement('div'); back.className = 'up-back';
        back.innerHTML = '<div class="up-box" role="dialog" aria-label="ใส่เสื้อฟอร์มให้รูปพนักงาน">' +
          '<div class="up-stage" id="upStage"><canvas width="600" height="750"></canvas><div class="up-guide" id="upGuide"></div></div>' +
          '<div class="up-side"><div><h3>ใส่เสื้อฟอร์มให้รูปพนักงาน</h3>' +
          '<p>ลากรูปให้หน้าอยู่ในกรอบเส้นประ และคอพอดีกับปกเสื้อ เลื่อนลูกกลิ้งเมาส์หรือใช้สองนิ้วเพื่อย่อขยาย</p></div>' +
          '<label class="up-row">ขนาดรูป<input type="range" id="upZoom" min="0.4" max="4" step="0.01"></label>' +
          '<label class="up-row">หมุนรูป<input type="range" id="upRot" min="-20" max="20" step="0.5"></label>' +
          '<label class="up-chk"><input type="checkbox" id="upWear"' + (wear ? ' checked' : '') + '> ใส่เสื้อฟอร์มบริษัท</label>' +
          '<label class="up-chk"><input type="checkbox" id="upGuideOn" checked> แสดงกรอบใบหน้า</label>' +
          '<div class="up-acts"><button class="up-btn" id="upOk">✔ ใช้รูปนี้</button><button class="up-btn soft" id="upReset">เริ่มใหม่</button><button class="up-btn soft" id="upCancel">ยกเลิก</button></div>' +
          '</div></div>';
        document.body.appendChild(back);
        var stage = back.querySelector('#upStage'), cv = stage.querySelector('canvas'), g = cv.getContext('2d');
        var zoom = back.querySelector('#upZoom'), rot = back.querySelector('#upRot'), ghost = false;
        function paint() { draw(g, cv.width, cv.height, photo, t, { wear: wear, ghost: ghost }); zoom.value = t.s; rot.value = t.r; }
        paint();

        // pointer drag + two-finger pinch
        var pts = {}, last = null, pinch = null;
        function frac(dx, dy) { var b = stage.getBoundingClientRect(); return { x: dx / b.width, y: dy / b.height }; }
        stage.addEventListener('pointerdown', function (e) {
          stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          stage.classList.add('drag'); ghost = true; last = { x: e.clientX, y: e.clientY };
          var ids = Object.keys(pts);
          if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: t.s }; }
          paint();
        });
        stage.addEventListener('pointermove', function (e) {
          if (!pts[e.pointerId]) return;
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          var ids = Object.keys(pts);
          if (ids.length >= 2 && pinch) {
            var a = pts[ids[0]], b = pts[ids[1]];
            t.s = Math.max(0.4, Math.min(4, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1)));
          } else if (last) {
            var f = frac(e.clientX - last.x, e.clientY - last.y);
            t.x += f.x; t.y += f.y; last = { x: e.clientX, y: e.clientY };
          }
          paint();
        });
        function up(e) {
          delete pts[e.pointerId]; pinch = null;
          var ids = Object.keys(pts);
          last = ids.length ? pts[ids[0]] : null;
          if (!ids.length) { stage.classList.remove('drag'); ghost = false; paint(); }
        }
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
        stage.addEventListener('wheel', function (e) {
          e.preventDefault();
          t.s = Math.max(0.4, Math.min(4, t.s * Math.exp(-e.deltaY * 0.0015))); paint();
        }, { passive: false });
        zoom.addEventListener('input', function () { t.s = +zoom.value; paint(); });
        rot.addEventListener('input', function () { t.r = +rot.value; paint(); });
        back.querySelector('#upWear').addEventListener('change', function (e) { wear = e.target.checked; paint(); });
        back.querySelector('#upGuideOn').addEventListener('change', function (e) { back.querySelector('#upGuide').hidden = !e.target.checked; });
        back.querySelector('#upReset').addEventListener('click', function () { t = Object.assign({}, start); paint(); });
        function close(v) {
          document.removeEventListener('keydown', key); back.remove();
          if (typeof src !== 'string') URL.revokeObjectURL(url);
          done(v);
        }
        function key(e) { if (e.key === 'Escape') close(null); }
        document.addEventListener('keydown', key);
        back.querySelector('#upCancel').addEventListener('click', function () { close(null); });
        back.querySelector('#upOk').addEventListener('click', function () {
          var out = document.createElement('canvas'); out.width = OW; out.height = OH;
          draw(out.getContext('2d'), OW, OH, photo, t, { wear: wear, ghost: false });
          close(out.toDataURL(o.type || 'image/jpeg', o.quality || 0.88));
        });
      });
    });
  };

  window.UniformPhoto = U;
})();
