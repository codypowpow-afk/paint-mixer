// Standard artist acrylic colours, described by how the pigment reflects light.
// r:   reflectance of the undiluted paint at 400, 425 ... 700 nm. These are modelled from the
//      typical curve shape of each pigment, not lab measurements of a particular brand.
// str: tinting strength relative to Titanium White. Higher means a little goes a long way.
// group flags let the solver offer "no black" and "cadmium-free" routes.
window.PAINTS = [
  { id: 'white',    name: 'Titanium White',        pigment: 'PW6',    str: 1.00, group: 'white', r: [.80,.87,.90,.91,.92,.92,.92,.92,.92,.92,.92,.91,.91] },
  { id: 'lemon',    name: 'Hansa Yellow Light',    pigment: 'PY3',    str: 0.35, group: 'yellow', r: [.06,.05,.05,.08,.30,.72,.84,.87,.88,.88,.88,.88,.88] },
  { id: 'cadyel',   name: 'Cadmium Yellow Medium', pigment: 'PY35',   str: 0.55, group: 'yellow', cad: true, r: [.05,.04,.04,.05,.10,.33,.66,.78,.81,.82,.83,.83,.84] },
  { id: 'ochre',    name: 'Yellow Ochre',          pigment: 'PY43',   str: 0.20, group: 'earth', r: [.09,.09,.10,.12,.17,.26,.36,.45,.50,.52,.53,.54,.55] },
  { id: 'rawsi',    name: 'Raw Sienna',            pigment: 'PBr7',   str: 0.25, group: 'earth', r: [.06,.06,.07,.08,.10,.15,.22,.30,.37,.41,.43,.45,.46] },
  { id: 'cadora',   name: 'Cadmium Orange',        pigment: 'PO20',   str: 0.60, group: 'red', cad: true, r: [.05,.04,.04,.04,.05,.06,.11,.35,.65,.75,.78,.79,.80] },
  { id: 'cadredl',  name: 'Cadmium Red Light',     pigment: 'PR108',  str: 0.55, group: 'red', cad: true, r: [.05,.045,.04,.035,.03,.03,.035,.07,.50,.78,.84,.85,.85] },
  { id: 'cadred',   name: 'Cadmium Red Medium',    pigment: 'PR108',  str: 0.65, group: 'red', cad: true, r: [.05,.045,.04,.035,.03,.03,.03,.04,.22,.58,.74,.78,.80] },
  { id: 'crimson',  name: 'Quinacridone Crimson',  pigment: 'PR206',  str: 0.60, group: 'red', r: [.07,.06,.05,.04,.03,.025,.02,.02,.05,.18,.33,.42,.47] },
  { id: 'magenta',  name: 'Quinacridone Magenta',  pigment: 'PR122',  str: 0.60, group: 'red', r: [.22,.20,.16,.10,.06,.04,.03,.04,.12,.36,.55,.62,.66] },
  { id: 'dioxazine',name: 'Dioxazine Purple',      pigment: 'PV23',   str: 1.00, group: 'violet', r: [.09,.10,.09,.05,.02,.012,.01,.01,.012,.02,.05,.12,.24] },
  { id: 'ultra',    name: 'Ultramarine Blue',      pigment: 'PB29',   str: 0.30, group: 'blue', r: [.22,.36,.40,.30,.14,.06,.03,.02,.03,.035,.05,.10,.20] },
  { id: 'cobalt',   name: 'Cobalt Blue',           pigment: 'PB28',   str: 0.15, group: 'blue', r: [.22,.30,.38,.36,.24,.13,.07,.05,.05,.05,.06,.07,.09] },
  { id: 'cerulean', name: 'Cerulean Blue',         pigment: 'PB35',   str: 0.25, group: 'blue', r: [.17,.25,.34,.38,.33,.24,.15,.09,.06,.05,.05,.05,.06] },
  { id: 'phthblue', name: 'Phthalo Blue (GS)',     pigment: 'PB15:3', str: 0.60, group: 'blue', r: [.10,.13,.16,.17,.13,.07,.035,.02,.012,.01,.01,.012,.02] },
  { id: 'phthgrn',  name: 'Phthalo Green (BS)',    pigment: 'PG7',    str: 0.70, group: 'green', r: [.03,.035,.05,.09,.15,.15,.08,.035,.015,.01,.008,.01,.012] },
  { id: 'viridian', name: 'Viridian',              pigment: 'PG18',   str: 0.15, group: 'green', r: [.06,.09,.12,.19,.29,.27,.18,.11,.07,.05,.045,.05,.06] },
  { id: 'sap',      name: 'Sap Green',             pigment: 'hue mix',str: 0.50, group: 'green', r: [.03,.03,.03,.035,.06,.12,.17,.16,.13,.11,.11,.12,.14] },
  { id: 'bsienna',  name: 'Burnt Sienna',          pigment: 'PR101',  str: 0.35, group: 'earth', r: [.05,.05,.05,.05,.05,.06,.08,.14,.24,.31,.35,.37,.39] },
  { id: 'bumber',   name: 'Burnt Umber',           pigment: 'PBr7',   str: 0.40, group: 'earth', r: [.028,.028,.028,.03,.034,.038,.045,.06,.08,.10,.115,.125,.13] },
  { id: 'rumber',   name: 'Raw Umber',             pigment: 'PBr7',   str: 0.40, group: 'earth', r: [.03,.03,.034,.038,.045,.052,.064,.075,.09,.10,.105,.115,.12] },
  { id: 'payne',    name: "Payne's Grey",          pigment: 'hue mix',str: 0.60, group: 'black', r: [.06,.07,.08,.08,.07,.06,.055,.05,.045,.042,.04,.04,.045] },
  { id: 'ivory',    name: 'Ivory Black',           pigment: 'PBk9',   str: 0.35, group: 'black', r: [.035,.035,.035,.036,.037,.038,.038,.039,.04,.041,.042,.043,.045] },
  { id: 'mars',     name: 'Mars Black',            pigment: 'PBk11',  str: 0.70, group: 'black', r: [.02,.02,.02,.02,.02,.021,.021,.022,.022,.023,.024,.025,.026] }
];

// Palette presets offered in the sidebar.
window.PALETTE_PRESETS = {
  'Full set': null,
  'Basic 8': ['white', 'mars', 'cadyel', 'ochre', 'cadred', 'crimson', 'ultra', 'bumber'],
  'Cadmium-free': window.PAINTS.filter(function (p) { return !p.cad; }).map(function (p) { return p.id; })
};
