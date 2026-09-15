// What people think a probability word means. Four surveys played the same game — show
// someone a word for chance, ask them to put a number on it — and disagreed with the
// institutions that publish those words for a living.
//
//   Budescu, Por & Broomell (2012)  556 US adults, eight sentences from the IPCC's Fourth
//                                   Assessment Report, three presentation formats.
//   Wintle et al. (2019)            924 people, eight intelligence-analysis statements,
//                                   four formats, the US intelligence community's ICD 203
//                                   lexicon — the same four words, a different rulebook.
//   Juanchich et al. (2025)         301 people, four ways of saying the same low
//                                   probability: two pointing away from the event
//                                   ("unlikely", "the likelihood is low") and two pointing
//                                   towards it ("a small probability", "a small
//                                   possibility"). Between subjects, one phrasing each.
//   Mauboussin & Mauboussin (2018)  1,976 people, 23 everyday phrases judged bare, with no
//                                   context and no official scale to be right about.
//
// The figure runs horizontally, one row per word: the 0-100% scale across the x axis, the
// official range for that word shaded on the row where one exists, and the answers
// themselves as bubbles, coloured by whether they fall inside that range.
//
// The answers are heaped on round numbers rather than spread out, so one dot per person
// would be mostly overplotting. Every distinct value gets one bubble instead, with its area
// proportional to how many people gave it, dodged vertically the way a beeswarm dodges dots
// (tryLayout, below). The heaping is the finding, so the chart is built to show it. Nothing
// is allowed to overlap or to leave its row: fitBubbles solves for the largest bubble scale
// at which the whole figure still packs, rather than trusting a constant picked by eye.
//
// Hovering or focusing a bubble names it exactly — how many people gave that answer, out of
// how many — because area is readable as "bigger" but not as a number.
//
// Studies differ in how many words they asked about — four against twenty-three — so the
// row pitch, and with it the figure's height, is a function of the selected study. Width
// still reflows between MIN_WIDTH and FIGURE_WIDTH the way every other widget here does.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.
//
// Data: src/probability-words/data/probability-words.json, one tally per study, condition
// and word, written by scripts/probability-words.jl from the four sources above. Every
// answer is kept, including the 0s and 100s Budescu et al. recoded away — see "About the
// data" on the widget's page.

const SVGNS = "http://www.w3.org/2000/svg";

const BACKGROUND = "#f2f2f2";
const BAR_BACKGROUND = "#e4e4e4"; // the group bar, a shade under the plate so it reads as a tray
const FIGURE_WIDTH = 600;
const MIN_WIDTH = 320;
const TRANSITION = "480ms ease";

// Vertical layout: constant for a given study, so switching condition never moves anything
// and an embed only has to allow for the tallest study once.
const ROW_TOP = 66;
const BOTTOM_CHROME = 66; // axis ticks and the source line, below the last row
const TICK_OFFSET = 20;
const SOURCE_OFFSET = 52;

// Okabe-Ito. A bubble is coloured by whether that answer falls inside the range the
// publishing body assigns to the word: green inside, vermillion outside, and plain blue
// where the phrase has no official range to be judged against.
const BAND_COLOR = "#009E73";
const IN_COLOR = "#009E73";
const OUT_COLOR = "#D55E00";
const NEUTRAL_COLOR = "#0072B2";
const KEY_COLOR = "#8a8a8a"; // the size key stands for magnitude, not for membership
const PICK_COLOR = "#111";

// Radius is the square root of the count, so it is the bubble's *area* that is proportional
// to the number of people. Nothing is floored to a minimum size: that would make the
// smallest bubbles overstate themselves, and the whole point of the encoding is that area
// can be read as a headcount. In a study where one answer is 1,233 of 1,862 the radius
// range is 35 to 1, so the rarest answers do land under a pixel and show only as a faint
// trace. That is the honest rendering of one person in a thousand.

// A bubble smaller than this is still pickable out to this radius, so the tiny ones can be
// hovered at all.
const MIN_PICK_R = 5;

// Round counts for the size key. The largest that fits the study's biggest pile, plus one
// about a tenth of it, plus one.
const NICE_COUNTS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// Two sentences per word in the IPCC study, split around the word so it can be emphasised.
// "brief" is the shortened retelling shown when the figure is too narrow for the original:
// a row holds two sentences and the pair has to fit a box whose height is reserved, so that
// hovering a row never reflows the page.
const IPCC_SENTENCES = {
  very_likely: [
    {
      pre: "Continued greenhouse gas emissions at or above current rates would cause further " +
        "warming and induce many changes in the global climate system during the 21st century " +
        "that would ",
      post: " be larger than those observed during the 20th century.",
      briefPre: "Further warming this century would ",
      briefPost: " be larger than that of the 20th century.",
    },
    {
      pre: "It is ",
      post: " that hot extremes, heat waves, and heavy precipitation events will continue to " +
        "become more frequent.",
      briefPre: "It is ",
      briefPost: " that heat waves and heavy rain keep getting more frequent.",
    },
  ],
  likely: [
    {
      pre: "The Greenland ice sheet and other Arctic ice fields ",
      post: " contributed no more than 4 m of the observed sea level rise.",
      briefPre: "Greenland and Arctic ice ",
      briefPost: " added no more than 4 m of past sea level rise.",
    },
    {
      pre: "Temperatures of the most extreme hot nights, cold nights and cold days are ",
      post: " to have increased due to anthropogenic forcing.",
      briefPre: "The most extreme hot nights and cold days are ",
      briefPost: " to have shifted because of human forcing.",
    },
  ],
  unlikely: [
    {
      pre: "Over the past 3,000 to 5,000 years, oscillations in global sea level on time-scales " +
        "of 100 to 1,000 years are ",
      post: " to have exceeded 0.3 to 0.5 m.",
      briefPre: "Sea level swings over the past few thousand years are ",
      briefPost: " to have exceeded 0.3 to 0.5 m.",
    },
    {
      pre: "Reconstructions of climate data for the past 1,000 years also indicate that this " +
        "warming was unusual and is ",
      post: " to be entirely natural in origin.",
      briefPre: "This warming was unusual and is ",
      briefPost: " to be entirely natural in origin.",
    },
  ],
  very_unlikely: [
    {
      pre: "It is ",
      post: " that the MOC will undergo a large abrupt transition during the 21st century.",
      briefPre: "It is ",
      briefPost: " that the ocean's overturning circulation shifts abruptly this century.",
    },
    {
      pre: "It is ",
      post: " that climate changes of at least the seven centuries prior to 1950 were due to " +
        "variability generated within the climate system alone.",
      briefPre: "It is ",
      briefPost: " that climate changes before 1950 came from the climate system alone.",
    },
  ],
};

