---
title: CO₂ per person, country by country (embed)
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
import {createCo2PerCapitaWidget} from "./widget.js";

const data = await FileAttachment("data/co2-per-capita.json").json();

// ?year=1990 opens on that year; ?mode=cumulative opens on emissions since 1850.
const params = new URLSearchParams(location.search);
const year = Number(params.get("year")) || undefined;
const mode = params.get("mode") ?? undefined;
```

```js
const perCapita = view(createCo2PerCapitaWidget({data, year, mode}));
```
