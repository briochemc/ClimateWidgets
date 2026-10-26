# Paying into the climate funds

Who has pledged what to the UNFCCC's climate funds, and who has paid. Every country that has paid anything is a bar, ranked from the top, in segments coloured by fund: the Green Climate Fund, the Global Environment Facility, the two small funds the GEF runs for the least developed countries and for adaptation, the Adaptation Fund, and the new Fund for responding to Loss and Damage. Switch between what was **received** and what was **pledged**; between the dollars **in all**, the dollars **per person**, the money as a **share of GDP** over the years the receipts cover, and as a **share of GDP since 1850**; click a fund in the key to see it alone (hovering an entry names the fund in full) and **All** for the funds together, and a bar for its breakdown by fund (the arrow keys then walk the ranking).

```js
import {createClimateFundsWidget} from "./widget.js";

const data = await FileAttachment("./data/climate-funds.json").json();
```

```js
const funds = view(createClimateFundsWidget({data}));
```

The figures come from each fund's own report where it publishes one donor by donor. For the Green Climate Fund that is its Status of Pledges: each country's pledge, and the cash it has paid plus the promissory notes it has deposited, in US dollars at the fixed reference exchange rate of each fundraising round, as the Fund itself reports them. For the Adaptation Fund and the Loss and Damage fund it is the World Bank's quarterly trustee report: pledges, and cash received plus notes deposited, in US dollars. The GEF, the LDCF and the SCCF publish their donor tables only as pictures, so for them the money is what the World Bank, trustee of all six, records as received since July 2011, cash and notes encashed at the exchange rate of the day; they have no pledge figures, so the **pledged** view shows the other three funds only, and their entries in the key are faded. **Per person** divides by today's population. **Share of GDP** divides the money by GDP summed over 2011 to 2025, so that both sides of the fraction cover the same years; a single year's GDP would make the small, slow-growing economies look more generous than they are. **Share of GDP since 1850** divides the same money by everything the country has produced since 1850, the year the [CO₂ widgets](../co2-per-capita-bars/) count emissions from, so that what a country pays can be set against the wealth its emissions bought it; the GDP here is the Maddison Project's, in dollars of 2011, so the figure is a ratio of today's dollars to inflation-adjusted ones and only the ranking should be read, and a country whose record begins later (most of the smaller ones, in 1950) is summed from where it begins, which flatters it. The grey bar in the dollar view, **EU and other donors**, is the European Union, the UNFCCC secretariat, a development bank, private donors, and some four hundred million dollars of receipts the World Bank's record does not attribute to anyone; it has no people or GDP, so it leaves with the other views.

## What to look for

**Four countries, more than half the money.** Germany, Japan, the United Kingdom and France have paid in about 22 of the 41 billion dollars. The United States is fifth at 4.2 billion: two billion to the Green Climate Fund in three lumps, in the fiscal years 2016, 2017 and 2023, and its yearly instalments to the GEF, which stopped after 2024.

**Pledged against received.** Switch to **Pledged**: the Green Climate Fund has been promised 30 billion dollars and has received 25, with Germany, France and the United Kingdom still paying in their latest round. The Loss and Damage fund, set up at COP28, has pledges of 820 million dollars and has received 450; Italy and the United Arab Emirates have promised 100 million each and paid nothing and 15 million.

**Per person, the Nordics.** Sweden has paid about $310 a head and Norway $225, against Germany's $82, Japan's $44 and the United States' $12. Monaco and Luxembourg are up there too, on much smaller sums.

**As a share of income, the ranking barely moves.** Sweden has given about 0.039% of fifteen years of GDP, Norway 0.018%, and the United States 0.0013%; for scale, the long-standing aid target is 0.7% of national income a year. Australia ranks 17th by the dollars and in the twenties by the other measures: $480 million, $17 a person, 0.002% of GDP.

