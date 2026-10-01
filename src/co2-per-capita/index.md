# CO₂ per person, country by country

<div class="note">Archived: kept for reference, not developed further or used in the course. <a href="../co2-per-capita-bars/">CO₂ per person, as bars</a> and <a href="../co2-per-capita-today/">CO₂ per person today</a> are the live widgets on these data.</div>

Every country is a wedge. Its angle is its population, its length is its CO₂ emissions per person, so its area is its emissions in all. The wedges run clockwise from the top in order of emissions per person, the highest first: the thin tall wedges of the small rich emitters come first, then the fat ones of the populous countries. Click or tap a wedge for the country's numbers, or a group in the key to see only its countries.

```js
import {createCo2PerCapitaWidget} from "./widget.js";

const data = await FileAttachment("data/co2-per-capita.json").json();
```

```js
const perCapita = view(createCo2PerCapitaWidget({data}));
```

*Per person* is one of two things. **This year** divides the year's emissions by the year's population, the usual figure. **Since 1850** divides everything a country has emitted since 1850 by its population in the year shown: today's people carrying their country's whole history, which is what a fair share of the remaining budget would have to reckon with. Left alone, the figure plays the years through from 1850, and as the ranking changes the wedges slide past one another to their new places; countries appear when their records begin.

## What to look for

**Area is emissions.** China's wedge is the widest and not the longest; the United States' is a third as wide and twice as long; India's is nearly as wide as China's and a quarter as long. Read the area and the three come out at about 28%, 12% and 7.5% of the world's CO₂.

**The tall slivers.** Qatar, Kuwait, Bahrain, the Emirates and Saudi Arabia are at the top of the ranking at twenty to forty tonnes a person, from gas flaring and oil as much as from what their people burn; the radial scale is fixed at 25 tonnes a year (2,000 since 1850), so the frame never moves as the years play, and the few that overshoot it are cut at the rim and marked with a dot.

**History changes the ranking.** Switch to *Since 1850*: Canada, the United States, Russia, Australia and the United Kingdom move to the top, at well over a thousand tonnes for each person alive today, while China's 250 is a sixth of the United States' and India's 73 a twentieth. The 1850 ranking is a different world again: land clearing, not coal, put New Zealand, the United States, Canada and Australia at the top.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "co2-per-capita/embed",
  height: 1180,
  title: "CO₂ per person, country by country",
  note: "The chart fills the frame up to 1280&nbsp;px wide and shrinks with it below that, down to about 320&nbsp;px, " +
    "so the height to allow is about the frame's width plus 200&nbsp;px. The embed page accepts <code>?year=1990</code> to open on " +
    "that year and <code>?mode=cumulative</code> to open on emissions since 1850.",
  script: `<div id="co2-per-capita"></div>

<script type="module">
  import {createCo2PerCapitaWidget}
    from "${cdnUrl("co2-per-capita/widget.js")}";

  const data = await fetch("${cdnUrl("co2-per-capita/data/co2-per-capita.json")}")
    .then(r => r.json());

  // Options: {year: 1990} opens on that year, {mode: "cumulative"} on emissions since 1850.
  document.getElementById("co2-per-capita")
    .appendChild(createCo2PerCapitaWidget({data}));
<\/script>`
}));
```

---

After Visual Capitalist's [Carbon emissions per capita by country](https://decarbonization.visualcapitalist.com/visualizing-global-per-capita-co2-emissions/) (2022, from Aqal Group and IEA data), which drew the fossil emissions of 2021 this way for the largest emitters and grouped the rest.

Data: [Our World in Data's CO₂ and greenhouse gas emissions dataset](https://github.com/owid/co2-data) (CC BY 4.0), which carries the Global Carbon Budget's national emissions and Our World in Data's population series (HYDE and the UN). Emissions are fossil fuels and cement plus land-use change, as in the carbon-budget widgets, so Brazil and Indonesia rank higher than on a fossil-only chart and the early decades are mostly land clearing. Countries appear when both series exist for them: 32 in 1850, 175 by 1950, 213 today. The groups are the UN's regions, with the Middle East as Western Asia less the Caucasus and Cyprus, plus Iran, and Russia and Australia–New Zealand on their own; colours are Okabe and Ito's. Refreshed by `scripts/co2-per-capita.mjs`.
