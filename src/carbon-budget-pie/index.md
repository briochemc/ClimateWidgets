# The carbon budget as a pie

The same budget as [the grid](../carbon-budget/), as one circle. The whole pie is all the CO₂ the world can emit, from 1850 onwards, and still keep warming under the chosen limit; the slices, clockwise from the top, are what has been emitted so far, and the grey is what is left. By the Global Carbon Budget 2025's update of Forster et al. (2025), the 1.5 °C pie is 2,860 GtCO₂ and 97% of it is gone; the 2 °C pie is 3,780 and 73% is gone. The *Limit* toggle switches between them, and the two other limits are ticked on the grey so that where each runs out stays in view.

```js
import {createCarbonBudgetPieWidget} from "./widget.js";

const data = await FileAttachment("../carbon-budget/data/carbon-budget.json").json();
```

```js
const pie = view(createCarbonBudgetPieWidget({data}));
```

Left alone, the figure winds back to 1850, plays the years through once and stops at the end. Move the slider or click anything to stop it early; *Play tour* runs it again. *Slices* cuts the emitted part four ways: by decade, by year, by region, or by country (every country its own slice, colours cycling so that neighbours never match). There is no key: click or tap a slice and it is outlined and named, until you click it again. The biggest slices are named outside the rim, and so is Australia's whatever its size. The year is written at the centre of the pie, and the slider above it is as wide as the pie.

## What to look for

**Twelve o'clock.** Emissions start at the top and run clockwise, oldest first. Sliced by year, the pale first century is a sliver and the dark last few decades fill most of the circle; sliced by decade, the 2010s alone are a sixth of everything since 1850.

**Whose slices.** By region, Asia, Europe and North America take three quarters of the emitted part between them. By country, the United States is the widest single slice, a fifth of everything, then China at an eighth; Brazil and Indonesia are among the biggest because of their forests, not their fuel.

**Two pies, one past.** The emitted part is the same whichever limit is chosen; what changes is the whole. At 1.5 °C the grey is a thin wedge, two years' worth; at 2 °C it is a quarter of the circle, about 24 years at today's rate.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "carbon-budget-pie/embed",
  height: 580,
  title: "The carbon budget as a pie",
  note: "The pie is 420&nbsp;px across in a frame 480&nbsp;px wide or more and shrinks with the frame below " +
    "that; allow about 560&nbsp;px of height at phone width, where the buttons wrap. The embed page accepts " +
    "<code>?year=1990</code> to open on that year, <code>?colour=year</code>, <code>region</code> or " +
    "<code>country</code> to open sliced that way (decades are the default), <code>?limit=2</code> for the 2 °C pie, " +
    "and <code>?estimate=ipcc</code> for the IPCC budgets.",
  script: `<div id="carbon-budget-pie"></div>

<script type="module">
  import {createCarbonBudgetPieWidget}
    from "${cdnUrl("carbon-budget-pie/widget.js")}";

  const data = await fetch("${cdnUrl("carbon-budget/data/carbon-budget.json")}")
    .then(r => r.json());

  // Options: {year: 1990}, {colour: "country"} (or "region", "year"; "decade" is the default),
  // {limit: 2} (or 1.5, 1.7), {estimate: "ipcc"}.
  document.getElementById("carbon-budget-pie")
    .appendChild(createCarbonBudgetPieWidget({data}));
<\/script>`
}));
```

---

The data, the budgets and their sources are [the grid widget's](../carbon-budget/); this page draws from the same file. The region colours are Okabe and Ito's colour-universal palette; countries and decades use the tableau palette (`tab20`).
