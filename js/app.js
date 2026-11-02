// Paint Mixer UI: hex entry, palette choices and recipe cards.
(function () {
  var PAINTS = window.PAINTS;
  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'paintmixer.v1';
  var state = { hex: '#6B8E4E', enabled: PAINTS.map(function (p) { return p.id; }), batch: 30 };
  var timer = null, lastResult = null;

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved) {
        if (Mixer.parseHex(saved.hex || '')) state.hex = Mixer.parseHex(saved.hex);
        if (Array.isArray(saved.enabled)) state.enabled = saved.enabled;
        if (saved.batch > 0) state.batch = saved.batch;
      }
    } catch (e) { /* storage unavailable: run on defaults */ }
    var q = Mixer.parseHex(new URLSearchParams(location.search).get('hex') || '');
    if (q) state.hex = q;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* not fatal */ }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function inkOn(hex) {
    var lab = Mixer.hexToLab(hex);
    return lab[0] > 58 ? '#111111' : '#ffffff';
  }

  function matchWords(e) {
    if (e < 1) return 'Practically identical';
    if (e < 2.5) return 'Very close';
    if (e < 5) return 'Close';
    if (e < 10) return 'Rough approximation';
    return 'Distant, best available';
  }

  function formatMl(v) {
    if (v < 0.1) return '< 0.1 ml';
    return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ml';
  }
  function formatPct(v) { return v < 0.01 ? '< 1%' : Math.round(v * 100) + '%'; }

  function ratioText(r) {
    return r.paints.map(function (l) { return l.parts + ' ' + l.paint.name; }).join(' : ');
  }

  // Practical order: go from the biggest amount to the smallest, and warn about staining paints.
  function tipFor(r) {
    if (r.paints.length === 1) return 'Straight from the tube.';
    var base = r.paints[0].paint.name;
    var strong = r.paints.slice(1).filter(function (l) { return l.paint.str >= 0.55 && l.share < 0.25; })
      .map(function (l) { return l.paint.name; });
    var tip = 'Start with the ' + base + ' and work the others in.';
    if (strong.length) tip += ' ' + strong.join(' and ') + (strong.length > 1 ? ' are' : ' is') + ' strong, so add it a little at a time.';
    return tip;
  }

  function recipeCard(r) {
    var card = el('article', 'recipe');
    var compare = el('div', 'compare');
    var mine = el('div', '', 'Target');
    mine.style.background = state.hex; mine.style.color = inkOn(state.hex);
    var mix = el('div', '', 'This mix ' + r.hex);
    mix.style.background = r.hex; mix.style.color = inkOn(r.hex);
    compare.appendChild(mine); compare.appendChild(mix);
    card.appendChild(compare);

    var body = el('div', 'body');
    var head = el('div', 'recipe-head');
    head.appendChild(el('h3', '', r.why));
    head.appendChild(el('span', 'match', matchWords(r.deltaE) + ' (ΔE ' + r.deltaE.toFixed(1) + ')'));
    var copy = el('button', 'copy', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var text = state.hex + ': ' + ratioText(r);
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { copy.textContent = 'Failed'; });
    });
    head.appendChild(copy);
    body.appendChild(head);

    var bar = el('div', 'bar');
    r.paints.forEach(function (l) {
      var seg = el('i');
      seg.style.background = l.paint.hex;
      seg.style.flex = l.share + ' 1 0';
      seg.title = l.paint.name;
      bar.appendChild(seg);
    });
    body.appendChild(bar);

    var table = el('table', 'lines');
    r.paints.forEach(function (l) {
      var row = el('tr');
      var dot = el('td', 'dot'), blob = el('i');
      blob.style.background = l.paint.hex;
      dot.appendChild(blob);
      row.appendChild(dot);
      var name = el('td');
      name.appendChild(document.createTextNode(l.paint.name));
      name.appendChild(el('span', 'pig', l.paint.pigment));
      row.appendChild(name);
      row.appendChild(el('td', 'num parts', l.parts + (l.parts === 1 ? ' part' : ' parts')));
      row.appendChild(el('td', 'num soft', formatPct(l.share)));
      row.appendChild(el('td', 'num soft', formatMl(l.share * state.batch)));
      table.appendChild(row);
    });
    body.appendChild(table);
    body.appendChild(el('p', 'tip', tipFor(r)));
    card.appendChild(body);
    return card;
  }

  function renderRecipes() {
    var box = $('recipes'), res = lastResult;
    box.textContent = '';
    $('note').hidden = !(res && res.note);
    $('note').textContent = res && res.note ? res.note : '';
    if (!res) return;
    if (!res.recipes.length) {
      box.appendChild(el('p', 'empty', 'Turn on at least one paint to get a recipe.'));
      return;
    }
    res.recipes.forEach(function (r) { box.appendChild(recipeCard(r)); });
  }

  function solveNow() {
    lastResult = Mixer.solve(state.hex, state.enabled, 5);
    renderRecipes();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(solveNow, 60);
  }

  function setHex(hex, fromPicker) {
    state.hex = hex;
    $('targetSwatch').style.background = hex;
    $('picker').value = hex.toLowerCase();
    if (fromPicker) $('hex').value = hex;
    $('hex').removeAttribute('aria-invalid');
    $('error').textContent = '';
    save();
    schedule();
  }

  function renderPalette() {
    var list = $('paintList');
    list.textContent = '';
    PAINTS.forEach(function (p) {
      var li = el('li'), label = el('label'), box = el('input'), blob = el('i');
      box.type = 'checkbox';
      box.checked = state.enabled.indexOf(p.id) >= 0;
      box.addEventListener('change', function () {
        state.enabled = PAINTS.filter(function (q) {
          return q === p ? box.checked : state.enabled.indexOf(q.id) >= 0;
        }).map(function (q) { return q.id; });
        updateCount();
        save();
        schedule();
      });
      blob.style.background = p.hex;
      label.appendChild(box);
      label.appendChild(blob);
      label.appendChild(el('span', '', p.name));
      li.appendChild(label);
      list.appendChild(li);
    });
    updateCount();
  }
  function updateCount() {
    $('paintCount').textContent = state.enabled.length + ' of ' + PAINTS.length + ' on';
  }

  function init() {
    load();
    Object.keys(window.PALETTE_PRESETS).forEach(function (name) {
      var b = el('button', '', name);
      b.type = 'button';
      b.addEventListener('click', function () {
        state.enabled = (window.PALETTE_PRESETS[name] || PAINTS.map(function (p) { return p.id; })).slice();
        renderPalette();
        save();
        schedule();
      });
      $('presets').appendChild(b);
    });
    renderPalette();

    $('hex').addEventListener('input', function () {
      var hex = Mixer.parseHex(this.value);
      if (hex) { setHex(hex, false); return; }
      if (this.value.trim().replace('#', '').length >= 6) {
        this.setAttribute('aria-invalid', 'true');
        $('error').textContent = 'Use 3 or 6 hex digits, like #6B8E4E.';
      } else {
        this.removeAttribute('aria-invalid');
        $('error').textContent = '';
      }
    });
    $('hex').addEventListener('blur', function () {
      if (!Mixer.parseHex(this.value)) {
        this.setAttribute('aria-invalid', 'true');
        $('error').textContent = 'Use 3 or 6 hex digits, like #6B8E4E.';
      } else {
        this.value = state.hex;
      }
    });
    $('picker').addEventListener('input', function () { setHex(this.value.toUpperCase(), true); });
    $('batch').value = state.batch;
    $('batch').addEventListener('input', function () {
      var v = parseFloat(this.value);
      if (v > 0) { state.batch = v; save(); renderRecipes(); }
    });
    setHex(state.hex, true);
  }
  init();
})();