// A band is [lo, hi] with a flag for each end saying whether the bound itself counts as
// inside. The IPCC's guidance note defines its terms as one-sided thresholds ("greater than
// 90%"); ICD 203 defines closed ranges ("80-95%"). Both tests below were checked against
// the percentages the two papers publish.
const IPCC_TERMS = [
  {id: "very_likely", label: "very likely", lo: 90, hi: 100, loOpen: true, hiOpen: false,
   rule: "greater than 90%", short: ">90%"},
  {id: "likely", label: "likely", lo: 66, hi: 100, loOpen: true, hiOpen: false,
   rule: "greater than 66%", short: ">66%"},
  {id: "unlikely", label: "unlikely", lo: 0, hi: 33, loOpen: false, hiOpen: true,
   rule: "less than 33%", short: "<33%"},
  {id: "very_unlikely", label: "very unlikely", lo: 0, hi: 10, loOpen: false, hiOpen: true,
   rule: "less than 10%", short: "<10%"},
];

const ICD_TERMS = [
  {id: "very_likely", label: "very likely", lo: 80, hi: 95, loOpen: false, hiOpen: false,
   rule: "80% to 95%", short: "80-95%"},
  {id: "likely", label: "likely", lo: 55, hi: 80, loOpen: false, hiOpen: false,
   rule: "55% to 80%", short: "55-80%"},
  {id: "unlikely", label: "unlikely", lo: 20, hi: 45, loOpen: false, hiOpen: false,
   rule: "20% to 45%", short: "20-45%"},
  {id: "very_unlikely", label: "very unlikely", lo: 5, hi: 20, loOpen: false, hiOpen: false,
   rule: "5% to 20%", short: "5-20%"},
];

// All four of Juanchich et al.'s phrasings are ways of saying the same thing, so they share
// one band: the IPCC's "unlikely". That is the authors' own yardstick — their data file
// codes each answer as within "IPCC guidelines 0-33%" or beyond it — not a choice made here.
const UNLIKELY_BAND = {lo: 0, hi: 33, loOpen: false, hiOpen: false,
  rule: "0% to 33%", short: "0-33%"};

const JUANCHICH_TERMS = [
  {id: "unlikely", label: "unlikely", ...UNLIKELY_BAND},
  {id: "low_likelihood", label: "the likelihood is low", ...UNLIKELY_BAND},
  {id: "small_probability", label: "a small probability", ...UNLIKELY_BAND},
  {id: "small_possibility", label: "a small possibility", ...UNLIKELY_BAND},
];

const STUDIES = [
  {
    id: "budescu-2012",
    pill: "IPCC words",
    title: ["How the US public reads", "the IPCC's probability words"],
    cite: "Budescu et al.",
    year: 2012,
    journal: "Climatic Change",
    url: "https://doi.org/10.1007/s10584-011-0330-3",
    authority: "the IPCC",
    setting: "in sentences from the IPCC's Fourth Assessment Report",
    terms: IPCC_TERMS,
    sentences: IPCC_SENTENCES,
    // `format` names the presentation format independently of the study's own condition
    // ids, so that switching study lands on the matching group where the new study ran one.
    conditions: [
      {id: "control", format: "words", label: "Words only", blurb: "the word on its own"},
      {id: "translation", format: "table", label: "IPCC table shown",
       blurb: "the IPCC's translation table beside it"},
      {id: "vn", format: "inline", label: "Numbers in the sentence",
       blurb: "the range printed in the sentence"},
    ],
  },
  {
    id: "wintle-2019",
    pill: "Intelligence words",
    title: ["How the public reads", "the intelligence world's words"],
    cite: "Wintle et al.",
    year: 2019,
    journal: "PLOS ONE",
    url: "https://doi.org/10.1371/journal.pone.0213522",
    authority: "ICD 203",
    setting: "in intelligence-analysis statements",
    terms: ICD_TERMS,
    sentences: null, // the paper does not publish the statements alongside its data
    conditions: [
      {id: "control", format: "words", label: "Words only", blurb: "the word on its own"},
      {id: "table", format: "table", label: "Table on a click",
       blurb: "a table of ranges one click away"},
      {id: "tool", format: "tooltip", label: "Tooltip on hover",
       blurb: "the range on hovering the word"},
      {id: "brackets", format: "inline", label: "Numbers in the sentence",
       blurb: "the range printed in the sentence"},
    ],
  },
  {
    id: "juanchich-2025",
    pill: "Ways to say unlikely",
    title: ["Four ways of saying", "the same low probability"],
    cite: "Juanchich et al.",
    year: 2025,
    journal: "Nature Climate Change",
    url: "https://doi.org/10.1038/s41558-025-02472-1",
    authority: "the IPCC",
    setting: "as a bare phrase, with no sentence around it",
    terms: JUANCHICH_TERMS,
    sentences: null,
    conditions: [
      {id: "all", format: "words", label: "Everyone", blurb: "one of the four phrasings, at random"},
    ],
  },
  {
    id: "mauboussin-2018",
    pill: "Everyday words",
    title: ["How people read", "everyday words for chance"],
    cite: "Mauboussin & Mauboussin",
    year: 2018,
    journal: "Harvard Business Review",
    url: "https://hbr.org/2018/07/if-you-say-something-is-likely-how-likely-do-people-think-it-is",
    authority: null, // nobody publishes a scale for these
    setting: "with no sentence around them",
    terms: null, // taken from the data, in the order the extraction script wrote them
    sentences: null,
    conditions: [{id: "all", format: "words", label: "Everyone", blurb: "the phrase on its own"}],
  },
];

// --- parsing ------------------------------------------------------------------------
// The JSON holds one tally per study, condition and word: [[value, people], ...]. Summary
// statistics are computed from the tallies rather than shipped, so the file stays small and
// the numbers cannot drift from the bubbles drawn beside them.
export function parseProbabilityWords(json) {
  const byId = new Map((json?.studies ?? []).map(s => [s.id, s]));

  const studies = STUDIES.map(spec => {
    const raw = byId.get(spec.id);
    if (!raw) throw new Error(`probability-words JSON: no study "${spec.id}"`);

    const rawConditions = new Map(raw.conditions.map(c => [c.id, c]));
    // Word order comes from the first condition; every condition must then match it, so a
    // row means the same word whichever button is pressed.
    const first = raw.conditions[0];
    if (!first) throw new Error(`probability-words JSON: study "${spec.id}" has no conditions`);
    const order = first.terms.map(t => t.id);

    const terms = order.map(id => {
      const known = spec.terms?.find(t => t.id === id);
      if (spec.terms && !known) {
        throw new Error(`probability-words JSON: study "${spec.id}" has unexpected word "${id}"`);
      }
      return known ?? {id, label: id.replace(/_/g, " "), lo: null, hi: null, rule: null, short: null};
    });
    if (spec.terms && spec.terms.length !== terms.length) {
      throw new Error(`probability-words JSON: study "${spec.id}" is missing words`);
    }

    let maxCount = 1;
    const conditions = spec.conditions.map(cspec => {
      const rawCondition = rawConditions.get(cspec.id);
      if (!rawCondition) {
        throw new Error(`probability-words JSON: study "${spec.id}" has no condition "${cspec.id}"`);
      }
      const rawTerms = new Map(rawCondition.terms.map(t => [t.id, t]));

      const rows = terms.map(term => {
        const entry = rawTerms.get(term.id);
        if (!entry) {
          throw new Error(`probability-words JSON: "${spec.id}/${cspec.id}" has no "${term.id}"`);
        }
        // Ascending by value for the quantiles; the layout re-sorts by count.
        const counts = entry.tally.map(([v, c]) => [Number(v), Number(c)]).sort((a, b) => a[0] - b[0]);
        let n = 0;
        let inBand = 0;
        let mode = null;
        let modeCount = 0;
        for (const [v, c] of counts) {
          n += c;
          if (c > maxCount) maxCount = c;
          if (c > modeCount) {
            modeCount = c;
            mode = v;
          }
          if (inside(v, term)) inBand += c;
        }
        return {
          term: term.id,
          counts,
          n,
          mode,
          modeCount,
          q1: quantile(counts, n, 0.25),
          median: quantile(counts, n, 0.5),
          q3: quantile(counts, n, 0.75),
          // Share of answers inside the official range for that word, where there is one:
          // each study's own measure of whether the communication worked.
          pctInRange: term.lo === null || !n ? null : (100 * inBand) / n,
        };
      });

      return {...cspec, respondents: rawCondition.respondents, rows};
    });

    return {...spec, terms, conditions, maxCount};
  });

  return {studies};
}

