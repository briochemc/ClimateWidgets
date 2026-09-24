---
title: What the air is made of (embed)
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
import {createAtmosphericCompositionWidget} from "./widget.js";

const data = await FileAttachment("data/composition.json").json();

// ?level=2 opens zoomed in to that grid (the thumbnail capture uses it); ?water=0.4, 1 or 4
// opens with that percentage of water vapour mixed in (the amounts the data file offers).
const params = new URLSearchParams(location.search);
const level = Number(params.get("level")) || 1;
const waterParam = params.get("water") ?? "";
const waterVapour = ["true", "yes", "on"].includes(waterParam) ? true : Math.round(Number(waterParam) * 1e4) || 0;
```

```js
const air = view(createAtmosphericCompositionWidget({data, level, waterVapour}));
```
