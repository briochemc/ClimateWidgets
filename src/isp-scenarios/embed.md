---
title: The NEM to 2050 (embed)
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
import {createIspScenariosWidget} from "./widget.js";

const data = await FileAttachment("./data/isp-2026.json").json();

// Presets: ?scenario=step-change, accelerated-transition or slower-growth; ?measure=generation
// or capacity.
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") ?? undefined;
const measure = params.get("measure") ?? undefined;
```

```js
const isp = view(createIspScenariosWidget({data, scenario, measure}));
```
