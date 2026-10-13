---
title: The Coriolis effect on the Earth (embed)
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
import {createCoriolisSphereWidget} from "./widget.js";

const world = await FileAttachment("../data/countries-110m.json").json();

// ?frame=fixed opens with the view from space; ?demo opens with three parcels already
// launched (the thumbnail capture uses it).
const params = new URLSearchParams(location.search);
const frame = params.get("frame") === "fixed" ? "fixed" : "rotating";
const demo = params.has("demo");
```

```js
const coriolis = view(createCoriolisSphereWidget({world, frame, demo}));
```
