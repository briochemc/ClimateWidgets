---
title: From plant to a light bulb (embed)
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

// Presets: ?source=coal, gas, nuclear, biomass, geothermal, hydro, wind or solar; ?bulb=incandescent,
// led (an ordinary one) or best-led; ?efficiency=45 (the plant's, per cent, overriding the source's typical figure).
const params = new URLSearchParams(location.search);
const source = params.get("source") ?? undefined;
const bulb = params.get("bulb") ?? undefined;
const eff = Number(params.get("efficiency"));
const efficiency = eff > 1 ? eff / 100 : eff > 0 ? eff : undefined;
```

```js
const energy = view(createEnergyChainWidget({source, bulb, efficiency}));
```
