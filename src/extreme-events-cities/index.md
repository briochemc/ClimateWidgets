# Extreme events, in real cities

The [simple figure](../extreme-events-simple/) with real days behind the curve. Pick a city on the map. The bars are a histogram of its daily maximum temperatures in the three hottest months of its year, one bar per degree, for the years chosen with the slider, from the ERA5 reanalysis. The gray curve is a skewed bell fitted to the first thirty years on record, the baseline; the black curve is the same bell fitted to the chosen years, so it follows the slider. Extreme heat and extreme cold are the hottest and coldest 1% of baseline days, rounded to the degree, and the vivid red is what the chosen years add to the extreme heat.

```js
import {createCityExtremesWidget} from "./widget.js";

const data = await FileAttachment("data/hot-season-tmax.json").json();
const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const extremes = view(createCityExtremesWidget({data, world}));
```

## What to look for

**Drag the window.** The slider opens on the last ten years. Drag both handles down to the 1940s and the bars sit under the gray curve, which was fitted to them; drag them back up and watch where the bars go. Make the window a single year and the bars get ragged, because ninety days is not many: that raggedness is why climate is defined over thirty years, and why ten recent years are a fair sample but not a definitive one.

**Read the numbers.** Tick *Show numbers* for the two fits, average ± spread and skewness, and for the share of the chosen years' days beyond each threshold against the baseline's share. The multiplier over a tail is the ratio of the two fitted curves' tails.

**Not every city tells the same story.** The biggest multipliers are where the spread is smallest: in Jakarta, Kuala Lumpur, Taipei and Hong Kong one hot-season day is much like the next, so a degree of warming pushes a large share of days past a threshold that used to be rare, and days above Jakarta's old 1% mark are now one in six. Madrid, Tokyo, Paris and London show the textbook case, an average up by one to two degrees and the old 1% days four to fourteen times as common. The Australian cities have moved little at their ERA5 grid points, which on a coast mix land and sea. And in South Asia the reanalysis shows the hottest months cooling since the 1940s: New Delhi, Islamabad and Dhaka have fewer days past their old thresholds, not more, a known pattern over the Indo-Gangetic plain attributed to irrigation and air pollution, and one to treat with care, since the early decades of a reanalysis rest on few observations there.

**Why the three hottest months.** A whole year of daily maxima has two humps, one per season, and is not a bell. The figure keeps each city's three hottest consecutive calendar months, by the mean daily maximum over the whole record: December to February in Sydney, January to March in Melbourne and Perth, June to August in Beijing and April to June in New Delhi, where the monsoon makes July and August cooler than May.

## About the data

