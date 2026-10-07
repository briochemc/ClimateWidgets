# Extreme events

Climate change is a change in the odds. A warming of one degree in the mean sounds like nothing, and most days it is nothing. But the hottest days are the tail of a distribution, and a tail is where a small shift makes a large difference: push a bell curve a little to the right and the sliver beyond the old record swells into a wedge. This figure lets you do the pushing. The gray curve is the distribution of some climate quantity as it was: temperature, rainfall, wind. Move the sliders and the black curve is the same distribution after a change in its mean, its spread, its skewness or the weight of its tails. Drag the handle under the axis to decide what counts as extreme, and watch the red area.

```js
import {createExtremeEventsWidget} from "./widget.js";
```

```js
const extremes = view(createExtremeEventsWidget());
```

## What to look for

**A shift in the mean.** The figure opens on the normal distribution with the mean already moved up by half the spread. Push the *Mean* slider on to a full notch of spread. The curve barely looks different, yet what was beyond the threshold 2% of the time is now there 16% of the time: seven times as often. Tick *Show numbers* to read it off. The further out the threshold, the bigger the multiplier: for a record that used to be passed one day in a thousand, the same shift makes it one day in fifty-five.

**A change in the spread.** Put the mean back and widen the *Spread* instead. Both tails grow at once: more hot extremes and more cold ones, with fewer ordinary days in between. Narrow it and the extremes vanish from both ends. Whether the spread of daily temperature is changing is a live question in the science; the shift of the mean is not.

**Skewness.** Pick the *Skewed* distribution. Its third slider tilts the curve: positive skewness lengthens the warm tail and shortens the cold one, and the mean and spread stay exactly where they were. This is how a distribution can produce more extremes at one end without any change in the average, and it is the case drawn in the IPCC's schematic as "changed symmetry".

**Fat tails.** The *Heavy-tailed* distribution has a kurtosis slider instead. Raising it moves probability out of the shoulders of the curve and into both the peak and the far tails. The curve looks more peaked, not wider, yet extremes become more common.

**Quantities that cannot go below zero.** Rainfall and wind speed are bounded at zero and skewed by nature, and their distributions are not bells. The *Gamma*, *Lognormal* and *Weibull* families start at zero. Their skewness is not a free choice: it follows from the mean and the spread, which is why the skewness slider is greyed out and shows the implied value. Shift the mean of a gamma and the whole shape changes, because it is pinned at the bound.

## About the figure

Everything is drawn in units of the original distribution's standard deviation, with its mean at zero, or at two standard deviations for the families bounded at zero so that the bound is in the frame. The threshold is set in the same units; it starts at two standard deviations above the original mean, which a normal distribution exceeds 2.3% of the time. The red and gray areas are computed from the cumulative distribution functions, not read off the picture, and the vertical scale is fixed at twice the original curve's peak, stretching only when the black curve would otherwise overflow, so that the gray curve holds still while the sliders move.

The controls are the same four moments whatever the family, and a family that does not have one of them as a free parameter greys that slider out. Where a one-to-one mapping from the moments onto the family's own parameters exists, it is used:

| Family | Free moments | Mapping | Typical use |
|---|---|---|---|
| Normal | mean, spread | direct | daily temperature, pressure |
| Skewed (Pearson type III) | mean, spread, skewness ${tex`\gamma`} | shape ${tex`4/\gamma^2`}, scale ${tex`\sigma\lvert\gamma\rvert/2`}, shifted so the mean is right, mirrored for ${tex`\gamma<0`}; the normal at ${tex`\gamma = 0`} | temperature with a skew; the hydrologist's family for anything skewed |
| Heavy-tailed (Student's ${tex`t`}) | mean, spread, excess kurtosis ${tex`\kappa`} | degrees of freedom ${tex`\nu = 4 + 6/\kappa`}, scaled by ${tex`\sqrt{(\nu-2)/\nu}`} | fat-tailed temperature |
| Gamma | mean, spread | shape ${tex`(\mu/\sigma)^2`}, scale ${tex`\sigma^2/\mu`}; skewness ${tex`2\sigma/\mu`} follows | rainfall totals |
| Lognormal | mean, spread | ${tex`s^2 = \ln(1 + \sigma^2/\mu^2)`}, ${tex`m = \ln\mu - s^2/2`} | rainfall, wind |
| Weibull | mean, spread | shape from the coefficient of variation, by bisection; scale ${tex`\mu/\Gamma(1 + 1/k)`} | wind speed |

The sliders stop where the shapes stop being useful: skewness at ±1.5, where a Pearson III is still a bell (at ±2 it is an exponential with its mode on the bound), and kurtosis at 6, a ${tex`t`} with five degrees of freedom.

Observable Plot has no parametric distributions and d3-random has only samplers, so the densities, their cumulative distributions and the three special functions behind them (log-gamma, the regularized incomplete gamma and beta functions, the complementary error function) are written into the widget in the forms given in *Numerical Recipes*. They were checked against numerical integration: for every family the density integrates to one and reproduces the moments it was asked for to four figures, and the cumulative distribution agrees with the integral of the density to better than ${tex`10^{-4}`}.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "extreme-events/embed",
  height: 600,
  title: "Extreme events",
  note: "The figure is a fixed 350&nbsp;px tall; the rest is the menu above and the four " +
    "sliders below. Allow about 640&nbsp;px for a 320&nbsp;px phone-width frame, where the " +
    "controls wrap onto more rows.",
  script: `<div id="extreme-events"></div>

<script type="module">
  import {createExtremeEventsWidget}
    from "${cdnUrl("extreme-events/widget.js")}";

  // Options: {family: "gamma"} opens on another family ("normal", "pearson3",
  // "student", "gamma", "lognormal", "weibull"); {shift: 0} opens with the two
  // curves on top of each other instead of the mean already moved up by half a
  // standard deviation; {threshold: 1.5} sets where the threshold starts, in
  // standard deviations above the original mean; {showNumbers: true} shows the
  // figures from the start; {words: ["cool", "usual", "warm"]} replaces the
  // three words on the axis.
  document.getElementById("extreme-events")
    .appendChild(createExtremeEventsWidget());
<\/script>`
}));
```

---

Sources and credits:

- IPCC (2012), *Managing the Risks of Extreme Events and Disasters to Advance Climate Change Adaptation* (SREX), [Figure SPM.3](https://www.ipcc.ch/report/managing-the-risks-of-extreme-events-and-disasters-to-advance-climate-change-adaptation/), and IPCC (2013), AR5 WGI Chapter 1, Figure 1.8, for the schematic of a shifted mean, a wider spread and a changed symmetry that this figure animates.
- The format, with no vertical axis and the numbers kept out of the picture, follows a chart in *The Economist* of 11 February 2023.
- Wikipedia, [Pearson distribution](https://en.wikipedia.org/wiki/Pearson_distribution), [Student's t-distribution](https://en.wikipedia.org/wiki/Student%27s_t-distribution), [Log-normal distribution](https://en.wikipedia.org/wiki/Log-normal_distribution) and [Weibull distribution](https://en.wikipedia.org/wiki/Weibull_distribution), for the moment formulas.
- Press, W. H., Teukolsky, S. A., Vetterling, W. T. & Flannery, B. P., *Numerical Recipes*, for the special functions.
