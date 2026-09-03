# Studies of the scientific consensus

Every study that has measured it finds the same thing: the scientists who actually publish climate research overwhelmingly agree that global warming is human-caused. Pick a study with the buttons to see what it found. The wedge barely moves, which is the point. The studies are those in [Skeptical Science's graphic](https://skepticalscience.com/print.php?r=442) of that record, whose seven pies are the ones synthesised in the 2016 "consensus on consensus" paper, plus three that postdate it: the synthesis itself and the two studies published since. **Click the pie, or the citation under it, to open the paper.**

```js
import {createConsensusStudiesWidget, parseConsensusStudies} from "./widget.js";

const studies = parseConsensusStudies(await FileAttachment("data/consensus-studies.csv").text());
```

```js
const study = view(createConsensusStudiesWidget({data: studies}));
```

## About the data

Agreement rises with expertise, so every one of these surveys reports more than one number. The pies show the figure for the scientists who actually publish climate research, which is the convention the original graphic follows and the one Cook et al. (2016) tabulate: Verheggen et al.'s 90% is for respondents with more than ten climate papers, against 85% across everyone who stated a position; Stenhouse et al.'s 93% is for the meteorologists publishing mostly on climate, against 73% of the American Meteorological Society at large. Where a study reports both, the note beside the pie gives both numbers. That gap is the finding, not a caveat: a survey that reaches further from the field finds more doubt, and the people closest to the evidence are the most united about it.

The two newest pies are the ones the original graphic could not have. Myers et al. repeated Doran & Zimmerman's survey a decade on: 91.1% agreement across all 2,548 Earth scientists, 98.7% among those whose publication records confirm them as climate experts, and 100% among the most published of all. Lynas et al. surveyed no one. They sampled 3,000 of the 88,125 climate papers published since 2012, set aside 282 that turned out not to be about climate, and found four of the remaining 2,718 to be skeptical. That leaves the 99.85% the paper reports, and it is why that study's missing sliver is too thin to see.

No pie rounds up. The original graphic prints a tidy 97% over several of these studies, but each pie here carries the figure its paper actually reports (97.4%, 97.1%, 96.7%), and where a paper gives a range rather than a number, the low end of it: Anderegg et al.'s 97 to 98% is drawn at 97. The data is a hand-curated [CSV](https://github.com/briochemc/ClimateWidgets/blob/main/src/consensus-studies/data/consensus-studies.csv) with one row per paper, carrying its citation, finding and DOI, so there is no build script behind this widget.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "consensus-studies/embed",
  height: 580,
  title: "Studies of the scientific consensus on human-caused global warming",
  note: "The figure holds a constant 340&nbsp;px height; the study buttons above it wrap onto " +
    "more rows as the iframe narrows, so give it extra height below about 480&nbsp;px wide.",
  script: `<div id="consensus-studies"></div>

<script type="module">
  import {createConsensusStudiesWidget, parseConsensusStudies}
    from "${cdnUrl("consensus-studies/widget.js")}";

  const csv = await fetch("${cdnUrl("consensus-studies/data/consensus-studies.csv")}")
    .then(r => r.text());

  document.getElementById("consensus-studies")
    .appendChild(createConsensusStudiesWidget({data: parseConsensusStudies(csv)}));
<\/script>`
}));
```

---

The studies, in the order they appear: Oreskes (2004), [*Beyond the ivory tower: the scientific consensus on climate change*](https://doi.org/10.1126/science.1103618); Doran & Zimmerman (2009), [*Examining the scientific consensus on climate change*](https://doi.org/10.1029/2009EO030002); Anderegg et al. (2010), [*Expert credibility in climate change*](https://doi.org/10.1073/pnas.1003187107); Cook et al. (2013), [*Quantifying the consensus on anthropogenic global warming in the scientific literature*](https://doi.org/10.1088/1748-9326/8/2/024024); Verheggen et al. (2014), [*Scientists' views about attribution of global warming*](https://doi.org/10.1021/es501998e); Stenhouse et al. (2014), [*Meteorologists' views about global warming*](https://doi.org/10.1175/BAMS-D-13-00091.1); Carlton et al. (2015), [*The climate change consensus extends beyond climate scientists*](https://doi.org/10.1088/1748-9326/10/9/094025); Cook et al. (2016), [*Consensus on consensus*](https://doi.org/10.1088/1748-9326/11/4/048002); Myers et al. (2021), [*Consensus revisited*](https://doi.org/10.1088/1748-9326/ac2774); and Lynas et al. (2021), [*Greater than 99% consensus on human caused climate change in the peer-reviewed scientific literature*](https://doi.org/10.1088/1748-9326/ac2966).

Figure after [*The 97% consensus on global warming*](https://skepticalscience.com/print.php?r=442) by John Cook, Skeptical Science (CC BY 3.0).
