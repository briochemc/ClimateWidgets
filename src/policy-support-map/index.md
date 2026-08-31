# Support for climate policy, by country

The same study that measured [belief in climate change](../belief-map/) ([Vlasceanu et al. 2024, *Science Advances*](https://www.science.org/doi/10.1126/sciadv.adj5778)) also asked its 59,440 participants in 63 countries how much they agreed with nine statements, from 0 (not at all) to 100 (very much so):

- I support raising carbon taxes on gas/fossil fuels/coal
- I support significantly expanding infrastructure for public transportation
- I support increasing the number of charging stations for electric vehicles
- I support increasing the use of sustainable energy such as wind and solar energy
- I support increasing taxes on airline companies to offset carbon emissions
- I support protecting forested and land areas
- I support investing more in green jobs and businesses
- I support introducing laws to keep waterways and oceans clean
- I support increasing taxes on carbon intense foods (for example meat and dairy)

Each country's *policy support* score is a posterior mean from the authors' Bayesian hierarchical model — a zero-one-inflated beta model, fitted to each participant's mean across the nine items, with country and intervention effects. Click or tap a country to see its score; click it again, or the ocean, to dismiss it.

```js
import {createPolicySupportMapWidget, parseTabS6} from "./widget.js";

const support = parseTabS6(await FileAttachment("data/Vlasceanu_etal_ScienceAdvances_2024_tabS6.csv").text());
const world = await FileAttachment("../belief-map/data/countries-110m.json").json();
```

```js
const country = view(createPolicySupportMapWidget({data: support, world}));
```

## About the data

The values come straight from Table S6 of the [supplementary materials](https://www.science.org/doi/10.1126/sciadv.adj5778#supplementary-materials); the figure recreates the paper's Fig. 4B ("Policy support").

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "policy-support-map/embed",
  height: 470,
  title: "Support for climate policy, by country",
  note: "The map fills its column up to 640&nbsp;px wide and reflows down to about " +
    "320&nbsp;px; narrower than that it scrolls sideways inside the frame. Unlike the " +
    "other widgets its height follows its width (the map keeps the Equal Earth aspect " +
    "ratio), so in a column much narrower than 640&nbsp;px you can trim the iframe " +
    "height to about 350.",
  script: `<div id="policy-support-map"></div>

<script type="module">
  import {createPolicySupportMapWidget, parseTabS6}
    from "${cdnUrl("policy-support-map/widget.js")}";

  // The country outlines are shared with the belief-map widget, hence the path.
  const [csv, world] = await Promise.all([
    fetch("${cdnUrl("policy-support-map/data/Vlasceanu_etal_ScienceAdvances_2024_tabS6.csv")}")
      .then(r => r.text()),
    fetch("${cdnUrl("belief-map/data/countries-110m.json")}").then(r => r.json()),
  ]);

  document.getElementById("policy-support-map")
    .appendChild(createPolicySupportMapWidget({data: parseTabS6(csv), world}));
<\/script>`
}));
```

---

Policy-support estimates: Table S6 of Vlasceanu et al., ["Addressing climate change with behavioral science: A global intervention tournament in 63 countries"](https://www.science.org/doi/10.1126/sciadv.adj5778), *Science Advances* 10, eadj5778 (2024). Country boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:110m via [world-atlas](https://github.com/topojson/world-atlas).
