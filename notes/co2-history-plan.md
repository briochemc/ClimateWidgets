# CO₂ history widget — data inventory and plan

*Written 2026-09-30. Status: data inventory done (every URL below returned 200 and its header was read), the three open decisions agreed and the whole plan built the same day: `scripts/co2-history.mjs` (678 kB JSON, 174 kB gzipped; the Bereiter composite is labelled by core by matching rows to the per-core files, 2 of 1,901 fall back to the age table; Siple Station's 34 samples are typed into the script because they only exist inside an ESS-DIVE tarball), `src/co2-history/` with a canvas widget, and the pages. Choices made on the way: the widget is canvas, not SVG (thousands of dots, a 41-point curve animated per frame); records fade in and out over bands of look-back span in log space rather than switching; the tour hovers nothing (the cursor is the tour's during the sweep, a click takes over); the Mauna Loa weekly and monthly files are refetched live from NOAA by the page and the embed snippet (`updateMaunaLoa`); the homepage thumbnail is a blank placeholder until `npm run thumbnails` is run. Split the same afternoon, on seeing it in the browser, into two widgets: `co2-history` keeps the timeline, slider, presets and a tour that only zooms out; `co2-latitude` (new) has the latitude panel, a larger map, the month clock and the Mauna Loa and South Pole records since 1957 as a fixed lower chart with a scrubber, and Play sweeps the months at two years a second. The script writes one JSON per widget (142 kB and 549 kB). The latitude widget opens on, and Play ends at, the last month with the reference and at least ten stations, because the flask means run about a year behind Mauna Loa. Thumbnails are still placeholders.*

## Concept and acknowledgement

Zoom in and out in time over the record of atmospheric CO₂, from 800,000 years of ice cores down to the weekly cycle at Mauna Loa, after Andy Jacobson's NOAA GML animation [History of atmospheric carbon dioxide](https://gml.noaa.gov/ccgg/trends/history.html) (video: `https://gml.noaa.gov/aftp/products/movies/pumphandle_latest.mp4`, April 2026 edition). **The widget page must say it is inspired by that animation, credit Andy Jacobson (NOAA GML) and link the history page.**

What the video does, in order (168 s):

1. **1979–2025, latitude panel.** CO₂ against latitude (90°S–90°N), one frame per week: GLOBALVIEW+ sites as dots (Mauna Loa red, South Pole blue, "background conditions" filled and joined by a line, "local signals" open and scattered above), a small world map with the same sites, the year, and a clock face for the month. The January 1979 profile stays behind as a ghost ("Jan 1979: 336 ppm").
2. **Beside it, a time series** of Mauna Loa (red) and South Pole (blue) that grows with the animation, with a callout "Oct 1989: Mauna Loa sees 350 ppm for the last time".
3. **Zoom out in time**, the axis rescaling continuously: Keeling's Mauna Loa record back to 1958 (green), then Law Dome (orange, with age and CO₂ error bars) and Siple Station (brown) back to 1 CE, with "Preindustrial: about 278 ppm".
4. **Further out**: 8000 yBCE, 150 kyBCE (Vostok, purple), 400 and 800 kyBCE (EPICA Dome C, dark blue), with "Ice ages: about 185 ppm". The modern rise ends as a vertical line.
5. Credits: logo pages for the GLOBALVIEW+ labs.

NOAA publishes no file of the data behind the video.

## Data inventory

Base paths: NOAA trends `https://gml.noaa.gov/webdata/ccgg/trends/co2/`; Scripps `https://keelinglabsites.ucsd.edu/websitedataco2/`; NCEI ice cores `https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/`.

### Instrumental era

