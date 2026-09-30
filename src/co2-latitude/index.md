# CO₂ around the world, month by month

Where carbon dioxide is measured, and what one month of it looks like. The map shows the flask-sampling stations; the thin plot beside it, lined up with the map's parallels, is CO₂ against latitude for the month: the black curve is NOAA's marine boundary layer reference, the clean background air over the oceans, and the dots are the stations, Mauna Loa in red and the South Pole in blue. Pick a month with the slider or by dragging across the lower chart, or press **Play** and watch the years go by; the clock on the Mauna Loa curve keeps the month.

```js
import {createCo2LatitudeWidget} from "./widget.js";

const data = await FileAttachment("data/co2-latitude.json").json();
```

```js
const month = view(createCo2LatitudeWidget({data}));
```

## Reading the figure

Two things happen at once as the months pass. The curve breathes: every northern summer the forests draw CO₂ down, deepest in the far north where most of the land is, and every winter it comes back, while the southern hemisphere, mostly ocean, hardly moves. And the whole curve climbs, year after year, north first, because that is where most of the fossil fuel is burnt; the south catches up a year or so later. The January 1979 curve stays as a grey ghost, so the climb since then is always in view, and the CO₂ scale is the same for the latitude plot and the lower chart and never changes, so a move is a move.

Before 1979 there is no reference curve, only the handful of stations that existed; the two longest records, Mauna Loa and the South Pole, are the lower chart. The lower chart is the same red and blue as the first decades of [the history of atmospheric CO₂](../co2-history/), which zooms out from here to the ice ages.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "co2-latitude/embed",
  height: 560,
  title: "CO₂ around the world, month by month",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about " +
    "320&nbsp;px, so it works on phones; narrower than that it scrolls sideways inside " +
    "the frame. The map keeps its 2:1 shape, so the figure is shorter in a narrow column " +
    "(about 470 at 320&nbsp;px). The bundled data are refreshed now and then; the last few " +
    "months are always sparse because the stations' monthly means are published about a " +
    "year behind.",
  script: `<div id="co2-latitude"></div>

<script type="module">
  import {createCo2LatitudeWidget}
    from "${cdnUrl("co2-latitude/widget.js")}";

  const data = await fetch("${cdnUrl("co2-latitude/data/co2-latitude.json")}")
    .then(r => r.json());

  const host = document.getElementById("co2-latitude");
  host.appendChild(createCo2LatitudeWidget({data}));
<\/script>`
}));
```

---

Inspired by the first half of Andy Jacobson's animation [*History of atmospheric carbon dioxide*](https://gml.noaa.gov/ccgg/trends/history.html) (NOAA Global Monitoring Laboratory). His latitude panel draws on the full GLOBALVIEW+ ObsPack, which cannot be redistributed; this one uses NOAA's public reference and station means instead, so the scatter of local signals from towers, aircraft and continental sites is missing.

Data, all fetched by `scripts/co2-history.mjs` and bundled with the widget:

- **Latitude curve**: NOAA GML's [Marine Boundary Layer Reference](https://gml.noaa.gov/ccgg/mbl/), 1979 onwards, in 41 bins of sine latitude (Lan, Tans, Thoning and NOAA GML 2024, doi:[10.15138/DVNP-F961](https://doi.org/10.15138/DVNP-F961)).
- **Stations**: monthly means of NOAA's [Carbon Cycle Cooperative Global Air Sampling Network](https://gml.noaa.gov/ccgg/flask.html) (doi:[10.15138/wkgj-f215](https://doi.org/10.15138/wkgj-f215)), including the Pacific and South China Sea ship tracks, binned by latitude, and of the [Scripps CO₂ Program](https://scrippsco2.ucsd.edu/)'s flask stations (Keeling et al. 2001, SIO Reference Series 01-06, CC BY 4.0), some of which go back to 1957.
- **Mauna Loa**, monthly from March 1958: NOAA GML [in situ record](https://gml.noaa.gov/ccgg/trends/) (doi:[10.15138/9N0H-ZH07](https://doi.org/10.15138/9N0H-ZH07)); the values before April 1974 are Scripps's, C. D. Keeling's original record.
- **South Pole**, monthly: Scripps from 1957, then NOAA's flask samples from 1975.

NOAA's data are in the public domain; the Scripps data are CC BY 4.0. The world map is the 110 m Natural Earth land outline.
