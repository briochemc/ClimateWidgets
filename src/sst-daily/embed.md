---
title: Daily sea surface temperature (embed)
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
import {createSstDailyWidget, sstUnavailableNotice} from "./widget.js";

const SST_URL = "https://climatereanalyzer.org/clim/sst_daily/json_2clim/oisst2.1_world2_sst_day.json";
const sstData = await fetch(SST_URL)
  .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
  .catch(() => null);
```

```js
sstData ? view(createSstDailyWidget({data: sstData})) : display(sstUnavailableNotice());
```
