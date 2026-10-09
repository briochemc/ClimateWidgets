# Extreme events, in real cities

The [simple figure](../extreme-events-simple/) with real days behind the curve. Pick a city on the map. The bars are a histogram of its daily maximum temperatures in the three hottest months of its year, one bar per degree, for the years chosen with the slider, from the ERA5 reanalysis. The gray curve is a skewed bell fitted to the first thirty years of the record, 1950 to 1979, the baseline; the black curve is the same bell fitted to the chosen years, so it follows the slider. Extreme heat and extreme cold are the hottest and coldest 1% of baseline days, and the vivid red is what the chosen years add to the extreme heat.

```js
import {createCityExtremesWidget} from "./widget.js";

const data = await FileAttachment("data/hot-season-tmax.json").json();
const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const extremes = view(createCityExtremesWidget({data, world}));
```

<div class="caution" label="A grain of salt">

Take the data you see in the widget above with a grain of salt! This is because there are limitations with using reanalyses like ERA5. This is particularly apparent for example in Perth, where the max temperature shows as if it declined, but other observations show it has actually significantly increased. This particular mismatch in Perth is likely partly due to including an ocean grid box in the reanalysis, although we don't think this explains everything. What's important to remember is that in practice, weather and climate scientists don't solely rely on reanalyses for monitoring or for global-warming studies, but rely on many modelling and observational datasets.

</div>

## What to look for

**Drag the window.** The slider opens on the last ten years. Grab it in the middle and slide it down to the 1950s, and the bars sit under the gray curve, which was fitted to them; slide it back up and watch where the bars go. Each handle moves on its own too. Make the window a single year and the bars get ragged, because ninety days is not many: that raggedness is why climate is defined over thirty years, and why ten recent years are a fair sample but not a definitive one.

**Read the numbers.** Tick *Show numbers* for the two fits, average ± spread and skewness, and for the share of the chosen years' days beyond each threshold against the baseline's share. The multiplier over a tail is the ratio of the two fitted curves' tails.

**Not every city tells the same story.** The biggest multipliers are where the spread is smallest: in Jakarta, Kuala Lumpur, Taipei and Hong Kong one hot-season day is much like the next, so a degree of warming pushes a large share of days past a threshold that used to be rare, and days above Jakarta's old 1% mark are now one in six. Madrid, Tokyo, Paris and London show the textbook case, an average up by one to two degrees and the old 1% days four to fourteen times as common. The Australian cities have moved little at their ERA5 grid points, which on a coast mix land and sea. And in South Asia the reanalysis shows the hottest months cooling from the 1950s to the 1990s before levelling off: New Delhi and Islamabad have fewer days past their old thresholds, not more. Station records show the same, a known pattern over the Indo-Gangetic plain attributed to the spread of irrigation and to aerosol haze, and still one to treat with care, since the early decades of a reanalysis rest on few observations there.

**Why the three hottest months.** A whole year of daily maxima has two humps, one per season, and is not a bell. The figure keeps each city's three hottest consecutive calendar months, by the mean daily maximum over the whole record: December to February in Sydney, January to March in Melbourne and Perth, June to August in Beijing and April to June in New Delhi, where the monsoon makes July and August cooler than May.

## About the data

