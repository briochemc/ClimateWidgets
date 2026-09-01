# Support for climate action, by country

The [Global Climate Change Survey](https://gccs.iza.org/) ([Andre, Boneva, Chopra & Falk 2024, *Nature Climate Change*](https://www.nature.com/articles/s41558-024-01925-3)) asked 129,902 people in 125 countries three yes/no questions:

- Would you be willing to contribute 1% of your household income every month to fight global warming?
- Do you think that people in [your country] should try to fight global warming?
- Do you think the national government should do more to fight global warming?

Each country's share is the proportion who said yes, weighted by the survey's sampling weights; the global bars additionally reweight countries to be population-representative, so populous countries move the world figure more. Pick a question with the buttons; click or tap a country to see its share, and click it again, or the ocean, to dismiss it.

```js
import {createClimateActionSupportWidget, parseClimateActionSupport} from "./widget.js";

const support = parseClimateActionSupport(await FileAttachment("data/climate-action-support.csv").text());
const world = await FileAttachment("../belief-map/data/countries-110m.json").json();
```

```js
const country = view(createClimateActionSupportWidget({data: support, world}));
```

## About the data

The values are derived in [`scripts/climate-action-support.jl`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/climate-action-support.jl) from the survey microdata on the [IZA Dataverse](https://doi.org/10.15185/gccs.1), following the aggregation in the paper's own replication code: each country's share is weighted by the within-country sampling weight, and the global bars by a weight that additionally makes the country mix population-representative. The figure recreates the paper's Fig. 1. Hong Kong, Singapore, Malta and Mauritius are in the survey but have no polygon at this map's resolution.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "climate-action-support/embed",
  height: 520,
  title: "Support for climate action, by country",
  note: "The map fills the row up to 640&nbsp;px wide and the bar chart matches whatever " +
    "height it lands at, so the widget is about 460–505&nbsp;px tall at usual widths. " +
    "Below about 440&nbsp;px the bars stack above the map instead of beside it, which " +
    "roughly doubles the height — give the iframe about 780 there.",
  script: `<div id="climate-action-support"></div>

<script type="module">
  import {createClimateActionSupportWidget, parseClimateActionSupport}
    from "${cdnUrl("climate-action-support/widget.js")}";

  const [csv, world] = await Promise.all([
    fetch("${cdnUrl("climate-action-support/data/climate-action-support.csv")}")
      .then(r => r.text()),
    fetch("${cdnUrl("belief-map/data/countries-110m.json")}").then(r => r.json()),
  ]);

  document.getElementById("climate-action-support")
    .appendChild(createClimateActionSupportWidget({data: parseClimateActionSupport(csv), world}));
<\/script>`
}));
```

---

Survey data: Andre, P., Boneva, T., Chopra, F. & Falk, A. (2024), ["Globally representative evidence on the actual and perceived support for climate action"](https://www.nature.com/articles/s41558-024-01925-3), *Nature Climate Change* 14, 253–259, via the [IZA Dataverse](https://doi.org/10.15185/gccs.1). Country boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:110m via [world-atlas](https://github.com/topojson/world-atlas).