function inside(v, term) {
  if (term.lo === null) return false;
  const okLo = term.loOpen ? v > term.lo : v >= term.lo;
  const okHi = term.hiOpen ? v < term.hi : v <= term.hi;
  return okLo && okHi;
}

// Linear interpolation between order statistics — the same definition d3.quantile and R's
// default (type 7) use — read straight off the tally rather than an expanded array.
function quantile(counts, n, p) {
  if (!n) return null;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const a = valueAt(counts, lo);
  const b = valueAt(counts, Math.min(lo + 1, n - 1));
  return a + (h - lo) * (b - a);
}

function valueAt(counts, k) {
  let acc = 0;
  for (const [v, c] of counts) {
    acc += c;
    if (k < acc) return v;
  }
  return counts.length ? counts[counts.length - 1][0] : 0;
}

// Text width without a layout pass, so the left margin can be sized to the longest word in
// the selected study before anything is drawn. The container sets sans-serif, and the SVG
// text inherits it, so the canvas measures the same face the figure will use.
let measureCtx = null;
function textWidth(text, font) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export function createProbabilityWordsWidget({data, width = FIGURE_WIDTH} = {}) {
  const {studies} = data;

  // Snap instead of animating for a reader who has asked the system for reduced motion,
  // which is also what the thumbnail script forces, so every capture is the same frame.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const TRANS = reduceMotion ? "0s" : TRANSITION;

  let study = studies[0];
  let condition = study.conditions[0];
  let labelRow = null; // row whose word is being read out, set by its label
  let labelPinned = false; // clicking the word keeps its text up
  let picked = null; // {row, value} of the bubble being named, or null
  let pinned = false; // a picked bubble survives the pointer leaving, until dismissed

  // Vertical geometry, recomputed only when the study changes.
  let nRows, rowPitch, swarmHalf, figureHeight, rowBottom, tickY, sourceY;

  let w, marginL, marginR, plotL, plotR, axL, axR, unitR;
  let longSentence, shortAxisName, showKey, showInRange;
  let titleFont, termFont, readFont, subReadFont, tickFont, sourceFont, keyFont, pickFont;

  // The laid-out bubbles for the current width, by condition then row; also what the
  // pointer and the arrow keys hit-test against.
  let layouts = {};

  function applyStudyGeometry() {
    nRows = study.terms.length;
    // Roomy rows when there are few words, tighter when there are many; the figure's height
    // follows, which is why an embed has to allow for the tallest study.
    rowPitch = nRows <= 5 ? 72 : nRows <= 10 ? 46 : 24;
    swarmHalf = rowPitch * 0.43;
    rowBottom = ROW_TOP + rowPitch * nRows;
    figureHeight = rowBottom + BOTTOM_CHROME;
    tickY = rowBottom + TICK_OFFSET;
    sourceY = rowBottom + SOURCE_OFFSET;
  }

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;

    titleFont = lerp(14, 20);
    // Enough for four roomy rows, shrinking as rows are added, never below readable.
    termFont = clamp(rowPitch * 0.42, 8.5, lerp(11.5, 14.5));
    readFont = lerp(11, 13.5);
    subReadFont = lerp(8.5, 9.5);
    tickFont = lerp(9, 11);
    sourceFont = lerp(7, 8);
    keyFont = lerp(8.5, 10);
    pickFont = lerp(9.5, 11);

    // The left margin is measured, not guessed: "with moderate probability" and "very
    // likely" need very different amounts of room, and a constant would either clip the
    // long study or waste a third of the axis on the short one.
    const labelFont = `bold ${termFont}px sans-serif`;
    const widest = Math.max(...study.terms.map(term => textWidth(term.label, labelFont)));
    marginL = clamp(Math.ceil(widest) + 18, 76, Math.round(w * 0.45));
    // Only the studies with an official range have anything to put on the right, so the
    // everyday phrases get that space back as axis instead of an empty column.
    marginR = study.authority === null ? lerp(16, 26) : lerp(58, 78);
    plotL = marginL;
    plotR = w - marginR;

    // Stepwise, not continuous: text either fits or it does not, and switching at a
    // threshold beats letting it shrink until it is unreadable.
    showInRange = study.authority !== null;
    shortAxisName = w < 430;
    showKey = w >= 520;
    longSentence = w >= 480;
  }

  const bubbleR = count => unitR * Math.sqrt(count);
  const x = pct => axL + ((axR - axL) * pct) / 100;
  const rowY = i => ROW_TOP + rowPitch * (i + 0.5);

  // The plate runs under the whole widget, tabs included, so it reads as one card; the
  // SVG keeps painting its own background rect in the same color (below), so the two merge
  // seamlessly here and the SVG still stands on its own if it is ever pulled out.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  // --- controls: the studies as a strip of tabs across the top, and the selected study's
  // groups in a bar hanging off it, above the figure. The bar is tinted so it reads as a
  // tray belonging to the active tab: the groups are *within* the study, not a second
  // dimension beside it. The bar never disappears — a study with a single group says so in
  // words rather than showing one permanently pressed button or nothing at all. ---
  const uid = `probability-words-${++instances}`;

  const tabRow = document.createElement("div");
  tabRow.setAttribute("role", "tablist");
  tabRow.setAttribute("aria-label", "Survey");
  tabRow.style.cssText = "display:flex;flex-wrap:wrap;border-bottom:1px solid #c4c4c4;";
  container.appendChild(tabRow);

  // Everything under the strip belongs to the active tab.
  const panel = document.createElement("div");
  panel.setAttribute("role", "tabpanel");
  container.appendChild(panel);

  const groupBar = document.createElement("div");
  groupBar.setAttribute("role", "group");
  groupBar.setAttribute("aria-label", "Group within the survey");
  groupBar.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;" +
    "margin-bottom:8px;border-radius:0 0 6px 6px;box-sizing:border-box;" +
    "background:" + BAR_BACKGROUND + ";font-size:13px;line-height:1.35;color:#555;";
  panel.appendChild(groupBar);

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "probability-words"); // thumbnail script greps for this class
  svg.style.display = "block";
  svg.style.touchAction = "pan-y";
  scroller.appendChild(svg);
  panel.appendChild(scroller);

  // --- status area: the legend, or the hovered row's own detail, or the picked bubble's
  // exact count. Its height is reserved in buildAll so moving the pointer never reflows the
  // page below. ---
  const statusText = document.createElement("div");
  statusText.style.cssText = "padding:8px 0 0;font-size:13px;line-height:1.35;color:#555;";
  statusText.setAttribute("aria-live", "polite");
  panel.appendChild(statusText);

  const studyTabs = studies.map((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `${uid}-tab-${i}`;
    b.setAttribute("role", "tab");
    b.textContent = s.pill;
    // The underline sits over the strip's rule, hence the negative margin. The weight never
    // changes between states, so activating a tab cannot reflow the strip.
    b.style.cssText =
      "font:14px sans-serif;padding:8px 12px;cursor:pointer;background:none;" +
      "border:0;border-bottom:3px solid transparent;margin-bottom:-1px;" +
      "transition:color " + TRANS + ",border-color " + TRANS + ";";
    b.addEventListener("click", () => selectStudy(s));
    b.addEventListener("pointerenter", () => { if (study !== s) b.style.color = "#111"; });
    b.addEventListener("pointerleave", () => styleTab(b, study === s));
    // The strip is one tab stop; the arrow keys move between studies from there, as a
    // tablist is expected to work.
    b.addEventListener("keydown", e => {
      const n = studies.length;
      let next;
      if (e.key === "ArrowRight") next = (i + 1) % n;
      else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = n - 1;
      else return;
      e.preventDefault();
      selectStudy(studies[next]);
      studyTabs[next].focus();
    });
    tabRow.appendChild(b);
    return b;
  });

  function selectStudy(s) {
    if (study === s) return;
    study = s;
    // Keep the reader on the same presentation format where the new study also ran one,
    // so switching studies compares like with like rather than resetting to the default.
    condition = s.conditions.find(c => c.format === condition.format) ?? s.conditions[0];
    clearPick();
    // A row index from the old study means nothing in the new one.
    labelRow = null;
    labelPinned = false;
    applyStudyGeometry();
    buildAll(w);
    emit();
  }

  let conditionButtons = [];

  function buildGroupBar() {
    groupBar.replaceChildren();
    const total = study.conditions.reduce((n, c) => n + c.respondents, 0);
    const caption = document.createElement("span");
    groupBar.appendChild(caption);

    if (study.conditions.length > 1) {
      const ways = WAYS[study.conditions.length] ?? String(study.conditions.length);
      caption.textContent = `${num(total)} people, split ${ways} ways by what they saw:`;
      conditionButtons = study.conditions.map(c => {
        const b = pillButton(c.label, () => {
          if (condition === c) return;
          condition = c;
          clearPick();
          update();
        });
        groupBar.appendChild(b);
        return b;
      });
    } else {
      caption.textContent = `${num(total)} people, all shown ${study.conditions[0].blurb}.`;
      conditionButtons = [];
    }
  }

  // A shade smaller than the tabs, so the two levels read as levels.
  function pillButton(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText =
      "font:13px sans-serif;padding:5px 12px;border-radius:999px;cursor:pointer;" +
      "border:1px solid #ccc;background:#fff;color:#333;" +
      "transition:background-color " + TRANS + ",color " + TRANS + ",border-color " + TRANS + ";";
    b.addEventListener("click", onClick);
    return b;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // Elements rebuilt by buildAll and mutated by update.
  let bandRects = [], swarmGroups = {};
  let labelGroups = [], labelUnderlines = [], readMain = [], readSub = [], hitRects = [];
  let pickRing, pickLabel, pickLabelHalo;

  // --- the bubble swarm -----------------------------------------------------------------
  // Bubbles arrive biggest-first, so the piles that carry most of the people are the ones
  // that land on the centre line and the rare answers arrange themselves around them.
  // Dodging is the only tool: a bubble never overlaps another and never leaves its row's
  // band, so nothing is ever hidden behind anything else. Returns null instead if some
  // bubble has nowhere to go — that is the signal fitBubbles uses to shrink the scale. The
  // placement is deterministic, with no randomness and no relaxation, so a rebuild at the
  // same width always yields the same picture, which is what keeps the thumbnail stable.
  function tryLayout(counts, scale, xOf) {
    const placed = [];

    for (const [value, count] of counts) {
      const bx = xOf(value);
      const r = scale * Math.sqrt(count);
      const limit = swarmHalf - r;
      if (limit < -0.01) return null; // the bubble alone is taller than the row

      // Candidate offsets: the centre line, plus the two heights at which this bubble
      // would rest exactly touching each bubble it could otherwise overlap. One of those
      // is always the closest position to the centre that clears everything, so the
      // nearest candidate that is free and inside the band is the answer.
      const candidates = [0];
      for (const p of placed) {
        const dx = bx - p.x;
        const sum = r + p.r;
        if (Math.abs(dx) >= sum) continue;
        const dy = Math.sqrt(sum * sum - dx * dx);
        candidates.push(p.y + dy, p.y - dy);
      }
      candidates.sort((a, b) => Math.abs(a) - Math.abs(b));

      let y = null;
      for (const cand of candidates) {
        if (Math.abs(cand) > limit + 0.01) continue;
        if (isFree(placed, bx, cand, r)) {
          y = cand;
          break;
        }
      }
      if (y === null) return null;
      placed.push({value, count, x: bx, y, r});
    }
    return placed;
  }

  function isFree(placed, bx, by, r) {
    for (const p of placed) {
      const dx = bx - p.x;
      const dy = by - p.y;
      const sum = r + p.r;
      if (dx * dx + dy * dy < sum * sum - 1e-6) return false;
    }
    return true;
  }

  // Solves for the bubble scale: the largest one at which every row of every condition in
  // the selected study lays out with no overlaps and nothing outside its band. Shrinking
  // every radius by a common factor can only make the packing easier, so the property is
  // monotone in the scale and bisection finds the boundary.
  //
  // The scale is solved rather than chosen because it depends on the width, on the margins,
  // on how many words the study asked about and on how heaped its answers happen to be —
  // and because the alternative, a constant picked by eye, silently starts overlapping the
  // moment any of those change. It is solved per study, so a bubble means the same number
  // of people in every row and every condition of one study, and the key states the scale.
  //
  // Returns the winning layouts too, so the bisection's last success is what gets drawn.
  function fitBubbles() {
    // Bubbles are sorted biggest-first for the layout; the tallies come in ascending by
    // value, so this is where that order is imposed.
    const byCount = {};
    for (const cond of study.conditions) {
      byCount[cond.id] = cond.rows.map(row =>
        [...row.counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]));
    }

    const attempt = scale => {
      // 0% and 100% are popular answers and a bubble is centred on its value, so the scale
      // is inset by the largest bubble's radius at each end; that inset shrinks with the
      // bubbles, which is why the axis is solved for here as well.
      const padX = scale * Math.sqrt(study.maxCount);
      const aL = plotL + padX;
      const aR = plotR - padX;
      if (aR - aL < 40) return null;
      const xOf = pct => aL + ((aR - aL) * pct) / 100;

      const byCondition = {};
      for (const cond of study.conditions) {
        const rows = [];
        for (const counts of byCount[cond.id]) {
          const placed = tryLayout(counts, scale, xOf);
          if (!placed) return null;
          rows.push(placed);
        }
        byCondition[cond.id] = rows;
      }
      return {scale, axL: aL, axR: aR, byCondition};
    };

    // A bubble can never be taller than the band it sits in, which bounds the search.
    let hi = swarmHalf / Math.sqrt(study.maxCount);
    let lo = 0;
    let best = null;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const got = attempt(mid);
      if (got) {
        best = got;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    // Backed off a little from the boundary the bisection converged on, so two nearby
    // widths cannot land either side of it and rearrange the whole row for no visible
    // reason. Shrinking always still fits, so this cannot fail when `best` did not.
    if (best) return attempt(best.scale * 0.97) ?? best;
    // Degenerate fallback: a figure so narrow that even a hairline does not fit. Draw the
    // smallest bubbles rather than nothing at all.
    return attempt(0.15);
  }

  // Round counts for the size key: one, one about a tenth of the biggest pile, and the
  // biggest round number the study actually reaches.
  function keyCounts() {
    const max = study.maxCount;
    const top = [...NICE_COUNTS].reverse().find(v => v <= max) ?? 1;
    const mid = [...NICE_COUNTS].reverse().find(v => v <= Math.max(1, Math.round(max / 10))) ?? 1;
    return [...new Set([1, mid, top])].sort((a, b) => a - b);
  }

  // --- build ------------------------------------------------------------------------
  // Rebuilt on resize and on a change of study: both move every horizontal metric, and the
  // second moves the vertical ones too. The condition survives it, so this is also what a
  // first build runs.
  function buildAll(newW) {
    applyLayout(newW);

    // Solve the bubble scale and the axis inset for this study at this width before
    // anything is drawn: every mark's x position depends on them.
    const fit = fitBubbles();
    unitR = fit.scale;
    axL = fit.axL;
    axR = fit.axR;
    layouts = fit.byCondition;

    // Capped to the figure's own width rather than the page column's, so the tabs and pills
    // wrap onto more rows instead of spilling wider than the chart below them.
    tabRow.style.maxWidth = `${w}px`;
    groupBar.style.maxWidth = `${w}px`;
    statusText.style.maxWidth = `${w}px`;
    statusText.style.minHeight = `${(longSentence ? 3 : 5) * 1.35}em`;

    svg.setAttribute("width", w);
    svg.setAttribute("height", figureHeight);
    svg.replaceChildren();
    svg.appendChild(svgEl("rect", {width: w, height: figureHeight, fill: BACKGROUND}));

    const title1 = svgEl("text", {x: 10, y: 26, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title1.textContent = study.title[0];
    const title2 = svgEl("text", {x: 10, y: 48, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title2.textContent = study.title[1];
    svg.append(title1, title2);

    // Size key, in the empty strip to the right of the two-line title: area is hard to
    // judge unaided, so the figure states its own scale. Laid out right to left from the
    // figure's right edge, biggest bubble first, with each count under its own bubble.
    if (showKey) {
      const counts = keyCounts();
      const keyRMax = bubbleR(counts[counts.length - 1]);
      const keyLabelY = ROW_TOP - 8;
      const keyCY = keyLabelY - keyFont - keyRMax;
      let cursor = w - 10;
      for (const count of [...counts].reverse()) {
        const r = bubbleR(count);
        // A study with a huge biggest pile has tiny bubbles for everything else, so the
        // slot each entry takes is set by whichever is wider, its bubble or its number.
        // Spacing on the bubble alone runs the labels into each other.
        const slot = Math.max(2 * r, textWidth(String(count), `${keyFont}px sans-serif`));
        cursor -= slot / 2;
        svg.appendChild(bubbleCircle(cursor, keyCY, r, KEY_COLOR));
        const label = svgEl("text", {
          x: cursor, y: keyLabelY, "text-anchor": "middle", "font-size": keyFont, fill: "#777",
        });
        label.textContent = String(count);
        svg.appendChild(label);
        cursor -= slot / 2 + 9;
      }
      const caption = svgEl("text", {
        x: cursor - 2, y: keyCY + keyFont * 0.35, "text-anchor": "end",
        "font-size": keyFont, fill: "#777",
      });
      caption.textContent = "people giving the same answer:";
      svg.appendChild(caption);
    }

    // Vertical gridlines behind everything, with their labels under the last row. The axis
    // is named in the empty strip to the left of the ticks, under the row labels, rather
    // than by stretching the last tick's label back over its neighbour.
    for (let v = 0; v <= 100; v += 25) {
      const px = x(v);
      svg.appendChild(svgEl("line", {
        x1: px, x2: px, y1: ROW_TOP - 4, y2: rowBottom + 4, stroke: "#c4c4c4", "stroke-width": 1,
      }));
      const t = svgEl("text", {
        x: px, y: tickY, "text-anchor": v === 0 ? "start" : v === 100 ? "end" : "middle",
        "font-size": tickFont, fill: "#808080",
      });
      t.textContent = v === 100 ? "100%" : `${v}`;
      svg.appendChild(t);
    }
    const axisName = svgEl("text", {
      x: 10, y: tickY, "text-anchor": "start", "font-size": tickFont, fill: "#808080",
    });
    axisName.textContent = shortAxisName ? "probability:" : "probability meant:";
    svg.appendChild(axisName);

    bandRects = study.terms.map((term, i) => {
      // Only the studies with a published scale have a band; the everyday phrases have
      // nothing to be right or wrong about, so their rows carry no shading at all.
      const band = svgEl("rect", {
        x: term.lo === null ? 0 : x(term.lo),
        y: rowY(i) - swarmHalf,
        width: term.lo === null ? 0 : Math.max(0, x(term.hi) - x(term.lo)),
        height: swarmHalf * 2,
        fill: BAND_COLOR, opacity: term.lo === null ? 0 : 0.18,
      });
      svg.appendChild(band);
      return band;
    });

    // A faint rule down the middle of each row, so an empty stretch of the scale still
    // reads as part of that word's row rather than as blank plate.
    study.terms.forEach((_, i) => {
      svg.appendChild(svgEl("rect", {
        x: axL, y: rowY(i) - 0.5, width: axR - axL, height: 1, fill: "#c9c9c9",
      }));
    });

    // One group per condition, all built up front so switching cross-fades rather than
    // blanking: they hold different people, so nothing should appear to move between them.
    swarmGroups = {};
    for (const cond of study.conditions) {
      const g = svgEl("g", {opacity: 0});
      g.style.transition = `opacity ${TRANS}`;
      study.terms.forEach((_, i) => {
        const cy = rowY(i);
        for (const p of layouts[cond.id][i]) {
          g.appendChild(bubbleCircle(p.x, cy + p.y, p.r, bubbleFill(study.terms[i], p.value)));
        }
      });
      svg.appendChild(g);
      swarmGroups[cond.id] = g;
    }

    // The highlight on a named bubble: a ring around it and its exact count above it. One
    // pair of elements, moved rather than recreated, so there is nothing to clean up.
    pickRing = svgEl("circle", {
      r: 0, fill: "none", stroke: PICK_COLOR, "stroke-width": 2, opacity: 0,
    });
    svg.appendChild(pickRing);
    // Drawn twice: once as a fat background-coloured stroke, once in ink. That is what
    // keeps the number legible where it lands on top of the bubbles.
    pickLabelHalo = svgEl("text", {
      "text-anchor": "middle", "font-size": pickFont, "font-weight": "bold",
      fill: "none", stroke: BACKGROUND, "stroke-width": 3.5, "stroke-linejoin": "round", opacity: 0,
    });
    pickLabel = svgEl("text", {
      "text-anchor": "middle", "font-size": pickFont, "font-weight": "bold",
      fill: "#111", opacity: 0,
    });
    svg.append(pickLabelHalo, pickLabel);

    // Row labels, left of the plot: the word itself, which is the whole point of the
    // figure, so it is set at reading size rather than as a tick label. The word is also
    // the control for its own row — pointing at it, or focusing it, writes that row's
    // sentences and figures into the status line, and clicking keeps them there. A
    // transparent rect behind the glyphs does the catching, because text on its own is
    // only hoverable where the ink is.
    labelGroups = [];
    labelUnderlines = study.terms.map((term, i) => {
      const cy = rowY(i);
      const width = textWidth(term.label, `bold ${termFont}px sans-serif`);
      const right = marginL - 10;

      const g = svgEl("g", {});
      g.setAttribute("tabindex", "0");
      g.style.cursor = "pointer";
      g.style.outline = "none";

      g.appendChild(svgEl("rect", {
        x: right - width - 6, y: cy - rowPitch / 2, width: width + 12, height: rowPitch,
        fill: "transparent",
      }));

      const label = svgEl("text", {
        x: right, y: cy + termFont * 0.35, "text-anchor": "end",
        "font-size": termFont, "font-weight": "bold", fill: "#111",
      });
      label.textContent = term.label;
      g.appendChild(label);

      // Shown while the word is being read out, so it is clear which row the text belongs
      // to and that the word is worth pointing at in the first place.
      const underline = svgEl("rect", {
        x: right - width, y: cy + termFont * 0.35 + 3, width, height: 1.5,
        fill: "#111", opacity: 0,
      });
      g.appendChild(underline);

      g.addEventListener("pointerenter", () => {
        if (labelPinned) return;
        labelRow = i;
        update();
      });
      g.addEventListener("pointerleave", () => {
        if (labelPinned || document.activeElement === g) return;
        if (labelRow === i) labelRow = null;
        update();
      });
      g.addEventListener("click", () => {
        const again = labelPinned && labelRow === i;
        labelRow = again ? null : i;
        labelPinned = !again;
        update();
      });
      g.addEventListener("focus", () => { labelRow = i; update(); });
      g.addEventListener("blur", () => {
        if (labelPinned || labelRow !== i) return;
        labelRow = null;
        update();
      });
      // The word is the row's single tab stop, so the arrow keys have to reach the bubbles
      // from here rather than from a second focusable strip over the plot.
      g.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          g.dispatchEvent(new MouseEvent("click"));
          return;
        }
        stepWithKey(e, i);
      });

      svg.appendChild(g);
      labelGroups.push(g);
      return underline;
    });

    // Readouts, right of the plot.
    readMain = [];
    readSub = [];
    study.terms.forEach((_, i) => {
      const cy = rowY(i);
      // The share of the row that met the official range, which is the whole point of the
      // colouring, set big with its qualifier under it rather than as one long line.
      const main = svgEl("text", {
        x: w - 10, y: cy - 1, "text-anchor": "end",
        "font-size": readFont, fill: "#333",
      });
      const sub = svgEl("text", {
        x: w - 10, y: cy + 12, "text-anchor": "end", "font-size": subReadFont, fill: "#777",
      });
      svg.append(main, sub);
      readMain.push(main);
      readSub.push(sub);
    });

    // Transparent strips over the plot, carrying the row's accessible description. The
    // pointer is handled on the SVG itself, and the keyboard through the word on the left,
    // so these take no focus of their own.
    hitRects = study.terms.map((_, i) => {
      const r = svgEl("rect", {
        x: plotL - 4, y: rowY(i) - rowPitch / 2, width: plotR - plotL + 8, height: rowPitch,
        fill: "transparent",
      });
      svg.appendChild(r);
      return r;
    });

    // Below about 470px the full citation with its link would overrun the figure's left
    // edge (it is fixed, right-anchored text at a small font, sized for the 600px figure);
    // a shorter form there avoids that rather than letting it clip.
    const sourceLink = svgEl("a", {target: "_blank", rel: "noopener", tabindex: "0"});
    sourceLink.setAttribute("href", study.url);
    sourceLink.style.cursor = "pointer";
    const sourceTitle = svgEl("title", {});
    sourceTitle.textContent = `Open ${study.url} in a new tab`;
    sourceLink.appendChild(sourceTitle);

    const source = svgEl("text", {
      x: w - 10, y: sourceY, "text-anchor": "end", "font-size": sourceFont, fill: "#808080",
    });
    const italic = document.createElementNS(SVGNS, "tspan");
    italic.setAttribute("font-style", "italic");
    italic.textContent = study.cite;
    if (w >= 470) {
      const prefix = document.createElementNS(SVGNS, "tspan");
      prefix.textContent = "Data source: ";
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.textContent = ` ${study.journal}, ${study.year} `;
      // Only the address is inked as a link, so the citation still reads as a citation
      // while the clickable part looks clickable.
      const href = document.createElementNS(SVGNS, "tspan");
      href.setAttribute("fill", "#0b57d0");
      href.setAttribute("text-decoration", "underline");
      href.textContent = `(${study.url})`;
      source.append(prefix, italic, rest, href);
    } else {
      const comma = document.createElementNS(SVGNS, "tspan");
      comma.textContent = ", ";
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.setAttribute("fill", "#0b57d0");
      rest.setAttribute("text-decoration", "underline");
      rest.textContent = `${study.journal} (${study.year})`;
      source.append(italic, comma, rest);
    }
    sourceLink.appendChild(source);
    svg.appendChild(sourceLink);

    buildGroupBar();
    update({emit: false});
  }

  function bubbleCircle(cx, cy, r, fill) {
    // The hairline separating touching bubbles has to shrink with them, or it eats the
    // smallest ones entirely.
    return svgEl("circle", {
      cx, cy, r, fill, "fill-opacity": 0.78,
      stroke: BACKGROUND, "stroke-width": Math.min(0.6, r * 0.35),
    });
  }

  // Green inside the range the publishing body assigns to the word, vermillion outside it,
  // plain blue where the phrase has no official range to be judged against.
  function bubbleFill(term, value) {
    if (term.lo === null) return NEUTRAL_COLOR;
    return inside(value, term) ? IN_COLOR : OUT_COLOR;
  }

  // --- update: everything that depends on the selection, never on layout ----------------
  function update({emit: shouldEmit = true} = {}) {
    studyTabs.forEach((b, i) => styleTab(b, studies[i] === study));
    panel.setAttribute("aria-labelledby", studyTabs[studies.indexOf(study)].id);
    conditionButtons.forEach((b, i) => stylePill(b, study.conditions[i] === condition));

    for (const g of Object.values(swarmGroups)) g.style.opacity = 0;
    if (swarmGroups[condition.id]) swarmGroups[condition.id].style.opacity = 1;

    study.terms.forEach((term, i) => {
      const s = condition.rows[i];
      labelUnderlines[i].setAttribute("opacity", labelRow === i ? 1 : 0);

      const hasRange = showInRange && s.n && s.pctInRange !== null;
      readMain[i].textContent = hasRange ? `${s.pctInRange.toFixed(0)}%` : "";
      readSub[i].textContent = hasRange ? "in range" : "";

      labelGroups[i].setAttribute("aria-label", rowSpeech(i, term, s));
    });

    renderPick();
    renderStatus();
    svg.setAttribute("aria-label", summaryText());

    container.value = value();
    if (shouldEmit) emit();
  }

  // The active tab is the one tab stop in the strip; the others are reached by arrow key.
  function styleTab(b, active) {
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
    b.style.color = active ? "#111" : "#666";
    b.style.borderBottomColor = active ? "#333" : "transparent";
  }

  function stylePill(b, active) {
    b.setAttribute("aria-pressed", String(active));
    b.style.border = active ? "1px solid #333" : "1px solid #ccc";
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
  }

  // The group that read the range inside the sentence saw it there, so that is what this
  // shows while their answers are on screen — the reader sees what the respondents saw.
  function termAsShown(term) {
    const inline = condition.format === "inline";
    return term.label + (inline && term.rule ? ` (${term.rule})` : "");
  }

  // --- the picked bubble ----------------------------------------------------------------
  function bubbleAt(row, value) {
    return layouts[condition.id]?.[row]?.find(b => b.value === value) ?? null;
  }

  function clearPick() {
    picked = null;
    pinned = false;
  }

  // Hit-test within one row. Tiny bubbles are given a larger catch radius so they can be
  // hovered at all; where those overlap, the closest edge wins.
  function hitTest(row, px, py) {
    const bubbles = layouts[condition.id]?.[row];
    if (!bubbles) return null;
    const cy = rowY(row);
    let best = null;
    let bestScore = Infinity;
    for (const b of bubbles) {
      const reach = Math.max(b.r, MIN_PICK_R);
      const dx = px - b.x;
      const dy = py - (cy + b.y);
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;
      const score = dist - b.r; // nearest edge, so a big bubble is not stolen by a speck
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  function renderPick() {
    const b = picked ? bubbleAt(picked.row, picked.value) : null;
    if (!b) {
      for (const el of [pickRing, pickLabel, pickLabelHalo]) el.setAttribute("opacity", 0);
      return;
    }
    const cy = rowY(picked.row) + b.y;
    const ringR = Math.max(b.r, MIN_PICK_R * 0.7) + 2.5;
    pickRing.setAttribute("cx", b.x);
    pickRing.setAttribute("cy", cy);
    pickRing.setAttribute("r", ringR);
    pickRing.setAttribute("opacity", 1);

    // Above the bubble by default; below it when that would run into the row above.
    const above = cy - ringR - 4 - pickFont * 0.3;
    const below = cy + ringR + 4 + pickFont * 0.9;
    const top = rowY(picked.row) - swarmHalf;
    const labelY = above - pickFont * 0.7 >= top ? above : below;
    const text = `${b.value}% · ${b.count}`;
    const half = textWidth(text, `bold ${pickFont}px sans-serif`) / 2;
    const labelX = clamp(b.x, 10 + half, w - 10 - half);
    for (const el of [pickLabelHalo, pickLabel]) {
      el.setAttribute("x", labelX);
      el.setAttribute("y", labelY);
      el.setAttribute("opacity", 1);
      el.textContent = text;
    }
  }

  function renderStatus() {
    statusText.replaceChildren();

    // A named bubble is the most specific thing on screen, so it wins the line.
    if (picked) {
      const b = bubbleAt(picked.row, picked.value);
      const term = study.terms[picked.row];
      const s = condition.rows[picked.row];
      if (b) {
        const strong = document.createElement("strong");
        strong.style.color = "#111";
        strong.textContent = `${b.count} of the ${s.n} answers`;
        statusText.append(
          strong,
          document.createTextNode(
            ` for “${term.label}” put it at exactly ${b.value}%` +
            `, that is ${((100 * b.count) / s.n).toFixed(1)}% of them` +
            (term.lo === null
              ? "."
              : inside(b.value, term)
                ? `, inside ${study.authority}'s ${term.rule}.`
                : `, outside ${study.authority}'s ${term.rule}.`) +
            (pinned ? " Click anywhere else, or press Escape, to release it." : ""),
          ),
        );
        return;
      }
    }

    if (labelRow !== null) {
      const term = study.terms[labelRow];
      const s = condition.rows[labelRow];
      const sentences = study.sentences?.[term.id];

      if (sentences) {
        // Both sentences that used this word, so it is clear what the row pools.
        sentences.forEach((sentence, k) => {
          if (k > 0) statusText.appendChild(document.createTextNode(" "));
          statusText.appendChild(document.createTextNode(longSentence ? sentence.pre : sentence.briefPre));
          const strong = document.createElement("strong");
          strong.style.color = "#111";
          strong.textContent = termAsShown(term);
          statusText.appendChild(strong);
          statusText.appendChild(document.createTextNode(longSentence ? sentence.post : sentence.briefPost));
        });
      } else {
        const strong = document.createElement("strong");
        strong.style.color = "#111";
        strong.textContent = termAsShown(term);
        statusText.append(strong, document.createTextNode(`, judged ${study.setting}.`));
      }

      const facts = document.createElement("span");
      facts.style.color = "#111";
      const bits = [];
      if (term.short) bits.push(`${study.authority}: ${term.short}`);
      if (s.n) {
        bits.push(`median ${fmt(s.median)}%`);
        bits.push(`commonest answer ${s.mode}% (${s.modeCount} of ${s.n})`);
        if (s.pctInRange !== null) bits.push(`${s.pctInRange.toFixed(0)}% in range`);
      }
      facts.textContent = bits.length ? " " + bits.join(" · ") + "." : "";
      statusText.appendChild(facts);
      return;
    }

    const band = study.authority
      ? ` The shaded band is the range ${study.authority} assigns to that word,` +
        " and a bubble is green when the answer lands inside it, orange when it misses."
      : " There is no official range for these phrases, so no band is shaded and the" +
        " bubbles carry no verdict.";
    statusText.textContent =
      "Every bubble gathers the people who gave the same answer, and its area is how many " +
      `they were: the ${condition.respondents} in this group saw ${condition.blurb}.` + band +
      " Point at a bubble for its exact count, or at a word on the left for its sentences" +
      " and figures; click either to keep it up. Tab reaches the words, and the arrow keys" +
      " step along a row from there.";
  }

  function rowSpeech(i, term, s) {
    const rule = term.rule ? ` ${study.authority} means ${term.rule}.` : "";
    const met = s.pctInRange === null ? "" : ` ${s.pctInRange.toFixed(0)} percent meet it.`;
    const sel = picked && picked.row === i ? (() => {
      const b = bubbleAt(i, picked.value);
      return b ? ` Selected: ${b.count} answers at ${b.value} percent.` : "";
    })() : "";
    return `${term.label}, judged ${study.setting}.${rule} ` +
      `${s.n} answers, median ${fmt(s.median)} percent, commonest ${s.mode} percent.${met}${sel}` +
      " Click to keep this text up. Use the left and right arrow keys to step through the answers.";
  }

  function summaryText() {
    const parts = study.terms.map((term, i) => {
      const s = condition.rows[i];
      const rule = term.rule ? `, which ${study.authority} uses to mean ${term.rule}` : "";
      const met = s.pctInRange === null ? "" : `, and ${s.pctInRange.toFixed(0)}% of answers meet it`;
      return `${term.label}${rule}: median answer ${fmt(s.median)}%, commonest answer ` +
        `${s.mode}% given by ${s.modeCount} of ${s.n}${met}`;
    }).join("; ");
    return `${study.title.join(" ")}. ${condition.label} group (${condition.respondents} people), ` +
      `who saw ${condition.blurb}: ${parts}.`;
  }

  // --- pointer and keyboard --------------------------------------------------------------
  function pointerAt(e) {
    const r = svg.getBoundingClientRect();
    return {
      px: (e.clientX - r.left) * (w / r.width),
      py: (e.clientY - r.top) * (figureHeight / r.height),
    };
  }

  function rowAt(py) {
    if (py < ROW_TOP || py > rowBottom) return null;
    const i = Math.floor((py - ROW_TOP) / rowPitch);
    return i >= 0 && i < study.terms.length ? i : null;
  }

  svg.addEventListener("pointermove", e => {
    if (pinned) return;
    const {px, py} = pointerAt(e);
    const row = rowAt(py);
    const hit = row === null ? null : hitTest(row, px, py);
    const same = (picked?.row === row && picked?.value === hit?.value) || (!picked && !hit);
    svg.style.cursor = hit ? "pointer" : "default";
    if (same) return;
    picked = hit ? {row, value: hit.value} : null;
    update();
  });

  svg.addEventListener("pointerleave", () => {
    if (pinned) return;
    picked = null;
    update();
  });

  // Tapping is the only way to inspect a bubble without a hover, so a click pins the
  // highlight; clicking off a bubble, or pressing Escape, lets it go.
  svg.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    const row = rowAt(py);
    const hit = row === null ? null : hitTest(row, px, py);
    if (hit) {
      const again = pinned && picked?.row === row && picked?.value === hit.value;
      picked = again ? null : {row, value: hit.value};
      pinned = !again;
      update();
      e.preventDefault();
    } else if (picked || pinned) {
      // Clicking bare plate lets a pinned bubble go, but a click on the word's own strip
      // has to reach the label's handler, so nothing is prevented here.
      clearPick();
      update();
    }
  });

  function stepWithKey(e, row) {
    const bubbles = layouts[condition.id]?.[row];
    if (!bubbles?.length) return;
    if (e.key === "Escape") {
      clearPick();
      update();
      return;
    }
    // Stepping follows the scale, not the drawing order, so the arrow keys walk left to
    // right along the axis the way the eye does.
    const byValue = [...bubbles].sort((a, b) => a.value - b.value);
    const at = picked && picked.row === row
      ? byValue.findIndex(b => b.value === picked.value)
      : -1;
    let next = at;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = at < 0 ? byValue.length - 1 : at - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = at < 0 ? 0 : at + 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = byValue.length - 1;
    else return;
    e.preventDefault();
    next = clamp(next, 0, byValue.length - 1);
    picked = {row, value: byValue[next].value};
    pinned = false;
    update();
  }

  container.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!picked && labelRow === null) return;
    clearPick();
    labelRow = null;
    labelPinned = false;
    update();
  });

  function value() {
    const b = picked ? bubbleAt(picked.row, picked.value) : null;
    return {
      study: study.id,
      condition: condition.id,
      selected: b ? {term: study.terms[picked.row].id, value: b.value, count: b.count} : null,
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  applyStudyGeometry();
  buildAll(Math.max(MIN_WIDTH, Math.round(width)));
  container.value = value();

  // Reflow with the container. Rebuilding relays every bubble, so the work is coalesced
  // into one animation frame rather than run once per resize notification. Resizing never
  // emits "input": the study, the condition and the picked bubble are data-space state,
  // unchanged by re-layout.
  if (typeof ResizeObserver === "function") {
    const maxW = Math.max(MIN_WIDTH, Math.round(width));
    let pending = 0;
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted === w || fitted === pending) return;
      pending = fitted;
      requestAnimationFrame(() => {
        pending = 0;
        if (fitted !== w) buildAll(fitted);
      });
    });
    ro.observe(container);
  }

  return container;
}

function fmt(v) {
  return v === null ? "" : Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function num(n) {
  return n.toLocaleString("en-US");
}

// Counts of groups, spelt out in the bar's caption.
const WAYS = {2: "two", 3: "three", 4: "four", 5: "five"};

// Numbered per widget on the page, so the tab and panel ids that tie them together for
// assistive technology stay unique when the widget is embedded more than once.
let instances = 0;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
