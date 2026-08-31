# Support for climate policy, by country

The same global tournament of behavioral-science interventions that measured [belief in climate change](../belief-map/) ([Vlasceanu et al. 2024, *Science Advances*](https://www.science.org/doi/10.1126/sciadv.adj5778)) also asked its ~59,000 participants in 63 countries how much they supported nine climate policies — raising carbon taxes, expanding public transport, and so on — on a 0–100 scale, averaged into a single *policy support* score. The map colors each country by its estimated mean support, on an [Equal Earth](https://en.wikipedia.org/wiki/Equal_Earth_projection) projection. Click or tap a country to see its score; click it again, or the ocean, to dismiss it.

```js
import {createPolicySupportMapWidget, parseTabS6} from "./widget.js";

const support = parseTabS6(await FileAttachment("data/Vlasceanu_etal_ScienceAdvances_2024_tabS6.csv").text());
const world = await FileAttachment("../belief-map/data/countries-110m.json").json();
```

```js
const country = view(createPolicySupportMapWidget({data: support, world}));
```

## About the data

The values are the country-level posterior mean policy support from the paper's Bayesian hierarchical model, taken directly from Table S6 of the [supplementary materials](https://www.science.org/doi/10.1126/sciadv.adj5778#supplementary-materials) rather than refit; the figure recreates the paper's Fig. 4B ("Policy support"). Worth knowing before reading too much into the colors:

- The color scale spans the full 0–100 range so this map is directly comparable with the [belief map](../belief-map/). Support runs lower than belief everywhere — from about 59 (Japan) to 80 (Turkey) — which is one of the paper's headline observations: believing in climate change is more widespread than supporting the policies that address it. Countries in gray were not part of the study.
- Singapore is one of the 63 study countries but is too small to have an outline in the 1:110m-scale map geometry, so it cannot be drawn or clicked here.

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
