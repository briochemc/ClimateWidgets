# The carbon budget

Warming tracks the total amount of carbon dioxide ever emitted, so a limit on warming is a limit on the total: a carbon budget. Every square here is a billion tonnes of CO₂ (1 GtCO₂). The black squares are what has been emitted since 1850, about 2,770 of them by the end of 2025, stacked by region and, within a region, by country. The grey squares are what is left, and the three lines are where the budget runs out for 1.5, 1.7 and 2 °C of warming: 90, 450 and 1,010 GtCO₂ from the start of 2026, by the Global Carbon Budget 2025's update of Forster et al. (2025). At the 2025 rate of 42 GtCO₂ a year, that is about 2, 11 and 24 years.

Left alone, the figure winds back to 1850 and plays the years through. Move the slider or click anything to stop it; *Play tour* starts it again. Click or tap a square to see whose it is: the country is named and its whole contribution outlined, and stays so until you click it again. The *Colour* toggle paints the squares by region, with a key whose entries outline a whole region when clicked, or lays the same squares out by year instead, oldest at the bottom, or by decade.

```js
import {createCarbonBudgetWidget, budgetSeries, budgetThresholds, formatGt} from "./widget.js";

const data = await FileAttachment("data/carbon-budget.json").json();
```

```js
const budget = view(createCarbonBudgetWidget({data}));
```

## What to look for

**Three regions, three-quarters.** Colour by *Region*: Asia, Europe and North America have emitted 30%, 24% and 24% of the total; South America 8%, Africa 6%, the Middle East 3%. Click inside the blocks and the countries come out: the United States alone is a fifth of everything since 1850, China an eighth, and then Russia, Brazil, Germany, Indonesia and India at three to five percent each. Brazil and Indonesia are there for their forests, not their fuel.

**The pace.** Switch the colour to *Year* and play the tour. The years go by at a steady rate and the fill does not: the first fifty years lay down about two hundred squares, the last fifty about 1,650. Half of everything emitted since 1850 has been emitted since 1986, and a third of it since 2000. Each row of the grid is 60 GtCO₂, about a year and a half of today's emissions, and it takes the fill about three rows to add a tenth of a degree of warming.

**Land use first.** In *Year* colouring, the palest squares along the bottom are mostly deforestation: in 1850 fossil fuels were 0.2 GtCO₂ a year and clearing land 2.7. Land use stayed the larger of the two until the late 1950s, and its total since 1850, some 900 GtCO₂, is a third of the whole. Click a year and the read-out gives the two parts.

**How long the budget looked.** Drag the slider to an earlier year and the read-out says how many years the 1.5 °C budget would have lasted at that year's rate: about 175 years in 1950, 48 in 1990, 34 in 2000, 2 at the end of 2025. The budget was never large; emissions grew into it.

**Two estimates.** The Global Carbon Budget brings two published budgets forward to the start of 2026 by subtracting what has been emitted since they were made. Forster et al.'s 2025 revision, the default, leaves 90 GtCO₂ for 1.5 °C; the IPCC's 2021 budgets leave 250. Most of the difference is a newer estimate of the warming from other gases. The lines for 1.7 and 2 °C move much less, because the further from the limit, the less the details of the last few tenths of a degree matter.

**Fifty–fifty.** Both estimates give a 50% chance of staying under the limit, the IPCC's central case. For a two-in-three chance the budgets are smaller still, and the Global Carbon Budget also notes an uncertainty of about ±220 GtCO₂, nearly four rows of the grid, from how much of the other greenhouse gases and aerosols the world emits along the way.

## The numbers

The emissions the figure is drawn from, by region and by period, and the remaining budgets it draws the lines at. The tables are computed from the same file as the figure, so the two cannot disagree.

```js
const series = budgetSeries(data);
const {years, regions} = series;
const periods = [[1850, 1899], [1900, 1949], [1950, 1989], [1990, 2009], [2010, 2025]];
const between = (arr, a, b) => arr.reduce((s, v, k) => (years[k].year >= a && years[k].year <= b ? s + v : s), 0);
display(html`<table>
  <thead><tr><th>Region (GtCO₂)</th>${periods.map(([a, b]) => html`<th style="text-align:right">${a}–${b}</th>`)}<th style="text-align:right">1850–2025</th><th style="text-align:right">Share</th></tr></thead>
  <tbody>${regions.map(r => html`<tr>
    <td title=${r.note ?? ""}>${r.name}${r.note ? html` <span style="color:#888;font-size:85%">(${r.note})</span>` : ""}</td>
    ${periods.map(([a, b]) => html`<td style="text-align:right">${formatGt(between(r.byYear, a, b))}</td>`)}
    <td style="text-align:right">${formatGt(r.total)}</td>
    <td style="text-align:right">${Math.round(100 * r.total / series.used)}%</td>
  </tr>`)}
  <tr style="font-weight:bold">
    <td>World</td>
    ${periods.map(([a, b]) => html`<td style="text-align:right">${formatGt(between(years.map(y => y.total), a, b))}</td>`)}
    <td style="text-align:right">${formatGt(series.used)}</td>
    <td style="text-align:right">100%</td>
  </tr></tbody>
</table>`);
```

