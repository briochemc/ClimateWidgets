---
title: Global Warming's Six Americas (embed)
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
import {createLeiserowitzEtal2026Widget, parseLeiserowitzEtal2026} from "./widget.js";

const waves = parseLeiserowitzEtal2026(await FileAttachment("data/leiserowitz-etal-2026.csv").text());
```

```js
const wave = view(createLeiserowitzEtal2026Widget({data: waves}));
```
