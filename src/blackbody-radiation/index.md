# Blackbody radiation

Everything warmer than absolute zero glows. How brightly, and in what colours, depends on its temperature alone: that is Planck's law, and it is where the greenhouse effect starts. The Sun, at 5772 K, glows mostly in visible light. The Earth, at 288 K, glows too, but entirely in the infrared, at wavelengths twenty times longer. The atmosphere treats those two kinds of light very differently.

Left alone, the figure tours its objects from the coldest to the hottest and round again. Change the temperature yourself and the tour stops; *Play tour* starts it again. Switching between *Log* and *Linear* does not interrupt it, so you can watch the same tour on either axis. Drag the slider or the peak itself, pick an object to jump to its exact temperature, or type a temperature of your own into the box. The slider lies along the wavelength axis with its handle directly under the peak of the curve, so moving it left, toward the hot end, carries the peak toward shorter wavelengths, out of the infrared, through the visible band and into the ultraviolet. The brightness axis rescales as you go, because it has to: the peak at the hot end of the slider is seventeen billion times higher than at the cold end.

```js
import {createBlackbodyRadiationWidget} from "./widget.js";
```

```js
const blackbody = view(createBlackbodyRadiationWidget());
```

## What to look for

**The slider is Wien's law.** The curve shows how brightly something glows at each wavelength, which physicists call its *spectral radiance*. Planck's law gives it for a perfect absorber and emitter, a *blackbody*, at wavelength ${tex`\lambda`} and temperature ${tex`T`}:

```tex
B_\lambda(\lambda, T) = \frac{2hc^2}{\lambda^5}\,\frac{1}{e^{hc/\lambda k_\mathrm{B} T} - 1}
```

Its peak sits at ${tex`\lambda_\text{peak} = b/T`} with ${tex`b = 2898`} μm K: 0.50 μm for the Sun, 10 μm for the Earth's surface. That is why a temperature slider can be drawn on a wavelength axis at all. Every temperature has one wavelength where it peaks, the handle sits at that wavelength, and each object's tick on the slider is directly below the peak of its gray curve. Hotter is to the left only because shorter wavelengths are. On the logarithmic axis the correspondence is even: doubling the temperature moves the peak the same distance to the left wherever you start.

**The curve never changes shape.** On the logarithmic axis every curve in the figure, black or gray, is the same shape: temperature slides it sideways and stretches it upward, and does nothing else. The coloured band marks visible light, 0.38 to 0.75 μm. At the Sun's temperature it sits under the peak. With the slider at a light-bulb filament the peak has moved well into the infrared and only the curve's short-wavelength foot is left in the band, which is why a filament wastes more than 90% of its power as heat. Below about 800 K nothing is left in the band at all.

**The brightness axis is a fifth power.** The height of the peak grows as ${tex`T^5`}, and the total power radiated as ${tex`T^4`} (the Stefan–Boltzmann law, ${tex`\sigma T^4`} per square metre of surface). The Sun's surface is 20 times hotter than the Earth's, so its peak is 3.2 million times higher and each square metre radiates 160,000 times the power. This is why the gray curves behave as they do: a slightly cooler object is already much lower, a much cooler one is pressed flat against the axis, and a hotter one leaves through the top of the frame almost at once. A hotter body outshines a cooler one at *every* wavelength, not just near its own peak: the curves never cross.

**Try the linear axis.** The *Linear* button redraws the same curves against a plain wavelength axis from 0 to 20 μm. At the Earth's end of the slider this is the picture in the textbooks: a steep rise, a peak at 10 μm in the middle of the axis, and a long tail. It is also the honest one for judging power by eye, since on a linear axis the area under the curve *is* the power. Then click *Sun*. The whole solar spectrum becomes a spike against the left edge, its peak a fortieth of the way along, and the hot third of the slider is squeezed into a few pixels with it. No linear axis can show sunlight and earthlight together, which is the reason the default here is logarithmic, and it is a fair picture of how far apart the two are. One more thing changes on this axis. Below 290 K the peak is past the middle of the axis and the curve is increasingly cut off by the right edge, which makes it a poor thing to size the frame by, so from there down the brightness axis stops following and the curves simply sink, as the fifth power says they should.

**Sunlight and earthlight barely overlap.** 98% of the power of a 5772 K blackbody lies between 0.25 and 4.0 μm. 98% of a 288 K one lies between 5.0 and 80 μm. Click *Sun* and then *Earth's surface* and watch the curve cross the axis from one side of 4 μm to the other. Gases such as water vapour and CO₂ are largely transparent across the first range and absorb strongly in parts of the second, so energy arrives more easily than it leaves. The two Earth entries are the result: seen from space the Earth radiates like a 255 K body, 240 W per m², which balances the sunlight it absorbs, while the surface underneath is at 288 K and radiates 390 W per m².

**Only a quarter of the power is on the short side of the peak.** Against wavelength itself (the linear view) the curve rises steeply and falls slowly, so the peak is not the middle: 25% of the power is at shorter wavelengths and 75% at longer ones, at any temperature. Half lies beyond 1.42 peak wavelengths.

## About the figure

