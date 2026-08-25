# Daily sea surface temperature

Daily global-mean sea surface temperature (world ocean, 60°S–60°N) from NOAA OISST v2.1, drawn as a spiral: the day of the year is the angle and the temperature is the radius. Because 31 December meets 1 January at the same place on the circle, every year since 1981 joins into one continuous line, and the years working their way outwards are the warming. The dashed loop is the 1991–2020 average.

```js
import {createSstDailyWidget, sstUnavailableNotice} from "./widget.js";

const SST_URL = "https://climatereanalyzer.org/clim/sst_daily/json_2clim/oisst2.1_world2_sst_day.json";
const sstData = await fetch(SST_URL)
  .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
  .catch(() => null);
```

```js
sstData ? view(createSstDailyWidget({data: sstData})) : display(sstUnavailableNotice());
```

## Reading the chart

The chart opens by touring the five years that hold the warmest day ever recorded, hottest first. The marker travels the calendar between one and the next rather than jumping, so the years in between go past on the way; each leg takes the same time, which means a long gap races and a short one ambles. Move the pointer over the chart at any point to take over.

Hovering picks out whichever loop is nearest and reads it out in the middle of the circle — the year, the date and the temperature — with an arrow out to the 1991–2020 average showing the anomaly for that day. Click to keep a year, and keep several to compare them; the five featured years each have their own colour, darkest for the hottest, which is what the buttons are showing. Press Esc to clear, or **↻ Replay** to start the tour over.

The current year's loop ends at the most recent available observation, preliminary for the last day or two until it is folded into the official record.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "sst-daily/embed",
  height: 880,
  title: "Daily global sea surface temperature",
  note: "The figure itself is a fixed 640&nbsp;px square, so it never reflows. In a column " +
    "narrower than that it scrolls sideways inside the frame. The data is fetched live " +
    "from climatereanalyzer.org on every load, so the embed is always current.",
  script: `<div id="sst-daily"></div>

<script type="module">
  import {createSstDailyWidget, sstUnavailableNotice}
    from "${cdnUrl("sst-daily/widget.js")}";

  const host = document.getElementById("sst-daily");
  try {
    const data = await fetch("https://climatereanalyzer.org/clim/sst_daily/json_2clim/oisst2.1_world2_sst_day.json")
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)));
    host.appendChild(createSstDailyWidget({data}));
  } catch {
    host.appendChild(sstUnavailableNotice());
  }
<\/script>`
}));
```

---

Sea surface temperature data: NOAA Optimum Interpolation SST (OISST) v2.1, via [Climate Reanalyzer](https://climatereanalyzer.org/clim/sst_daily/) (Climate Change Institute, University of Maine). World ocean, 60°S–60°N; updated daily with roughly a two-day lag, and the most recent days are preliminary.
