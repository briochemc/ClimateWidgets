---
title: Temperature trends (embed)
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
import {createTemperatureTrendWidget, parseGistemp} from "./widget.js";

const gistemp = parseGistemp(await FileAttachment("data/GLB.Ts+dSST.csv").text());
```

```js
const trend = view(createTemperatureTrendWidget({data: gistemp}));
```
