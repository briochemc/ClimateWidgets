---
title: Actual vs. perceived opinion on climate change (embed)
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
import {createLevistonEtal2013Widget, parseLevistonEtal2013} from "./widget.js";

const opinions = parseLevistonEtal2013(await FileAttachment("data/leviston-etal-2013.csv").text());
```

```js
const selection = view(createLevistonEtal2013Widget({data: opinions}));
```
