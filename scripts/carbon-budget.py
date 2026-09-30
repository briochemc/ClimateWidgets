# Derives the carbon-budget widget's data file from the Global Carbon Budget 2025:
#
# Friedlingstein, P., O'Sullivan, M., Jones, M. W., et al. (2026). Global Carbon Budget 2025.
# Earth System Science Data, 18, 3211-3288. https://doi.org/10.5194/essd-18-3211-2026
#
# Three workbooks from https://globalcarbonbudget.org/datahub/the-latest-gcb-data-2025/:
#
# - Global Carbon Budget v2025, sheet "Historical Budget" (GtC/yr): fossil emissions
#   (excluding the cement carbonation sink), land-use change emissions, and the carbonation
#   sink. The total the paper uses for the budget is fossil plus land use minus carbonation,
#   stored here as the world's fossil (net of carbonation) and land use per year, in GtCO2 at
#   the paper's 3.664 GtCO2 per GtC. Summed over 1850-2024 that is 745.0 GtC, 2730 GtCO2
#   (Sect. 3.4).
# - National Fossil Carbon Emissions v2025, sheet "Territorial Emissions" (MtC/yr), for each
#   country's fossil emissions, with international shipping and aviation as two more
#   "countries", and its "Regions" sheet for which countries make up each continent. The
#   carbonation sink, which is global only, is shared out in proportion to fossil emissions.
# - National Land Use Change Carbon Emissions v2025 (MtC/yr), one sheet per bookkeeping model
#   (BLUE, OSCAR, LUCE): the GCB land-use figure is their mean, so a country's land use is the
#   mean of its three columns.
#
# The widget stacks the squares by region, and within a region by country, so the file gives
# every country's total (fossil plus land use) per year, grouped into the GCB's continents:
# Asia, Europe (which includes Russia), North America, South America, Africa and the Middle
# East, with Oceania, Central America and the Caribbean, and international transport gathered
# into "Rest of the world". Within a region, countries below MIN_COUNTRY GtCO2 over the whole
# period are merged into "Other <region>". A country's net total in a year is clamped at zero
# (land use can be a net sink), and every year's country totals are then scaled by a hair so
# that they sum to the world's total exactly: the scaling absorbs the clamping, the LUC file's
# unattributed "OTHER" and "DISPUTED" columns, and the fossil file's statistical difference,
# together about 0.1 % of the total.
#
# The workbooks stop at 2024. 2025 is the paper's projection (Sect. 3.1.4 and the executive
# summary): fossil 10.4 GtC (38.1 GtCO2) including the carbonation sink, land use 1.1 GtC
# (4.1 GtCO2), 42.2 GtCO2 in all. Its country split applies the paper's projected growth
# rates for fossil emissions (China +0.4 %, USA +2.5 %, India +1.1 %, EU27 -0.1 %, Japan
# -0.9 %, international aviation +6.7 %, shipping +2.0 %, everyone else +0.9 %) to 2024 and
# scales to the projected totals; land use keeps its 2024 shares.
#
# The remaining budgets, from the beginning of 2026 at 50 % likelihood, are the paper's
# (Sect. 4, last paragraph), entered by hand: its update of Forster et al. (2025), and its
# update of the IPCC AR6 budgets. (The paper's headline figure is the average of the two;
# the widget shows the two themselves.)
#
# Needs openpyxl, which the Julia project does not provide. From the repo root:
#   python3 -m venv .venv && .venv/bin/pip install openpyxl
#   .venv/bin/python scripts/carbon-budget.py <global.xlsx> <national-fossil.xlsx> <national-luc.xlsx>

import json
import sys

import openpyxl

OUT_PATH = "src/carbon-budget/data/carbon-budget.json"
GTC_TO_GTCO2 = 3.664
MTC_TO_GTCO2 = 3.664 / 1000
FIRST_YEAR = 1850
LAST_YEAR = 2024
MIN_COUNTRY = 1.0  # GtCO2 over 1850-2025; smaller countries are merged into "Other <region>"

PROJECTION_2025 = {"fossil": 38.1, "landUse": 4.1}
GROWTH_2025 = {"China": 0.004, "USA": 0.025, "India": 0.011, "Japan": -0.009,
               "International Aviation": 0.067, "International Shipping": 0.020}
GROWTH_2025_EU27 = -0.001
GROWTH_2025_OTHER = 0.009

