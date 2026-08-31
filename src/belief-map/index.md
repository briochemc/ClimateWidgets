# Belief in climate change, by country

In 2022–2023, [Vlasceanu et al. (2024, *Science Advances*)](https://www.science.org/doi/10.1126/sciadv.adj5778) asked 59,440 people in 63 countries "How accurate do you think these statements are?", from 0 (not at all accurate) to 100 (extremely accurate):

- Taking action to fight climate change is necessary to avoid a global catastrophe
- Human activities are causing climate change
- Climate change poses a serious threat to humanity
- Climate change is a global emergency

Each country's *belief* score is a posterior mean from the Bayesian hierarchical model the authors fitted to all those ratings — a zero-one-inflated beta model with country, item, participant, and intervention effects. Click or tap a country to see its score; click it again, or the ocean, to dismiss it.

```js
import {createBeliefMapWidget, parseTabS5} from "./widget.js";

const belief = parseTabS5(await FileAttachment("data/Vlasceanu_etal_ScienceAdvances_2024_tabS5.csv").text());
const world = await FileAttachment("data/countries-110m.json").json();
```

```js
const country = view(createBeliefMapWidget({data: belief, world}));
```

## About the data

The values come straight from Table S5 of the [supplementary materials](https://www.science.org/doi/10.1126/sciadv.adj5778#supplementary-materials); the figure recreates the paper's Fig. 4A ("Belief").

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
