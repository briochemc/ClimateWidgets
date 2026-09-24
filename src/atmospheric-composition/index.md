# What the air is made of

Take a hundred molecules of dry air. Seventy-eight are nitrogen, twenty-one are oxygen, and the hundredth is everything else: argon, carbon dioxide, and a dozen gases rarer still. The greenhouse gases that this site is about are all inside that last molecule. The figure is a way of looking inside it. Every square of the first grid is one of those hundred molecules; its last square is blown up a hundred times to make the second grid, where a square is 100 parts per million; that grid's last square is blown up again; and so on. Four blow-ups take you from nitrogen to nitrous oxide, a molecule in three million.

Left alone, the figure zooms in one grid at a time, rests on the greenhouse gas each one reveals, then zooms all the way back out and goes round again. Click anything and it stops; *Play tour* starts it again. Click the dashed square to zoom into it yourself, the strip of big squares around a grid to zoom back out, or any block to read its share.

```js
import {createAtmosphericCompositionWidget, composition, gridLevels, formatUnit} from "./widget.js";

const data = await FileAttachment("data/composition.json").json();
```

```js
const air = view(createAtmosphericCompositionWidget({data}));
```

## What to look for

**The zoom is exact.** Each grid is the last square of the grid before, cropped, not rounded. So a gas that runs into a grid's last square carries over: grid 2 opens with two squares of oxygen, the tail end of its twenty-one squares in grid 1, and grid 3 opens with seventy-two squares of carbon dioxide, the last three-quarters of its fourth square in grid 2. The gases are laid along a snake, as in the game: along one row, back along the next, and so on, or up one column and down the next. Inside a square the boundary between two gases is drawn at the exact fraction, cut across the snake's direction of travel, and the next grid's snake runs in that same direction, so the cut in one grid is the block at the start of the next. A gas too small to start before the last square is not drawn in that grid at all: it appears in the next grid instead. The last square is the next grid, literally: the next grid is drawn inside it at a tenth of the scale, which is why it looks like a miniature before you zoom in, and why the zoom is a plain magnification and not a cut to a new picture.

**The warm colours are the greenhouse gases.** Carbon dioxide, methane, nitrous oxide, ozone and water vapour are drawn in oranges and reds; nitrogen, oxygen and the noble gases in greys and blues. Nothing warm appears until the second grid, and there it is four squares out of a hundred. Argon, which does nothing at all, is twenty-two times more abundant than the gas that sets the planet's temperature.

**The darker part is ours.** The blocks for CO₂, CH₄ and N₂O are split at their 1750 amounts: the lighter part is what the air held before industry, the darker part is what has been added since. A third of the carbon dioxide, three-fifths of the methane and a fifth of the nitrous oxide are the darker shade. Because the addition is drawn at the end of each block, grid 3 opens on seventy-two squares of it: every molecule of CO₂ in that tail is one that was not there in 1750.

**Add water vapour.** Every table of the air is a table of *dry* air, because water vapour varies from almost nothing over Antarctica to several percent of the molecules in the tropics. The toggle mixes in one of three amounts and shrinks everything else to make room. The global mean, 0.4% over the whole atmosphere, is less than argon's 0.93%, so in the first grid it stays inside the last square, while argon, pushed forward, comes out of that square into view; in grid 2 the water is forty squares, ten times the carbon dioxide. The mean at sea level, 1%, is more than argon, and water takes a square of the first grid for itself. In humid tropical air, 4%, it takes four, more than everything else put together apart from nitrogen and oxygen. Whatever the amount, it is the largest greenhouse gas of all. It does not drive the warming, though: it follows the temperature, condensing out in days, and amplifies whatever the long-lived gases do.

## The numbers

Mole fractions of dry air, that is, shares by number of molecules, as the figure uses them. The table below is computed from the same file as the figure, so the two cannot disagree.

