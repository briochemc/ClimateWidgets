# Electricity generation in the NEM

Where Australia's electricity comes from, source by source: coal, gas, hydro, wind, solar on roofs and in solar farms, batteries, and the rest, in the National Electricity Market as a whole or in one of its five regions, and in Western Australia's grid. Pick the **region** and the **period**: the last year week by week, five years month by month, or everything since the market began in December 1998, month by month or year by year. Show each source as a **share of generation** or in **GWh**; in GWh, the energy drawn from the grid to pump water uphill, charge batteries or export to a neighbouring state hangs below zero, and imports sit at the bottom of the stack. Click a source in the key to hide it (and **All** to bring everything back), switch **Renewables** on for the share of hydro, wind, solar and bioenergy as a line, and **Simple** to gather the sources into seven. Hover or touch the chart for the numbers.

```js
import {createNemGenerationWidget} from "./widget.js";

const data = await FileAttachment("./data/nem-generation.json").json();
```

```js
const generation = view(createNemGenerationWidget({data}));
```

The numbers are [Open Electricity](https://openelectricity.org.au/)'s, the open record of the Australian electricity markets kept by The Superpower Institute (it began as OpenNEM): the monthly history from its public data files, the weeks from its API, refreshed once a month by `scripts/nem-generation.mjs` (a GitHub Action runs it). A share is a share of the electricity generated in the region, so imports, which come from another region's generators, and the loads, which are generation used twice, are left out of the percentages; Open Electricity's tracker does the same, give or take a percent. Battery discharge is counted as a source and is neither renewable nor fossil in the renewables line, since it is other generators' electricity returned later. The weeks start on Sunday and the last one shown is the last complete one.

## Embed this widget

```js
import {embedSnippets, libUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "nem-generation/embed",
  height: 520,
  title: "Electricity generation in the NEM",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about 320&nbsp;px; allow about 600&nbsp;px of height at phone width, " +
    "where the buttons wrap. The embed page is preset through its URL: <code>?region=sa1</code> (nem, nsw1, qld1, sa1, tas1, vic1, wem), " +
    "<code>?range=1y</code>, <code>5y</code> or <code>all</code> with <code>&amp;interval=1y</code> for years, <code>?measure=gwh</code> or " +
    "<code>share</code>, <code>?only=wind</code> or <code>?hide=coal,gas</code> (fuel technologies or the simple groups, comma-separated), " +
    "<code>?renewables=1</code>, and <code>?group=simple</code>.",
  script: `<div id="nem-generation"></div>

<script type="module">
  import {createNemGenerationWidget}
    from "${libUrl("nem-generation/widget.js")}";

  const data = await fetch("${libUrl("nem-generation/data/nem-generation.json")}")
    .then(r => r.json());

  // Options: {region: "SA1"}, {period: "1y" | "5y" | "all" | "all-yearly"}, {measure: "share" | "gwh"},
  // {grouping: "simple"}, {only: ["wind"]} or {hide: ["coal"]}, {renewables: true}.
  document.getElementById("nem-generation")
    .appendChild(createNemGenerationWidget({data}));
<\/script>`
}));
```

---

Data: [Open Electricity](https://openelectricity.org.au/) (The Superpower Institute), [CC BY-NC 4.0](https://platform.openelectricity.org.au/license): the monthly energy by fuel technology for the NEM, each of its regions and the WEM from its v4 data files (`data.openelectricity.org.au/v4/stats/au/…/energy/all.json`), and the last 52 weeks from its [API](https://docs.openelectricity.org.au) (`/v4/data/network/NEM?metrics=energy&interval=7d`). Colours and names are Open Electricity's. The data file is refreshed by `scripts/nem-generation.mjs`; the date of the last week or month shown is written under the chart.
