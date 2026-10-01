// CO₂ emissions per person, country by country, in the latest year only: the bars widget with
// the year fixed, no slider and no tour, for a page or a slide that wants the one picture and
// nothing moving. Everything else (the stack, the two views, the regions, the labels and the
// opening annotations) is the bars widget's, which this wraps; the data file is shared too.

import {createCo2PerCapitaBarsWidget} from "../co2-per-capita-bars/widget.js";

export {MODES, REGIONS, REGION_COLOURS} from "../co2-per-capita-bars/widget.js";

// Options: {mode: "cumulative"} opens on emissions since 1850; {year} picks another fixed year.
export function createCo2PerCapitaTodayWidget({data, width, year, mode} = {}) {
  const widget = createCo2PerCapitaBarsWidget({data, width, year, mode, timeline: false});
  // Carries this page's own name, so that it can be told apart from the bars widget it wraps.
  widget.querySelector("svg")?.classList.add("co2-per-capita-today");
  return widget;
}