The data are the ERA5 reanalysis's daily maximum 2-metre temperature at each city's grid point, from the [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api), from 1940 to the latest complete hot season. [`scripts/fetch-hot-season-tmax.py`](https://github.com/briochemc/ClimateWidgets/blob/main/scripts/fetch-hot-season-tmax.py) downloads them, keeps the hot-season days in tenths of a degree, and writes them to [`data/hot-season-tmax.json`](https://github.com/briochemc/ClimateWidgets/blob/main/src/extreme-events-cities/data/hot-season-tmax.json); the site never runs the script. A season that straddles the new year is labelled by the year of its last month, so Sydney's 1941 season is December 1940 to February 1941.

The cities are the capitals of the countries that send the most students to Australia, from the Department of Education's [international student numbers by country](https://www.education.gov.au/international-education-data-and-research/international-student-numbers-country-state-and-territory) (the shortlist is kept in [`data/the-number-of-internatio.csv`](https://github.com/briochemc/ClimateWidgets/blob/main/src/extreme-events-cities/data/the-number-of-internatio.csv)), plus the four largest Australian cities, less three capitals that would sit on top of a neighbour on the map: Singapore under Kuala Lumpur, Thimphu between Kathmandu and Dhaka, Phnom Penh beside Bangkok. Colombo stands for Sri Lanka, whose official capital is its suburb. A few more are there so that the map covers the world: London, Paris, Madrid, Berlin, Stockholm and Moscow; Istanbul, Baghdad, Riyadh and Tehran; Cairo, Marrakesh, Algiers, Tripoli, Abuja and Cape Town; Los Angeles and Seattle; and four places in the polar regions, Longyearbyen in Svalbard, Nuuk in Greenland, Australia's Casey Station on the coast of East Antarctica, whose warmest months barely reach above freezing, and Byrd Station, 1,500 m up on the ice sheet of West Antarctica, where they never do. Nuuk is another place to read with the caution above in mind: its summer average rises by more than five degrees between the baseline and the last thirty years, far more than at any other city, which looks like the reanalysis's grid cell, part fjord and poorly constrained before the satellite era, rather than the town's weather.

A reanalysis grid cell is not a thermometer in a city: on a coast it mixes land and sea, it smooths over the urban heat island, and its early decades rest on fewer observations than its recent ones. The figure therefore starts the record in 1950 although the file runs from 1940: ERA5's 1940s, added last and resting on the sparse observations of the war years, come out a degree or two warmer than the 1950s at cities as far apart as Sydney, Beijing and Islamabad, in a step rather than a trend, and as a third of the baseline they inflated every "was" figure. Both curves are Pearson type III distributions fitted by the method of moments (sample mean, standard deviation and skewness). The histogram's bars are a density, the share of the window's days per degree, so they are on the same scale as the curves, and the vertical scale is fixed at twice the baseline curve's peak whatever the window shows. The thresholds are the baseline days' 1st and 99th percentiles to a tenth of a degree; rounding them to whole degrees read better but, in a tropical city where the spread is under two degrees, could move the baseline share from 1% to 0.1% and the multiplier tenfold. The temperature axis runs from 0 to 55 °C for every city (Baghdad's hottest days pass 52 °C), so that nothing moves when a city is picked, with one exception: a city with days below freezing, which means the three polar stations, slides it down in steps of 5 degrees just far enough to hold its coldest day, the same width, and the ticks are seen to move, down to −35 to 20 °C at Byrd Station. Picking a city is not a cut: the curves fade out, the bars of the city being left sink to the axis and the new city's bars rise from it, each bar a moment after its neighbour so the two moves run across the axis as a wave, and the curves fade back in. A city in the tropics, where one day is much like the next, is a narrow spike on this axis, and that is the point. The map is the one the [CO₂ around the world](../co2-latitude/) widget draws: Natural Earth's 1:110m land from [world-atlas](https://github.com/topojson/world-atlas), in the Equal Earth projection with d3-geo.

For the baseline and the last thirty years:

<!-- city-table -->
| City | Hot season | Baseline | Last 30 years | Days above the old 1% threshold |
|---|---|---|---|---|
| Sydney | Dec–Feb | 24.4 ± 3.2 °C | 25.3 ± 3.5 °C | 34.0 °C: 1.0% then 2.1% |
| Melbourne | Jan–Mar | 25.0 ± 5.1 °C | 25.2 ± 5.5 °C | 37.5 °C: 0.9% then 2.0% |
| Brisbane | Dec–Feb | 28.3 ± 3.0 °C | 28.7 ± 3.0 °C | 36.7 °C: 1.0% then 1.1% |
| Perth | Jan–Mar | 31.2 ± 4.6 °C | 30.3 ± 4.5 °C | 41.0 °C: 1.0% then 0.5% |
| Beijing | Jun–Aug | 29.3 ± 3.6 °C | 31.5 ± 3.5 °C | 37.8 °C: 1.0% then 3.3% |
| New Delhi | Apr–Jun | 39.3 ± 3.7 °C | 38.0 ± 3.6 °C | 45.7 °C: 1.0% then 0.3% |
| Kathmandu | May–Jul | 25.9 ± 2.2 °C | 25.7 ± 1.7 °C | 32.3 °C: 1.0% then 0.0% |
| Hanoi | Jun–Aug | 31.5 ± 2.3 °C | 32.2 ± 2.2 °C | 36.6 °C: 1.0% then 2.1% |
| Dhaka | Mar–May | 32.9 ± 3.3 °C | 32.3 ± 2.6 °C | 40.7 °C: 0.9% then 0.1% |
| Jakarta | Aug–Oct | 30.3 ± 1.3 °C | 31.5 ± 1.6 °C | 33.3 °C: 0.9% then 12.2% |
| Manila | Mar–May | 32.1 ± 1.9 °C | 32.0 ± 2.1 °C | 35.5 °C: 0.9% then 3.9% |
| Bogotá | Aug–Oct | 18.9 ± 1.5 °C | 19.5 ± 1.4 °C | 22.0 °C: 0.8% then 2.8% |
| Islamabad | May–Jul | 34.9 ± 4.4 °C | 34.4 ± 3.7 °C | 43.2 °C: 0.9% then 0.2% |
| Colombo | Feb–Apr | 31.0 ± 1.3 °C | 31.2 ± 1.5 °C | 34.3 °C: 0.9% then 2.8% |
| Brasília | Aug–Oct | 28.3 ± 2.7 °C | 28.7 ± 2.5 °C | 35.0 °C: 0.8% then 0.4% |
| Bangkok | Mar–May | 33.4 ± 2.1 °C | 33.8 ± 2.2 °C | 38.1 °C: 0.7% then 1.1% |
| Seoul | Jun–Aug | 27.2 ± 3.1 °C | 28.0 ± 2.9 °C | 34.3 °C: 0.9% then 1.3% |
| Kuala Lumpur | Feb–Apr | 30.2 ± 1.3 °C | 30.7 ± 1.7 °C | 33.5 °C: 0.9% then 6.8% |
| Taipei | Jun–Aug | 30.0 ± 1.8 °C | 31.1 ± 2.2 °C | 33.3 °C: 1.0% then 13.8% |
| Hong Kong | Jun–Aug | 29.2 ± 1.4 °C | 29.6 ± 1.6 °C | 32.3 °C: 0.9% then 3.8% |
| Tokyo | Jul–Sep | 27.1 ± 3.1 °C | 28.7 ± 3.6 °C | 33.4 °C: 0.8% then 8.3% |
| Nairobi | Jan–Mar | 25.1 ± 1.8 °C | 26.6 ± 1.9 °C | 29.1 °C: 1.0% then 8.8% |
| Washington | Jun–Aug | 29.3 ± 3.6 °C | 29.8 ± 3.7 °C | 36.9 °C: 0.9% then 1.7% |
| Ulaanbaatar | Jun–Aug | 20.8 ± 4.1 °C | 22.6 ± 4.6 °C | 29.5 °C: 1.0% then 6.2% |
| Santiago | Dec–Feb | 27.3 ± 2.4 °C | 28.1 ± 2.7 °C | 32.0 °C: 1.0% then 6.2% |
| Ottawa | Jun–Aug | 24.2 ± 4.0 °C | 24.8 ± 3.9 °C | 33.3 °C: 0.9% then 1.0% |
| London | Jun–Aug | 20.0 ± 2.9 °C | 21.3 ± 3.6 °C | 28.2 °C: 1.0% then 4.9% |
| Paris | Jun–Aug | 21.8 ± 3.6 °C | 23.9 ± 4.3 °C | 31.9 °C: 0.9% then 4.7% |
| Madrid | Jun–Aug | 28.9 ± 4.3 °C | 31.4 ± 4.4 °C | 36.7 °C: 0.8% then 8.5% |
| Berlin | Jun–Aug | 21.7 ± 3.7 °C | 23.6 ± 4.3 °C | 30.9 °C: 0.9% then 5.2% |
| Stockholm | Jun–Aug | 18.9 ± 3.0 °C | 20.3 ± 3.4 °C | 26.3 °C: 0.9% then 4.8% |
| Moscow | Jun–Aug | 21.1 ± 4.2 °C | 22.6 ± 4.4 °C | 30.8 °C: 1.0% then 2.8% |
| Istanbul | Jun–Aug | 25.9 ± 2.6 °C | 27.4 ± 3.0 °C | 31.5 °C: 0.9% then 6.1% |
| Baghdad | Jun–Aug | 43.1 ± 2.7 °C | 44.3 ± 2.8 °C | 49.3 °C: 1.0% then 3.1% |
| Riyadh | Jun–Aug | 40.9 ± 1.6 °C | 42.5 ± 1.6 °C | 44.3 °C: 0.9% then 13.1% |
| Tehran | Jun–Aug | 33.6 ± 2.8 °C | 35.3 ± 2.9 °C | 38.7 °C: 0.9% then 10.7% |
| Cairo | Jun–Aug | 36.3 ± 2.3 °C | 36.9 ± 2.4 °C | 42.7 °C: 0.9% then 1.4% |
| Marrakesh | Jul–Sep | 33.6 ± 4.1 °C | 35.2 ± 4.6 °C | 42.1 °C: 0.8% then 7.3% |
| Algiers | Jul–Sep | 29.7 ± 3.1 °C | 30.8 ± 3.3 °C | 37.5 °C: 0.9% then 3.0% |
| Tripoli | Jul–Sep | 30.6 ± 2.8 °C | 31.9 ± 3.1 °C | 38.3 °C: 1.0% then 3.7% |
| Abuja | Jan–Mar | 34.4 ± 1.6 °C | 35.1 ± 1.6 °C | 37.8 °C: 0.8% then 3.9% |
| Cape Town | Jan–Mar | 24.9 ± 3.1 °C | 25.3 ± 3.4 °C | 32.8 °C: 0.9% then 2.8% |
| Los Angeles | Jul–Sep | 31.3 ± 3.8 °C | 31.4 ± 3.6 °C | 40.5 °C: 0.9% then 0.8% |
| Seattle | Jul–Sep | 22.0 ± 4.3 °C | 22.8 ± 4.0 °C | 32.6 °C: 1.0% then 0.7% |
| Longyearbyen | Jun–Aug | 3.2 ± 2.1 °C | 6.7 ± 3.4 °C | 9.1 °C: 1.0% then 22.2% |
| Nuuk | Jun–Aug | 4.6 ± 2.6 °C | 10.2 ± 3.7 °C | 12.8 °C: 0.9% then 23.8% |
| Casey Station | Dec–Feb | −1.1 ± 2.4 °C | −0.6 ± 2.1 °C | 3.5 °C: 1.0% then 0.7% |
| Byrd Station | Dec–Feb | −15.3 ± 4.5 °C | −15.7 ± 4.4 °C | −6.0 °C: 0.9% then 0.8% |
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

  // Options: {city: "Beijing"} opens on another city; {xRange: [0, 55]} sets the
  // temperature axis, which a city with colder days slides down to fit them;
  // {firstYear: 1940} starts the record (and the baseline) earlier;
  // {showNumbers: true} shows the figures from the start.
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
