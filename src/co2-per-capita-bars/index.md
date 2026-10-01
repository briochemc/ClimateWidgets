# CO₂ per person, country by country, as bars

Every country is a bar: its height is its population, its length is its CO₂ emissions per person, so its area is its emissions in all, and that is the number written in it. The bars are stacked from the bottom in order of emissions per person, the lowest at the bottom, so the population axis starts at zero and the stack reaches 8.2 billion people today. Click or tap a bar for its label (the arrow keys then walk the selection up and down the ranking), or a region in the key to see only its countries; drag the slider to another year, or press **Play tour** to see the years from 1850 play through.

```js
import {createCo2PerCapitaBarsWidget} from "./widget.js";

const data = await FileAttachment("../co2-per-capita/data/co2-per-capita.json").json();
```

```js
const bars = view(createCo2PerCapitaBarsWidget({data}));
```

**Yearly emissions** divides the year's emissions by the year's population; **Cumulative emissions** divides everything a country has emitted since 1850 by its population in the year shown. The figure opens on the latest year, with the other bars dimmed and three notes around China's bar that say what height, length and area mean; they go when you touch anything, and come back whenever you switch between the two views. Australia is labelled whenever its label fits. The tour runs from 1850 to the latest year once and stops there; as the ranking changes the bars slide up and down past one another, and countries appear when their records begin. Both scales are fixed (35 tonnes a year, 2,000 since 1850), so the frame never moves; a bar that overshoots is cut at the edge and marked with a dot.

## What to look for

**Area is emissions.** The tall thin bars at the bottom are most of humanity at a tonne or two a person; the long thin bars at the top are the Gulf states; the big rectangles in between, China and the United States, are where most of the CO₂ is.

**The race.** Play the tour and watch China climb: near the bottom of the stack for a century, past the world average in 2007, past the United Kingdom in the 2010s and Germany in 2022. India is still low in the stack, and getting taller every year.

For the same picture with the year fixed and nothing moving, see [CO₂ per person today](../co2-per-capita-today/).

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "co2-per-capita-bars/embed",
  height: 920,
  title: "CO₂ per person, country by country, as bars",
  note: "The plot is 680&nbsp;px tall whatever the width, and fills the frame up to 960&nbsp;px wide; allow about " +
    "960&nbsp;px of height at phone width, where the controls wrap. The embed page accepts <code>?year=1990</code> " +
    "to open on that year and <code>?mode=cumulative</code> to open on emissions since 1850.",
  script: `<div id="co2-per-capita-bars"></div>

<script type="module">
  import {createCo2PerCapitaBarsWidget}
    from "${cdnUrl("co2-per-capita-bars/widget.js")}";

  const data = await fetch("${cdnUrl("co2-per-capita/data/co2-per-capita.json")}")
    .then(r => r.json());

  // Options: {year: 1990} opens on that year, {mode: "cumulative"} on emissions since 1850.
  document.getElementById("co2-per-capita-bars")
    .appendChild(createCo2PerCapitaBarsWidget({data}));
<\/script>`
}));
```

---

Data: [Our World in Data's CO₂ and greenhouse gas emissions dataset](https://github.com/owid/co2-data) (CC BY 4.0), which carries the Global Carbon Budget's national emissions and Our World in Data's population series (HYDE and the UN). Emissions are fossil fuels and cement plus land-use change, as in the carbon-budget widgets, so Brazil and Indonesia rank higher than on a fossil-only chart and the early decades are mostly land clearing. Countries appear when both series exist for them: 32 in 1850, 175 by 1950, 213 today. The five regions are the UN's, with Russia counted with Europe and the Middle East with Asia; colours are Okabe and Ito's. The data file is shared with [the polar chart](../co2-per-capita/) this widget began as, and refreshed by `scripts/co2-per-capita.mjs`.
