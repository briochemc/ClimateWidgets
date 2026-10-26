---
title: Paying into the climate funds (embed)
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
import {createClimateFundsWidget} from "./widget.js";

const data = await FileAttachment("./data/climate-funds.json").json();

// ?measure=perCapita, ?measure=gdp or ?measure=gdp1850 opens on that measure; ?fund=gcf (gef,
// ldcf, sccf, af, frld) on that fund alone.
const params = new URLSearchParams(location.search);
const measure = params.get("measure") ?? undefined;
const fund = params.get("fund") ?? undefined;
```

```js
const funds = view(createClimateFundsWidget({data, measure, fund}));
```
