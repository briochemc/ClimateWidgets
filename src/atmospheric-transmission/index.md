# Atmospheric transmission

Sunlight comes in mostly as visible light, and the Earth sends the energy back out as infrared, at wavelengths twenty times longer. The air in between is not equally clear to both. Water vapour, carbon dioxide and a few other gases each absorb at their own wavelengths, and where they do, light that would have gone straight through is stopped. This figure shows what gets through, gas by gas, along the same wavelength axis as the [black-body widget](../blackbody-radiation/): the top panel is the two glows, sunlight and the Earth's, each drawn faintly in full and solidly where it gets through; the middle panel is the fraction the whole atmosphere absorbs; and the rows below are the constituents, one each, which you can leave out or put back.

Left alone, the figure starts with no atmosphere at all and adds the constituents one at a time: oxygen and Rayleigh scattering first, then the greenhouse gases, carbon dioxide, methane, nitrous oxide, ozone and finally water vapour. Press anything and the tour stops; *Play tour* starts it again. Tick a gas's box in the figure, or press its button under it, to include it or leave it out; the presets do the common combinations, the segmented controls set the amounts of carbon dioxide, methane and nitrous oxide (1750, today, or double today's), and the slider moves the Earth's surface temperature. Hover or touch the figure to read the absorption at any wavelength.

```js
import {createAtmosphericTransmissionWidget} from "./widget.js";

const data = await FileAttachment("data/transmission.json").json();
```

```js
const transmission = view(createAtmosphericTransmissionWidget({data}));
```

## What to look for

**Sunlight gets in more easily than the glow gets out.** With everything included, ${formatShare(transmission.sunlightToGround)} of the sunlight reaches the ground and ${formatShare(transmission.glowToSpace)} of the surface's glow escapes straight to space. The top panel shows why. Between 0.3 and 1 μm, where the Sun is brightest, the air is nearly transparent; the bites out of the near-infrared tail of the solar curve are all water vapour. Between 5 and 100 μm, where the Earth's surface glows, most of the curve is stopped. That is the greenhouse effect in one picture: the energy arrives, and it leaves less easily than it arrives.

**The window.** Look at the middle panel between 8 and 13 μm. The absorbed fraction drops to almost nothing there, apart from ozone's band at 9.6 μm, and that stretch sits right under the peak of the Earth's curve. It is the *atmospheric window*: the wavelengths through which the surface can radiate straight to space. Nearly everything the Earth sends out directly escapes through it. Either side, water vapour closes the window: its bending band at 6.3 μm on the short side, and beyond 17 μm its rotational bands, which by 30 μm make the air opaque.

**Carbon dioxide's band gets wider, not deeper.** Leave in only carbon dioxide (the preset) and switch its amount from 1750 to today to doubled. The centre of its 15 μm band was already completely opaque in 1750; more gas cannot make it more opaque. What changes is the edges: the band widens, at 13 and at 17 μm, and each time it widens it takes another slice of the Earth's curve. That is why "the CO₂ band is saturated" is not the objection it sounds like. The same is true of the 4.3 μm band, which matters less because neither the Sun nor the Earth is bright there.

**A colder or a warmer surface.** The slider moves the Earth's surface from 210 K to 310 K, and its curve slides along the axis under bands that stay where they are (Wien's law: the peak wavelength is inversely proportional to the temperature). At 288 K the peak, at 10 μm, sits in the window. Cool the surface to 210 K, the Martian mean or an Antarctic winter night, and the peak moves out to 14 μm, onto the carbon dioxide band and the far-infrared water bands: with everything included, the share that escapes falls from 28% at 288 K to about 18%. Warm it to 310 K and the peak moves to 9.4 μm, deeper into the window, and about 30% escapes. It is a small effect on the share, because the window is wide and the curve broad, but it is one part of why a warmer surface cools itself more efficiently through the window, and why a cold one does not.

**Water vapour does most of the absorbing, in bands, and its amount is set by the temperature.** Leave in only water vapour: most of the infrared picture is already there. Water's bands are wide and numerous, and on an average day there are about ten thousand water molecules in the air for every CO₂ molecule. But water vapour condenses out in days and its amount follows the temperature, so it is not a control on the climate but an amplifier. The dry gases, carbon dioxide first, set the temperature; the water vapour follows and roughly doubles their effect.

**Ozone is the ultraviolet.** In the top-left of the figure, everything short of 0.3 μm is stopped, and the ozone row shows what stops it: the Hartley band, so strong that the 300 Dobson units of ozone in the column (a layer 3 mm thick at sea-level pressure) are enough to make the air opaque there. The far ultraviolet, below 0.2 μm, is taken out higher still by oxygen itself. Ozone also has the 9.6 μm band that sits in the middle of the window, which makes it a greenhouse gas as well.

