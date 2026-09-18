# Black-body radiation

Everything warmer than absolute zero glows. How brightly, and in what colours, depends on its temperature alone: that is Planck's law, and it is where the greenhouse effect starts. The Sun, at 5772 K, glows mostly in visible light. The Earth, at 288 K, glows too, but entirely in the infrared, at wavelengths twenty times longer. The atmosphere treats those two kinds of light very differently.

Drag the slider, or pick an object, and watch the axes. The frame always follows the curve, so the curve itself stays put: what changes is the scale it is drawn on, and which of the gray reference curves are in view.

```js
import {createBlackbodyRadiationWidget} from "./widget.js";
```

```js
const blackbody = view(createBlackbodyRadiationWidget());
```

## What to look for

**The curve never changes shape.** Planck's law gives the spectral radiance of a perfect absorber and emitter, a *black body*, at wavelength ${tex`\lambda`} and temperature ${tex`T`}:

```tex
B_\lambda(\lambda, T) = \frac{2hc^2}{\lambda^5}\,\frac{1}{e^{hc/\lambda k_\mathrm{B} T} - 1}
```

Measured in units of its own peak, that curve is identical at every temperature. Temperature only sets the two scales, and the two axes of the figure are those two scales.

**The wavelength axis is Wien's law.** The peak sits at ${tex`\lambda_\text{peak} = b/T`} with ${tex`b = 2898`} µm·K: 0.50 µm for the Sun, 10 µm for the Earth's surface. Double the temperature and every number on the x-axis halves. The coloured band marks visible light, 0.38 to 0.75 µm. At the Sun's temperature it sits under the peak. By the time the slider is down at a light-bulb filament the band has slid well to the left of the peak, which is why a filament wastes more than 90% of its power as heat, and below about 800 K there is nothing under it at all.

**The radiance axis is a fifth power.** The height of the peak grows as ${tex`T^5`}, and the area under the curve, the total power, as ${tex`T^4`} (the Stefan–Boltzmann law, ${tex`\sigma T^4`} per square metre of surface). The Sun's surface is 20 times hotter than the Earth's, so its peak is 3.2 million times higher and each square metre radiates 160,000 times the power. This is why the gray curves behave as they do: a slightly cooler object is already much lower, a much cooler one is pressed flat against the axis, and a hotter one leaves through the top of the frame almost at once. A hotter body outshines a cooler one at *every* wavelength, not just near its own peak: the curves never cross.

**Sunlight and earthlight barely overlap.** 98% of the power of a 5772 K black body lies between 0.25 and 4.0 µm. 98% of a 288 K one lies between 5.0 and 80 µm. Click *Sun* and then *Earth's surface* and note that no tick label survives the trip. Gases such as water vapour and CO₂ are largely transparent across the first range and absorb strongly in parts of the second, so energy arrives more easily than it leaves. The two Earth entries are the result: seen from space the Earth radiates like a 255 K body, 240 W per m², which balances the sunlight it absorbs, while the surface underneath is at 288 K and radiates 390 W per m².

**Only a quarter of the power is on the short side of the peak.** The curve rises steeply and falls slowly, so the peak is not the middle: 25% of the power is at shorter wavelengths and 75% at longer ones, at any temperature. Half lies beyond 1.42 peak wavelengths.

## About the figure

