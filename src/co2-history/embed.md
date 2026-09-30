---
title: The history of atmospheric CO₂ (embed)
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
import {createCo2HistoryWidget, updateMaunaLoa} from "./widget.js";

const data = await FileAttachment("data/co2-history.json").json();

const NOAA = "https://gml.noaa.gov/webdata/ccgg/trends/co2/";
try {
  const [weekly, monthly] = await Promise.all(
    ["co2_weekly_mlo.txt", "co2_mm_mlo.txt"].map(f => fetch(NOAA + f).then(r => r.ok ? r.text() : null)));
  updateMaunaLoa(data, {weekly, monthly});
} catch {}
```

```js
const history = view(createCo2HistoryWidget({data}));
```
