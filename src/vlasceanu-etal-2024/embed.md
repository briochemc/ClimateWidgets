---
title: Vlasceanu et al. 2024 — climate beliefs and action (embed)
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
