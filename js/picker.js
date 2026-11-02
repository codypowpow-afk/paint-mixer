// Colour wheel and hue / saturation / brightness gradient sliders.
// Works in HSV and keeps it as the source of truth, so dragging brightness down to black and
// back up doesn't lose the hue the way converting through hex would.
(function () {
  function hsvToRgb(h, s, v) {
    var c = v * s, p = (h % 360) / 60, x = c * (1 - Math.abs(p % 2 - 1)), m = v - c;
    var t = p < 1 ? [c, x, 0] : p < 2 ? [x, c, 0] : p < 3 ? [0, c, x] : p < 4 ? [0, x, c] : p < 5 ? [x, 0, c] : [c, 0, x];
    return [Math.round((t[0] + m) * 255), Math.round((t[1] + m) * 255), Math.round((t[2] + m) * 255)];
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), d = max - Math.min(r, g, b), h = 0;
    if (d > 0) {
      h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function css(h, s, v) { return toHex(hsvToRgb(h, s, v)); }

  window.ColourPicker = function (onPick) {
    var $ = function (id) { return document.getElementById(id); };
    var wheel = $('wheel'), dot = $('wheelDot'), sliders = { h: $('hue'), s: $('sat'), v: $('bri') };
    var hsv = { h: 0, s: 0, v: 1 }, drawnV = -1, ctx = wheel.getContext('2d');

    // Red at the top, running clockwise. The disc shows the current brightness.
    function drawWheel() {
      var size = wheel.width, R = size / 2 - 1, mid = size / 2, img = ctx.createImageData(size, size), i = 0;
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++, i += 4) {
          var dx = x + 0.5 - mid, dy = y + 0.5 - mid, r = Math.hypot(dx, dy);
          if (r > R + 1) continue;
          var rgb = hsvToRgb((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, Math.min(1, r / R), hsv.v);
          img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2];
          img.data[i + 3] = 255 * Math.min(1, R + 1 - r);
        }
      }
      ctx.putImageData(img, 0, 0);
      drawnV = hsv.v;
    }

    function refresh() {
      if (hsv.v !== drawnV) drawWheel();
      var box = wheel.clientWidth / 2, a = hsv.h * Math.PI / 180, r = hsv.s * (box - 1);
      dot.style.left = box + r * Math.sin(a) + 'px';
      dot.style.top = box - r * Math.cos(a) + 'px';
      dot.style.background = css(hsv.h, hsv.s, hsv.v);

      var hues = [];
      for (var d = 0; d <= 360; d += 60) hues.push(css(d, hsv.s, hsv.v));
      sliders.h.style.background = 'linear-gradient(to right,' + hues.join(',') + ')';
      sliders.s.style.background = 'linear-gradient(to right,' + css(hsv.h, 0, hsv.v) + ',' + css(hsv.h, 1, hsv.v) + ')';
      sliders.v.style.background = 'linear-gradient(to right,#000000,' + css(hsv.h, hsv.s, 1) + ')';

      sliders.h.value = hsv.h;
      sliders.s.value = hsv.s * 100;
      sliders.v.value = hsv.v * 100;
      $('hueVal').textContent = Math.round(hsv.h) + '°';
      $('satVal').textContent = Math.round(hsv.s * 100) + '%';
      $('briVal').textContent = Math.round(hsv.v * 100) + '%';
    }

    function changed() {
      refresh();
      onPick(css(hsv.h, hsv.s, hsv.v));
    }

    function pickFromWheel(e) {
      var rect = wheel.getBoundingClientRect(), box = rect.width / 2;
      var dx = e.clientX - rect.left - box, dy = e.clientY - rect.top - box;
      hsv.h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      hsv.s = Math.min(1, Math.hypot(dx, dy) / (box - 1));
      changed();
    }
    wheel.addEventListener('pointerdown', function (e) {
      if (Math.hypot(e.offsetX - wheel.clientWidth / 2, e.offsetY - wheel.clientHeight / 2) > wheel.clientWidth / 2) return;
      wheel.setPointerCapture(e.pointerId);
      // A disc at black has no colours to choose from, so choosing one brings the light back.
      if (hsv.v < 0.2) hsv.v = 1;
      pickFromWheel(e);
    });
    wheel.addEventListener('pointermove', function (e) {
      if (wheel.hasPointerCapture(e.pointerId)) pickFromWheel(e);
    });

    sliders.h.addEventListener('input', function () { hsv.h = +this.value % 360; changed(); });
    sliders.s.addEventListener('input', function () { hsv.s = this.value / 100; changed(); });
    sliders.v.addEventListener('input', function () { hsv.v = this.value / 100; changed(); });

    // Takes a colour from elsewhere (typed, eyedropper). Greys and black have no hue of their own,
    // so the sliders keep the last one rather than jumping back to red.
    this.set = function (hex) {
      if (css(hsv.h, hsv.s, hsv.v) === hex) return;
      var n = parseInt(hex.slice(1), 16), next = rgbToHsv(n >> 16 & 255, n >> 8 & 255, n & 255);
      if (next.s === 0 || next.v === 0) next.h = hsv.h;
      if (next.v === 0) next.s = hsv.s;
      hsv = next;
      refresh();
    };
    refresh();
  };
})();
