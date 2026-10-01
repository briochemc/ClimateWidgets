# CO₂ per person today

[The bars widget](../co2-per-capita-bars/) with the year fixed to the latest one, and nothing that moves: no slider, no tour. Every country is a bar, as tall as its population and as long as its CO₂ emissions per person, so its area is its emissions in all; the bars are stacked from the bottom in order of emissions per person, the lowest at the bottom. Click or tap a bar for its label (the arrow keys then walk the selection up and down the ranking), or a region in the key to see only its countries.

```js
import {createCo2PerCapitaTodayWidget} from "./widget.js";

const data = await FileAttachment("../co2-per-capita/data/co2-per-capita.json").json();
```

```js
const today = view(createCo2PerCapitaTodayWidget({data}));
```

**Yearly emissions** divides the year's emissions by the year's population; **Cumulative emissions** divides everything a country has emitted since 1850 by its population today. The three notes around China's bar, there until you touch anything (and back whenever you switch view), say what height, length and area mean; the large corner text says which view the year is of. Australia is labelled whenever its label fits. For the same picture with the years from 1850 playing through, see [the bars widget](../co2-per-capita-bars/).

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "co2-per-capita-today/embed",
  height: 880,
  title: "CO₂ per person today",
  note: "The plot is 680&nbsp;px tall whatever the width, and fills the frame up to 960&nbsp;px wide; allow about " +
    "900&nbsp;px of height at phone width, where the key wraps. The embed page accepts <code>?mode=cumulative</code> " +
    "to open on emissions since 1850.",
  script: `<div id="co2-per-capita-today"></div>

<script type="module">
  import {createCo2PerCapitaTodayWidget}
    from "${cdnUrl("co2-per-capita-today/widget.js")}";

  const data = await fetch("${cdnUrl("co2-per-capita/data/co2-per-capita.json")}")
    .then(r => r.json());

  // Options: {mode: "cumulative"} opens on emissions since 1850.
  document.getElementById("co2-per-capita-today")
    .appendChild(createCo2PerCapitaTodayWidget({data}));
<\/script>`
}));
```

---

The data and their sources are [the bars widget's](../co2-per-capita-bars/); this page draws from the same file.