# In stacking order. `lists` are the continents on the workbook's Regions sheet; the last
# region takes every country (and the two international transport columns) not in the others.
REGIONS = [
    {"id": "asia", "name": "Asia", "lists": ["Asia"]},
    {"id": "europe", "name": "Europe", "lists": ["Europe"], "note": "including Russia"},
    {"id": "namerica", "name": "North America", "lists": ["North America"]},
    {"id": "samerica", "name": "South America", "lists": ["South America"]},
    {"id": "africa", "name": "Africa", "lists": ["Africa"]},
    {"id": "mideast", "name": "Middle East", "lists": ["Middle East"]},
    {"id": "rest", "name": "Rest of the world", "lists": None,
     "note": "Oceania, Central America and the Caribbean, and international shipping and aviation"},
]
DISPLAY_NAMES = {"USA": "United States", "International Shipping": "International shipping", "International Aviation": "International aviation"}

BUDGETS = {
    "from": 2026,
    "likelihood": 0.5,
    "thresholds": [1.5, 1.7, 2.0],
    "estimates": [
        {
            "id": "forster",
            "name": "Forster et al. (2025), updated",
            "short": "Forster et al. 2025",
            "note": "Forster et al.'s 2025 revision of the IPCC budgets, less the emissions of 2025.",
            "GtCO2": [90, 450, 1010],
        },
        {
            "id": "ipcc",
            "name": "IPCC AR6 (2021), updated",
            "short": "IPCC AR6",
            "note": "The IPCC's 2021 budgets (Canadell et al., 2021), less the emissions of 2020 to 2025.",
            "GtCO2": [250, 600, 1100],
        },
    ],
}


def sheet_table(ws, is_header):
    """A sheet as {column name: {year: value}}, given a test for the header row."""
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if is_header(r))
    names = list(rows[hi])
    table = {}
    for r in rows[hi + 1:]:
        y = r[0]
        if isinstance(y, str) and y.isdigit():
            y = int(y)
        if not isinstance(y, (int, float)):
            continue
        for name, v in zip(names, r):
            if not name or name == names[0]:
                continue
            try:
                table.setdefault(name, {})[int(y)] = float(v)
            except (TypeError, ValueError):
                table.setdefault(name, {})[int(y)] = 0.0
    return table


