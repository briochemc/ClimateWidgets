# CO₂ per person, country by country, as bars

[The polar chart](../co2-per-capita/) unrolled. Every country is a bar: its height is its population, its length is its CO₂ emissions per person, so its area is its emissions in all. The bars are stacked from the top in order of emissions per person, the highest first, and the full height of the plot is ten billion people, so the stack fills most of it today and a sliver of it in 1850. Click or tap a bar for the country's numbers, or a group in the key to see only its countries.

```js
import {createCo2PerCapitaBarsWidget} from "./widget.js";

const data = await FileAttachment("../co2-per-capita/data/co2-per-capita.json").json();
```

```js
const bars = view(createCo2PerCapitaBarsWidget({data}));
```

*Per person* is one of two things, as on the polar chart: **This year** divides the year's emissions by the year's population; **Since 1850** divides everything a country has emitted since 1850 by its population in the year shown. Left alone, the figure plays the years through from 1850, and as the ranking changes the bars slide up and down past one another; countries appear when their records begin. Both scales are fixed (25 tonnes a year, 2,000 since 1850), so the frame never moves; a bar that overshoots is cut at the edge and marked with a dot.

## What to look for

**Area is emissions.** The tall thin bars at the bottom are most of humanity at a tonne or two a person; the long thin bars at the top are the Gulf states; the big rectangles in between, the United States and China, are where most of the CO₂ is.

**The race.** Play the tour and watch China climb: near the bottom of the stack for a century, past the world average in 2007, past the United Kingdom in the 2010s and Germany in 2022. India is still low in the stack, and getting taller every year.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "co2-per-capita-bars/embed",
  height: 1060,
  title: "CO₂ per person, country by country, as bars",
  note: "The plot is 800&nbsp;px tall whatever the width, and fills the frame up to 640&nbsp;px wide; allow about " +
    "1,100&nbsp;px of height at phone width, where the controls wrap. The embed page accepts <code>?year=1990</code> " +
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

The data, the groups and their sources are [the polar chart's](../co2-per-capita/); this page draws from the same file.
