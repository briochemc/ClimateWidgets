---
title: Draw the future (embed)
header: false
footer: false
sidebar: false
toc: false
pager: false
---

<!-- Legacy route. There is no longer a separate "simplified" variant — the widget only
     has the one form — but this path is kept alive because a live Moodle iframe may
     point at it. It renders exactly what /embed and /draw-the-future/embed render. -->

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
import {createClimateWidget} from "./draw-the-future/widget.js";

const co2 = await FileAttachment("draw-the-future/data/co2_all.json").json();
const pco2 = await FileAttachment("draw-the-future/data/pco2_all.json").json();
const d3 = await import("https://esm.sh/d3@5");
```

```js
const stroke = view(createClimateWidget({co2, pco2, d3}));
```
