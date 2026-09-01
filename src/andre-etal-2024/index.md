# Support for climate action, by country

The [Global Climate Change Survey](https://gccs.iza.org/) ([Andre, Boneva, Chopra & Falk 2024, *Nature Climate Change*](https://www.nature.com/articles/s41558-024-01925-3)) asked 129,902 people in 125 countries three yes/no questions:

- Would you be willing to contribute 1% of your household income every month to fight global warming?
- Do you think that people in [your country] should try to fight global warming?
- Do you think the national government should do more to fight global warming?

Each country's share is the proportion who said yes, weighted by the survey's sampling weights; the global bars additionally reweight countries to be population-representative, so populous countries move the world figure more. Pick a question with the buttons; click or tap a country to see its share, and click it again, or the ocean, to dismiss it.

```js
import {createAndreEtal2024Widget, parseAndreEtal2024} from "./widget.js";

const support = parseAndreEtal2024(await FileAttachment("data/andre-etal-2024.csv").text());
const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const country = view(createAndreEtal2024Widget({data: support, world}));
```

## About the data

The values are derived in [`scripts/andre-etal-2024.jl`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/andre-etal-2024.jl) from the survey microdata on the [IZA Dataverse](https://doi.org/10.15185/gccs.1), following the aggregation in the paper's own replication code: each country's share is weighted by the within-country sampling weight, and the global bars by a weight that additionally makes the country mix population-representative. The figure recreates the paper's Fig. 1, though with a continuous YlGnBu scale in place of the paper's stepped mako one. It runs from 30% rather than 0%, since every country's share falls between 30.5% and 98.2% and anchoring at zero would spend half the ramp on empty range. Hong Kong, Singapore, Malta and Mauritius are in the survey but have no polygon at this map's resolution.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "andre-etal-2024/embed",
  height: 520,
  title: "Support for climate action, by country",
  note: "The map fills the row up to 640&nbsp;px wide and the bar chart matches whatever " +
    "height it lands at, so the widget is about 460–505&nbsp;px tall at usual widths. " +
    "Below about 440&nbsp;px the bars stack above the map instead of beside it, which " +
    "roughly doubles the height — give the iframe about 780 there.",
  script: `<div id="andre-etal-2024"></div>

<script type="module">
  import {createAndreEtal2024Widget, parseAndreEtal2024}
    from "${cdnUrl("andre-etal-2024/widget.js")}";

  const [csv, world] = await Promise.all([
    fetch("${cdnUrl("andre-etal-2024/data/andre-etal-2024.csv")}")
      .then(r => r.text()),
    fetch("${cdnUrl("data/countries-110m.json")}").then(r => r.json()),
  ]);

  document.getElementById("andre-etal-2024")
    .appendChild(createAndreEtal2024Widget({data: parseAndreEtal2024(csv), world}));
<\/script>`
}));
```

---

Survey data: Andre, P., Boneva, T., Chopra, F. & Falk, A. (2024), ["Globally representative evidence on the actual and perceived support for climate action"](https://www.nature.com/articles/s41558-024-01925-3), *Nature Climate Change* 14, 253–259, via the [IZA Dataverse](https://doi.org/10.15185/gccs.1). Country boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:110m via [world-atlas](https://github.com/topojson/world-atlas).
