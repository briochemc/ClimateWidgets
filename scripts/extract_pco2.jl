using NCDatasets
using Statistics
using JSON

const IN_PATH  = "data/fair-outputs/fair_run.nc"
const OUT_PATH = "docs/data/pco2_all.json"
const YEAR_MIN = 1900
const YEAR_MAX = 2150

ds = NCDataset(IN_PATH)
scenarios = String.(ds["scenario"][:])
tb = Float64.(ds["timebounds"][:])
mask = (tb .>= YEAR_MIN) .& (tb .<= YEAR_MAX)
tidx = findall(mask)
years = round.(Int, tb[tidx])

# co2_concentration dims: (config, scenario, timebounds)
cc = ds["co2_concentration"][:, :, tidx]

result = Dict{String, Vector{Dict{String, Any}}}()
for (i, s) in enumerate(scenarios)
    slice = cc[:, i, :]  # (config, time)
    med = [median(skipmissing(slice[:, t])) for t in eachindex(years)]
    result[s] = [Dict("year" => years[t], "ppm" => med[t]) for t in eachindex(years)]
end

close(ds)

mkpath(dirname(OUT_PATH))
open(OUT_PATH, "w") do io
    JSON.print(io, result)
end

println("Wrote $OUT_PATH")
for s in scenarios
    v = result[s]
    println("  $s: $(length(v)) pts, $(v[1]["year"])=$(round(v[1]["ppm"],digits=1)) ppm → $(v[end]["year"])=$(round(v[end]["ppm"],digits=1)) ppm")
end