The constants are the exact SI values of ${tex`h`}, ${tex`c`} and ${tex`k_\mathrm{B}`}, and radiance is per micrometre of wavelength, which keeps the numbers readable at Earth temperatures (about 8 W·m⁻²·sr⁻¹·µm⁻¹ at the 288 K peak). The implementation was checked three ways: the numerical peak against Wien's constant, the numerical integral over wavelength against ${tex`\sigma T^4/\pi`} (they agree to six figures from 210 K to 20,000 K), and the percentile points against the table in Wikipedia's [Planck's law](https://en.wikipedia.org/wiki/Planck%27s_law#Percentiles) article. The ultraviolet, visible and infrared shares come from the series for the integral of Planck's law up to a given wavelength, with the visible band taken as 380 to 750 nm.

The x-axis runs from zero to five peak wavelengths and the y-axis to 1.5 times the peak. Tick marks come from the 1–2–5 sequence and fade in and out according to how far apart they are on screen, so the axes rescale continuously instead of jumping. A reference curve is labelled while its peak is inside the frame and tall enough to read, and unlabelled otherwise.

**Colour.** The swatch, the slider track and the dots on the buttons show the colour of a black body at that temperature: Planck's law weighted by the CIE 1931 colour-matching functions (in the analytic fit of [Wyman, Sloan & Shirley, 2013](https://jcgt.org/published/0002/02/01/)), converted to sRGB. The results agree with Mitchell Charity's widely used [black-body colour table](http://www.vendian.org/mncharity/dir3/blackbody/) to within a few units per channel. Hue is physics; brightness is not. A screen cannot show the many orders of magnitude between a dull red glow and a filament, so the swatch simply fades to black below the [Draper point](https://en.wikipedia.org/wiki/Draper_point), 798 K, where a solid first becomes visible by its own light in a dark room. Note that the Sun comes out nearly white, not yellow, which is correct.

**The objects.** Real objects are not perfect black bodies. Skin, water, ice, rock and soot come close in the infrared (emissivity above 0.9); a polished metal, a gas or a clean flame does not. Each gray curve is the black body at the object's temperature, the most that object could emit.

| Object | Temperature | Note |
|---|---|---|
| Mars | 210 K | Global mean surface temperature |
| Earth from space | 255 K | Effective emission temperature: what balances the 240 W·m⁻² of absorbed sunlight |
| Ice | 273 K | Melting point of water, 0 °C |
| Earth's surface | 288 K | Global mean surface temperature, about 15 °C |
| Human body | 306 K | Skin, about 33 °C, rather than the 37 °C core: skin is what radiates |
| Kettle | 373 K | Boiling water, 100 °C |
| Oven | 523 K | A hot kitchen oven, 250 °C |
| First red glow | 798 K | The Draper point |
| Cigarette | 1100 K | The tip during a puff, roughly 800–900 °C; it smoulders cooler between puffs |
| Lava | 1450 K | Basalt erupts at about 1100–1200 °C |
| Molten iron | 1811 K | Melting point of iron, 1538 °C |
| Light bulb | 2700 K | Tungsten filament of an incandescent bulb |
| Betelgeuse | 3600 K | Red supergiant |
| Sun | 5772 K | The IAU's nominal solar effective temperature |
| Sirius | 9940 K | Sirius A, the brightest star in the night sky |
| Rigel | 12,100 K | Blue supergiant |

The stellar values are effective temperatures: the temperature of the black body that would radiate the same total power per unit area. They are rounded, and for a variable star like Betelgeuse they are only good to a couple of hundred kelvin.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "blackbody-radiation/embed",
  height: 740,
  title: "Black-body radiation",
  note: "The figure is a fixed 466&nbsp;px tall; the rest is the read-out and the object " +
    "buttons, which wrap onto more rows as the frame narrows. The height above suits a frame " +
    "640&nbsp;px wide or more. Allow about 940&nbsp;px for a 320&nbsp;px phone-width frame.",
  script: `<div id="blackbody-radiation"></div>

<script type="module">
  import {createBlackbodyRadiationWidget}
    from "${cdnUrl("blackbody-radiation/widget.js")}";

  // Optional: {temperature: 288} to open on the Earth's surface instead of the Sun.
  document.getElementById("blackbody-radiation")
    .appendChild(createBlackbodyRadiationWidget());
<\/script>`
}));
```

---

Sources and credits:

- The idea of a slider-driven Planck curve, and the first version of the maths this one was checked against, come from David Ward's [Blackbody Radiation interactive](https://space-charts.vercel.app/) ([source](https://github.com/gendelbendel/space-charts)).
- Wikipedia, [Planck's law](https://en.wikipedia.org/wiki/Planck%27s_law) and [Black-body radiation](https://en.wikipedia.org/wiki/Black-body_radiation), for the formula, the percentile table, the skin temperature and the Draper point.
- Prša, A. et al. (2016), ["Nominal values for selected solar and planetary quantities: IAU 2015 Resolution B3"](https://doi.org/10.3847/0004-6256/152/2/41), *The Astronomical Journal* 152, 41, for the Sun's 5772 K.
- Wyman, C., Sloan, P.-P. & Shirley, P. (2013), ["Simple analytic approximations to the CIE XYZ color matching functions"](https://jcgt.org/published/0002/02/01/), *Journal of Computer Graphics Techniques* 2(2), 1–11.
