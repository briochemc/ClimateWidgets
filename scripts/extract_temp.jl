using NCDatasets
using Statistics
using JSON

const IN_PATH  = "data/fair-outputs/fair_run.nc"
const OUT_PATH = "src/data/temp_all.json"
const YEAR_MIN = 1900
const YEAR_MAX = 2150

ds = NCDataset(IN_PATH)
scenarios = String.(ds["scenario"][:])
tb = Float64.(ds["timebounds"][:])
mask = (tb .>= YEAR_MIN) .& (tb .<= YEAR_MAX)
tidx = findall(mask)
years = round.(Int, tb[tidx])

# temperature dims: (config, scenario, timebounds).
# Subtract each (config, scenario)'s own 1850-1900 mean, then take ensemble
# median across configs — matches cmip7-scenariomip/scripts/plotting.py.
baseline_mask = (tb .>= 1850) .& (tb .< 1901)
baseline_idx = findall(baseline_mask)
tt = ds["temperature"][:, :, tidx]
tb_base = ds["temperature"][:, :, baseline_idx]
baseline = mean(tb_base, dims=3)[:, :, 1]  # (config, scenario)

result = Dict{String, Vector{Dict{String, Any}}}()
for (i, s) in enumerate(scenarios)
    slice = tt[:, i, :] .- baseline[:, i]  # anomaly vs 1850-1900 per config
    med = [median(skipmissing(slice[:, t])) for t in eachindex(years)]
    result[s] = [Dict("year" => years[t], "T" => med[t]) for t in eachindex(years)]
end

close(ds)

mkpath(dirname(OUT_PATH))
open(OUT_PATH, "w") do io
    JSON.print(io, result)
end

println("Wrote $OUT_PATH")
for s in scenarios
    v = result[s]
    println("  $s: $(length(v)) pts, $(v[1]["year"])=$(round(v[1]["T"],digits=2)) °C → $(v[end]["year"])=$(round(v[end]["T"],digits=2)) °C")
end
