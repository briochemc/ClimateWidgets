---
title: From coal to a light bulb (embed)
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
import {createEnergyChainWidget} from "./widget.js";

// Presets: ?bulb=led or incandescent; ?efficiency=45 (the power station's, per cent).
const params = new URLSearchParams(location.search);
const bulb = params.get("bulb") ?? undefined;
const eff = Number(params.get("efficiency"));
const efficiency = eff > 1 ? eff / 100 : eff > 0 ? eff : undefined;
```

```js
const energy = view(createEnergyChainWidget({bulb, efficiency}));
```
