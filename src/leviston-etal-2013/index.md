# Actual vs. perceived opinion on climate change

Leviston, Walker & Morwinski (2013) asked a large, representative sample of Australians which of four statements best matched their own opinion on climate change — that it is not happening, that they don't know, that it is happening but natural, or that it is happening and human-induced — and separately asked everyone to estimate how the *whole community* is split across those same four opinions. The survey ran twice, twelve months apart. Two effects show up when you compare estimate to actual: people underestimate how many others share the "human-induced" view (a false-consensus-adjacent finding sometimes called pluralistic ignorance), and each opinion group's own estimate is skewed toward its own opinion more than the true split is — people think others agree with them a bit more than others actually do.

Pick a time and an estimator with the buttons below. The dashed outline always traces the actual split for reference, except when "Actual" itself is selected.

```js
import {createLevistonEtal2013Widget, parseLevistonEtal2013} from "./widget.js";

const opinions = parseLevistonEtal2013(await FileAttachment("data/leviston-etal-2013.csv").text());
```

```js
const selection = view(createLevistonEtal2013Widget({data: opinions}));
```

## About the data

The values are the percentages printed on the paper's published Figures 1 and 2, transcribed into [`data/leviston-etal-2013.csv`](https://github.com/briochemc/ClimateWidgets/blob/main/src/leviston-etal-2013/data/leviston-etal-2013.csv). "Perceived by all" is each survey's pooled estimate (Figure 1); the four opinion-group estimates are each group's own average estimate of the community-wide split (Figure 2) — for example, respondents who themselves picked "not happening" estimated, on average, that 43.3% of the community agrees with them at Time 1, versus the true 5.6%.

The four opinion-group sample sizes (Not happening 283, Don't know 189, Natural 2,024, Human-induced 2,540) are from Time 1; the paper's own Figure 2 reuses them under the Time 2 panel as well, and this widget does the same.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "leviston-etal-2013/embed",
  height: 560,
  title: "Actual vs. perceived opinion on climate change",
  note: "The figure holds a constant 380&nbsp;px height; the buttons above it wrap onto more " +
    "rows as the iframe narrows, so give it a little extra height below about 400&nbsp;px wide.",
  script: `<div id="leviston-etal-2013"></div>

<script type="module">
  import {createLevistonEtal2013Widget, parseLevistonEtal2013}
    from "${cdnUrl("leviston-etal-2013/widget.js")}";

  const csv = await fetch("${cdnUrl("leviston-etal-2013/data/leviston-etal-2013.csv")}")
    .then(r => r.text());

  document.getElementById("leviston-etal-2013")
    .appendChild(createLevistonEtal2013Widget({data: parseLevistonEtal2013(csv)}));
<\/script>`
}));
```

---

Survey data: Leviston, Z., Walker, I. & Morwinski, S. (2013), ["Your opinion on climate change might not be as common as you think"](https://doi.org/10.1038/nclimate1743), *Nature Climate Change* 3, 334–337.
