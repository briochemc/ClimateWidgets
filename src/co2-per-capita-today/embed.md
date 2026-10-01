---
title: CO₂ per person today (embed)
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
import {createCo2PerCapitaTodayWidget} from "./widget.js";

const data = await FileAttachment("../co2-per-capita/data/co2-per-capita.json").json();

// ?mode=cumulative opens on emissions since 1850; ?year=1990 fixes another year.
const params = new URLSearchParams(location.search);
const year = Number(params.get("year")) || undefined;
const mode = params.get("mode") ?? undefined;
```

```js
const today = view(createCo2PerCapitaTodayWidget({data, year, mode}));
```
