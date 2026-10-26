# Paying into the climate funds

Who has paid what into the UNFCCC's climate funds. Every country that has paid anything is a bar, ranked from the top, in segments coloured by fund: the Green Climate Fund, the Global Environment Facility, the two small funds the GEF runs for the least developed countries and for adaptation, the Adaptation Fund, and the new Fund for responding to Loss and Damage. Switch between the dollars **in all**, the dollars **per person**, the money as a **share of GDP** over the same years, and as a **share of GDP since 1850**; click a fund in the key to see it alone (hovering an entry names the fund in full) and **All** for the six together, and a bar for its breakdown by fund (the arrow keys then walk the ranking).

```js
import {createClimateFundsWidget} from "./widget.js";

const data = await FileAttachment("./data/climate-funds.json").json();
```

```js
const funds = view(createClimateFundsWidget({data}));
```

The money is what the funds' trustee, the World Bank, has actually received since July 2011, when its open record of receipts begins, not what was pledged; by one count the Green Climate Fund alone has had another ten billion dollars promised that has not yet arrived. **Per person** divides by today's population. **Share of GDP** divides fifteen years of payments by fifteen years of GDP, summed over the same calendar years, so the two sides of the fraction cover the same period; a single year's GDP would make the small, slow-growing economies look more generous than they are. **Share of GDP since 1850** divides the same payments by everything the country has produced since 1850, the year the [CO₂ widgets](../co2-per-capita-bars/) count emissions from, so that what a country pays can be set against the wealth its emissions bought it; the GDP here is the Maddison Project's, in dollars of 2011, so the figure is a ratio of today's dollars to inflation-adjusted ones and only the ranking should be read, and a country whose record begins later (most of the smaller ones, in 1950) is summed from where it begins, which flatters it. The grey bar in the dollar view, **EU and other donors**, is the European Union, two development banks, the UNFCCC secretariat, the Adaptation Fund's sale of carbon credits, private donors, and a billion dollars of receipts the record does not attribute to anyone; it has no people or GDP, so it leaves with the other two views.

## What to look for

**Four countries, more than half the money.** Germany, Japan, France and the United States have paid in about 19 of the 35 billion dollars. The United States' two billion for the Green Climate Fund came in three lumps, in the fiscal years 2016, 2017 and 2023; its yearly 150 million or so to the GEF stopped after 2024, and nothing has arrived from it since mid-2025.

**Per person, the Nordics.** Sweden has paid about $230 a head and Norway $210, against Germany's $73, Japan's $37 and the United States' $12. Monaco and Luxembourg are up there too, on much smaller sums.

**As a share of income, the ranking barely moves.** Sweden has given about 0.028% of fifteen years of GDP, Norway 0.016%, and the United States 0.0013%; for scale, the long-standing aid target is 0.7% of national income a year. Australia ranks 17th by the dollars and in the twenties by the other two: $450 million, $16 a person, 0.002% of GDP.

**Against the wealth of 175 years, the old industrial economies drop.** Switch to the share of GDP since 1850: Sweden and the Nordics stay at the top, but the United States falls to 24th, below Spain and Australia, and Japan to 15th; Germany, France and the United Kingdom slip too. Luxembourg comes first only because its record begins in 1950.

**The funds are not the same shape.** Click the GEF: its donors include China, India, Brazil, Mexico and South Africa, which pay into it as members, since it funds biodiversity and chemicals as well as climate. Click the Loss and Damage fund: 23 countries and some 400 million dollars so far, Germany, France and Spain at the top.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "climate-funds/embed",
  height: 1060,
  title: "Paying into the climate funds",
  note: "The figure is about 1,000&nbsp;px tall whatever the width, one row per donor, and fills the frame up to 720&nbsp;px wide; " +
    "allow about 1,100&nbsp;px of height at phone width, where the controls wrap. The embed page accepts <code>?measure=perCapita</code>, " +
    "<code>?measure=gdp</code> or <code>?measure=gdp1850</code> to open on that measure, and <code>?fund=gcf</code> (or gef, ldcf, sccf, af, frld) to open on one fund.",
  script: `<div id="climate-funds"></div>

<script type="module">
  import {createClimateFundsWidget}
    from "${cdnUrl("climate-funds/widget.js")}";

  const data = await fetch("${cdnUrl("climate-funds/data/climate-funds.json")}")
    .then(r => r.json());

  // Options: {measure: "perCapita"}, {measure: "gdp"} or {measure: "gdp1850"} opens on that measure, {fund: "gcf"} on one fund.
  document.getElementById("climate-funds")
    .appendChild(createClimateFundsWidget({data}));
<\/script>`
}));
```

---

Data: the World Bank's [Contributions (Receipts) to Trust Funds](https://financesone.worldbank.org/api-explorer?id=DS00073) (Finances One dataset DS00073, CC BY 4.0), the cash each donor paid into each fund in each World Bank fiscal year (July to June) from FY2012 on, in US dollars at the exchange rate of the day, refreshed quarterly; the World Bank's [World Development Indicators](https://data.worldbank.org/) for population and GDP in current US dollars; and, for GDP since 1850, the [Maddison Project Database](https://www.rug.nl/ggdc/historicaldevelopment/maddison/) as carried in [Our World in Data's CO₂ dataset](https://github.com/owid/co2-data), the file the CO₂-per-capita widgets are built from, with the gaps in its early decades interpolated and its last years, which end in 2022, carried forward (Monaco and Liechtenstein have no such record and sit out that view). The World Bank is trustee of all six funds, so one record covers them all; the Global Environment Facility's trust fund is counted whole, though only part of its work is climate. Fifty-six countries have paid in. Pledges, and what each round of the Green Climate Fund's fundraising brought in, are in the Fund's own [Status of Pledges](https://www.greenclimate.fund/document/status-pledges-all-cycles) document, a PDF; [Climate Funds Update](https://climatefundsupdate.org/data-dashboard/) tabulates pledges and deposits for these and twenty more funds. Colours are Okabe and Ito's. The data file is refreshed by `scripts/climate-funds.mjs`.
