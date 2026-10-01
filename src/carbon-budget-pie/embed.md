---
title: The carbon budget as a pie (embed)
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
import {createCarbonBudgetPieWidget} from "./widget.js";

const data = await FileAttachment("../carbon-budget/data/carbon-budget.json").json();

// ?year=1990 opens on that year; ?colour=year, region or country opens sliced that way (decades are the default);
// ?limit=1.5, 1.7 or 2 picks the pie; ?estimate=ipcc or forster the budgets (the data file's ids).
const params = new URLSearchParams(location.search);
const year = Number(params.get("year")) || undefined;
const colour = params.get("colour") ?? undefined;
const limit = Number(params.get("limit")) || undefined;
const estimate = params.get("estimate") ?? undefined;
```

```js
const pie = view(createCarbonBudgetPieWidget({data, year, colour, limit, estimate}));
```
