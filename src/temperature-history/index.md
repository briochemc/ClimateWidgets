# The history of global temperature

Global average temperature on every timescale we have estimated it: the thermometer record since 1855, the Holocene, the ice ages, and the 540 million years of the Phanerozoic. The chart always ends at 2015; the slider under its time axis stretches that axis from a century to 540 million years, pulling left to look further back. The **Play tour** does the zoom by itself, pausing at each of the figure's landmarks, and stops on the whole record; it plays once when the page opens, and again whenever you press it. Hover a period along the top, or a landmark on the curve, for its full name; click it for its Wikipedia page.

```js
import {createTemperatureHistoryWidget} from "./widget.js";

const data = await FileAttachment("data/temperature-history.json").json();
```

```js
const history = view(createTemperatureHistoryWidget({data}));
```

This is Glen Fergus's figure [*All palaeotemps*](https://commons.wikimedia.org/wiki/File:All_palaeotemps.svg) on Wikimedia Commons, made zoomable. Its page there explains what each record is, how the ice cores and the Phanerozoic curves were scaled onto one axis, and how much to trust each part; the numbers here are its [spreadsheet](https://web.archive.org/web/20220830172205/http://gergs.net/wp-content/uploads/2015/06/All_palaeotemps.xlsx)'s, as they are, extracted by `scripts/temperature-history.py`.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "temperature-history/embed",
  height: 430,
  title: "The history of global temperature",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about " +
    "320&nbsp;px, so it works on phones; narrower than that it scrolls sideways inside " +
    "the frame.",
  script: `<div id="temperature-history"></div>

<script type="module">
  import {createTemperatureHistoryWidget}
    from "${cdnUrl("temperature-history/widget.js")}";

  const data = await fetch("${cdnUrl("temperature-history/data/temperature-history.json")}")
    .then(r => r.json());

  const host = document.getElementById("temperature-history");
  host.appendChild(createTemperatureHistoryWidget({data}));
<\/script>`
}));
```

---

Figure and data: Glen Fergus, [*All palaeotemps*](https://commons.wikimedia.org/wiki/File:All_palaeotemps.svg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), via Wikimedia Commons; the records it compiles are cited there.
