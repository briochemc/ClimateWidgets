# Week 10 (Energy) widgets for ClimateWidgets

Spec for new widgets in <https://github.com/briochemc/ClimateWidgets> (Observable Framework,
published at <https://briochemc.github.io/ClimateWidgets/>). Written 10 Nov 2026 for the CLIM1001
week 10 lessons, whose current HTML is in `CLIM1001/bp/html/week10/` (`L1-Energy-use-today.html`,
`L2-Reducing-our-energy-emissions.html`, `L3-The-clean-energy-transition.html`).

## Why

The lessons currently iframe third-party pages: the Open Electricity tracker and legacy explore app
(six embeds) and Our World in Data graphers (five). They work, but each shows more than the lesson
needs (the tracker stacks market-price and emissions panels under the generation chart and nothing
in its URL hides them; the explore app adds an emissions panel and a banner), they cannot be
pre-set to the view the text talks about (a fuel isolated, a region and period), and their look
and licensing vary. Own widgets fix that and match the house style of the existing ones.

## Conventions (same as the existing widgets)

- One folder per widget under `src/<name>/`: `index.md` (page with prose, sources and the embed
  snippet via `components/embed-snippet.js`), `embed.md` (chrome-less, reads `URLSearchParams` to
  preset the view), `widget.js` (a `create…Widget(options)` factory returning a DOM node with
  `.value` and `input` events, self-contained, no d3 unless needed), `data/` (committed JSON).
- Data refresh scripts in `scripts/` (Node `.mjs` or Python), never run by the site, with a header
  comment saying what they fetch and how to run them. Data that moves monthly (Open Electricity)
  should get a scheduled GitHub Action (monthly) that re-runs the script and commits.
- Style: the Hickman / climate-funds look (grey plate, bold title in the corner, quiet gridlines,
  dark pill buttons, sources in small type bottom right). 640 px column, shrinks to 320 px.
- Moodle embeds are plain `<iframe src="https://briochemc.github.io/ClimateWidgets/<name>/embed?…">`
  (no scripts run on Moodle), so every preset must be a URL parameter.
