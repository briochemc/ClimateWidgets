# The history of atmospheric CO₂

Carbon dioxide in the air, on every timescale we have measured it: the seasonal breathing of the northern hemisphere in the weekly Mauna Loa record, the Keeling curve since 1958, two centuries of air trapped in Antarctic ice, and the ice ages. The chart always ends at the latest week; the **Look back** slider stretches its time axis from a year to 800,000 years, and the buttons jump to the spans worth stopping at.

```js
import {createCo2HistoryWidget, updateMaunaLoa} from "./widget.js";

const data = await FileAttachment("data/co2-history.json").json();

// Bring the Mauna Loa record up to date from NOAA; the bundled data are the fallback.
const NOAA = "https://gml.noaa.gov/webdata/ccgg/trends/co2/";
try {
  const [weekly, monthly] = await Promise.all(
    ["co2_weekly_mlo.txt", "co2_mm_mlo.txt"].map(f => fetch(NOAA + f).then(r => r.ok ? r.text() : null)));
  updateMaunaLoa(data, {weekly, monthly});
} catch {}
```

```js
const history = view(createCo2HistoryWidget({data}));
```

## Reading the figure

Mauna Loa (red) and the South Pole (blue) are direct measurements of the air; before 1958 every point is air recovered from ice, dated by how long it took the snow to seal it in. Law Dome (orange) and Siple Station (brown) cover the last two centuries at a resolution of years to decades, and the 800,000-year composite is stitched from seven Antarctic cores, each in its own colour. Zooming out, the modern rise folds into a vertical line: two centuries against the eight glacial cycles it sits on.

The **Play tour** does the zoom by itself, resting at each stop. For where in the world these numbers come from, and how the air breathes in and out each year, see [CO₂ around the world, month by month](../co2-latitude/).

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "co2-history/embed",
  height: 540,
  title: "The history of atmospheric CO₂",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about " +
    "320&nbsp;px, so it works on phones; narrower than that it scrolls sideways inside " +
    "the frame. In a narrow column the buttons wrap onto extra rows, so allow about 590 " +
    "of height there. The bundled data are refreshed now and then; the page also fetches " +
    "NOAA's latest Mauna Loa weeks live, and falls back to the bundled data if it cannot.",
  script: `<div id="co2-history"></div>

<script type="module">
  import {createCo2HistoryWidget, updateMaunaLoa}
    from "${cdnUrl("co2-history/widget.js")}";

  const data = await fetch("${cdnUrl("co2-history/data/co2-history.json")}")
    .then(r => r.json());

  // Optional: bring Mauna Loa up to date from NOAA (the bundled data are the fallback).
  const NOAA = "https://gml.noaa.gov/webdata/ccgg/trends/co2/";
  try {
    const [weekly, monthly] = await Promise.all(
      ["co2_weekly_mlo.txt", "co2_mm_mlo.txt"].map(f => fetch(NOAA + f).then(r => r.ok ? r.text() : null)));
    updateMaunaLoa(data, {weekly, monthly});
  } catch {}

  const host = document.getElementById("co2-history");
  host.appendChild(createCo2HistoryWidget({data}));
<\/script>`
}));
```

---

Inspired by Andy Jacobson's animation [*History of atmospheric carbon dioxide*](https://gml.noaa.gov/ccgg/trends/history.html) (NOAA Global Monitoring Laboratory), which walks the same records in the same order.

Data, all fetched by `scripts/co2-history.mjs` and bundled with the widget (the Mauna Loa series is also refreshed live from NOAA):

- **Mauna Loa**, monthly from March 1958 and weekly from May 1974: NOAA GML [in situ record](https://gml.noaa.gov/ccgg/trends/) (Lan, Tans and Thoning, doi:[10.15138/9N0H-ZH07](https://doi.org/10.15138/9N0H-ZH07)); the values before April 1974 are the Scripps CO₂ Program's, C. D. Keeling's original record.
- **South Pole**, monthly: the [Scripps CO₂ Program](https://scrippsco2.ucsd.edu/) from 1957 (Keeling et al. 2001, SIO Reference Series 01-06, CC BY 4.0), then NOAA's flask samples from 1975 (doi:[10.15138/wkgj-f215](https://doi.org/10.15138/wkgj-f215)).
- **Law Dome**, 154–1996 CE: Rubino et al. (2019), *Earth Syst. Sci. Data* 11, 473–492, doi:[10.5194/essd-11-473-2019](https://doi.org/10.5194/essd-11-473-2019), which updates Rubino et al. (2013), *J. Geophys. Res.* 118, and MacFarling Meure et al. (2006), *Geophys. Res. Lett.* 33, L14810.
- **Siple Station**, 1734–1983: Neftel et al. (1985), *Nature* 315, 45–47, and Friedli et al. (1986), *Nature* 324, 237–238, via the CDIAC archive (doi:[10.3334/CDIAC/ATG.010](https://doi.org/10.3334/CDIAC/ATG.010)).
- **800,000-year composite**: Bereiter et al. (2015), *Geophys. Res. Lett.* 42, 542–549, doi:[10.1002/2014GL061957](https://doi.org/10.1002/2014GL061957), assembled from Law Dome, EPICA Dome C (Monnin et al. 2001, Siegenthaler et al. 2005, *Science* 310, Lüthi et al. 2008, *Nature* 453, Schneider et al. 2013, Bereiter et al. 2014), WAIS Divide (Marcott et al. 2014), Siple Dome (Ahn et al. 2014), Talos Dome and EDML (Bereiter et al. 2012) and Vostok (Petit et al. 1999, *Nature* 399). Ages are gas ages on the AICC2012 timescale, counted from 1950.

NOAA's data are in the public domain; the Scripps and CDIAC data are CC BY 4.0.
