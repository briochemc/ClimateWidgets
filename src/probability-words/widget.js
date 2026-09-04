// What people think a probability word means. Three surveys played the same game — show
// someone a word for chance, ask them to put a number on it — and disagreed with the
// institutions that publish those words for a living.
//
//   Budescu, Por & Broomell (2012)  556 US adults, eight sentences from the IPCC's Fourth
//                                   Assessment Report, three presentation formats.
//   Wintle et al. (2019)            924 people, eight intelligence-analysis statements,
//                                   four formats, the US intelligence community's ICD 203
//                                   lexicon — the same four words, a different rulebook.
//   Mauboussin & Mauboussin (2018)  1,976 people, 23 everyday phrases judged bare, with no
//                                   context and no official scale to be right about.
//
// The figure runs horizontally, one row per word: the 0-100% scale across the x axis, the
// official range for that word shaded on the row where one exists, the answers themselves
// as bubbles, and a box for the middle half.
//
// The answers are heaped on round numbers rather than spread out, so one dot per person
// would be mostly overplotting. Every distinct value gets one bubble instead, with its area
// proportional to how many people gave it, dodged vertically the way a beeswarm dodges dots
// (tryLayout, below). The heaping is the finding, so the chart is built to show it. Nothing
// is allowed to overlap or to leave its row: fitBubbles solves for the largest bubble scale
// at which the whole figure still packs, rather than trusting a constant picked by eye.
//
// The reader places their own estimate on each row first and only then reveals the data,
// which makes the widget run the first study's control condition on them before showing how
// everyone else answered. Their answers persist across studies wherever the word does, so
// the same ring can be compared against the IPCC's readers and the intelligence world's.
//
// Studies differ in how many words they asked about — four against twenty-three — so the
// row pitch, and with it the figure's height, is a function of the selected study. Width
// still reflows between MIN_WIDTH and FIGURE_WIDTH the way every other widget here does.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.
//
// Data: src/probability-words/data/probability-words.json, one tally per study, condition
// and word, written by scripts/probability-words.jl from the three sources above. Every
// answer is kept, including the 0s and 100s Budescu et al. recoded away — see "About the
// data" on the widget's page.

const SVGNS = "http://www.w3.org/2000/svg";

const BACKGROUND = "#f2f2f2";
const FIGURE_WIDTH = 600;
const MIN_WIDTH = 320;
const TRANSITION = "480ms ease";

// Vertical layout: constant for a given study, so switching condition never moves anything
// and an embed only has to allow for the tallest study once.
const ROW_TOP = 66;
const BOTTOM_CHROME = 66; // axis ticks and the source line, below the last row
const TICK_OFFSET = 20;
const SOURCE_OFFSET = 52;