- Every figure that draws on Open Electricity data carries "Data: Open Electricity (The Superpower
  Institute), CC BY-NC 4.0" and a link, as their licence asks
  (<https://platform.openelectricity.org.au/license>; teaching use is explicitly fine).

## Data sources

- **Open Electricity API v4** (<https://docs.openelectricity.org.au>). Energy by fuel technology:
  `GET https://api.openelectricity.org.au/v4/data/network/NEM?metrics=energy&interval=1M&date_start=YYYY-MM-01&date_end=YYYY-MM-01&secondary_grouping=fueltech`,
  add `&primary_grouping=network_region` for the state regions (`NSW1 QLD1 SA1 TAS1 VIC1`); `WEM`
  is its own network. Anonymous "Community" access answered these calls on 10 Nov 2026 but only
  covers the last two years; a `.edu.au` email gets a free **Academic** key
  (<https://platform.openelectricity.org.au>) with the full history from Dec 1998, which the
  "all years" view needs. Date ranges per request are capped (about 10 years at monthly, 366 days
  at daily/weekly), so the script pages through them. Fuel-tech ids: `coal_black coal_brown
  gas_ccgt gas_ocgt gas_steam gas_recip gas_wcmg distillate hydro pumps wind solar_rooftop
  solar_utility bioenergy_biomass bioenergy_biogas battery_charging battery_discharging` (and
  `imports exports` per region). Shares are computed over positive generation, excluding pumps,
  battery charging and imports/exports, which is what the tracker's "% of gross demand" does
  within a percent or two. The old static JSON (`https://data.openelectricity.org.au/v3/stats/au/NEM/energy/all.json`)
  is stale (ends Nov 2024), do not use it.
- **AEMO 2026 Integrated System Plan** (final, 25 June 2026): PDF
  <https://aemo.com.au/-/media/files/major-publications/isp/2026/2026-integrated-system-plan-isp.pdf>
  (Figure 2, p. 14, "NEM annual generation (TWh, 2010 to 2050, Step Change)"; Figure 1, p. 13, the
  capacity version) and the "generation and storage outlook" workbooks on the ISP page
  <https://aemo.com.au/energy-systems/major-publications/integrated-system-plan-isp/2026-integrated-system-plan-isp>.
  Open Electricity's Scenario Explorer (<https://openelectricity.org.au/scenarios>) already plots
  these per technology and scenario (AEMO 2026 ISP Final, Step Change, CDP4 ODP, NEM) to FY50; its
  data feed can be read off the page's network requests if the AEMO workbook is awkward.
- **Our World in Data** CSV API, e.g.
  `https://ourworldindata.org/grapher/share-elec-by-source.csv?csvType=full&useColumnShortNames=true`
  (also `global-primary-energy-by-source`, `share-of-primary-energy-by-source`, `electricity-mix`,
  `co-emissions-by-sector`), CC BY 4.0.

## Widgets, in priority order

### 1. `nem-generation` — electricity generation by source in the NEM (needed)

Replaces six embeds: L1 "Where does Australia fit?" (tracker, NEM, last year, shares), L3 Wind
(tracker NEM and SA, last year, shares), L3 Hydroelectricity (explore NEM, last year, GWh), L3
Natural gas (explore NEM, all years, monthly, GWh, gas isolated) and the Coal paragraph's pointer
to it.

- Stacked area (or bars at monthly/weekly resolution) of generation by fuel technology, with the
  Open Electricity palette (solar yellow, wind green, hydro light blue, black coal black, brown
  coal dark brown, gas orange, distillate red, bioenergy teal, batteries blue, pumps/charging as
  negative or hidden).
- Controls: region (NEM, NSW, QLD, SA, TAS, VIC; WEM later), period (last year weekly, last five
  years monthly, all years monthly, all years yearly), measure (share of generation in %, or GWh),
  a legend whose entries toggle sources on and off, and a "Renewables" line overlay (share of
  solar + wind + hydro + bioenergy).
- Hover: the month/week, each source's value and share, renewables share.
- Optional simple/detailed grouping: simple = coal, gas, hydro, wind, solar, batteries, other.
- URL presets for `embed`: `?region=sa1&range=1y&measure=share&only=wind&renewables=1`
  (`only=` isolates one or more sources, comma-separated; `hide=` the opposite).
- Height target: about 480 px at 640 px wide.
- Data: `data/nem-generation.json`, monthly from Dec 1998 for NEM and each region, plus the last
  53 weeks weekly; script `scripts/nem-generation.mjs` with the Academic key read from an
  environment variable; monthly GitHub Action.

### 2. `isp-scenarios` — the NEM to 2050 under AEMO's ISP (needed)

Replaces the 2022 ISP screenshot at the end of L3 "What does the future hold?" (and is referred to
from the Solar and Wind sections).

- Stacked area of annual generation (TWh) by technology, FY2010 to FY2050, history in solid colour
  and projection hatched or lighter after the current year; a toggle to capacity (GW).
- Controls: scenario (Step Change as default, Progressive Change, Green Energy Exports, whatever
  the 2026 ISP calls them), generation/capacity, and a legend as in widget 1.
- Hover: the year, each technology's TWh and share, coal's remaining TWh (the lesson talks about
  coal retiring).
- URL presets: `?scenario=step-change&measure=generation`.
- Data: `data/isp-2026.json` from the AEMO workbook (script `scripts/isp-scenarios.py` or `.mjs`,
  run by hand when a new ISP comes out, every two years); cite "AEMO (2026), Integrated System
  Plan, Figure 2 / generation and storage outlook".

### 3. `energy-chain` — the light-bulb energy chain (nice to have)

Replaces the static course-made Sankey in L2 "The inefficiencies of the current system", generated
today by `CLIM1001/src/week10/ligthing_bulb_efficiency.py` (matplotlib Sankey).

- A left-to-right Sankey: 100 units of coal → generation loss 62 → transformer and line loss 2 →
  device → waste heat → light. Two buttons: incandescent (device draws 36, heat 34, light 2) and
  LED (device draws 6, heat 4, light 2, so 30 units of the delivered 36 are surplus, i.e. not
  needed). Animate the switch so the shrinking plug-side draw is the point.
- Optional slider for power-station efficiency (coal 33 % default, 45 % best coal, 60 % gas
  combined cycle) to show the chain's first link.
- Static numbers, no data script. Height about 360 px.

### 4. `energy-mix-world` — primary energy and electricity by source, world or a country (optional)

Only if a consistent look across the lessons is wanted; the OWID graphers do this already (L1 uses
`global-primary-energy-by-source` as shares since 1971, `share-elec-by-source` for the world,
`electricity-mix` for Australia as stacked shares, `co-emissions-by-sector` for Australia).

- Stacked shares by source, 1971 (or 1985) to the latest year, for primary energy or electricity,
  world or one country; same palette as widget 1 for the sources both have.
- URL presets: `?what=electricity&country=AUS&measure=share`.
- Data: OWID CSV API, script `scripts/energy-mix.mjs`, yearly refresh.

### 5. `energy-sankey` — the world's energy system as a Sankey (optional, larger)

Would replace the static IEA Energy Sankey capture in L1. The IEA tool itself cannot be framed
(`X-Frame-Options: SAMEORIGIN`). Data: IEA World Energy Balances Highlights (free xlsx behind a
login, <https://www.iea.org/data-and-statistics/data-product/world-energy-balances-highlights>),
one year, world (and Australia). Supply on the left, transformation in the middle (power and heat
plants, refineries), final consumption sectors on the right, with losses. Hover each flow for PJ
and share. Only worth it if the static capture proves a problem.

## Lesson-side changes once the widgets exist

Swap each `<iframe>` listed under widgets 1 and 2 for the ClimateWidgets `embed` URL with the
matching preset, keep the figure captions (adapt "hover over it" wording to the widget's controls),
and delete the Open Electricity screenshot comments. The L1 caption should keep a link to Open
Electricity for the live data. Heights: widget 1 about 500 px, widget 2 about 520 px, widget 3
about 380 px, at the lesson's 900 px column.