Fossil emissions are from coal, oil, gas, cement and flaring, net of the CO₂ that cement absorbs as it cures; land use is the net flux from deforestation, regrowth, wood harvest and peat, as the mean of the Global Carbon Budget's three bookkeeping models estimates it. 2025 is the Global Carbon Budget's projection. The regions are the Global Carbon Budget's own continents; countries too small to show (under 1 GtCO₂ over the whole period) are gathered into an "Other" entry in each.

```js
display(html`<table>
  <thead><tr><th>Remaining from 2026, 50% likelihood</th>${data.budgets.thresholds.map(l => html`<th style="text-align:right">${l} °C</th>`)}</tr></thead>
  <tbody>${data.budgets.estimates.map(e => {
    const ths = budgetThresholds(data, series, e.id);
    return html`<tr>
      <td>${e.name}<br><span style="font-size:90%;color:#666">${e.note}</span></td>
      ${ths.map(th => html`<td style="text-align:right;vertical-align:top">${th.budget} GtCO₂<br><span style="color:#666">${Math.round(th.years)} years at the 2025 rate</span></td>`)}
    </tr>`;
  })}</tbody>
</table>`);
```

The Global Carbon Budget's own headline figure is the average of these two: 170, 525 and 1,055 GtCO₂.

## About the figure

The layout is a waffle chart: a grid of unit squares, 60 wide, filled from the bottom along a snake, one row left to right and the next right to left, so that any run of squares is one connected block, the way the atmospheric-composition figure lays its gases. A block that only partly fills a square is cut at the exact fraction, so the top of the fill is always where the cumulative total says it is. The lattice is drawn heavier every ten squares so that a block of a hundred can be counted at a glance. The grid ends at the 2 °C line; the squares that would come after it are not drawn, which is why the top row is short.

**The whole grid is the total budget.** A remaining carbon budget is the difference between a total budget, fixed by the climate's response to CO₂, and what has been emitted. So the total for each limit is emissions to date plus the remaining budget, and the picture at any year is the same grid with the fill lower down. Ed Hawkins's [carbon budget countdown](https://ed-hawkins.github.io/climate-visuals/cbudget.html) draws exactly this as a pie chart filling from 1850; the grid is the same idea with the squares kept countable and, here, attributed.

**Stacked, not interleaved.** In black or by region, the fill is a stack of blocks, one per region and inside it one per country, largest first, each block growing as the years pass. The blocks shift as the ones below them grow, so a square is not a fixed gigatonne; it is a place in a stacked bar. By year, the same squares are laid down in the order they were emitted, and a square is a fixed gigatonne with a date. Both layouts have the same height at every year, because they hold the same squares.

**Why the lines move and the past does not.** The two estimates share the emissions record and differ only in the remaining budget, so switching between them moves the lines and leaves the coloured squares alone.

**Frozen, not live.** The values are the Global Carbon Budget 2025's; the data file is regenerated from its three spreadsheets by `scripts/carbon-budget.py` when a new edition comes out, and each edition revises the whole record a little, not just the last year.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "carbon-budget/embed",
  height: 820,
  title: "The carbon budget",
  note: "The grid is 520&nbsp;px wide and 560&nbsp;px tall in a frame 580&nbsp;px wide or more and shrinks with the " +
    "frame below that, so the height above suits a frame 640&nbsp;px wide; allow about " +
    "650&nbsp;px at phone width. The embed page accepts <code>?year=1990</code> to open on that year, " +
    "<code>?colour=region</code>, <code>?colour=year</code> or <code>?colour=decade</code> to open in that colouring, and " +
    "<code>?estimate=ipcc</code> to draw the lines from the IPCC estimate.",
  script: `<div id="carbon-budget"></div>

<script type="module">
  import {createCarbonBudgetWidget}
    from "${cdnUrl("carbon-budget/widget.js")}";

  const data = await fetch("${cdnUrl("carbon-budget/data/carbon-budget.json")}")
    .then(r => r.json());

  // Options: {year: 1990} opens on that year, {colour: "region"}, {colour: "year"} or
  // {colour: "decade"} in that colouring, {estimate: "ipcc"} draws the lines from the IPCC estimate.
  document.getElementById("carbon-budget")
    .appendChild(createCarbonBudgetWidget({data}));
<\/script>`
}));
```

---

Sources and credits:

- Friedlingstein, P., O'Sullivan, M., Jones, M. W., et al. (2026). [Global Carbon Budget 2025](https://doi.org/10.5194/essd-18-3211-2026). *Earth System Science Data*, 18, 3211–3288. The emissions are from the [Global Carbon Budget v2025, National Fossil Carbon Emissions v2025 and National Land Use Change Carbon Emissions v2025 spreadsheets](https://globalcarbonbudget.org/datahub/the-latest-gcb-data-2025/); the 2025 projection and the remaining budgets are from the paper.
- Canadell, J. G., et al. (2021). [Chapter 5](https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-5/) of *Climate Change 2021: The Physical Science Basis*, IPCC, for the budgets the "IPCC AR6" estimate updates.
- Forster, P. M., et al. (2025). [Indicators of Global Climate Change 2024](https://doi.org/10.5194/essd-17-2641-2025). *Earth System Science Data*, 17, 2641–2680, for the budgets the "Forster et al." estimate updates.
- The idea of animating the budget filling up from 1850 is Ed Hawkins's [Carbon budget countdown](https://ed-hawkins.github.io/climate-visuals/cbudget.html). The region colours are Okabe and Ito's [colour-universal palette](https://jfly.uni-koeln.de/color/).