**Why the sky is blue is in the last row.** Rayleigh scattering is not absorption: the light is deflected, not stopped, but for light travelling straight from the Sun to your eye it comes to the same thing. It rises as the fourth power of the frequency, so it takes a quarter of the violet, a tenth of the red, and nothing at all from the infrared. The row's ramp on the left is the blue of the sky (and the red of the sunset, when the path is long).

**Oxygen, methane and nitrous oxide.** Oxygen has a few narrow bands in the red and near-infrared, the ones that make the dark lines at 0.69 and 0.76 μm in the solar spectrum. Methane's band at 7.7 μm and nitrous oxide's at 7.8 and 17 μm lie at the edges of the water-vapour bands, which is part of why a molecule of either is worth so many of CO₂: they absorb where the air is still partly clear. Switch either from its 1750 amount to today's: methane has nearly tripled, so its band deepens visibly, where the CO₂ band, already opaque at its centre, only widens. That is the other half of why methane is so potent per molecule: its band is not yet saturated.

## About the figure

The spectra are computed, not drawn, and the computation is the standard one: the [HITRAN](https://hitran.org/) database lists the position, strength and width of every known absorption line of every gas, and a *line-by-line* code broadens each line for the pressure and temperature of each layer of the atmosphere, adds them up, and applies the Beer–Lambert law through the column. Here the code is [RADIS](https://radis.readthedocs.io/) (van den Bekerom & Pannier 2021), run offline once by `scripts/atmospheric-transmission.py` in this site's repository, and the result is shipped as a data file. The atmosphere is the US Standard Atmosphere 1976 in 26 layers from the surface to 60 km, with water vapour and ozone given their own vertical profiles after the AFGL standard tables, scaled to a 25 kg m<sup>−2</sup> column of water (the global mean) and 300 Dobson units of ozone. Carbon dioxide is 428 ppm, methane 1939 ppb and nitrous oxide 340 ppb (NOAA's 2025 global means); their 1750 amounts are 278 ppm, 729 ppb and 270 ppb (IPCC AR6), and "doubled" is twice today's. The three amounts of each are one line-by-line run with the optical depth rescaled, which is exact since it is linear in the amount. Layering matters: a single layer at surface pressure makes the 15 μm band half a micrometre too wide at each edge, because pressure broadening at 1 atm is then applied to gas that mostly sits higher up.

Two things are not in HITRAN's line lists and were added. The ultraviolet bands of ozone (Hartley, Huggins and Chappuis) are continuous rather than made of lines, and come from the laboratory cross-sections of [Serdyuchenko et al. (2014)](https://doi.org/10.5194/amt-7-625-2014) at 223 K, the temperature of the ozone layer. Below 0.2 μm, where oxygen's Schumann–Runge bands take over, the figure simply treats the air as opaque. Rayleigh scattering is the analytic formula of [Bodhaine et al. (1999)](https://doi.org/10.1175/1520-0426(1999)016%3C1854:ORODC%3E2.0.CO;2) for a vertical column at sea level, continued below 0.2 μm as Rayleigh's own λ<sup>−4</sup> law (the formula is a fit for the near-ultraviolet to the near-infrared and misbehaves in the far ultraviolet). Each per-gas transmittance is then averaged over 3,000 wavelength bins, evenly spaced on the log axis (a bin is a quarter of a percent wide, a fraction of a pixel), and the widget multiplies the bin averages of the gases you include to get the total. The two read-outs are integrals of that total weighted by the Planck curve at 5772 K and at the chosen surface temperature (288 K unless you move the slider) over the axis, 0.05 to 100 μm.

Things to know before quoting a number from it:

- **Clear sky, vertical path, direct transmission only.** Clouds are absent; sunlight in reality comes in at a slant, so the day-averaged path through the air is longer than the vertical one shown, and less gets through. And "escapes straight to space" means exactly that: the surface's own glow, transmitted directly. The atmosphere also radiates, and most of what the Earth actually sends to space is emitted by the air itself, not by the ground. This is a picture of transmission, not an energy budget; for the latter, compare the 288 K and 255 K curves in the black-body widget.
- **No water-vapour continuum.** Besides its lines, water vapour has a smooth background absorption (the *continuum*, modelled by MT_CKD in the professional codes) that is strongest in the 8–13 μm window. Without it the window is cleaner here than in reality, and the read-out of what escapes to space is a few points too high, more so in humid air.
- **Multiplying averages.** The total is the product of per-bin averages of each gas's transmittance, which is exact where only one gas absorbs in a bin and an approximation where two overlap (water vapour and CO₂ overlap near 15 μm and 2.7 μm, for instance). The error is small at this bin width and always makes the air slightly too opaque.
- **Both curves are scaled to their own peak.** In the top panel the Sun and the Earth are drawn the same height, as in Rohde's original. Per square metre of the Earth, the sunlight arriving at the top of the atmosphere, averaged over the globe, peaks about seventeen times higher than the surface's glow but spans a range of wavelengths twenty times narrower, so the two areas are comparable: that near-balance is what sets the Earth's temperature. Scaling each curve to its own peak is what lets the two be read on one panel.
- **Fine structure is not shown.** The lines themselves are far narrower than a bin, so what looks like a smooth band is the average over thousands of lines; hover values are bin averages too.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "atmospheric-transmission/embed",
  height: 880,
  title: "Atmospheric transmission",
  note: "The figure is a fixed 600&nbsp;px tall; the rest is the controls, the read-out and the " +
    "gas buttons, which wrap onto more rows as the frame narrows. The height above suits a frame " +
    "640&nbsp;px wide or more; allow about 1050&nbsp;px at phone width. The embed page accepts " +
    "<code>?co2=278</code> (or 428, 856), <code>?ch4=729</code> (1939, 3878) and <code>?n2o=270</code> " +
    "(340, 680) to open on those amounts (<code>1750</code>, <code>today</code> and <code>doubled</code> " +
    "work too), <code>?gases=h2o,co2</code> to open with only those constituents included, " +
    "<code>?earth=255</code> to open with the surface at that temperature (210 to 310 K), and " +
    "<code>?tour=0</code> to start without the tour.",
  script: `<div id="atmospheric-transmission"></div>

<script type="module">
  import {createAtmosphericTransmissionWidget}
    from "${cdnUrl("atmospheric-transmission/widget.js")}";

  const data = await fetch("${cdnUrl("atmospheric-transmission/data/transmission.json")}")
    .then(r => r.json());

  // Options: {amounts: {co2: 278, ch4: "1750", n2o: "doubled"}} opens on those amounts,
  // {gases: ["h2o", "co2"]} with only those constituents included, {earthTemperature: 255}
  // with the surface at that temperature (210 to 310 K), {tour: false} without the tour.
  document.getElementById("atmospheric-transmission")
    .appendChild(createAtmosphericTransmissionWidget({data}));
<\/script>`
}));
```

```js
function formatShare(f) {
  const pct = 100 * f;
  return pct < 1 || pct > 99 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
}
```

---

Sources and credits:

- Rohde, R. A., [*Atmospheric Transmission*](https://commons.wikimedia.org/wiki/File:Atmospheric_Transmission-en.svg), Global Warming Art, the figure this one reproduces interactively (his was computed with GATS's Spectral Calculator from the same HITRAN data).
- Gordon, I. E. et al. (2022), ["The HITRAN2020 molecular spectroscopic database"](https://doi.org/10.1016/j.jqsrt.2021.107949), *JQSRT* 277, 107949.
- van den Bekerom, D. C. M. & Pannier, E. (2021), ["A discrete integral transform for rapid spectral synthesis"](https://doi.org/10.1016/j.jqsrt.2020.107476), *JQSRT* 261, 107476, the RADIS code.
- Serdyuchenko, A., Gorshelev, V., Weber, M., Chehade, W. & Burrows, J. P. (2014), ["High spectral resolution ozone absorption cross-sections – Part 2: Temperature dependence"](https://doi.org/10.5194/amt-7-625-2014), *Atmos. Meas. Tech.* 7, 625–636, via the [MPI-Mainz UV/VIS Spectral Atlas](https://uv-vis-spectral-atlas-mainz.org/).
- Bodhaine, B. A., Wood, N. B., Dutton, E. G. & Slusser, J. R. (1999), ["On Rayleigh optical depth calculations"](https://doi.org/10.1175/1520-0426(1999)016%3C1854:ORODC%3E2.0.CO;2), *J. Atmos. Oceanic Technol.* 16, 1854–1861.
- Anderson, G. P. et al. (1986), *AFGL atmospheric constituent profiles (0–120 km)*, AFGL-TR-86-0110, for the shape of the water vapour and ozone profiles; NOAA Global Monitoring Laboratory for today's CO₂, CH₄ and N₂O.
- Archer, D., [MODTRAN Infrared Light in the Atmosphere](https://climatemodels.uchicago.edu/modtran/), University of Chicago, an interactive of the same physics from the other side (what the air emits, not what it transmits).
