---
title: The carbon budget (embed)
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
import {createCarbonBudgetWidget} from "./widget.js";

const data = await FileAttachment("data/carbon-budget.json").json();

// ?year=1990 opens on that year; ?colour=region, ?colour=year or ?colour=decade opens in that colouring;
// ?estimate=ipcc or ?estimate=forster draws the lines from that estimate (the data file's ids).
const params = new URLSearchParams(location.search);
const year = Number(params.get("year")) || undefined;
const colour = params.get("colour") ?? undefined;
const estimate = params.get("estimate") ?? undefined;
```

```js
const budget = view(createCarbonBudgetWidget({data, year, colour, estimate}));
```
