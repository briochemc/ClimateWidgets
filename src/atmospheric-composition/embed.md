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

// ?level=2 opens zoomed in to that grid (the thumbnail capture uses it), ?water=1 with
// water vapour mixed in.
const params = new URLSearchParams(location.search);
const level = Number(params.get("level")) || 1;
const waterVapour = ["1", "true", "yes"].includes(params.get("water") ?? "");
```

```js
const air = view(createAtmosphericCompositionWidget({data, level, waterVapour}));
```
