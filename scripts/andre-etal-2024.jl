# Derives the country and global shares behind Figure 1 of Andre, Boneva, Chopra & Falk
# (2024), "Globally representative evidence on the actual and perceived support for
# climate action", Nature Climate Change 14, 253-259 — from the Global Climate Change
# Survey microdata (125 countries, 129,902 respondents).
#
# Data: IZA Dataverse, https://doi.org/10.15185/gccs.1 (Country_data.zip, openly
# downloadable, no registration). Aggregation matches the paper's own replication code
# (code/cleaning/merge_world.R in Replication.zip on the same DOI): each country's share
# is weighted by the within-country weight `wgt`; global shares are weighted by
# `wgt_pop15`, which additionally reweights countries to be population-representative.
#
# Run from the repo root: julia --project=. scripts/andre-etal-2024.jl

using ZipFile, ReadStatTables, Tables, CSV

const ZIP_URL = "https://dataverse.iza.org/api/access/datafile/234"
const OUT_PATH = "src/andre-etal-2024/data/andre-etal-2024.csv"

function wmean(vals, wts)
    s = 0.0
    w = 0.0
    for (v, wt) in zip(vals, wts)
        if !ismissing(v)
            s += v * wt
            w += wt
        end
    end
    w > 0 ? s / w : missing
end

pct(x) = ismissing(x) ? missing : round(100x, digits=2)

tmp = mktempdir()
zip_path = joinpath(tmp, "Country_data.zip")
println("Downloading $ZIP_URL ...")
download(ZIP_URL, zip_path)

dta_path = joinpath(tmp, "gccs_data.dta")
zr = ZipFile.Reader(zip_path)
for f in zr.files
    endswith(f.name, "gccs_data.dta") && write(dta_path, read(f))
end
close(zr)

rows = collect(Tables.rows(readstat(dta_path)))
println("Loaded $(length(rows)) respondents")

by_country = Dict{String,Vector}()
for row in rows
    push!(get!(by_country, row.iso3, []), row)
end

records = NamedTuple[]
for iso3 in sort(collect(keys(by_country)))
    rs = by_country[iso3]
    wgt = [r.wgt for r in rs]
    wtp = wmean([r.wtp_1 for r in rs], wgt)
    if iso3 == "MNG"
        # The paper's own cleaning code overrides Mongolia's raw wtp_1 share, which
        # disagreed with the country's reported wtp_pos, with this adjustment.
        wtp_pos = wmean([r.wtp_pos for r in rs], wgt)
        wtp = 1 - 0.06 - (1 - wtp_pos)
    end
    push!(records, (
        iso3=iso3, country=String(rs[1].country), n=length(rs),
        wtp=pct(wtp),
        norm=pct(wmean([r.norm for r in rs], wgt)),
        government=pct(wmean([r.government for r in rs], wgt)),
    ))
end

# Global row: population-weighted across all respondents, not just the mean of country
# shares, so a populous country with strong opinions moves the world figure more.
wgt_pop15 = [r.wgt_pop15 for r in rows]
push!(records, (
    iso3="WLD", country="World", n=length(rows),
    wtp=pct(wmean([r.wtp_1 for r in rows], wgt_pop15)),
    norm=pct(wmean([r.norm for r in rows], wgt_pop15)),
    government=pct(wmean([r.government for r in rows], wgt_pop15)),
))

mkpath(dirname(OUT_PATH))
CSV.write(OUT_PATH, records)

world = records[end]
println("Wrote $OUT_PATH ($(length(records)) rows)")
println("Global shares: willing to contribute 1% = $(world.wtp)%, " *
        "should fight GW = $(world.norm)%, government should do more = $(world.government)%")