| Dataset | File(s) | Span and resolution | Scale | Licence, citation |
|---|---|---|---|---|
| **GLOBALVIEW+ ObsPack v11.0** (the video's source) | `https://gml.noaa.gov/ccgg/obspack/data.php`, behind a registration form; NetCDF 833 MB | 1957–2025, 80 labs, every site, tower and aircraft | X2019 | doi:10.25925/20250801. **May not be redistributed**, so it cannot be bundled |
| **NOAA MBL reference**, the closest open stand-in for the video's "background" line | two-step: `https://gml.noaa.gov/ccgg/mbl/ghg.php?hidden=true&param=CO2&reference_type=surface&reference=global&startyear=1979&startmonth=1&endyear=2025&endmonth=12` returns HTML linking to a temporary `tmp/co2_GHGreference.<id>_surface.txt` | 1979-01 to 2026-01, 48 steps a year, **41 sine-latitude bins** from −1 to +1; 2.4 MB | X2019 | CC0; doi:10.15138/DVNP-F961 |
| NOAA flask network, per site | `https://gml.noaa.gov/aftp/data/trace_gases/co2/flask/surface/co2_surface-flask_ccgg_text.tar.gz` (6.3 MB), monthly files `co2_<site>_surface-flask_1_ccgg_month.txt` | about 95 sites, monthly; NWR and STC from 1968, MLO 1969, BRW 1971, SMO 1973, SPO 1975 | X2019 | CC0; doi:10.15138/wkgj-f215 |
| NOAA global mean | `co2_mm_gl.txt` | 1979-01 to 2026-06, monthly, with trend | X2019 | CC0; Lan, Tans & Thoning, doi:10.15138/9N0H-ZH07 |
| NOAA Mauna Loa | `co2_mm_mlo.txt` (monthly from 1958-03; Scripps values before April 1974), `co2_weekly_mlo.txt`, `co2_daily_mlo.txt` (from May 1974) | to 2026-08 | X2019 | CC0 |
| **Scripps (Keeling) Mauna Loa** | `monthly_in_situ_co2_mlo.csv`, `weekly_…`, `daily_…` | from 1958-03 | SIO12 | CC BY 4.0; Keeling et al. 2001, SIO Reference Series 01-06 |
| Scripps flask stations | `monthly_merge_co2_{spo,ljo,ptb}.csv`, `monthly_flask_co2_{alt,kum,fan,chr,sam,ker,nzd,stp,bcs}.csv` | South Pole from 1957, La Jolla and Station P from 1969, Fanning 1972, Point Barrow 1974, Christmas Island 1974, NZ 1977; several end 2020–21 | SIO12 | CC BY 4.0 |
| Cape Grim (CSIRO), optional | `https://capegrim.csiro.au/GreenhouseGas/data/CapeGrim_CO2_data_download.csv` | monthly baseline 1976-05 to 2026-08 | | no commercial use; its terms must travel with any copy |

NOAA's X2019 and Scripps's SIO12 scales differ by well under 1 ppm, invisible at this scale.

### Ice cores (always gas age, not ice age)

| Record | File | Span, rows | Age scale | Citation |
|---|---|---|---|---|
| **Law Dome**, MacFarling Meure 2006 | `law/law2006.txt` (Latin-1, several sections: 20-year spline for 1–2004 CE annual, individual samples, Cape Grim archive air) | 1–2004 CE | CE | MacFarling Meure et al., GRL 33 (2006) |
| **Law Dome**, Rubino 2019 ESSD (supersedes Rubino 2013) | `law/law2018co2.txt` (322 samples with 1σ), `law/law2018splines.txt` | 154–1996 CE | CE | doi:10.5194/essd-11-473-2019. The CSIRO copy's licence is ambiguous, so use NCEI's |
| Law Dome, Rubino 2013 | only as the subset `antarctica2015co2lawsp.txt` inside the Bereiter set | −51 to 1,796 yr BP | BP 1950 | Rubino et al., JGR 118 (2013) |
| **Siple Station**, Neftel 1985 and Friedli 1986 | ESS-DIVE (ex-CDIAC) `trends.tar.gz` → `trends/co2/siple2.013` | 12 and 22 rows; air-age ranges 1734–1983 | CE | CC BY 4.0; doi:10.3334/CDIAC/ATG.010. NCEI's `siple/` folder is Siple *Dome*, a different core |
| **Vostok**, Petit 1999 | `vostok/co2nat.txt` | 283 rows, 2.3–414 kyr BP | GT4 | Petit et al., Nature 399 (1999) |
| **EPICA Dome C**, Lüthi 2008 composite | `epica_domec/edc-co2-2008.txt` (section 3) | 1,096 rows, 0.1–799 kyr BP | EDC3 | Lüthi et al., Nature 453 (2008), with Siegenthaler et al., Science 310 (2005) |
| EPICA Dome C, Siegenthaler 2005 | `epica_domec/edc-co2-650k-390k.txt` | about 350 rows, 390–650 kyr BP | EDC2 | |
| **Bereiter 2015 composite**, the current standard | `antarctica2015co2composite.txt`, and one file per core `antarctica2015co2*.txt` | 1,901 rows, −51 to 805,669 yr BP, with 1σ | AICC2012 (except Law Dome, WAIS, Siple Dome) | doi:10.25921/n8y4-bp27. Fixes the up-to-10 ppm bias in Lüthi's oldest section |
| Köhler 2017 spline (not on the original list) | `https://doi.pangaea.de/10.1594/PANGAEA.876013?format=textfile` | annual, −66 to 156 kyr BP (5 MB; downsample) | | CC BY 3.0 |
| WAIS Divide, Bauska 2021 (not on the list) | `wais2021co2.txt` | 661 rows, 0–67 kyr | WD2014 | best resolution for 20–67 kyr |

Already inside the Bereiter composite, and not needed separately: EDML, Talos Dome, Siple Dome, WAIS (Marcott 2014). Superseded: Taylor Dome, Dome Fuji, Byrd.

Constructed rather than measured, so kept as a fallback only: the CMIP7 historical concentrations (Nicholls et al. 2025), monthly in 15° latitude bands from 1 CE.

### Gotchas

- Everything is a direct download except ObsPack (form, no redistribution) and the MBL reference (a temporary file behind one GET, so script it once and commit the output).
- The older NCEI text files are Latin-1; the Cape Grim CSV has CRLF line endings; Scripps marks missing values as −99.99 or NaN.
- BP means years before 1950, and negative BP is after 1950. The video's axis is in years before the common era (yBCE, kyBCE).
- NOAA's GML-wide CC0 statement is not repeated inside the trends text files, which carry only a "fair use" note.
- Samples of every file are in the session scratchpad (`co2-data/`), not in the repo.

## Decisions (agreed 2026-09-30)

1. **Latitude panel:** the MBL surface product (CC0, 41 sine-latitude bins) for the "background" line, NOAA flask sites as dots. The ObsPack cloud of "local signals" is dropped (not redistributable); ask Andy Jacobson later if it is missed. Before 1979 the Scripps flask stations give a sparse profile.
2. **Ice cores:** the Bereiter 2015 per-core files, coloured by core, plus Law Dome (Rubino 2019 samples with error bars) and Siple Station. Bereiter 2015 joins the citations.
3. **Zoom:** a "look back" control anchored at the present, logarithmic from 1 year to 800,000 years, plus a Play tour that replays the video: the latitude animation over 1979–now, then the zoom-out with its callouts.

## Plan

Widget folder `src/co2-history/`, the usual four files (`widget.js`, `index.md`, `embed.md`, `data/`), plus `scripts/co2-history.mjs`.

### Data (`scripts/co2-history.mjs`, Node, no dependencies, never run by the site)

Downloads every source, parses it, and writes one `src/co2-history/data/co2-history.json` (target under 700 KB raw, about a fifth of that gzipped). Values stored as integers in hundredths of ppm; times as decimal years CE (ice-core ages converted from BP with 1950 as the zero). Contents:

- `mlo`: Mauna Loa monthly, Scripps 1958–1974 then NOAA (the NOAA monthly file already splices Scripps in before April 1974, so it alone will do), and NOAA weekly from May 1974.
- `spo`: South Pole monthly, Scripps 1957–2021 then NOAA flask.
- `global`: NOAA global monthly mean, 1979–, for the read-out.
- `mbl`: the surface reference at 24 steps a year (every second step of the 48), 41 bins, 1979–2026.
- `sites`: NOAA flask sites (code, name, lat, lon, first and last year, monthly values) and the Scripps stations, each tagged with its source. Only sites with at least five years of data.
- `lawDome`: Rubino 2019 samples (gas age CE, ppm, 1σ) and the 20-year spline; `siple`: the 34 Neftel/Friedli samples; `cores`: the Bereiter 2015 per-core records (core, age CE, ppm, 1σ), which include Vostok and Dome C.
- `land`: an equirectangular land-outline SVG path string baked from `src/data/countries-110m.json` at script time, so the widget's inset map needs no d3 or topojson at runtime.
- `meta`: download date, latest data month, and the source list with DOIs, so the page's source paragraph and the widget agree.

### Widget (`widget.js`, self-contained SVG, no runtime dependencies)

Fills its column up to 640 px and reflows to 320 px with the usual ResizeObserver; panels stack vertically, so the embed height is fixed.

1. **Main chart, CO₂ (ppm) against time.** The window always ends at the latest data point; its length is set by the **look-back slider** below it (logarithmic, 1 year to 800,000 years) and by preset buttons that match the video's stops: *5 years, since 1958, since 1750, 2,000 years, 10,000 years, 800,000 years*. The axis labels follow the window: months, years CE, then thousands of years ago. The y axis fits the visible data with a little padding, animated. Series appear as the window admits them: NOAA weekly Mauna Loa within 10 years, monthly Mauna Loa (red) and South Pole (blue) otherwise, then Law Dome (orange) and Siple (brown) as dots with age and CO₂ error bars, then the Bereiter cores as dots joined by thin lines, one colour per core. In the widest windows the modern record collapses into a vertical line, which is the point. Callouts as in the video: *Preindustrial: about 278 ppm*, *Ice ages: about 185 ppm*, *Jan 1979: 336 ppm* and the latest month's value, plus *Oct 1989: Mauna Loa sees 350 ppm for the last time*. A legend lists only the sources currently on screen. Hovering gives a date cursor and a read-out of the nearest values.
2. **Latitude panel** under the chart: CO₂ against sine latitude (ticks 90°S, 30°S, Equator, 30°N, 90°N, like the video), showing the MBL profile at the date under the cursor, the flask sites as dots at their latitude (Mauna Loa red, South Pole blue, the rest grey), a ghost of the January 1979 profile, the date and a small month clock, and an inset map with the sites lit up. Before 1979 there is no MBL curve, only the Scripps dots; before 1957 the panel says so and goes quiet.
3. **Play tour**: the same button and manners as the blackbody and composition widgets (respects `prefers-reduced-motion`, any click takes over). It scrubs the latitude panel from January 1979 to the latest month while the main chart's window grows from 5 years, then walks the look-back slider out through the presets, pausing at each callout, and ends at 800,000 years.
4. **Live update**, optional and page-side, like the SST widget: the page fetches NOAA's weekly Mauna Loa file (CORS is open) and appends anything newer than the bundled data before handing it to the widget; the embed script does the same; failure falls back silently to the bundled data.

### Pages

`index.md` with the prose, a sources section listing every dataset with its citation and DOI, and the acknowledgement of Andy Jacobson's animation; `embed.md`; a sidebar entry in `observablehq.config.js`; a homepage card and thumbnail; a line in the README's widget list.

### Order of work

1. Data script and JSON, checked by row counts and a few spot values against the source files.
2. Main chart with slider, presets and hover.
3. Latitude panel, map and clock.
4. Play tour.
5. Pages, embed, live update, thumbnail; `npm run build` after each step, the visual check is the user's.