def main(global_path, fossil_path, luc_path):
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))

    # The global budget, GtCO2/yr.
    ws = openpyxl.load_workbook(global_path, data_only=True, read_only=True)["Historical Budget"]
    glob = sheet_table(ws, lambda r: r and r[0] == "Year")
    fossil_gross = {y: glob["fossil emissions excluding carbonation"][y] * GTC_TO_GTCO2 for y in years}
    carbonation = {y: glob["cement carbonation sink"].get(y, 0.0) * GTC_TO_GTCO2 for y in years}
    land_use = {y: glob["land-use change emissions"][y] * GTC_TO_GTCO2 for y in years}
    fossil_net = {y: fossil_gross[y] - carbonation[y] for y in years}
    world = {y: fossil_net[y] + land_use[y] for y in years}

    # National fossil emissions and the continent lists.
    wb = openpyxl.load_workbook(fossil_path, data_only=True, read_only=True)
    nat = sheet_table(wb["Territorial Emissions"], lambda r: r and r[0] is None and "USA" in r)
    lists = {r[0]: [c.strip() for c in r[1].split(",")] for r in wb["Regions"].iter_rows(values_only=True) if r[0]}
    aggregates = set(lists) | {"World", "Statistical Difference"}
    all_countries = [c for c in nat if c not in aggregates]
    eu27 = set(lists["EU27"])
    for y in years:
        if abs(nat["World"][y] * MTC_TO_GTCO2 - fossil_gross[y]) > 0.02:
            raise ValueError(f"{y}: national World differs from the global fossil total")

    # National land use, mean of the three models.
    wb = openpyxl.load_workbook(luc_path, data_only=True, read_only=True)
    models = [sheet_table(wb[s], lambda r: r and r[0] and str(r[0]).startswith("unit")) for s in ["BLUE", "OSCAR", "LUCE"]]

    def fossil_of(c, y):
        return nat[c].get(y, 0.0) * MTC_TO_GTCO2 * fossil_net[y] / fossil_gross[y]

    def luc_of(c, y):
        if not all(c in m for m in models):
            return 0.0
        return sum(m[c].get(y, 0.0) for m in models) / len(models) * MTC_TO_GTCO2

    # Which region each country belongs to.
    region_of = {}
    for region in REGIONS:
        for name in region["lists"] or []:
            for c in lists[name]:
                region_of.setdefault(c, region["id"])
    rest_id = REGIONS[-1]["id"]
    for c in all_countries:
        region_of.setdefault(c, rest_id)

    # Every country's fossil and land use per year, the 2025 projection, then totals clamped
    # at zero and scaled to the world.
    fossil = {c: [fossil_of(c, y) for y in years] for c in all_countries}
    luc = {c: [luc_of(c, y) for y in years] for c in all_countries}
    for c in all_countries:
        g = GROWTH_2025.get(c, GROWTH_2025_EU27 if c in eu27 else GROWTH_2025_OTHER)
        fossil[c].append(fossil[c][-1] * (1 + g))
        luc[c].append(luc[c][-1])
    f_scale = PROJECTION_2025["fossil"] / sum(fossil[c][-1] for c in all_countries)
    l_scale = PROJECTION_2025["landUse"] / sum(luc[c][-1] for c in all_countries)
    for c in all_countries:
        fossil[c][-1] *= f_scale
        luc[c][-1] *= l_scale
    all_years = years + [LAST_YEAR + 1]
    world_totals = [world[y] for y in years] + [PROJECTION_2025["fossil"] + PROJECTION_2025["landUse"]]
    totals = {c: [max(0.0, f + l) for f, l in zip(fossil[c], luc[c])] for c in all_countries}
    scales = []
    for k in range(len(all_years)):
        s = sum(totals[c][k] for c in all_countries)
        scales.append(world_totals[k] / s)
        for c in all_countries:
            totals[c][k] *= scales[-1]
    print(f"country totals scaled to the world by {min(scales):.4f} to {max(scales):.4f}")

    # Regions: countries in descending order of their whole-period total, the small ones
    # merged into "Other <region>", which comes last.
    out_regions = []
    for region in REGIONS:
        members = [c for c in all_countries if region_of[c] == region["id"]]
        members.sort(key=lambda c: -sum(totals[c]))
        big = [c for c in members if sum(totals[c]) >= MIN_COUNTRY]
        small = [c for c in members if sum(totals[c]) < MIN_COUNTRY]
        countries = [{"name": DISPLAY_NAMES.get(c, c), "byYear": [round(v, 3) for v in totals[c]]} for c in big]
        if small:
            other = [sum(totals[c][k] for c in small) for k in range(len(all_years))]
            countries.append({"name": f"Other ({region['name']})", "members": len(small), "byYear": [round(v, 3) for v in other]})
        r_fossil = [sum(fossil[c][k] for c in members) for k in range(len(all_years))]
        r_luc = [sum(luc[c][k] for c in members) for k in range(len(all_years))]
        out_regions.append({
            **{k: v for k, v in region.items() if k != "lists"},
            "fossil": [round(v, 3) for v in r_fossil],
            "landUse": [round(v, 3) for v in r_luc],
            "countries": countries,
        })
        t = sum(sum(c["byYear"]) for c in countries)
        print(f"  {region['name']:>18}: {t:7.1f} GtCO2, {100 * t / sum(world_totals):4.1f}%, {len(big)} countries + {len(small)} small")

    out_years = [{"year": y, "fossil": round(fossil_net[y], 3), "landUse": round(land_use[y], 3)} for y in years]
    out_years.append({"year": LAST_YEAR + 1, **PROJECTION_2025, "projected": True})
    total = sum(e["fossil"] + e["landUse"] for e in out_years)
    print(f"{len(out_years)} years, {out_years[0]['year']}-{out_years[-1]['year']}, {total:.1f} GtCO2 in all")

    out = {
        "source": "Global Carbon Budget 2025 (Friedlingstein et al., 2026), https://doi.org/10.5194/essd-18-3211-2026",
        "units": "GtCO2 per year, 1850 to 2025; fossil includes the cement carbonation sink; a country's byYear is fossil plus land use",
        "budgets": BUDGETS,
        "years": out_years,
        "regions": out_regions,
    }
    with open(OUT_PATH, "w") as f:
        # One year, and one country, per line: readable, and a diff shows what a new edition changed.
        f.write("{\n")
        for k in ["source", "units", "budgets"]:
            f.write(f'  "{k}": {json.dumps(out[k], ensure_ascii=False)},\n')
        f.write('  "years": [\n' + ",\n".join("    " + json.dumps(e) for e in out_years) + "\n  ],\n")
        f.write('  "regions": [\n')
        for i, r in enumerate(out_regions):
            head = {k: v for k, v in r.items() if k != "countries"}
            f.write("    {" + ", ".join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in head.items()) + ',\n     "countries": [\n')
            f.write(",\n".join("      " + json.dumps(c, ensure_ascii=False) for c in r["countries"]))
            f.write("\n     ]}" + ("," if i < len(out_regions) - 1 else "") + "\n")
        f.write("  ]\n}\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("usage: carbon-budget.py <Global_Carbon_Budget.xlsx> <National_Fossil_Carbon_Emissions.xlsx> <National_LandUseChange_Carbon_Emissions.xlsx>")
    main(*sys.argv[1:])