The data are the ERA5 reanalysis's daily maximum 2-metre temperature at each city's grid point, from the [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api), from 1940 to the latest complete hot season. [`scripts/fetch-hot-season-tmax.py`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/fetch-hot-season-tmax.py) downloads them, keeps the hot-season days in tenths of a degree, and writes them to [`data/hot-season-tmax.json`](https://github.com/briochemc/ClimateWidgets/blob/main/src/extreme-events-cities/data/hot-season-tmax.json); the site never runs the script. A season that straddles the new year is labelled by the year of its last month, so Sydney's 1941 season is December 1940 to February 1941.

The cities are the capitals of the countries that send the most students to Australia, from the Department of Education's [international student numbers by country](https://www.education.gov.au/international-education-data-and-research/international-student-numbers-country-state-and-territory) (the shortlist is kept in [`data/the-number-of-internatio.csv`](https://github.com/briochemc/ClimateWidgets/blob/main/src/extreme-events-cities/data/the-number-of-internatio.csv)), plus the four largest Australian cities, less three capitals that would sit on top of a neighbour on the map: Singapore under Kuala Lumpur, Thimphu between Kathmandu and Dhaka, Phnom Penh beside Bangkok. Colombo stands for Sri Lanka, whose official capital is its suburb. A few more are there so that the map covers the world: London, Paris, Madrid, Berlin and Stockholm; Riyadh and Tehran; Cairo, Abuja and Cape Town; Los Angeles; and one station at each pole, Longyearbyen in Svalbard and Australia's Casey Station in Antarctica, whose warmest months barely reach above freezing.

A reanalysis grid cell is not a thermometer in a city: on a coast it mixes land and sea, it smooths over the urban heat island, and its early decades rest on fewer observations than its recent ones. Both curves are Pearson type III distributions fitted by the method of moments (sample mean, standard deviation and skewness). The histogram's bars are a density, the share of the window's days per degree, so they are on the same scale as the curves, and the vertical scale is fixed at twice the baseline curve's peak whatever the window shows. The thresholds are the baseline days' 1st and 99th percentiles rounded to whole degrees, so the baseline share beyond each is near 1% but not exactly. The temperature axis runs from 0 to 50 °C for every city, so that nothing moves when a city is picked, with one exception: the two polar stations slide it down to −25 to 25 °C, the same width, and the ticks are seen to move. A city in the tropics, where one day is much like the next, is a narrow spike on this axis, and that is the point. The map is the one the [CO₂ around the world](../co2-latitude/) widget draws: Natural Earth's 1:110m land from [world-atlas](https://github.com/topojson/world-atlas), in the Equal Earth projection with d3-geo.

For the first and last thirty years on record:

<!-- city-table -->
| City | Hot season | Baseline | Last 30 years | Days above the old 1% threshold |
|---|---|---|---|---|
| Sydney | Dec–Feb | 25.0 ± 3.9 °C | 25.3 ± 3.5 °C | 37 °C: 0.9% then 0.7% |
| Melbourne | Jan–Mar | 25.0 ± 5.2 °C | 25.2 ± 5.5 °C | 38 °C: 0.9% then 1.6% |
| Brisbane | Dec–Feb | 28.4 ± 3.0 °C | 28.7 ± 3.0 °C | 36 °C: 1.5% then 1.5% |
| Perth | Jan–Mar | 30.3 ± 4.6 °C | 30.3 ± 4.5 °C | 40 °C: 1.6% then 1.5% |
| Beijing | Jun–Aug | 29.5 ± 3.7 °C | 31.5 ± 3.5 °C | 39 °C: 0.8% then 1.6% |
| New Delhi | Apr–Jun | 40.1 ± 3.7 °C | 38.0 ± 3.6 °C | 46 °C: 1.5% then 0.1% |
| Kathmandu | May–Jul | 25.8 ± 2.1 °C | 25.7 ± 1.7 °C | 32 °C: 1.4% then 0.0% |
| Hanoi | Jun–Aug | 31.8 ± 2.6 °C | 32.2 ± 2.2 °C | 40 °C: 0.7% then 0.0% |
| Dhaka | Mar–May | 32.9 ± 3.4 °C | 32.3 ± 2.6 °C | 41 °C: 0.7% then 0.0% |
| Jakarta | Aug–Oct | 30.6 ± 1.4 °C | 31.5 ± 1.6 °C | 34 °C: 0.4% then 6.4% |
| Manila | Mar–May | 31.9 ± 1.8 °C | 32.0 ± 2.1 °C | 35 °C: 2.5% then 6.6% |
| Bogotá | Aug–Oct | 18.9 ± 1.4 °C | 19.5 ± 1.4 °C | 22 °C: 0.6% then 2.8% |
| Islamabad | May–Jul | 36.4 ± 4.6 °C | 34.4 ± 3.7 °C | 44 °C: 1.7% then 0.0% |
| Colombo | Feb–Apr | 31.0 ± 1.4 °C | 31.2 ± 1.5 °C | 35 °C: 0.7% then 0.5% |
| Brasília | Aug–Oct | 28.4 ± 2.7 °C | 28.7 ± 2.5 °C | 35 °C: 0.8% then 0.4% |
| Bangkok | Mar–May | 33.4 ± 2.1 °C | 33.8 ± 2.2 °C | 38 °C: 0.9% then 1.2% |
| Seoul | Jun–Aug | 27.4 ± 3.2 °C | 28.0 ± 2.9 °C | 34 °C: 1.4% then 1.7% |
| Kuala Lumpur | Feb–Apr | 29.9 ± 1.2 °C | 30.7 ± 1.7 °C | 33 °C: 1.5% then 9.9% |
| Taipei | Jun–Aug | 30.2 ± 1.9 °C | 31.1 ± 2.2 °C | 34 °C: 0.9% then 7.9% |
| Hong Kong | Jun–Aug | 29.1 ± 1.4 °C | 29.6 ± 1.6 °C | 32 °C: 1.3% then 5.0% |
| Tokyo | Jul–Sep | 27.3 ± 3.0 °C | 28.7 ± 3.6 °C | 33 °C: 1.4% then 10.1% |
| Nairobi | Jan–Mar | 25.4 ± 1.9 °C | 26.6 ± 1.9 °C | 30 °C: 0.6% then 2.7% |
| Washington | Jun–Aug | 29.1 ± 3.7 °C | 29.8 ± 3.7 °C | 37 °C: 0.7% then 1.6% |
| Ulaanbaatar | Jun–Aug | 21.2 ± 4.3 °C | 22.6 ± 4.6 °C | 31 °C: 0.9% then 3.0% |
| Santiago | Dec–Feb | 28.1 ± 2.5 °C | 28.1 ± 2.7 °C | 34 °C: 1.0% then 0.8% |
| Ottawa | Jun–Aug | 24.2 ± 4.1 °C | 24.8 ± 3.9 °C | 33 °C: 1.4% then 1.4% |
| London | Jun–Aug | 20.3 ± 3.1 °C | 21.3 ± 3.6 °C | 29 °C: 1.0% then 3.6% |
| Paris | Jun–Aug | 22.4 ± 3.8 °C | 23.9 ± 4.3 °C | 33 °C: 0.7% then 3.2% |
| Madrid | Jun–Aug | 29.5 ± 4.1 °C | 31.4 ± 4.4 °C | 37 °C: 0.5% then 7.1% |
| Berlin | Jun–Aug | 21.8 ± 3.8 °C | 23.6 ± 4.3 °C | 31 °C: 1.1% then 5.0% |
<!-- /city-table -->

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "extreme-events-cities/embed",
  height: 640,
  title: "Extreme events, in real cities",
  note: "The figure is a fixed 352&nbsp;px tall; above it are the title, the map (150&nbsp;px, " +
    "beside the title) and the years slider, below it the note. Allow about 820&nbsp;px for a " +
    "320&nbsp;px phone-width frame, where the map goes under the title at full width.",
  script: `<div id="extreme-events-cities"></div>

<script type="module">
  import {createCityExtremesWidget}
    from "${cdnUrl("extreme-events-cities/widget.js")}";

  const [data, world] = await Promise.all([
    fetch("${cdnUrl("extreme-events-cities/data/hot-season-tmax.json")}").then(r => r.json()),
    fetch("${cdnUrl("data/countries-110m.json")}").then(r => r.json()),
  ]);

  // Options: {city: "Beijing"} opens on another city; {xRange: [0, 50]} and
  // {polarRange: [-25, 25]} set the temperature axis, for cities within and beyond
  // 60° of latitude; {showNumbers: true} shows the figures from the start.
  document.getElementById("extreme-events-cities")
    .appendChild(createCityExtremesWidget({data, world}));
<\/script>`
}));
```

---

Sources and credits:

- Hersbach, H. et al. (2020), ["The ERA5 global reanalysis"](https://doi.org/10.1002/qj.3803), *Quarterly Journal of the Royal Meteorological Society* 146, 1999–2049, served by [Open-Meteo](https://open-meteo.com/) under CC BY 4.0.
- Australian Government Department of Education, [International student numbers by country, by state and territory](https://www.education.gov.au/international-education-data-and-research/international-student-numbers-country-state-and-territory), for the shortlist of countries.
- Šavrič, B., Patterson, T. & Jenny, B. (2019), ["The Equal Earth map projection"](https://doi.org/10.1080/13658816.2018.1504949), *International Journal of Geographical Information Science* 33, 454–465.
- IPCC (2012), *Managing the Risks of Extreme Events and Disasters to Advance Climate Change Adaptation* (SREX), [Figure SPM.3](https://www.ipcc.ch/report/managing-the-risks-of-extreme-events-and-disasters-to-advance-climate-change-adaptation/), for the schematic the curves animate.
