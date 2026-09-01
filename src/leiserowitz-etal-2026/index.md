# Global Warming's Six Americas

Since 2008, the [Yale Program on Climate Change Communication](https://climatecommunication.yale.edu/) and [George Mason University's Center for Climate Change Communication](https://www.climatechangecommunication.org/) have surveyed the U.S. public and sorted respondents into six audiences — Alarmed, Concerned, Cautious, Disengaged, Doubtful and Dismissive — ordered from highest to lowest belief in climate change, concern about it, and motivation to act. Drag the slider below the chart, or click anywhere on it, to see any of the 32 survey waves; the bars on the right animate to match.

```js
import {createLeiserowitzEtal2026Widget, parseLeiserowitzEtal2026} from "./widget.js";

const waves = parseLeiserowitzEtal2026(await FileAttachment("data/leiserowitz-etal-2026.csv").text());
```

```js
const wave = view(createLeiserowitzEtal2026Widget({data: waves}));
```

## About the data

The values are derived in [`scripts/leiserowitz-etal-2026.jl`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/leiserowitz-etal-2026.jl) from the program's own public trends spreadsheet, covering all 32 nationally representative waves fielded between November 2008 and November 2025 (the latest, Fall 2025, wave ran November 6–14, 2025 on the Ipsos KnowledgePanel, n = 1,146). The area chart recreates the program's own SASSY-trends figure, extended back over the full record rather than just its last decade; the thin light-gray band at the top of the stack is the small share the screener could not sort into one of the six segments (up to 4% before 2016, zero since), plus the ordinary rounding in the published whole-number percentages.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "leiserowitz-etal-2026/embed",
  height: 500,
  title: "Global Warming's Six Americas",
  note: "A constant ~460&nbsp;px tall at every width; below 320&nbsp;px it scrolls sideways " +
    "inside the iframe instead of shrinking further.",
  script: `<div id="leiserowitz-etal-2026"></div>

<script type="module">
  import {createLeiserowitzEtal2026Widget, parseLeiserowitzEtal2026}
    from "${cdnUrl("leiserowitz-etal-2026/widget.js")}";

  const csv = await fetch("${cdnUrl("leiserowitz-etal-2026/data/leiserowitz-etal-2026.csv")}")
    .then(r => r.text());

  document.getElementById("leiserowitz-etal-2026")
    .appendChild(createLeiserowitzEtal2026Widget({data: parseLeiserowitzEtal2026(csv)}));
<\/script>`
}));
```

---

Survey data: Leiserowitz, A., Kotcher, J., Verner, M., et al. (2026), [*Global Warming's Six Americas, Fall 2025*](https://climatecommunication.yale.edu/publications/global-warmings-six-americas-fall-2025/), Yale Program on Climate Change Communication & George Mason University Center for Climate Change Communication.