// Okabe-Ito: the official range, the respondents, the reader's own answer.
const BAND_COLOR = "#009E73";
const DOT_COLOR = "#0072B2";
const GUESS_COLOR = "#D55E00";

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
    conditions: [
      {id: "control", label: "Words only", blurb: "the word on its own"},
      {id: "translation", label: "IPCC table shown", blurb: "the IPCC's translation table beside it"},
      {id: "vn", label: "Numbers in the sentence", blurb: "the range printed in the sentence"},
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
      {id: "control", label: "Words only", blurb: "the word on its own"},
      {id: "table", label: "Table on a click", blurb: "a table of ranges one click away"},
      {id: "tool", label: "Tooltip on hover", blurb: "the range on hovering the word"},
      {id: "brackets", label: "Numbers in the sentence", blurb: "the range printed in the sentence"},
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
    conditions: [{id: "all", label: "Everyone", blurb: "the phrase on its own"}],
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
      const spec_ = spec.terms?.find(t => t.id === id);
      if (spec.terms && !spec_) {
        throw new Error(`probability-words JSON: study "${spec.id}" has unexpected word "${id}"`);
      }
      return spec_ ?? {id, label: id.replace(/_/g, " "), lo: null, hi: null, rule: null, short: null};
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

export function createProbabilityWordsWidget({data, width = FIGURE_WIDTH, revealed} = {}) {
  const {studies} = data;

  // Snap instead of animating for a reader who has asked the system for reduced motion —
  // and, because the thumbnail script forces that setting, open on the revealed frame so
  // every capture shows the figure rather than the empty guessing grid.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const TRANS = reduceMotion ? "0s" : TRANSITION;

  let study = studies[0];
  let condition = study.conditions[0];
  let isRevealed = revealed ?? reduceMotion;
  const guesses = new Map(); // word id -> percent, so an answer follows its word across studies
  let hovered = null; // row index whose detail the status line is showing
  let dragging = null;

  // Vertical geometry, recomputed only when the study changes.
  let nRows, rowPitch, swarmHalf, boxH, figureHeight, rowBottom, tickY, sourceY;

  let w, marginL, marginR, plotL, plotR, axL, axR, unitR;
  let longSentence, shortAxisName, showKey, showInRange;
  let titleFont, termFont, readFont, subReadFont, tickFont, sourceFont, keyFont;
  let ringR;

  function applyStudyGeometry() {
    nRows = study.terms.length;
    // Roomy rows when there are few words, tighter when there are many; the figure's height
    // follows, which is why an embed has to allow for the tallest study.
    rowPitch = nRows <= 5 ? 72 : nRows <= 10 ? 46 : 24;
    swarmHalf = rowPitch * 0.43;
    boxH = Math.max(8, rowPitch * 0.36);
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
    ringR = clamp(swarmHalf * 0.3, 4, lerp(7, 9));

    // The left margin is measured, not guessed: "with moderate probability" and "very
    // likely" need very different amounts of room, and a constant would either clip the
    // long study or waste a third of the axis on the short one.
    const labelFont = `bold ${termFont}px sans-serif`;
    const widest = Math.max(...study.terms.map(term => textWidth(term.label, labelFont)));
    marginL = clamp(Math.ceil(widest) + 18, 76, Math.round(w * 0.45));
    marginR = lerp(46, 96);
    plotL = marginL;
    plotR = w - marginR;

    // Stepwise, not continuous: text either fits or it does not, and switching at a
    // threshold beats letting it shrink until it is unreadable.
    showInRange = w >= 450 && study.authority !== null;
    shortAxisName = w < 430;
    showKey = w >= 520;
    longSentence = w >= 480;
  }

  const bubbleR = count => unitR * Math.sqrt(count);
  const x = pct => axL + ((axR - axL) * pct) / 100;
  const rowY = i => ROW_TOP + rowPitch * (i + 0.5);

  // The plate runs under the whole widget, buttons included, so it reads as one card; the
  // SVG keeps painting its own background rect in the same color (below), so the two merge
  // seamlessly here and the SVG still stands on its own if it is ever pulled out.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "probability-words"); // thumbnail script greps for this class
  svg.style.display = "block";
  svg.style.touchAction = "pan-y";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // --- status area: the prompt before the data is shown, the legend after it, and the
  // hovered or focused row's own detail in place of either. Its height is reserved in
  // buildAll so hovering never reflows the page below, and the Reveal control sits on its
  // own line so it does not shift as the text changes length. ---
  const statusText = document.createElement("div");
  statusText.style.cssText = "padding:8px 0 0;font-size:13px;line-height:1.35;color:#555;";
  container.appendChild(statusText);

  const statusControls = document.createElement("div");
  statusControls.style.cssText = "display:flex;align-items:center;gap:4px;height:34px;";
  container.appendChild(statusControls);

  const revealButton = pillButton("Reveal the answers", () => {
    isRevealed = true;
    update();
  });
  const skipLink = textLink("Skip", () => {
    isRevealed = true;
    update();
  });
  const againLink = textLink("Guess again", () => {
    guesses.clear();
    isRevealed = false;
    update();
  });
  statusControls.append(revealButton, skipLink, againLink);

  // --- study buttons, then the selected study's condition buttons. Both are hidden rather
  // than removed before the reveal, so the plate does not change height when the data
  // appears. ---
  const studyRow = document.createElement("div");
  studyRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;";
  container.appendChild(studyRow);

  const conditionRow = document.createElement("div");
  conditionRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;";
  container.appendChild(conditionRow);

  const studyButtons = studies.map(s => {
    const b = pillButton(s.pill, () => {
      if (study === s) return;
      study = s;
      // Keep the reader on the same presentation format where the new study also ran one,
      // so switching studies compares like with like rather than resetting to the default.
      condition = s.conditions.find(c => c.id === condition.id) ?? s.conditions[0];
      applyStudyGeometry();
      buildAll(w);
      emit();
    });
    studyRow.appendChild(b);
    return b;
  });

  let conditionButtons = [];

  function buildConditionButtons() {
    conditionRow.replaceChildren();
    conditionButtons = study.conditions.map(c => {
      const b = pillButton(`${c.label} (${c.respondents})`, () => {
        if (condition === c) return;
        condition = c;
        update();
      });
      conditionRow.appendChild(b);
      return b;
    });
    // A study with a single group has nothing to switch between, so the row collapses
    // rather than showing one permanently pressed button.
    conditionRow.style.display = study.conditions.length > 1 ? "flex" : "none";
  }

  function pillButton(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText =
      "font:14px sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;" +
      "border:1px solid #ccc;background:#fff;color:#333;" +
      "transition:background-color " + TRANS + ",color " + TRANS + ",border-color " + TRANS + ";";
    b.addEventListener("click", onClick);
    return b;
  }

  function textLink(text, onClick) {
    const a = document.createElement("button");
    a.type = "button";
    a.textContent = text;
    a.style.cssText =
      "font:13px sans-serif;padding:0 4px;margin-left:6px;border:0;background:none;" +
      "color:#0b57d0;text-decoration:underline;cursor:pointer;";
    a.addEventListener("click", onClick);
    return a;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // Elements rebuilt by buildAll and mutated by update.
  let bandRects = [], trackRects = [], swarmGroups = {}, boxParts = [];
  let guessGroups = [], focusRects = [], readMain = [], readSub = [], hitRects = [];

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
  // second moves the vertical ones too. The condition and the reader's answers survive it,
  // so this is also what a first build runs.
  function buildAll(newW) {
    applyLayout(newW);

    // Solve the bubble scale and the axis inset for this study at this width before
    // anything is drawn: every mark's x position depends on them.
    const fit = fitBubbles();
    unitR = fit.scale;
    axL = fit.axL;
    axR = fit.axR;

    // Capped to the figure's own width rather than the page column's, so the pills stack
    // onto more rows instead of spilling wider than the chart above them.
    studyRow.style.maxWidth = `${w}px`;
    conditionRow.style.maxWidth = `${w}px`;
    statusText.style.maxWidth = `${w}px`;
    statusText.style.minHeight = `${(longSentence ? 3 : 5) * 1.35}em`;

    svg.setAttribute("width", w);
    svg.setAttribute("height", figureHeight);
    svg.replaceChildren();
    svg.appendChild(svgEl("rect", {width: w, height: figureHeight, fill: BACKGROUND}));

    const title = study.title;
    const title1 = svgEl("text", {x: 10, y: 26, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title1.textContent = title[0];
    const title2 = svgEl("text", {x: 10, y: 48, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title2.textContent = title[1];
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
        svg.appendChild(svgEl("circle", {
          cx: cursor, cy: keyCY, r, fill: DOT_COLOR, "fill-opacity": 0.75,
          stroke: BACKGROUND, "stroke-width": 0.6,
        }));
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

    bandRects = [];
    trackRects = [];
    study.terms.forEach((term, i) => {
      // Only the two studies with a published scale have a band; the everyday phrases have
      // nothing to be right or wrong about, so their rows carry no shading at all.
      const band = svgEl("rect", {
        x: term.lo === null ? 0 : x(term.lo),
        y: rowY(i) - swarmHalf,
        width: term.lo === null ? 0 : Math.max(0, x(term.hi) - x(term.lo)),
        height: swarmHalf * 2,
        fill: BAND_COLOR, opacity: 0,
      });
      band.style.transition = `opacity ${TRANS}`;
      svg.appendChild(band);
      bandRects.push(band);

      // The bar the reader drags along. Before the reveal it is the only thing on the row,
      // so it is drawn thick enough to read as a control rather than as another gridline;
      // afterwards it thins out to a rule the ring can sit on.
      const track = svgEl("rect", {
        x: axL, y: rowY(i) - 2, width: axR - axL, height: 4, rx: 2, fill: "#c9c9c9",
      });
      track.style.transition = `opacity ${TRANS}, fill ${TRANS}`;
      svg.appendChild(track);
      trackRects.push(track);
    });

    // One group per condition, all built up front so switching cross-fades rather than
    // blanking: they hold different people, so nothing should appear to move between them.
    swarmGroups = {};
    for (const cond of study.conditions) {
      const g = svgEl("g", {opacity: 0});
      g.style.transition = `opacity ${TRANS}`;
      study.terms.forEach((_, i) => {
        const cy = rowY(i);
        for (const p of fit.byCondition[cond.id][i]) {
          // A hairline of the plate's own colour, so bubbles that end up touching still
          // read as two answers rather than as one blob.
          g.appendChild(svgEl("circle", {
            cx: p.x, cy: cy + p.y, r: p.r, fill: DOT_COLOR, "fill-opacity": 0.75,
            stroke: BACKGROUND, "stroke-width": 0.6,
          }));
        }
      });
      svg.appendChild(g);
      swarmGroups[cond.id] = g;
    }

    // The middle half of each group's answers, over the swarm. Both marks are rects, so x
    // and width can carry a CSS transition — a line's x1/x2 cannot — and the summary slides
    // between conditions. No whiskers: the bubbles already show the whole spread, and with
    // answers piled on 0 and 100 they would stretch across the entire axis.
    boxParts = study.terms.map((_, i) => {
      const cy = rowY(i);
      const mk = attrs => {
        const el = svgEl("rect", attrs);
        el.style.transition = `x ${TRANS}, width ${TRANS}, opacity ${TRANS}`;
        el.setAttribute("opacity", 0);
        svg.appendChild(el);
        return el;
      };
      // Unfilled: the bubbles underneath carry the ink, and a wash over them would make the
      // ones inside the box read as a different colour from the ones outside.
      const box = mk({
        x: axL, y: cy - boxH / 2, width: 0, height: boxH,
        fill: "none", stroke: "#111", "stroke-width": 1.2,
      });
      const median = mk({x: axL, y: cy - boxH / 2, width: 3, height: boxH, fill: "#111"});
      return {box, median};
    });

    // The reader's own answer: a vermillion ring with a white halo so it reads over the
    // bubbles. No transition — while dragging it has to track the pointer exactly.
    guessGroups = [];
    focusRects = [];
    study.terms.forEach((_, i) => {
      const focus = svgEl("rect", {
        x: plotL - 4, y: rowY(i) - swarmHalf - 3, width: plotR - plotL + 8, height: swarmHalf * 2 + 6,
        rx: 4, fill: "none", stroke: "#0b57d0", "stroke-width": 2, opacity: 0,
      });
      svg.appendChild(focus);
      focusRects.push(focus);

      const g = svgEl("g", {opacity: 0});
      g.appendChild(svgEl("circle", {r: ringR, fill: "none", stroke: "#fff", "stroke-width": 4.5}));
      g.appendChild(svgEl("circle", {r: ringR, fill: "none", stroke: GUESS_COLOR, "stroke-width": 2.5}));
      svg.appendChild(g);
      guessGroups.push(g);
    });

    // Row labels, left of the plot: the word itself, which is the whole point of the
    // figure, so it is set at reading size rather than as a tick label.
    study.terms.forEach((term, i) => {
      const label = svgEl("text", {
        x: marginL - 10, y: rowY(i) + termFont * 0.35, "text-anchor": "end",
        "font-size": termFont, "font-weight": "bold", fill: "#111",
      });
      label.textContent = term.label;
      svg.appendChild(label);
    });

    // Readouts, right of the plot.
    readMain = [];
    readSub = [];
    study.terms.forEach((_, i) => {
      const cy = rowY(i);
      const main = svgEl("text", {
        x: w - 10, y: showInRange ? cy - 1 : cy + termFont * 0.35, "text-anchor": "end",
        "font-size": readFont, fill: "#333",
      });
      const sub = svgEl("text", {
        x: w - 10, y: cy + 12, "text-anchor": "end", "font-size": subReadFont, fill: "#777",
      });
      svg.append(main, sub);
      readMain.push(main);
      readSub.push(sub);
    });

    // Transparent hit areas on top: they take the focus (so Tab walks the rows and the
    // arrow keys move that row's estimate) and give the pointer something to aim at.
    hitRects = study.terms.map((term, i) => {
      const r = svgEl("rect", {
        x: plotL - 4, y: rowY(i) - rowPitch / 2, width: plotR - plotL + 8, height: rowPitch,
        fill: "transparent", role: "slider", "aria-valuemin": 0, "aria-valuemax": 100,
      });
      r.setAttribute("tabindex", "0");
      r.style.cursor = "ew-resize";
      r.style.outline = "none";
      r.addEventListener("focus", () => { hovered = i; update({emit: false}); });
      r.addEventListener("blur", () => { if (hovered === i) hovered = null; update({emit: false}); });
      r.addEventListener("pointerenter", () => { hovered = i; update({emit: false}); });
      r.addEventListener("pointerleave", () => {
        if (hovered === i && document.activeElement !== r) { hovered = null; update({emit: false}); }
      });
      r.addEventListener("keydown", e => {
        const stepBy = e.shiftKey ? 10 : 1;
        const current = guesses.has(term.id) ? guesses.get(term.id) : 50;
        let next = current;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = current - stepBy;
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = current + stepBy;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = 100;
        else return;
        e.preventDefault();
        guesses.set(term.id, clamp(Math.round(next), 0, 100));
        update();
      });
      svg.appendChild(r);
      return r;
    });

    // Below about 470px the full citation with its link would overrun the figure's left
    // edge (it is fixed, right-anchored text at a small font, sized for the 600px figure);
    // a shorter form there avoids that rather than letting it clip.
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
      rest.textContent = ` ${study.journal}, ${study.year} (${study.url})`;
      source.append(prefix, italic, rest);
    } else {
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.textContent = `, ${study.journal} (${study.year})`;
      source.append(italic, rest);
    }
    svg.appendChild(source);

    buildConditionButtons();
    update({emit: false});
  }

  // --- update: everything that depends on the selection or the mode, never on layout ----
  function update({emit: shouldEmit = true} = {}) {
    studyButtons.forEach((b, i) => stylePill(b, studies[i] === study));
    conditionButtons.forEach((b, i) => stylePill(b, study.conditions[i] === condition));

    studyRow.style.visibility = isRevealed ? "visible" : "hidden";
    conditionRow.style.visibility = isRevealed ? "visible" : "hidden";
    revealButton.style.display = isRevealed ? "none" : "";
    skipLink.style.display = isRevealed ? "none" : "";
    againLink.style.display = isRevealed && guesses.size ? "" : "none";
    // The primary action while the data is hidden, so it is filled rather than outlined.
    revealButton.style.background = "#333";
    revealButton.style.color = "#fff";
    revealButton.style.border = "1px solid #333";

    for (const g of Object.values(swarmGroups)) g.style.opacity = 0;
    if (isRevealed && swarmGroups[condition.id]) swarmGroups[condition.id].style.opacity = 1;

    study.terms.forEach((term, i) => {
      bandRects[i].setAttribute("opacity", isRevealed && term.lo !== null ? 0.18 : 0);
      trackRects[i].setAttribute("opacity", isRevealed ? 0.4 : 1);
      trackRects[i].setAttribute("fill", hovered === i && !isRevealed ? "#9a9a9a" : "#c9c9c9");

      const s = condition.rows[i];
      const parts = boxParts[i];
      const on = isRevealed && s.n > 0;
      setRect(parts.box, x(s.q1), x(s.q3) - x(s.q1), on);
      setRect(parts.median, x(s.median) - 1.5, 3, on);

      const guess = guesses.get(term.id);
      guessGroups[i].setAttribute("opacity", guess === undefined ? 0 : 1);
      guessGroups[i].setAttribute("transform", `translate(${x(guess ?? 50)},${rowY(i)})`);
      focusRects[i].setAttribute("opacity", hovered === i ? 0.5 : 0);

      // Before the reveal the readout echoes the reader's own answer; after it, the group's
      // median and, where the word has an official range, how much of the group met it.
      if (!isRevealed) {
        readMain[i].setAttribute("fill", GUESS_COLOR);
        readMain[i].textContent = guess === undefined ? "" : `${guess}%`;
        readSub[i].textContent = "";
      } else {
        readMain[i].setAttribute("fill", "#333");
        readMain[i].textContent = s.n ? `${fmt(s.median)}%` : "";
        readSub[i].textContent =
          showInRange && s.n && s.pctInRange !== null ? `${s.pctInRange.toFixed(0)}% in range` : "";
      }

      hitRects[i].setAttribute("aria-valuenow", guess ?? 50);
      hitRects[i].setAttribute("aria-label", rowSpeech(i, term, s, guess));
    });

    renderStatus();
    svg.setAttribute("aria-label", summaryText());

    container.value = value();
    if (shouldEmit) emit();
  }

  function stylePill(b, active) {
    b.setAttribute("aria-pressed", String(active));
    b.style.border = active ? "1px solid #333" : "1px solid #ccc";
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
  }

  function setRect(el, x0, width, on) {
    el.setAttribute("x", x0);
    el.setAttribute("width", Math.max(0, width));
    el.setAttribute("opacity", on ? 1 : 0);
  }

  // The group that read the range inside the sentence saw it there, so that is what this
  // shows while their answers are on screen — the reader sees what the respondents saw.
  function termAsShown(term) {
    const inline = condition.id === "vn" || condition.id === "brackets";
    return term.label + (inline && term.rule ? ` (${term.rule})` : "");
  }

  function rowSpeech(i, term, s, guess) {
    const sentences = study.sentences?.[term.id];
    const where = sentences
      ? `, used in: ${sentences.map(x => x.pre + termAsShown(term) + x.post).join(" And: ")}`
      : ` ${study.setting}`;
    const rule = term.rule ? ` ${study.authority} means ${term.rule}.` : "";
    return `Your estimate of the probability meant by "${term.label}"${where}.` +
      (guess === undefined ? " No estimate yet." : ` You said ${guess}%.`) +
      (isRevealed
        ? `${rule} Median of the ${s.n} answers in this group: ${fmt(s.median)}%` +
          (s.pctInRange === null ? "." : `, of which ${s.pctInRange.toFixed(0)} percent meet it.`)
        : "");
  }

  function renderStatus() {
    statusText.replaceChildren();

    if (hovered !== null) {
      const term = study.terms[hovered];
      const s = condition.rows[hovered];
      const guess = guesses.get(term.id);
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
      if (guess !== undefined) bits.push(`you ${guess}%`);
      if (isRevealed && s.n) {
        bits.push(`median ${fmt(s.median)}%`);
        bits.push(`commonest answer ${s.mode}% (${s.modeCount} of ${s.n})`);
        if (s.pctInRange !== null) bits.push(`${s.pctInRange.toFixed(0)}% in range`);
      }
      facts.textContent = (bits.length ? " " + bits.join(" · ") + "." : "");
      statusText.appendChild(facts);
      return;
    }

    if (!isRevealed) {
      statusText.textContent =
        "Each row is a word for chance, as it was put to " +
        `${study.conditions[0].respondents} people ${study.setting}. What probability do you ` +
        "think was meant by each one? Drag along a row to place your answer, or focus a row " +
        "and use the arrow keys. Hover or focus a row to read more about it.";
      return;
    }

    const band = study.authority
      ? ` The shaded band is the range ${study.authority} assigns to that word`
      : " There is no official range for these phrases, so no band is shaded";
    statusText.textContent =
      "Every bubble gathers the people who gave the same answer, and its area is how many " +
      `they were: the ${condition.respondents} in this group saw ${condition.blurb}. The box ` +
      "covers the middle half of the answers and the thick line is the median." + band +
      (guesses.size ? ", and the ring is your own answer." : ".") +
      " Hover or focus a row to read more about it.";
  }

  function summaryText() {
    if (!isRevealed) {
      return `${study.title.join(" ")}. ${study.terms.length} words, one per row, each with a ` +
        "0 to 100 percent slider for your own estimate. The responses are hidden until you " +
        "reveal them.";
    }
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

  // --- pointer -------------------------------------------------------------------------
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

  const pctAt = px => clamp(Math.round(((px - axL) / (axR - axL)) * 100), 0, 100);

  svg.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    const i = rowAt(py);
    if (i === null) return;
    // The row is locked at pointerdown, so a sloppy vertical drag adjusts the row the
    // reader started on rather than jumping to its neighbour.
    dragging = i;
    svg.setPointerCapture(e.pointerId);
    hitRects[i].focus?.();
    hovered = i;
    guesses.set(study.terms[i].id, pctAt(px));
    update();
    e.preventDefault();
  });

  svg.addEventListener("pointermove", e => {
    if (dragging === null) return;
    const {px} = pointerAt(e);
    const id = study.terms[dragging].id;
    const next = pctAt(px);
    if (guesses.get(id) === next) return;
    guesses.set(id, next);
    update();
  });

  for (const type of ["pointerup", "pointercancel"]) {
    svg.addEventListener(type, e => {
      if (dragging === null) return;
      dragging = null;
      svg.releasePointerCapture(e.pointerId);
    });
  }

  function value() {
    return {
      study: study.id,
      condition: condition.id,
      revealed: isRevealed,
      guesses: Object.fromEntries(guesses),
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
  // emits "input": the study, the condition, the mode and the reader's answers are
  // data-space state, unchanged by re-layout.
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
