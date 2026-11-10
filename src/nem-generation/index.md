# Electricity generation in the NEM

Where Australia's electricity comes from, and how that has changed: coal, gas, hydro, wind, solar, batteries and the rest, stacked, since the National Electricity Market began in December 1998, for the market as a whole, one of its five regions, or Western Australia's grid. Show it **by year** or **by month**, in **GWh** or as each source's **% of generation**; in GWh, the energy drawn from the grid to pump water uphill, charge batteries or export to a neighbouring state hangs below zero, and imports sit at the bottom of the stack. The numbers are written on the chart: a probe stands at the latest month or year with each source's value beside its band, for every source above one per cent. Point at the chart to read another time, click to pin it there, and click a band to pick that source out, which also names a source too small to be labelled on its own.

```js
import {createNemGenerationWidget} from "./widget.js";

const data = await FileAttachment("./data/nem-generation.json").json();
```

```js
const generation = view(createNemGenerationWidget({data}));
```

The numbers are [Open Electricity](https://openelectricity.org.au/)'s, the open record of the Australian electricity markets kept by The Superpower Institute (it began as OpenNEM), from its public monthly data files, refreshed once a month by `scripts/nem-generation.mjs` (a GitHub Action runs it). A share is a share of the electricity generated in the region, so imports, which come from another region's generators, and the loads, which are generation used twice, are left out of the percentages; Open Electricity's tracker does the same, give or take a percent. Battery discharge is counted as a source, though it is other generators' electricity returned later. **Other** is bioenergy and distillate. The years are calendar years, the complete ones only.

## Embed this widget

```js
import {embedSnippets, libUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "nem-generation/embed",
  height: 460,
  title: "Electricity generation in the NEM",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about 320&nbsp;px; allow about 520&nbsp;px of height at phone width, " +
    "where the buttons wrap. The embed page is preset through its URL: <code>?region=sa1</code> (nem, nsw1, qld1, sa1, tas1, vic1, wem), " +
    "<code>?interval=month</code> (the default is by year), <code>?measure=share</code> (the default is GWh), and <code>?select=wind</code> " +
    "(coal, gas, hydro, wind, solar, batteries, other) to open with that source picked out.",
  script: `<div id="nem-generation"></div>

<script type="module">
  import {createNemGenerationWidget}
    from "${libUrl("nem-generation/widget.js")}";

  const data = await fetch("${libUrl("nem-generation/data/nem-generation.json")}")
    .then(r => r.json());

  // Options: {region: "SA1"}, {interval: "year" | "month"}, {measure: "gwh" | "share"}, {select: "wind"}.
  document.getElementById("nem-generation")
    .appendChild(createNemGenerationWidget({data}));
<\/script>`
}));
```

---

Data: [Open Electricity](https://openelectricity.org.au/) (The Superpower Institute), [CC BY-NC 4.0](https://platform.openelectricity.org.au/license): the monthly energy by fuel technology for the NEM, each of its regions and the WEM from its v4 data files (`data.openelectricity.org.au/v4/stats/au/…/energy/all.json`). Colours are Okabe and Ito's. The data file is refreshed by `scripts/nem-generation.mjs`; the last month in it is written under the chart.
