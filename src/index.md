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

---

Inspired by [Sterman (2008), _Science_](https://www.science.org/doi/10.1126/science.1162574), whose experiment showed how poorly people intuit the stock–flux relationship between CO₂ emissions and atmospheric concentration.
