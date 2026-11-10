---
title: Electricity generation in the NEM (embed)
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
import {createNemGenerationWidget} from "./widget.js";

const data = await FileAttachment("./data/nem-generation.json").json();

// Presets, for Moodle's plain iframes: ?region=sa1 (nem, nsw1, qld1, sa1, tas1, vic1, wem);
// ?range=1y, 5y or all, with &interval=1y for years rather than months; ?measure=gwh or share;
// ?only=wind or ?hide=coal,gas (fuel technologies or the simple groups); ?renewables=1;
// ?group=simple.
const params = new URLSearchParams(location.search);
const region = params.get("region") ?? undefined;
const range = params.get("range") ?? undefined;
const interval = params.get("interval") ?? undefined;
const measure = params.get("measure") ?? undefined;
const grouping = params.get("group") ?? params.get("grouping") ?? undefined;
const only = params.get("only") ?? undefined;
const hide = params.get("hide") ?? undefined;
const renewables = ["1", "true", "yes", "on"].includes((params.get("renewables") ?? "").toLowerCase());
```

```js
const generation = view(createNemGenerationWidget({data, region, range, interval, measure, grouping, only, hide, renewables}));
```
