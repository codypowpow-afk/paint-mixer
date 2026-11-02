// Mixing engine: Kubelka-Munk pigment mixing and a recipe search over the enabled paints.
// Paints mix by adding absorption (K) and scattering (S) per wavelength, which is what makes
// yellow + blue go green instead of the grey an RGB average would give.
(function () {
  var BANDS = 31; // 400..700 nm in 10 nm steps
  var D65 = [82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.8, 104.79, 107.69, 104.41, 104.05, 100, 96.33, 95.79, 88.69, 90.01, 89.6, 87.7, 83.29, 83.7, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61];
  var WHITE = [0.95047, 1, 1.08883];

  // CIE 1931 observer, multi-lobe gaussian fit (Wyman, Sloan & Shirley 2013).
  function lobe(x, mu, s1, s2) { var t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
  function cmfX(l) { return 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2); }
  function cmfY(l) { return 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1); }
  function cmfZ(l) { return 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8); }

  // Per-band weights, scaled so a perfect reflector lands exactly on the D65 white point.
  var WX = new Float64Array(BANDS), WY = new Float64Array(BANDS), WZ = new Float64Array(BANDS);
  (function () {
    var sx = 0, sy = 0, sz = 0, i, l;
    for (i = 0; i < BANDS; i++) {
      l = 400 + i * 10;
      WX[i] = cmfX(l) * D65[i]; WY[i] = cmfY(l) * D65[i]; WZ[i] = cmfZ(l) * D65[i];
      sx += WX[i]; sy += WY[i]; sz += WZ[i];
    }
    for (i = 0; i < BANDS; i++) { WX[i] *= WHITE[0] / sx; WY[i] *= WHITE[1] / sy; WZ[i] *= WHITE[2] / sz; }
  })();

  // Paint data expanded to K and S per band.
  var PAINTS = window.PAINTS;
  PAINTS.forEach(function (p) {
    p.K = new Float64Array(BANDS);
    p.S = new Float64Array(BANDS);
    for (var i = 0; i < BANDS; i++) {
      var pos = i / 2.5, a = Math.min(Math.floor(pos), p.r.length - 2), f = pos - a;
      var R = p.r[a] * (1 - f) + p.r[a + 1] * f;
      p.K[i] = p.str * (1 - R) * (1 - R) / (2 * R);
      p.S[i] = p.str;
    }
  });

  function finv(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
  function xyzToLab(x, y, z) {
    var fx = finv(x / WHITE[0]), fy = finv(y / WHITE[1]), fz = finv(z / WHITE[2]);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linearToSrgb(c) {
    c = c <= 0 ? 0 : c >= 1 ? 1 : c;
    return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  }
  function hexToLab(hex) {
    var c = hexToRgb(hex), r = srgbToLinear(c[0]), g = srgbToLinear(c[1]), b = srgbToLinear(c[2]);
    return xyzToLab(0.4124564 * r + 0.3575761 * g + 0.1804375 * b, 0.2126729 * r + 0.7151522 * g + 0.072175 * b, 0.0193339 * r + 0.119192 * g + 0.9503041 * b);
  }
  function xyzToHex(x, y, z) {
    var c = [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
    return '#' + c.map(function (v) { return ('0' + linearToSrgb(v).toString(16)).slice(-2); }).join('').toUpperCase();
  }

  function mixXyz(idx, w) {
    var x = 0, y = 0, z = 0, n = idx.length;
    for (var l = 0; l < BANDS; l++) {
      var k = 0, s = 0;
      for (var i = 0; i < n; i++) { var p = PAINTS[idx[i]]; k += w[i] * p.K[l]; s += w[i] * p.S[l]; }
      var q = k / s, R = 1 + q - Math.sqrt(q * q + 2 * q);
      x += R * WX[l]; y += R * WY[l]; z += R * WZ[l];
    }
    return [x, y, z];
  }
  function mixLab(idx, w) { var c = mixXyz(idx, w); return xyzToLab(c[0], c[1], c[2]); }
  function mixHex(idx, w) { var c = mixXyz(idx, w); return xyzToHex(c[0], c[1], c[2]); }

  // CIEDE2000 colour difference: about 1 is the smallest difference most eyes can see.
  function deltaE(a, b) {
    var C1 = Math.hypot(a[1], a[2]), C2 = Math.hypot(b[1], b[2]), Cm = (C1 + C2) / 2;
    var C7 = Math.pow(Cm, 7), G = 0.5 * (1 - Math.sqrt(C7 / (C7 + 6103515625)));
    var a1 = a[1] * (1 + G), a2 = b[1] * (1 + G);
    var c1 = Math.hypot(a1, a[2]), c2 = Math.hypot(a2, b[2]);
    var h1 = Math.atan2(a[2], a1), h2 = Math.atan2(b[2], a2), TAU = 2 * Math.PI;
    if (h1 < 0) h1 += TAU;
    if (h2 < 0) h2 += TAU;
    var dL = b[0] - a[0], dC = c2 - c1, dh = h2 - h1;
    if (c1 * c2 === 0) dh = 0; else if (dh > Math.PI) dh -= TAU; else if (dh < -Math.PI) dh += TAU;
    var dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh / 2);
    var Lm = (a[0] + b[0]) / 2, cm = (c1 + c2) / 2, hm = h1 + h2;
    if (c1 * c2 !== 0) {
      if (Math.abs(h1 - h2) > Math.PI) hm += hm < TAU ? TAU : -TAU;
      hm /= 2;
    }
    var T = 1 - 0.17 * Math.cos(hm - 0.5236) + 0.24 * Math.cos(2 * hm) + 0.32 * Math.cos(3 * hm + 0.1047) - 0.2 * Math.cos(4 * hm - 1.0996);
    var L50 = (Lm - 50) * (Lm - 50);
    var SL = 1 + 0.015 * L50 / Math.sqrt(20 + L50), SC = 1 + 0.045 * cm, SH = 1 + 0.015 * cm * T;
    var deg = (hm * 180 / Math.PI - 275) / 25, c7 = Math.pow(cm, 7);
    var RT = -2 * Math.sqrt(c7 / (c7 + 6103515625)) * Math.sin(1.0472 * Math.exp(-deg * deg));
    var tL = dL / SL, tC = dC / SC, tH = dH / SH;
    return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
  }

  // What the search minimises. It equals deltaE for colours paint can reach. For a vivid target
  // out of reach, CIEDE2000 alone rates a dull grey as well as a vivid near miss, but a painter
  // wants the vivid near miss, so losing hue or saturation costs extra.
  function fit(lab, target) {
    var e = deltaE(lab, target), ct = Math.hypot(target[1], target[2]);
    if (ct < 20) return e;
    var cm = Math.hypot(lab[1], lab[2]), d = Math.abs(Math.atan2(lab[2], lab[1]) - Math.atan2(target[2], target[1]));
    d = Math.min(d, 2 * Math.PI - d);
    return e + 0.1 * Math.max(0, ct - cm - 6) + 8 * Math.min(1, ct / 40) * Math.max(0, d - 0.35);
  }

  // Pattern search in log space, because good ratios span from 1:1 to 1:200.
  var STEPS = [3, 1.7, 1.3, 1.12, 1.05, 1.02];
  function refine(idx, w, target) {
    var best = fit(mixLab(idx, w), target), n = idx.length;
    if (n > 1) {
      for (var s = 0; s < STEPS.length; s++) {
        for (var pass = 0, moved = true; pass < 3 && moved; pass++) {
          moved = false;
          for (var i = 0; i < n; i++) {
            var old = w[i];
            for (var d = 0; d < 2; d++) {
              w[i] = old * (d ? 1 / STEPS[s] : STEPS[s]);
              var e = fit(mixLab(idx, w), target);
              if (e < best - 1e-4) { best = e; old = w[i]; moved = true; break; }
              w[i] = old;
            }
          }
        }
      }
    }
    var sum = 0, j;
    for (j = 0; j < n; j++) sum += w[j];
    for (j = 0; j < n; j++) w[j] /= sum;
    return { idx: idx, w: w, e: best };
  }

  function keyOf(idx) { return idx.join(','); }

  // Grows recipes one paint at a time, keeping the best seeds plus the best few for every paint,
  // so a strong route through one pigment can't crowd out a different route through another.
  function search(enabled, target) {
    var found = {};
    function keep(c) {
      var k = keyOf(c.idx);
      if (!found[k] || c.e < found[k].e) found[k] = c;
      return found[k];
    }
    function pickSeeds(list, top, perPaint) {
      var sorted = list.slice().sort(function (a, b) { return a.e - b.e; });
      var seeds = sorted.slice(0, top), count = {};
      sorted.forEach(function (c) {
        c.idx.forEach(function (i) {
          count[i] = (count[i] || 0) + 1;
          if (count[i] <= perPaint && seeds.indexOf(c) < 0) seeds.push(c);
        });
      });
      return seeds;
    }
    function grow(seeds) {
      var made = {};
      seeds.forEach(function (seed) {
        enabled.forEach(function (add) {
          if (seed.idx.indexOf(add) >= 0) return;
          var idx = seed.idx.concat(add).sort(function (a, b) { return a - b; }), k = keyOf(idx);
          if (made[k]) return;
          var bestW = null, bestE = Infinity;
          [0.01, 0.05, 0.15, 0.4].forEach(function (amount) {
            var w = idx.map(function (i) { return i === add ? amount : seed.w[seed.idx.indexOf(i)]; });
            var e = fit(mixLab(idx, w), target);
            if (e < bestE) { bestE = e; bestW = w; }
          });
          made[k] = keep(refine(idx, bestW, target));
        });
      });
      return Object.keys(made).map(function (k) { return made[k]; });
    }

    enabled.forEach(function (i) { keep(refine([i], [1], target)); });
    var pairs = [];
    for (var a = 0; a < enabled.length; a++) {
      for (var b = a + 1; b < enabled.length; b++) {
        var idx = [enabled[a], enabled[b]], bestW = null, bestE = Infinity;
        for (var r = -7; r <= 7; r++) {
          var w = [1, Math.pow(2, r)], e = fit(mixLab(idx, w), target);
          if (e < bestE) { bestE = e; bestW = w; }
        }
        pairs.push(keep(refine(idx, bestW, target)));
      }
    }
    var triples = grow(pickSeeds(pairs, 50, 3));
    grow(pickSeeds(triples, 30, 1));
    return found;
  }

  // Drops recipes where a paint isn't pulling its weight: a simpler recipe does about as well,
  // or it calls for an amount too small to measure. The model isn't accurate enough to justify
  // chasing tiny improvements with extra tubes.
  function usefulOnly(found) {
    return Object.keys(found).map(function (k) { return found[k]; }).filter(function (c) {
      if (c.idx.length === 1) return true;
      for (var i = 0; i < c.idx.length; i++) {
        var sub = found[keyOf(c.idx.filter(function (_, j) { return j !== i; }))];
        if (sub && sub.e <= c.e + 0.8) return false;
        if (c.w[i] < (c.idx.length > 2 ? 0.015 : 0.001)) return false;
      }
      return true;
    }).sort(function (a, b) { return practicalScore(a) - practicalScore(b); });
  }

  // Lower is better. Below about 1.2 a closer match can't be seen, so it stops counting,
  // while each extra tube and each lopsided ratio makes a recipe harder to mix.
  function practicalScore(c) {
    var colours = c.w.filter(function (_, i) { return PAINTS[c.idx[i]].group !== 'white'; });
    var spread = colours.length > 1 ? Math.log2(Math.max.apply(null, colours) / Math.min.apply(null, colours)) : 0;
    return Math.max(c.e, 1.2) + 0.5 * (c.idx.length - 1) + 0.3 * spread;
  }

  // Whole-number parts you can actually measure: the smallest set that keeps the match.
  function toParts(c, target) {
    var min = Math.min.apply(null, c.w), best = null;
    for (var m = 1; m <= 24; m++) {
      var parts = c.w.map(function (v) { return Math.max(1, Math.round(v / min * m)); });
      var e = fit(mixLab(c.idx, parts), target);
      if (!best || e < best.e - 0.05) best = { parts: parts, e: e };
      if (e <= Math.max(c.e + 0.5, 1.5)) break;
    }
    var total = best.parts.reduce(function (s, v) { return s + v; }, 0);
    return {
      paints: c.idx.map(function (i, j) { return { paint: PAINTS[i], parts: best.parts[j], share: best.parts[j] / total }; })
        .sort(function (x, y) { return y.parts - x.parts; }),
      total: total,
      deltaE: deltaE(mixLab(c.idx, best.parts), target),
      hex: mixHex(c.idx, best.parts),
      idx: c.idx
    };
  }

  function distance(a, b) {
    function colours(c) { return c.idx.filter(function (i) { return PAINTS[i].group !== 'white'; }); }
    var x = colours(a), y = colours(b), both = x.filter(function (i) { return y.indexOf(i) >= 0; }).length;
    var any = x.length + y.length - both;
    return any ? 1 - both / any : 0;
  }

  function hasBlack(c) { return c.idx.some(function (i) { return PAINTS[i].group === 'black'; }); }
  function hasCad(c) { return c.idx.some(function (i) { return PAINTS[i].cad; }); }

  // Colours the eye would call a different colour are never offered as an alternative, even if
  // the formula rates them similar. CIEDE2000 forgives a lot once the target is out of reach.
  function sameFamily(c, target, best) {
    var lab = mixLab(c.idx, c.w), ref = mixLab(best.idx, best.w);
    var chroma = Math.hypot(lab[1], lab[2]), refChroma = Math.hypot(ref[1], ref[2]);
    if (chroma < 0.7 * refChroma) return false;
    if (Math.hypot(target[1], target[2]) < 15 || chroma < 10) return true;
    var d = Math.abs(Math.atan2(lab[2], lab[1]) - Math.atan2(target[2], target[1]));
    return Math.min(d, 2 * Math.PI - d) < 0.55;
  }

  // The alternatives shown to the user. Each one has to be a genuinely different way of mixing.
  function chooseRecipes(pool, target, maxRecipes) {
    if (!pool.length) return [];
    var best = pool[0], limit = Math.max(best.e + 2.5, 4);
    var near = pool.filter(function (c) { return c.e <= limit && sameFamily(c, target, best); });
    var picks = [{ c: best, why: 'Best recipe' }];
    function taken(c) { return picks.some(function (p) { return p.c === c; }); }
    function add(c, why) { if (c && !taken(c)) picks.push({ c: c, why: why }); }

    var closest = near.slice().sort(function (a, b) { return a.e - b.e; })[0];
    if (closest && closest.e < best.e - 1) add(closest, 'Closest colour');
    var simplest = near.slice().sort(function (a, b) { return a.idx.length - b.idx.length || a.e - b.e; })[0];
    if (simplest && simplest.idx.length < best.idx.length) add(simplest, 'Fewest paints');
    if (picks.some(function (p) { return hasBlack(p.c); })) add(near.filter(function (c) { return !hasBlack(c); })[0], 'No black');
    if (picks.some(function (p) { return hasCad(p.c); })) add(near.filter(function (c) { return !hasCad(c); })[0], 'Cadmium-free');

    // Clearly different routes first. If that leaves few options, as it often does with a small
    // palette, accept weaker or more similar ones: the score on each card keeps that honest.
    function fill(list, wanted, minDistance) {
      while (picks.length < wanted) {
        var next = null, score = -Infinity;
        list.forEach(function (c) {
          if (taken(c)) return;
          var d = Math.min.apply(null, picks.map(function (p) { return distance(c, p.c); }));
          if (d < minDistance) return;
          var s = d - 0.15 * practicalScore(c);
          if (s > score) { score = s; next = c; }
        });
        if (!next) return;
        add(next, 'Alternative route');
      }
    }
    fill(near, maxRecipes, 0.5);
    fill(pool.filter(function (c) { return c.e <= limit + 3 && sameFamily(c, target, best); }), Math.min(3, maxRecipes), 0.25);
    return picks;
  }

  function reachNote(target, recipe, allOn) {
    if (recipe.deltaE < 6) return null;
    var c = hexToLab(recipe.hex), ct = Math.hypot(target[1], target[2]), cm = Math.hypot(c[1], c[2]);
    if (ct > cm + 8) return 'This colour is more vivid than these paints can reach. Screens can show colours that pigment cannot, so this is the nearest paint gets.';
    if (target[0] > c[0] + 5) return 'This colour is lighter than these paints can reach.';
    if (target[0] < c[0] - 5) return 'This colour is darker than these paints can reach.';
    return 'These paints can only get roughly close to this colour.' + (allOn ? '' : ' Turning on more paints may help.');
  }

  function solve(hex, enabledIds, maxRecipes) {
    var target = hexToLab(hex), enabled = [];
    PAINTS.forEach(function (p, i) { if (enabledIds.indexOf(p.id) >= 0) enabled.push(i); });
    if (!enabled.length) return { target: target, recipes: [], note: null };
    var picks = chooseRecipes(usefulOnly(search(enabled, target)), target, maxRecipes || 5);
    var recipes = picks.map(function (p) {
      var r = toParts(p.c, target);
      r.why = p.why;
      return r;
    });
    return { target: target, recipes: recipes, note: recipes.length ? reachNote(target, recipes[0], enabled.length === PAINTS.length) : null };
  }

  // Normalises typed or pasted hex: "#abc", "abc", "AABBCC". Returns "#AABBCC" or null.
  function parseHex(text) {
    var m = /^\s*#?([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(text);
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return '#' + h.toUpperCase();
  }

  PAINTS.forEach(function (p, i) { p.hex = mixHex([i], [1]); });

  window.Mixer = { solve: solve, parseHex: parseHex, mixHex: mixHex, hexToLab: hexToLab, deltaE: deltaE, mixLab: mixLab };
})();
