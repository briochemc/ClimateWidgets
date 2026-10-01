---
title: CO₂ around the world, month by month (embed)
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
import {createCo2LatitudeWidget} from "./widget.js";

const data = await FileAttachment("data/co2-latitude.json").json();
const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const month = view(createCo2LatitudeWidget({data, world}));
```