**Against the wealth of 175 years, the old industrial economies drop.** Switch to the share of GDP since 1850: Sweden and the Nordics stay at the top, but the United States falls to 25th, below Spain and Australia, and Japan to 13th; Germany, France and the United Kingdom slip too. Luxembourg comes second only because its record begins in 1950.

**The funds are not the same shape.** Click the GEF: its donors include China, India, Brazil, Mexico and South Africa, which pay into it as members, since it funds biodiversity and chemicals as well as climate. Click the Loss and Damage fund: 24 countries and 450 million dollars so far, Germany, the United Kingdom and France at the top.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "climate-funds/embed",
  height: 1180,
  title: "Paying into the climate funds",
  note: "The figure is about 1,160&nbsp;px tall whatever the width, one row per donor, and fills the frame up to 640&nbsp;px wide; " +
    "allow about 1,240&nbsp;px of height at phone width, where the buttons wrap. The embed page accepts <code>?basis=pledged</code> " +
    "to open on pledges, <code>?measure=perCapita</code>, <code>?measure=gdp</code> or <code>?measure=gdp1850</code> to open on that measure, " +
    "and <code>?fund=gcf</code> (or gef, ldcf, sccf, af, frld) to open on one fund.",
  script: `<div id="climate-funds"></div>

<script type="module">
  import {createClimateFundsWidget}
    from "${cdnUrl("climate-funds/widget.js")}";

  const data = await fetch("${cdnUrl("climate-funds/data/climate-funds.json")}")
    .then(r => r.json());

  // Options: {basis: "pledged"} opens on pledges; {measure: "perCapita"}, {measure: "gdp"} or {measure: "gdp1850"}
  // on that measure; {fund: "gcf"} on one fund.
  document.getElementById("climate-funds")
    .appendChild(createClimateFundsWidget({data}));
<\/script>`
}));
```

---

Data: the Green Climate Fund's [Status of Pledges](https://www.greenclimate.fund/document/status-pledges-all-cycles), a PDF the Fund refreshes every month or two; the World Bank trustee's quarterly reports for the [Adaptation Fund](https://fiftrustee.worldbank.org/en/about/unit/pim/fiftrustee/reports?fundName=ADAPT&folderName=Trustee%20Reports) and the [Fund for responding to Loss and Damage](https://fiftrustee.worldbank.org/en/about/unit/pim/fiftrustee/reports?fundName=FRLD&folderName=Trustee%20Reports), also PDFs; the World Bank's [Contributions (Receipts) to Trust Funds](https://financesone.worldbank.org/api-explorer?id=DS00073) (Finances One dataset DS00073, CC BY 4.0) for the GEF, LDCF and SCCF, the cash each donor paid into each fund in each World Bank fiscal year from FY2012 on, refreshed quarterly; the World Bank's [World Development Indicators](https://data.worldbank.org/) for population and GDP in current US dollars; and, for GDP since 1850, the [Maddison Project Database](https://www.rug.nl/ggdc/historicaldevelopment/maddison/) as carried in [Our World in Data's CO₂ dataset](https://github.com/owid/co2-data), the file the CO₂-per-capita widgets are built from, with the gaps in its early decades interpolated and its last years, which end in 2022, carried forward (Monaco and Liechtenstein have no such record and sit out that view). The sources are linked, with their dates, under the figure. The three reports and the World Bank's record count differently: a promissory note counts for the funds when it is deposited and for the World Bank when it is cashed, and the Green Climate Fund's dollars are at the reference rates of 2014, 2019 and 2023 rather than the rates of the day, which is why its totals are a little higher than a cash count would give. The Global Environment Facility's trust fund is counted whole, though only part of its work is climate. Fifty-seven countries have paid in. [Climate Funds Update](https://climatefundsupdate.org/data-dashboard/) tabulates pledges and deposits for these and twenty more funds. Colours are Okabe and Ito's. The data file is refreshed by `scripts/climate-funds.mjs`, which finds the newest report of each fund and needs poppler's `pdftotext`.