```js
const dry = composition(data);
display(html`<table>
  <thead><tr><th>Gas</th><th style="text-align:right">ppm</th><th style="text-align:right">Share</th><th>1750</th><th>Source</th></tr></thead>
  <tbody>${dry.gases.map(g => html`<tr>
    <td>${g.name} (${g.formula})</td>
    <td style="text-align:right">${g.approximate ? "≈ " : ""}${g.ppm >= 1000 ? Math.round(g.ppm).toLocaleString("en-US") : g.ppm >= 100 ? g.ppm.toFixed(1) : Number(g.ppm.toPrecision(3))}</td>
    <td style="text-align:right">${g.ppm >= 1e4 ? `${(g.ppm / 1e4).toFixed(2)}%` : g.ppm >= 1 ? `${Number((g.ppm / 1e4).toPrecision(2))}%` : `${Number((g.ppm * 1e3).toPrecision(3))} ppb`}</td>
    <td>${g.ppm1750 != null ? (g.ppm1750 >= 1 ? `${g.ppm1750} ppm` : `${Math.round(g.ppm1750 * 1000)} ppb`) : ""}</td>
    <td style="font-size:90%">${g.source}</td>
  </tr>`)}</tbody>
</table>`);
```

And what each grid contains, in squares, computed the same way. A tail is the continuation of a gas from the grid before; the rest is the part of the last square that only the next grid resolves.

```js
display(html`<table>
  <thead><tr><th>Grid</th><th>1 square =</th><th>Contents (squares)</th></tr></thead>
  <tbody>${gridLevels(dry).map(l => html`<tr>
    <td>${l.level}</td>
    <td>${formatUnit(l.unit)}</td>
    <td>${[
      ...l.regions.map(r => `${r.gas.formula}${r.tail ? " tail" : ""} ${Number((r.to - r.from).toPrecision(3))}`),
      ...(l.rest ? [`rest ${Number((100 - l.rest.from).toPrecision(2))} (${l.rest.gases.map(g => g.formula).join(", ")})`] : []),
    ].join(", ")}</td>
  </tr>`)}</tbody>
</table>`);
```

## About the figure

