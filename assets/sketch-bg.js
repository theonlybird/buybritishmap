/* ==========================================================================
   sketch-bg.js  —  faded engraving wallpaper for the content pages.

   The landing page reveals these same illustrations under the cursor. On a
   touch device there is no cursor, so the mask is dropped and the whole set
   sits faintly in the background instead — which reads better than the reveal.
   This script gives the content pages (About, Gold & Silver, FAQs, Contact)
   that same permanent wash, on every device.

   The order is shuffled per page from a hash of the filename: stable across
   reloads (so a page always looks like itself) but different on each page, so
   the wallpaper carries the theme without repeating itself.

   Sits at z-index 0 behind everything. Content cards stay solid white by
   design — the illustrations show in the paper margins around them, never
   through the text.
   ========================================================================== */
(function () {
  'use strict';

  // Same 24 engravings as the landing sketch, same filenames.
  var SKETCHES = [
    'trade-clothing-satchel-bag.png',   'trade-ceramics-cup.png',
    'trade-farm-apple-tree.png',        'trade-clothing-flat-cap.png',
    'trade-tools-chisel.png',           'trade-drink-beer.png',
    'trade-jewellery-ring.png',         'trade-ceramics-kiln.png',
    'trade-clothing-tailor.png',        'trade-farm-pigs.png',
    'trade-clothing-chelsea-boot.png',  'trade-farm-tomatoes.png',
    'trade-ceramics-potters-wheel.png', 'trade-clothing-t-shirts.png',
    'trade-ornament-pub-sign.png',      'trade-jewellery-watch.png',
    'trade-farm-chickens.png',          'trade-clothing-loom.png',
    'trade-farm-cheese-wheel.png',      'trade-clothing-shirt-and-tie.png',
    'trade-tools-grinder.png',          'trade-clothing-spinning-wheel.png',
    'trade-farm-milk-churn.png',        'trade-ceramics-dog-bowl.png'
  ];

  /* Seed from the page filename. Two pages never share a layout; one page is
     identical every visit, so the wallpaper isn't a lottery on each reload. */
  function seedFrom(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // mulberry32 — small, deterministic, good enough for shuffling 24 things.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, rand) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  var page = (location.pathname.split('/').pop() || 'index') .toLowerCase();
  var rand = rng(seedFrom(page || 'index'));
  var order = shuffled(SKETCHES, rand);

  // Per-page tilts too, so a shared illustration doesn't sit at the same angle
  // twice. Kept inside ±6deg — these are hand-drawn, not scattered.
  var tilts = order.map(function () { return (rand() * 12 - 6); });

  var style = document.createElement('style');
  style.textContent =
    '#sketchBg{position:fixed;inset:0;z-index:0;pointer-events:none;' +
      'mix-blend-mode:multiply;opacity:.1;overflow:hidden}' +
    '#sketchBg .sbg{position:absolute;display:flex;align-items:center;justify-content:center}' +
    '#sketchBg img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}' +
    /* Everything real sits above the wallpaper. The cards keep their solid
       fill, so nothing shows through the text. */
    'body>header,body>.wrap,body>footer,body>nav,body>main{position:relative;z-index:1}' +
    '@media print{#sketchBg{display:none}}';
  document.head.appendChild(style);

  function build() {
    var layer = document.getElementById('sketchBg');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'sketchBg';
      layer.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(layer, document.body.firstChild);
    }
    var cols = window.innerWidth < 760 ? 3 : 6;
    var rows = Math.ceil(order.length / cols);
    var w = 100 / cols, h = 100 / rows;

    layer.innerHTML = order.map(function (file, i) {
      var c = i % cols, r = Math.floor(i / cols);
      return '<div class="sbg" style="left:' + (c * w + w * 0.05).toFixed(2) + '%;' +
             'top:' + (r * h + h * 0.05).toFixed(2) + '%;' +
             'width:' + (w * 0.90).toFixed(2) + '%;height:' + (h * 0.90).toFixed(2) + '%;' +
             'transform:rotate(' + tilts[i].toFixed(2) + 'deg)">' +
             '<img src="assets/illustration/' + file + '" alt="" loading="lazy" decoding="async">' +
             '</div>';
    }).join('');

    layer.dataset.cols = cols;
  }

  // Rebuild only when the column count actually changes — a phone's address
  // bar collapsing fires resize constantly and must not thrash the DOM.
  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var layer = document.getElementById('sketchBg');
      var want = window.innerWidth < 760 ? 3 : 6;
      if (!layer || String(want) !== layer.dataset.cols) build();
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
  window.addEventListener('resize', onResize);
})();
