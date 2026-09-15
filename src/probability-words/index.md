# What people think a probability word means

The IPCC does not say "70% chance". It says *likely*, *very likely*, *unlikely* — words its guidance note ties to precise ranges: *very likely* means more than 90%, *likely* more than 66%, *unlikely* less than 33%, *very unlikely* less than 10%. The words are meant to carry those numbers.

Four surveys have checked whether they do, by playing the same game: show people a word for chance, ask them to put a number on it. This widget puts all four on one scale. Point at any bubble to read exactly how many people gave that answer.

```js
import {createProbabilityWordsWidget, parseProbabilityWords} from "./widget.js";

const answers = parseProbabilityWords(await FileAttachment("data/probability-words.json").json());
```

```js
const selection = view(createProbabilityWordsWidget({data: answers}));
```

**IPCC words.** Budescu, Por & Broomell (2012) showed 556 members of a nationally representative US panel eight real sentences from the IPCC's Fourth Assessment Report, two for each of four words. They split the panel three ways to see whether the misreading is fixable: one group saw the words alone, one could open the IPCC's own translation table, and one read the numerical range printed inside the sentence. In the words-only group the median reading of *likely*, of *unlikely* and of *very unlikely* is 50%, a coin flip, for three words the IPCC uses to mean three very different things. All four medians fall outside the range the IPCC intended.

**Intelligence words.** Wintle et al. (2019) ran the same experiment on the words the US intelligence community uses, whose ranges are set by a directive called ICD 203. Same four words, a different rulebook, four presentation formats and 924 people. This time every one of the four medians lands *inside* the official range. The difference is not the readers, it is the scale: ICD 203 gives each word a closed interval near where people already put it, such as 80–95% for *very likely*, while the IPCC gives one-sided thresholds pushed out to the extremes.

**Ways to say unlikely.** Juanchich, Sirota, Teigen & Shepherd (2025) asked whether the *framing* of a low probability changes the number people read into it. Two of their phrasings point away from the event, *unlikely* and *the likelihood is low*; two point towards it, *a small probability* and *a small possibility*. Each of 301 people saw one of the four. The four rows come out on top of each other: every median is 15%, and between 93% and 96% of answers land inside the IPCC's *unlikely* range. Swapping the negative wording for a positive one does not move the number at all. What it does move, the paper shows in its other seven experiments, is what readers infer about how much scientists agree and how much evidence is behind the claim.

**Everyday words.** Mauboussin & Mauboussin (2018) asked 1,976 people for a number on 23 everyday phrases with no sentence around them and no official scale at all. Nothing here can be right or wrong, which is the point: *possibly* runs from near zero to near certain, and even *always* and *never* are not unanimous.

Two things survive all four. Answers pile up hard on round numbers, 50 then 25 and 75, rather than on any official threshold. And the spread within a single word is far wider than the gap between neighbouring words, which is what makes the vocabulary leak.

## About the data

Answers were given on a slider and came back as whole percentages, and they are heaped: 95 of the 384 readings of *very unlikely* in the IPCC study's words-only group are exactly 50%, and 1,233 of the 1,862 readings of *never* are exactly 0%. One dot per person would therefore be mostly overplotting, so each distinct value gets a single bubble whose **area** is the number of people who chose it. The bubbles are then dodged vertically, the way a beeswarm dodges dots, and the figure solves for the largest bubble scale at which every row of every group still packs without overlapping. Nothing is hidden behind anything else. The scale is solved per study, so a bubble means the same number of people in every row and group of one study; the key above the figure states it.

Nothing is floored to a minimum size, so area can be read as a headcount throughout. The cost is that in the everyday-words study, where one answer is 1,233 of 1,862, the rarest answers are 35 times smaller in radius than the commonest and show only as a faint trace. That is the honest rendering of one person in a thousand; pointing at a row and stepping through it with the arrow keys is how you read those counts.

A bubble is green when the answer falls inside the range its publisher assigns to the word and orange when it misses, so the "in range" figure on the right has a direct visual counterpart. Where a study asked two sentences per word, the row pools both, following Budescu et al.'s own Figure 2. The everyday phrases have no official range, so they are drawn in plain blue with no band and no percentage.

[`scripts/probability-words.jl`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/probability-words.jl) downloads all four sources and writes the tallies to [`data/probability-words.json`](https://github.com/briochemc/ClimateWidgets/blob/main/src/probability-words/data/probability-words.json). The site never runs the script; the JSON is committed.

- The IPCC study ran on Time-sharing Experiments for the Social Sciences, which archives the full response file on the [OSF](https://osf.io/gf5sm/). Every answer is kept here, including the 0s and the 100s. The paper recoded all extreme responses as missing before computing its own tables, because a handful of respondents had answered 0% to all four positive items or 100% to all four negative ones. Applying that recoding to this data reproduces the paper's Table 3 exactly, in all 24 cells, which is how the extraction was checked. It is not applied in the figure, because it drops 8.3% of real answers and, for *very likely*, removes answers of 100% that are inside the range the IPCC means.
- The intelligence study publishes its data on the [OSF](https://osf.io/q78fu/). Counting an answer as in range when it falls on or between the ICD 203 bounds reproduces the paper's published percentages to within a point, inside its own confidence intervals.
- The four-phrasings study publishes its data on the [OSF](https://osf.io/ch4wf/); Experiment 1 is the one that asked for a number, and its file carries the authors' own coding of each answer as within "IPCC guidelines 0-33%" or beyond. Counting answers of 33% or less reproduces that coding exactly, 284 against 17, which is the band drawn here.
- The everyday-phrase survey publishes its data on [GitHub](https://github.com/amauboussin/probability-survey). Its rows are ordered by median, highest first.

A fifth dataset in this literature, the [r/samplesize survey](https://github.com/zonination/perceptions) of Sherman Kent's phrases, is left out: at 46 respondents it is too small for the bubbles to say much that the 1,976-person survey does not say better.

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
    "420&nbsp;px for the three four-word studies to 684&nbsp;px for the 23 everyday phrases. " +
    "The height above fits the tallest; drop it to about 660&nbsp;px if you only ever want " +
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
- Juanchich, M., Sirota, M., Teigen, K. H. & Shepherd, T. G. (2025), ["Negative verbal probabilities undermine communication of climate science"](https://doi.org/10.1038/s41558-025-02472-1), *Nature Climate Change*.
- Mauboussin, A. & Mauboussin, M. (2018), ["If you say something is 'likely', how likely do people think it is?"](https://hbr.org/2018/07/if-you-say-something-is-likely-how-likely-do-people-think-it-is), *Harvard Business Review*.
