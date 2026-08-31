# Draw the future

Pick one of the [CMIP7 ScenarioMIP scenarios](https://gmd.copernicus.org/articles/19/2627/2026/) to see its atmospheric CO₂ and CO₂ fluxes. Then drag in the bottom panel to draw your own future CO₂ emissions from 2024 onward, and release to reveal the atmospheric CO₂ they would produce (in red). Your trajectory is routed through that scenario's natural CO₂ sink — the net uptake by ocean and land, diagnosed directly from the true CO₂ record (it turns into a source when CO₂ falls). The scenario curves stay fixed no matter what you draw; trace a scenario's actual emissions and you'll recover its true CO₂ curve exactly.

```js
import {createClimateWidget} from "./widget.js";

const co2 = await FileAttachment("data/co2_all.json").json();
const pco2 = await FileAttachment("data/pco2_all.json").json();
const d3 = await import("https://esm.sh/d3@5");
```

```js
const stroke = view(createClimateWidget({co2, pco2, d3}));
```

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "draw-the-future/embed",
  height: 780,
  title: "Draw the future: CO₂ emissions and atmospheric CO₂",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about " +
    "320&nbsp;px, so it works on phones; narrower than that it scrolls sideways inside " +
    "the frame. The older <code>/embed-simple</code> URL still works and now serves this " +
    "same widget, so any page already pointing at it keeps working.",
  script: `<div id="draw-the-future"></div>

<script type="module">
  import {createClimateWidget} from "${cdnUrl("draw-the-future/widget.js")}";
  import * as d3 from "https://esm.sh/d3@5";

  const base = "${cdnUrl("draw-the-future/data/")}";
  const [co2, pco2] = await Promise.all(
    ["co2_all.json", "pco2_all.json"]
      .map(f => fetch(base + f).then(r => r.json()))
  );

  const host = document.getElementById("draw-the-future");
  host.appendChild(createClimateWidget({co2, pco2, d3}));
<\/script>`
}));
```

---

Inspired by [Sterman (2008), _Science_](https://www.science.org/doi/10.1126/science.1162574), whose experiment showed how poorly people intuit the stock–flux relationship between CO₂ emissions and atmospheric concentration.
