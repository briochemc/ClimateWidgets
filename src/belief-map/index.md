# Belief in climate change, by country

In 2022–2023, a global tournament of behavioral-science interventions surveyed about 59,000 people in 63 countries ([Vlasceanu et al. 2024, *Science Advances*](https://www.science.org/doi/10.1126/sciadv.adj5778)). Participants rated four statements about climate change — that it poses a serious threat to humanity, that it is caused by human activity, and so on — on a 0–100 scale, averaged into a single *belief* score. The map colors each country by its estimated mean belief, on an [Equal Earth](https://en.wikipedia.org/wiki/Equal_Earth_projection) projection. Hover over a country to see its score, or click to pin it.

```js
import {createBeliefMapWidget, parseTabS5} from "./widget.js";

const belief = parseTabS5(await FileAttachment("data/Vlasceanu_etal_ScienceAdvances_2024_tabS5.csv").text());
const world = await FileAttachment("data/countries-110m.json").json();
```

```js
const country = view(createBeliefMapWidget({data: belief, world}));
```

## About the data

The values are the country-level posterior mean belief from the paper's Bayesian hierarchical model, taken directly from Table S5 of the [supplementary materials](https://www.science.org/doi/10.1126/sciadv.adj5778#supplementary-materials) rather than refit; the figure recreates the paper's Fig. 4A ("Belief"). Two things worth knowing before reading too much into the colors:

- The color scale spans the full 0–100 range, but every country in the study sits between about 63 (USA) and 97 (Philippines) — belief in climate change is high nearly everywhere it was measured. Countries in gray were not part of the study. A companion widget maps the same study's [support for climate policy](../policy-support-map/), which runs notably lower on the same scale.
- Singapore is one of the 63 study countries (mean belief 83.9) but is too small to have an outline in the 1:110m-scale map geometry, so it cannot be drawn or hovered here.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "belief-map/embed",
  height: 470,
  title: "Belief in climate change, by country",
  note: "The map fills its column up to 640&nbsp;px wide and reflows down to about " +
    "320&nbsp;px; narrower than that it scrolls sideways inside the frame. Unlike the " +
    "other widgets its height follows its width (the map keeps the Equal Earth aspect " +
    "ratio), so in a column much narrower than 640&nbsp;px you can trim the iframe " +
    "height to about 350.",
  script: `<div id="belief-map"></div>

<script type="module">
  import {createBeliefMapWidget, parseTabS5}
    from "${cdnUrl("belief-map/widget.js")}";

  const [csv, world] = await Promise.all([
    fetch("${cdnUrl("belief-map/data/Vlasceanu_etal_ScienceAdvances_2024_tabS5.csv")}")
      .then(r => r.text()),
    fetch("${cdnUrl("belief-map/data/countries-110m.json")}").then(r => r.json()),
  ]);

  document.getElementById("belief-map")
    .appendChild(createBeliefMapWidget({data: parseTabS5(csv), world}));
<\/script>`
}));
```

---

Belief estimates: Table S5 of Vlasceanu et al., ["Addressing climate change with behavioral science: A global intervention tournament in 63 countries"](https://www.science.org/doi/10.1126/sciadv.adj5778), *Science Advances* 10, eadj5778 (2024). Country boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:110m via [world-atlas](https://github.com/topojson/world-atlas).
