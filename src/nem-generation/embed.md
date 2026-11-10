---
title: Electricity generation in the NEM (embed)
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
import {createNemGenerationWidget} from "./widget.js";

const data = await FileAttachment("./data/nem-generation.json").json();

// Presets, for Moodle's plain iframes: ?region=sa1 (nem, nsw1, qld1, sa1, tas1, vic1, wem);
// ?interval=month (by year is the default); ?measure=share (GWh is the default); ?select=wind
// (coal, gas, hydro, wind, solar, batteries, other) to open with that source picked out.
const params = new URLSearchParams(location.search);
const region = params.get("region") ?? undefined;
const interval = params.get("interval") ?? undefined;
const measure = params.get("measure") ?? undefined;
const select = params.get("select") ?? undefined;
```

```js
const generation = view(createNemGenerationWidget({data, region, interval, measure, select}));
```
