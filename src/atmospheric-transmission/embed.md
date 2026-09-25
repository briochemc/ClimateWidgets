---
title: Atmospheric transmission (embed)
header: false
footer: false
sidebar: false
toc: false
pager: false
---

<style>
/* Full-bleed: this page is only ever seen inside an iframe, so drop the
   centred-column max-width and page padding that the Air theme applies. */
#observablehq-center {
  margin: 0;
  padding: 0;
  max-width: none;
}
#observablehq-main {
  margin: 0;
  padding: 0;
  max-width: none;
}
body {
  margin: 0;
  overflow-x: auto;
}
</style>

```js
import {createAtmosphericTransmissionWidget} from "./widget.js";

const data = await FileAttachment("data/transmission.json").json();

// ?co2=278 (or 428, 856), ?ch4=729 (1939, 3878) and ?n2o=270 (340, 680) open on those
// amounts (1750, today and doubled work too); ?h2o=dry (mean, tropical; or 4, 25, 42) on
// that water column; ?gases=h2o,co2 opens with only those constituents included (keys:
// h2o, co2, o3, ch4, n2o, o2, rayleigh); ?earth=-50 opens with the surface at that
// temperature in °C (−90 to 60); ?tour=0 starts without the tour.
const params = new URLSearchParams(location.search);
const amounts = Object.fromEntries(["h2o", "co2", "ch4", "n2o"].filter(k => params.has(k)).map(k => [k, params.get(k)]));
const gases = params.has("gases") ? params.get("gases").split(",").map(s => s.trim()).filter(Boolean) : undefined;
const earthTemperature = params.has("earth") ? Number(params.get("earth")) : undefined;
const tour = !["0", "false", "no"].includes(params.get("tour") ?? "");
```

```js
const transmission = view(createAtmosphericTransmissionWidget({data, amounts, gases, earthTemperature, tour}));
```
