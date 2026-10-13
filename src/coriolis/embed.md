---
title: The Coriolis effect (embed)
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
import {createCoriolisWidget} from "./widget.js";

// ?frame=fixed opens with the view from the room; ?rpm=6 sets the rotation, negative for
// clockwise; ?demo opens with three balls already thrown (the thumbnail capture uses it).
const params = new URLSearchParams(location.search);
const frame = params.get("frame") === "fixed" ? "fixed" : "rotating";
const rpm = params.has("rpm") ? Number(params.get("rpm")) : 4;
const demo = params.has("demo");
```

```js
const coriolis = view(createCoriolisWidget({frame, rpm, demo}));
```