The layout is the one xkcd used for its [Money](https://xkcd.com/980/) chart: a grid of squares, one of which is the whole of the next grid. The composition is laid out once, gases in descending order of abundance, along a snake through the grid, the way the snake in the game sweeps a screen: along one row, back along the next, and so on, so that every gas is one connected block. The snake has to end at the bottom-right square, the one every level shares, and with ten rows that fixes where it starts: at the top right, running left. The second grid's snake runs by columns instead, starting at the bottom left and running up, then down the next column, and ending at the same corner; the third is rows again, the fourth columns. The orientation alternates because a partial square is cut across the snake's direction of travel, which keeps every block a clean band with no sliver, and the next grid's snake has to run in the direction of that cut for the zoom to be exact. Grid *k* is the last 100 × 10⁴⁄100^(*k*−1) ppm of that fill, so its squares are worth 1%, 100 ppm, 1 ppm and 10 ppb in turn, and it stops when a grid's last square has nothing left to resolve. Because every grid's last square is its bottom-right corner, every grid shares that corner, and the zoom is a single magnification about it: a factor of ten per level, run at a steady pace. From the second level down the grid is drawn slightly inset, so a strip of the big squares it sits among stays in view above and to the left.

**The table does not add up, so nitrogen is the remainder.** Wikipedia's dry-air table gives nitrogen as 78.084%, a figure that dates from when carbon dioxide was near 330 ppm; with today's CO₂ and CH₄ its twelve entries sum to 1,000,091 ppm. Two fixes were checked. Scaling every gas by the same factor moves nitrogen by 20 ppm and carbon dioxide by 0.04 ppm; taking nitrogen as a million ppm minus everything else moves only nitrogen, by 91 ppm, which is 0.009 of a square in the first grid. Neither is visible, so the figure does the second. It also ignores that rising CO₂ displaces oxygen in reality, about 4 ppm a decade; oxygen is the 2002 value throughout.

**Ozone is a stratospheric gas.** The 0.03 ppm here is the near-surface value, and even that is a middle of Wikipedia's 0.02 (winter) to 0.07 (summer). Nearly all of the ozone is 15 to 35 km up, and a typical column of 300 Dobson units, averaged over the whole atmosphere, would be about 0.37 ppm, more than nitrous oxide. The near-surface value is used because it is the one the table gives. Carbon monoxide, about 0.1 ppm, is in neither of the two tables the figure draws on and is left out.

**Frozen, not live.** The values are Wikipedia's, with the 2024 figures for carbon dioxide and methane, and the 1750 values are the IPCC's. NOAA's monthly means for 2026 (CO₂ near 428 ppm, CH₄ near 1.94 ppm, N₂O near 0.34 ppm) differ by less than the rounding of a square, and the file is easier to update than a fetch is to keep working. The "as of" year is stored with the data and printed in the read-out.

**Water vapour** is 0.4% of the molecules over the whole atmosphere, from about 25 kg of precipitable water per square metre against 10,330 kg of air (0.24% by mass, times the ratio of the molar masses, 28.97⁄18.02); around 1% in the air at sea level, where most of it is; and 4.24% in surface air at a dew point of 30 °C, which is the humid tropics on a warm day, rounded here to 4%. The toggle multiplies every dry fraction by one minus the chosen amount and inserts water where its abundance puts it in the descending order: after argon at 0.4%, before it at 1% and 4%.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "atmospheric-composition/embed",
  height: 650,
  title: "What the air is made of",
  note: "The grid is 480&nbsp;px square in a frame 480&nbsp;px wide or more and shrinks with the " +
    "frame below that, so the height above suits a frame 640&nbsp;px wide; allow about " +
    "550&nbsp;px at phone width. The embed page accepts <code>?level=2</code> to open zoomed in " +
    "to that grid and <code>?water=0.4</code>, <code>?water=1</code> or <code>?water=4</code> to start " +
    "with that percentage of water vapour mixed in.",
  script: `<div id="atmospheric-composition"></div>

<script type="module">
  import {createAtmosphericCompositionWidget}
    from "${cdnUrl("atmospheric-composition/widget.js")}";

  const data = await fetch("${cdnUrl("atmospheric-composition/data/composition.json")}")
    .then(r => r.json());

  // Options: {level: 2} opens zoomed in to the second grid, {waterVapour: 10000} with
  // that many ppm of water vapour mixed in (4000, 10000 or 40000).
  document.getElementById("atmospheric-composition")
    .appendChild(createAtmosphericCompositionWidget({data}));
<\/script>`
}));
```

---

Sources and credits:

- The nested-grid idea is from Randall Munroe's [Money](https://xkcd.com/980/) (xkcd 980). The nested pie chart it replaces is Wikipedia's [Atmosphere gas proportions](https://en.wikipedia.org/wiki/File:Atmosphere_gas_proportions.svg).
- Wikipedia, [Atmosphere of Earth](https://en.wikipedia.org/wiki/Atmosphere_of_Earth#Composition), for the main gases (after Allen's *Astrophysical Quantities*, 2002, with carbon dioxide and methane updated to 2024) and the water vapour over the whole atmosphere and at sea level; [Water vapor](https://en.wikipedia.org/wiki/Water_vapor) for the humid-tropics value; [Atmospheric chemistry](https://en.wikipedia.org/wiki/Atmospheric_chemistry) for hydrogen, nitrous oxide, xenon and ozone.
- IPCC (2021), [Chapter 2](https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-2/) of *Climate Change 2021: The Physical Science Basis*, for the 1750 concentrations: 278.3 ppm CO₂, 729.2 ppb CH₄ and 270.1 ppb N₂O.
