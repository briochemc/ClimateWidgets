# Temperature trends

Global mean surface temperature, one point per year, as an anomaly relative to the 1951–1980 average. Drag the two handles below the chart to pick a period; the blue segment is the least-squares trend fitted to the years inside it, and the shaded band shows which years those are.

```js
import {createTemperatureTrendWidget, parseGistemp} from "./widget.js";

const gistemp = parseGistemp(await FileAttachment("data/GLB.Ts+dSST.csv").text());
```

```js
const trend = view(createTemperatureTrendWidget({data: gistemp}));
```

## Why the presets

Pick a short enough window and you can make this record say almost anything. The first two buttons are periods that have been used in public argument: **1998–2013** is the window Australian senator Malcolm Roberts and others pointed to when claiming that warming had stopped, and **1992–2007** is the equally arbitrary 16-year window used as a counterpoint by [Lewandowsky et al. (2015)](https://www.nature.com/articles/srep16784) — same record, same window length, roughly twice the warming rate.

The last two buttons take that to its limit: they are the flattest and the steepest 16-year windows anywhere in the record, found by fitting every one of them. One of them cools. Neither says anything useful about the climate, which is the point — 16 years is short enough that year-to-year variability, an El Niño at one end or a volcano at the other, dominates the fit. Drag the handles out to the full record to see the trend the data actually supports.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "temperature-trend/embed",
  height: 660,
  title: "Global mean temperature trends",
  note: "The figure itself is a fixed 640&nbsp;px wide, so it never reflows. In a column " +
    "narrower than that it scrolls sideways inside the frame and the preset buttons wrap " +
    "onto extra rows, so allow about 780 of height there.",
  script: `<div id="temperature-trend"></div>

<script type="module">
  import {createTemperatureTrendWidget, parseGistemp}
    from "${cdnUrl("temperature-trend/widget.js")}";

  const csv = await fetch("${cdnUrl("temperature-trend/data/GLB.Ts+dSST.csv")}")
    .then(r => r.text());

  const host = document.getElementById("temperature-trend");
  host.appendChild(createTemperatureTrendWidget({data: parseGistemp(csv)}));
<\/script>`
}));
```

---

Temperature data: [NASA GISS Surface Temperature Analysis (GISTEMP v4)](https://data.giss.nasa.gov/gistemp/), land-ocean global means, updated monthly. The widget uses the `J-D` annual mean column and ignores the current year until it is complete.
