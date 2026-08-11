# Draw the future

Pick a scenario to see its temperature, atmospheric CO₂, and CO₂ fluxes. Then drag in the bottom panel to draw your own future CO₂ emissions from 2024 onward, and release to reveal the atmospheric CO₂ they would produce (in red). Your trajectory is routed through that scenario's natural CO₂ sink — the net uptake by ocean and land, diagnosed directly from the true CO₂ record (it turns into a source when CO₂ falls). The scenario curves stay fixed no matter what you draw; trace a scenario's actual emissions and you'll recover its true CO₂ curve exactly.

```js
import {createClimateWidget} from "./widget.js";

const co2 = await FileAttachment("data/co2_all.json").json();
const pco2 = await FileAttachment("data/pco2_all.json").json();
const temp = await FileAttachment("data/temp_all.json").json();
const d3 = await import("https://esm.sh/d3@5");
```

```js
const stroke = view(createClimateWidget({co2, pco2, temp, d3, width}));
```

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "draw-the-future/embed",
  height: 940,
  title: "Draw the future: CO₂ emissions and atmospheric CO₂",
  note: "There is also a simplified variant for slides — no temperature panel, units on the " +
    "tick labels, larger annotations. Swap <code>/embed</code> for <code>/embed-simple</code> " +
    "in the URL above and reduce the height to about 740, or pass " +
    "<code>simplified: true</code> to the script-tag version.",
  script: `<div id="draw-the-future"></div>

<script type="module">
  import {createClimateWidget} from "${cdnUrl("draw-the-future/widget.js")}";
  import * as d3 from "https://esm.sh/d3@5";

  const base = "${cdnUrl("draw-the-future/data/")}";
  const [co2, pco2, temp] = await Promise.all(
    ["co2_all.json", "pco2_all.json", "temp_all.json"]
      .map(f => fetch(base + f).then(r => r.json()))
  );

  const host = document.getElementById("draw-the-future");
  host.appendChild(createClimateWidget({
    co2, pco2, temp, d3,
    width: host.clientWidth || 960,
    widthScale: 1
  }));
<\/script>`
}));
```

---

Inspired by [Sterman (2008), _Science_](https://www.science.org/doi/10.1126/science.1162574), whose experiment showed how poorly people intuit the stock–flux relationship between CO₂ emissions and atmospheric concentration.
