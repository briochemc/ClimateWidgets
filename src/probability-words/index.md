# What people think a probability word means

The IPCC does not say "70% chance". It says *likely*, *very likely*, *unlikely* — words its guidance note ties to precise ranges: *very likely* means more than 90%, *likely* more than 66%, *unlikely* less than 33%, *very unlikely* less than 10%. The words are meant to carry those numbers.

Three surveys have checked whether they do, by playing the same game: show people a word for chance, ask them to put a number on it. This widget puts all three on one scale, and lets you play it first.

```js
import {createProbabilityWordsWidget, parseProbabilityWords} from "./widget.js";

const answers = parseProbabilityWords(await FileAttachment("data/probability-words.json").json());
```

```js
const selection = view(createProbabilityWordsWidget({data: answers}));
```

**IPCC words.** Budescu, Por & Broomell (2012) showed 556 members of a nationally representative US panel eight real sentences from the IPCC's Fourth Assessment Report, two for each of four words. They split the panel three ways to see whether the misreading is fixable: one group saw the words alone, one could open the IPCC's own translation table, and one read the numerical range printed inside the sentence. In the words-only group the median reading of *likely*, of *unlikely* and of *very unlikely* is 50%, a coin flip, for three words the IPCC uses to mean three very different things. All four medians fall outside the range the IPCC intended.

**Intelligence words.** Wintle et al. (2019) ran the same experiment on the words the US intelligence community uses, whose ranges are set by a directive called ICD 203. Same four words, a different rulebook, four presentation formats and 924 people. This time every one of the four medians lands *inside* the official range. The difference is not the readers, it is the scale: ICD 203 gives each word a closed interval near where people already put it, such as 80–95% for *very likely*, while the IPCC gives one-sided thresholds pushed out to the extremes.

**Everyday words.** Mauboussin & Mauboussin (2018) asked 1,976 people for a number on 23 everyday phrases with no sentence around them and no official scale at all. Nothing here can be right or wrong, which is the point: *possibly* runs from near zero to near certain, and even *always* and *never* are not unanimous.

Two things survive all three. Answers pile up hard on round numbers, 50 then 25 and 75, rather than on any official threshold. And the spread within a single word is far wider than the gap between neighbouring words, which is what makes the vocabulary leak.

## About the data

Answers were given on a slider and came back as whole percentages, and they are heaped: 95 of the 384 readings of *very unlikely* in the IPCC study's words-only group are exactly 50%, and 1,233 of the 1,862 readings of *never* are exactly 0%. One dot per person would therefore be mostly overplotting, so each distinct value gets a single bubble whose **area** is the number of people who chose it. The bubbles are then dodged vertically, the way a beeswarm dodges dots, and the figure solves for the largest bubble scale at which every row of every group still packs without overlapping. Nothing is hidden behind anything else. The scale is solved per study, so a bubble means the same number of people in every row and group of one study; the key above the figure states it.

Where a study asked two sentences per word, the row pools both, following Budescu et al.'s own Figure 2. The box covers the middle half of a row's answers and the thick line is the median. There are no whiskers: the bubbles already show the whole spread, and answers pile up on 0 and 100 often enough that a percentile whisker would stretch across the entire axis. "In range" counts the share of a row's answers inside the official range, which is each study's own measure of whether the communication worked. The everyday phrases have no such range, so they carry no band and no percentage.

[`scripts/probability-words.jl`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/probability-words.jl) downloads all three sources and writes the tallies to [`data/probability-words.json`](https://github.com/briochemc/ClimateWidgets/blob/main/src/probability-words/data/probability-words.json). The site never runs the script; the JSON is committed.

- The IPCC study ran on Time-sharing Experiments for the Social Sciences, which archives the full response file on the [OSF](https://osf.io/gf5sm/). Every answer is kept here, including the 0s and the 100s. The paper recoded all extreme responses as missing before computing its own tables, because a handful of respondents had answered 0% to all four positive items or 100% to all four negative ones. Applying that recoding to this data reproduces the paper's Table 3 exactly, in all 24 cells, which is how the extraction was checked. It is not applied in the figure, because it drops 8.3% of real answers and, for *very likely*, removes answers of 100% that are inside the range the IPCC means.
- The intelligence study publishes its data on the [OSF](https://osf.io/q78fu/). Counting an answer as in range when it falls on or between the ICD 203 bounds reproduces the paper's published percentages to within a point, inside its own confidence intervals.
- The everyday-phrase survey publishes its data on [GitHub](https://github.com/amauboussin/probability-survey). Its rows are ordered by median, highest first.

A fourth dataset in this literature, the [r/samplesize survey](https://github.com/zonination/perceptions) of Sherman Kent's phrases, is left out: at 46 respondents it is too small for the bubbles to say much that the 1,976-person survey does not say better.

Quantiles use linear interpolation between order statistics.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "probability-words/embed",
  height: 880,
  title: "What people think a probability word means",
  note: "The figure's height depends on how many words the selected study asked about, from " +
    "420&nbsp;px for the two four-word studies to 684&nbsp;px for the 23 everyday phrases. " +
    "The height above fits the tallest; drop it to about 640&nbsp;px if you only ever want " +
    "the four-word studies on screen.",
  script: `<div id="probability-words"></div>

<script type="module">
  import {createProbabilityWordsWidget, parseProbabilityWords}
    from "${cdnUrl("probability-words/widget.js")}";

  const data = await fetch("${cdnUrl("probability-words/data/probability-words.json")}")
    .then(r => r.json());

  document.getElementById("probability-words")
    .appendChild(createProbabilityWordsWidget({data: parseProbabilityWords(data)}));
<\/script>`
}));
```

---

Survey data:

- Budescu, D. V., Por, H.-H. & Broomell, S. B. (2012), ["Effective communication of uncertainty in the IPCC reports"](https://doi.org/10.1007/s10584-011-0330-3), *Climatic Change* 113, 181–200. It extends Budescu, Broomell & Por (2009), ["Improving communication of uncertainty in the reports of the Intergovernmental Panel on Climate Change"](https://doi.org/10.1111/j.1467-9280.2009.02284.x), *Psychological Science* 20, 299–308, and was repeated in 24 countries and 17 languages by Budescu, Por, Broomell & Smithson (2014), ["The interpretation of IPCC probabilistic statements around the world"](https://doi.org/10.1038/nclimate2194), *Nature Climate Change* 4, 508–512, whose supplementary information reports the same pull toward 50% in every sample. Neither of those two publishes per-respondent data, so neither can be drawn here.
- Wintle, B. C., Fraser, H., Wills, B. C., Nicholson, A. E. & Fidler, F. (2019), ["Verbal probabilities: very likely to be somewhat more confusing than numbers"](https://doi.org/10.1371/journal.pone.0213522), *PLOS ONE* 14, e0213522.
- Mauboussin, A. & Mauboussin, M. (2018), ["If you say something is 'likely', how likely do people think it is?"](https://hbr.org/2018/07/if-you-say-something-is-likely-how-likely-do-people-think-it-is), *Harvard Business Review*.
