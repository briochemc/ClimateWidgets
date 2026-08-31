---
title: Belief in climate change, by country (embed)
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
import {createBeliefMapWidget, parseTabS5} from "./widget.js";

const belief = parseTabS5(await FileAttachment("data/Vlasceanu_etal_ScienceAdvances_2024_tabS5.csv").text());
const world = await FileAttachment("data/countries-110m.json").json();
```

```js
const country = view(createBeliefMapWidget({data: belief, world}));
```
