# Vlasceanu et al. 2024 — climate beliefs and action in 63 countries

In 2022–2023, [Vlasceanu et al. (2024, *Science Advances*)](https://www.science.org/doi/10.1126/sciadv.adj5778) ran a behavioural intervention tournament with 59,440 participants in 63 countries, measuring four outcomes. Pick one with the buttons; click or tap a country to see its score, and click it again, or the ocean, to dismiss it.

**Climate beliefs** — "How accurate do you think these statements are?", 0 (not at all) to 100 (extremely), averaged over four statements: that action is necessary to avoid catastrophe, that human activities are causing climate change, that it threatens humanity, and that it is a global emergency.

**Policy support** — agreement from 0 (not at all) to 100 (very much so) with nine policies, including carbon taxes, public transport, renewable energy, protecting forests, and green jobs.

**Social media sharing** — the share who said yes to "Are you willing to share this information on your social media?" after reading a climate fact. Participants who do not use social media, about a quarter of the sample, are excluded.

**Tree-planting effort** — pages completed in the Work for Environmental Protection Task, a tedious number-screening job where each of up to eight pages funded one tree.

```js
import {createVlasceanuEtal2024Widget, parseVlasceanuEtal2024} from "./widget.js";

const study = parseVlasceanuEtal2024({
  belief: await FileAttachment("data/tabS5.csv").text(),
  policy: await FileAttachment("data/tabS6.csv").text(),
  sharing: await FileAttachment("data/tabS7.csv").text(),
  wept: await FileAttachment("data/tabS8.csv").text(),
});
const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const country = view(createVlasceanuEtal2024Widget({data: study, world}));
```

## About the data

The four tables ship here exactly as published — Tables S5 to S8 of the [supplementary materials](https://www.science.org/doi/10.1126/sciadv.adj5778#supplementary-materials) — and everything drawn above is computed from them in the browser. Each value is a posterior mean from the authors' Bayesian hierarchical models (zero-one-inflated beta, with country, item, participant and intervention effects), not an average of their respondents: the raw participant means run about four points lower on belief. The bar is therefore the unweighted mean of the 63 country scores, the same quantity the map is coloured by, rather than a respondent-level average that would not match it. Note that the 63 countries are a convenience sample, so that bar is a 63-country figure and not a world one.

Belief, policy support and sharing are all reported on a 0–100 scale, so the three share one diverging colour scale fixed to that full range: those maps can be read against each other, and the midpoint of the scale is the midpoint of the measure. Tree-planting effort is pages completed out of eight rather than a percentage, so a diverging scale would imply a midpoint it does not have; it gets its own sequential scale over the range the 63 countries span, and is not comparable with the other three. The bar chart's axis always starts at zero. Singapore is in the study but has no polygon at this map's resolution.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "vlasceanu-etal-2024/embed",
  height: 545,
  title: "Vlasceanu et al. 2024 — climate beliefs and action in 63 countries",
  note: "The map fills the row up to 640&nbsp;px wide and the bar chart matches whatever " +
    "height it lands at. Below about 400&nbsp;px the bars stack above the map instead of " +
    "beside it, which roughly doubles the height — give the iframe about 805 there.",
  script: `<div id="vlasceanu-etal-2024"></div>

<script type="module">
  import {createVlasceanuEtal2024Widget, parseVlasceanuEtal2024}
    from "${cdnUrl("vlasceanu-etal-2024/widget.js")}";

  const base = "${cdnUrl("vlasceanu-etal-2024/data/")}";
  const [belief, policy, sharing, wept, world] = await Promise.all([
    fetch(base + "tabS5.csv").then(r => r.text()),
    fetch(base + "tabS6.csv").then(r => r.text()),
    fetch(base + "tabS7.csv").then(r => r.text()),
    fetch(base + "tabS8.csv").then(r => r.text()),
    fetch("${cdnUrl("data/countries-110m.json")}").then(r => r.json()),
  ]);

  document.getElementById("vlasceanu-etal-2024").appendChild(
    createVlasceanuEtal2024Widget({
      data: parseVlasceanuEtal2024({belief, policy, sharing, wept}),
      world,
    }));
<\/script>`
}));
```

---

Country estimates: Tables S5–S8 of Vlasceanu et al., ["Addressing climate change with behavioral science: A global intervention tournament in 63 countries"](https://www.science.org/doi/10.1126/sciadv.adj5778), *Science Advances* 10, eadj5778 (2024). Country boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:110m via [world-atlas](https://github.com/topojson/world-atlas).