The constants are the exact SI values of ${tex`h`}, ${tex`c`} and ${tex`k_\mathrm{B}`}, and radiance is per micrometre of wavelength, which keeps the numbers readable at Earth temperatures (about 8 W m<sup>−2</sup> sr<sup>−1</sup> μm<sup>−1</sup> at the 288 K peak). The implementation was checked three ways: the numerical peak against Wien's constant, the numerical integral over wavelength against ${tex`\sigma T^4/\pi`} (they agree to six figures from 210 K to 20,000 K), and the percentile points against the table in Wikipedia's [Planck's law](https://en.wikipedia.org/wiki/Planck%27s_law#Percentiles) article. The ultraviolet, visible and infrared shares come from the series for the integral of Planck's law up to a given wavelength, with the visible band taken as 380 to 750 nm.

The wavelength axis is fixed: 0.05 to 100 μm on the logarithmic scale, 0 to 20 μm on the linear one, and switching between them morphs one scale into the other so that each curve can be followed across. The brightness axis runs to 1.5 times the current peak, except on the linear scale below 290 K, where it holds at 1.5 times the peak of the 290 K curve, the last one whose peak is in the left half of the axis. Its tick marks come from the 1–2–5 sequence and fade in and out according to how far apart they are on screen, so the axis rescales continuously instead of jumping. A reference curve is labelled while its peak is inside the frame and tall enough to read, and unlabelled otherwise. The two exceptions are the Sun and the Earth's surface, the pair this whole site is about: their curves are drawn thicker and darker, and when either one's peak is out through the top of the frame its name moves down onto the side of the curve instead of disappearing. Every label is also a button: click *Sun* on its curve and the black curve goes there, just as it does from the buttons under the figure. One caution about the logarithmic view: equal widths on a log axis are not equal ranges of wavelength, so there the area under the curve is not proportional to power. The percentages under the figure are computed from the integral, not read off the picture.

**Colour.** The swatch, the slider track and the dots on the buttons show the colour of a blackbody at that temperature: Planck's law weighted by the CIE 1931 colour-matching functions (in the analytic fit of [Wyman, Sloan & Shirley, 2013](https://jcgt.org/published/0002/02/01/)), converted to sRGB. The results agree with Mitchell Charity's widely used [blackbody colour table](http://www.vendian.org/mncharity/dir3/blackbody/) to within a few units per channel. Hue is physics; brightness is not. A screen cannot show the many orders of magnitude between a dull red glow and a filament, so the swatch simply fades to black below the [Draper point](https://en.wikipedia.org/wiki/Draper_point), 798 K, where a solid first becomes visible by its own light in a dark room. Note that the Sun comes out nearly white, not yellow, which is correct.

**The objects.** Real objects are not perfect blackbodies. Skin, water, ice, rock and soot come close in the infrared (emissivity above 0.9); a polished metal, a gas or a clean flame does not. Each gray curve is the blackbody at the object's temperature, the most that object could emit.

| Object | Temperature | Note |
|---|---|---|
| Mars | 210 K | Global mean surface temperature |
| Earth from space | 255 K | Effective emission temperature: what balances the 240 W m<sup>−2</sup> of absorbed sunlight |
| Ice (0 °C) | 273 K | Melting point of water |
| Earth's surface | 288 K | Global mean surface temperature, about 15 °C |
| Human body | 306 K | Skin, about 33 °C, rather than the 37 °C core: skin is what radiates |
| Boiling water (100 °C) | 373 K | A kettle as it clicks off |
| Oven (250 °C) | 523 K | A hot kitchen oven |
| First red glow | 798 K | The Draper point |
| Cigarette | 1100 K | The tip during a puff, roughly 800–900 °C; it smoulders cooler between puffs |
| Lava | 1450 K | Basalt erupts at about 1100–1200 °C |
| Molten iron | 1811 K | Melting point of iron, 1538 °C |
| Light bulb | 2700 K | Tungsten filament of an incandescent bulb |
| Sun | 5772 K | The IAU's nominal solar effective temperature |
| Sirius | 9940 K | Sirius A, the brightest star in the night sky |

The two stellar values, for the Sun and Sirius, are effective temperatures: the temperature of the blackbody that would radiate the same total power per unit area. All the temperatures here are representative and rounded, which is why the figure pairs each object with its temperature by ≈ and not =.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "blackbody-radiation/embed",
  height: 785,
  title: "Blackbody radiation",
  note: "The figure is a fixed 466&nbsp;px tall; the rest is the read-out and the object " +
    "buttons, which wrap onto more rows as the frame narrows. The height above suits a frame " +
    "640&nbsp;px wide or more. Allow about 1015&nbsp;px for a 320&nbsp;px phone-width frame.",
  script: `<div id="blackbody-radiation"></div>

<script type="module">
  import {createBlackbodyRadiationWidget}
    from "${cdnUrl("blackbody-radiation/widget.js")}";

  // Options: {temperature: 288} opens on the Earth's surface instead of the Sun,
  // {scale: "linear"} on the linear wavelength axis instead of the logarithmic one.
  document.getElementById("blackbody-radiation")
    .appendChild(createBlackbodyRadiationWidget());
<\/script>`
}));
```

---

Sources and credits:

- The idea of a slider-driven Planck curve, and the first version of the maths this one was checked against, come from David Ward's [Blackbody Radiation interactive](https://space-charts.vercel.app/) ([source](https://github.com/gendelbendel/space-charts)).
- Wikipedia, [Planck's law](https://en.wikipedia.org/wiki/Planck%27s_law) and [Blackbody radiation](https://en.wikipedia.org/wiki/Black-body_radiation), for the formula, the percentile table, the skin temperature and the Draper point.
- Prša, A. et al. (2016), ["Nominal values for selected solar and planetary quantities: IAU 2015 Resolution B3"](https://doi.org/10.3847/0004-6256/152/2/41), *The Astronomical Journal* 152, 41, for the Sun's 5772 K.
- Wyman, C., Sloan, P.-P. & Shirley, P. (2013), ["Simple analytic approximations to the CIE XYZ color matching functions"](https://jcgt.org/published/0002/02/01/), *Journal of Computer Graphics Techniques* 2(2), 1–11.
