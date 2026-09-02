# Climate anxiety in young people

Hickman et al. (2021) surveyed 10,000 people aged 16–25 across ten countries — the United Kingdom, Australia, the United States, India, the Philippines, Nigeria, France, Finland, Portugal and Brazil, about 1,000 in each — on how worried they are about climate change, from "not worried" to "extremely". Pick a country with the buttons to see how its answers differ from the pooled total, shown first.

```js
import {createHickmanEtal2021Widget, parseHickmanEtal2021} from "./widget.js";

const worry = parseHickmanEtal2021(await FileAttachment("data/hickman-etal-2021.csv").text());
```

```js
const country = view(createHickmanEtal2021Widget({data: worry}));
```

## About the data

The values are the paper's published counts of respondents choosing each answer, transcribed into [`data/hickman-etal-2021.csv`](https://github.com/briochemc/ClimateWidgets/blob/main/src/hickman-etal-2021/data/hickman-etal-2021.csv). The pooled "All" row sums to 9,848 rather than the paper's headline 10,000, because of item non-response; each country's own total is close to 1,000. Percentages are computed per selection from that selection's own total, so they always sum to (about) 100%.

Bars are shown as a percentage of the selected group's respondents, on a fixed 0–70% scale, so a country's bars are directly comparable to the pooled total's; the label inside (or above, for the shortest bars) each bar instead gives the underlying respondent count. The bracket over the "very" and "extremely" bars recomputes its headline percentage for whichever selection is showing.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "hickman-etal-2021/embed",
  height: 560,
  title: "Climate anxiety in young people",
  note: "The figure holds a constant 380&nbsp;px height; the country buttons above it wrap " +
    "onto more rows as the iframe narrows, so give it a little extra height below about " +
    "400&nbsp;px wide.",
  script: `<div id="hickman-etal-2021"></div>

<script type="module">
  import {createHickmanEtal2021Widget, parseHickmanEtal2021}
    from "${cdnUrl("hickman-etal-2021/widget.js")}";

  const csv = await fetch("${cdnUrl("hickman-etal-2021/data/hickman-etal-2021.csv")}")
    .then(r => r.text());

  document.getElementById("hickman-etal-2021")
    .appendChild(createHickmanEtal2021Widget({data: parseHickmanEtal2021(csv)}));
<\/script>`
}));
```

---

Survey data: Hickman, C., Marks, E., Pihkala, P., Clayton, S., Lewandowski, R. E., Mayall, E. E., Wray, B., Mellor, C. & van Susteren, L. (2021), ["Climate anxiety in children and young people and their beliefs about government responses to climate change: a global survey"](https://doi.org/10.1016/S2542-5196(21)00278-3), *The Lancet Planetary Health* 5(12), e863–e873.
