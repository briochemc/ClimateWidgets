---
title: Support for climate action, by country (embed)
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
import {createAndreEtal2024Widget, parseAndreEtal2024} from "./widget.js";

const support = parseAndreEtal2024(await FileAttachment("data/andre-etal-2024.csv").text());
const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const country = view(createAndreEtal2024Widget({data: support, world}));
```
