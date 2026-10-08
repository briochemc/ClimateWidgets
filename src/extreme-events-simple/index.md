# Extreme events, simply

The simple version of the [extreme events](../extreme-events/) figure. One bell curve of a summer day's maximum temperature, in degrees, for a made-up place where the average summer day peaks at 25 °C. Warm the average by a degree or two with the *Warming* slider and watch what happens to the days above 35 °C: the gray curve is the climate before, the black curve the climate after, and the vivid red is what the warming adds to the extreme heat. The other two sliders widen the curve and tilt it.

```js
import {createSimpleExtremesWidget} from "./widget.js";
```

```js
const extremes = view(createSimpleExtremesWidget());
```

## What to look for

**Warming.** The figure opens with the average already one degree warmer. Push *Warming* on to two degrees. The curve hardly looks different, yet days above 35 °C, which used to come about one summer day in 160, now come one day in 44: nearly four times as often, and the multiplier appears over the red tail once it passes two. Days below 15 °C all but disappear. Tick *Show numbers* to read the figures off.

**Spread.** Put the warming back to zero and widen the *Spread*. Both tails grow: more very hot days and more very cold ones, with fewer ordinary days in between.

**Skewness.** Tilt the curve with the *Skewness* slider. A positive skewness stretches the warm side out and tucks the cold side in, and the average does not move at all. This is how a place can get more extreme heat without getting warmer on average. Real summer maxima are skewed this way: for 1961–1990, the ERA5 reanalysis gives Sydney's a skewness of about +0.8 and Melbourne's +0.5.

**The thresholds do not move.** What counts as a dangerously hot day is set by people, crops and buildings, not by the climate, so the brackets stay where they are while the curve moves over them.

## About the figure

The curve is a Pearson type III distribution, a bell that can be skewed, and it is the normal distribution when the skewness is zero. The baseline has a mean of 25 °C and a standard deviation of 4 °C, which is roughly a Sydney or Melbourne summer (ERA5 via Open-Meteo gives 24.5 °C ± 3.2 °C for Sydney and 24.5 °C ± 5.4 °C for Melbourne over 1961–1990). The extremes are fixed temperatures, 35 °C and 15 °C, each 2.5 standard deviations from the baseline mean, so 0.6% of baseline days are beyond each. The vertical axis is the probability density, which has no units a student needs; it is labelled with what it means instead. Everything else, the painting of the tails, the multiplier and the fixed vertical scale, is as in the [full figure](../extreme-events/), whose code this one imports.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "extreme-events-simple/embed",
  height: 560,
  title: "Extreme events, simply",
  note: "The figure is a fixed 352&nbsp;px tall; the rest is the title, the three sliders " +
    "above it and the note below. Allow about 640&nbsp;px for a 320&nbsp;px phone-width frame.",
  script: `<div id="extreme-events-simple"></div>

<script type="module">
  import {createSimpleExtremesWidget}
    from "${cdnUrl("extreme-events-simple/widget.js")}";

  // Options, all in °C: {mean: 25, sd: 4} is the baseline's average and spread;
  // {hot: 35, cold: 15} the thresholds; {warming: 0} opens with the two curves on
  // top of each other instead of the average already up by one degree; {skew0: 0.6}
  // gives the baseline a skew; {showNumbers: true} shows the figures from the start;
  // {quantity: "Daily minimum temperature"} renames the axis.
  document.getElementById("extreme-events-simple")
    .appendChild(createSimpleExtremesWidget());
<\/script>`
}));
```

---

Sources and credits:

- IPCC (2012), *Managing the Risks of Extreme Events and Disasters to Advance Climate Change Adaptation* (SREX), [Figure SPM.3](https://www.ipcc.ch/report/managing-the-risks-of-extreme-events-and-disasters-to-advance-climate-change-adaptation/), for the schematic this figure animates.
- The baseline's numbers were chosen with a look at ERA5 daily maximum temperatures from the [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api), but the figure uses no real data.
