# Paint Mixer

Pick or type a colour and get mixing proportions in standard artist acrylics, with alternative ways to reach the same colour.

- **Choosing a colour**: type a hex code, drag on the colour wheel, use the hue, saturation and brightness gradients, or sample any pixel on screen with the eyedropper.
- **Recipes in parts**, plus percentages and ml for any batch size.
- **Alternatives**: best recipe, closest colour, fewest paints, no black, cadmium-free and other routes through different pigments.
- **Your paints**: tick the tubes you own (24 standard colours, or the Basic 8 and Cadmium-free presets) and recipes use only those.
- **Honest matches**: every recipe shows its colour next to your target with a ΔE score, and colours paint can't reach are flagged.

## How it works

Paints mix by Kubelka-Munk theory: absorption and scattering add per wavelength (400-700 nm), so yellow + blue gives green. Colour difference is CIEDE2000, where about 1 is the smallest difference most people can see.

The reflectance curves and tinting strengths in `js/paints.js` are modelled from how each pigment typically behaves. They are not lab measurements of a brand, so use recipes as starting points, test a swatch and adjust by eye. Acrylics usually dry a little darker.

## Run and build

Open `index.html` through any local web server, for example `py -m http.server 8768`. `?hex=C2410C` sets the starting colour.

`desktop\build.ps1` builds `dist\PaintMixer.exe`, a single exe with the app embedded in a WebView2 window, using the csc that ships with Windows.
