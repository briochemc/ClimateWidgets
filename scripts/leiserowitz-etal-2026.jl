# Derives the wave-by-wave series behind Global Warming's Six Americas (the SASSY
# segmentation) from the trends spreadsheet the Yale Program on Climate Change
# Communication and George Mason University's Center for Climate Change Communication
# publish alongside the report:
# Leiserowitz, A., Kotcher, J., Verner, M., et al. (2026). Global Warming's Six Americas,
# Fall 2025. https://climatecommunication.yale.edu/publications/global-warmings-six-americas-fall-2025/
#
# Sheet (public, no auth): https://docs.google.com/spreadsheets/d/1g9ULwHOk6jY4lJwWBA0VWSt4vy1msL3F
# Columns: Wave, % n, % Alarmed, % Concerned, % Cautious, % Disengaged, % Doubtful,
# % Dismissive, % No Segment. Percentages are already whole numbers; "% No Segment" is the
# share the survey's screener could not place in one of the six segments (0-4%, mostly in
# early waves) plus ordinary rounding — this script does not try to separate the two.
#
# Run from the repo root: julia --project=. scripts/leiserowitz-etal-2026.jl

using CSV, Dates

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1g9ULwHOk6jY4lJwWBA0VWSt4vy1msL3F/export?format=csv&gid=728493926"
const OUT_PATH = "src/leiserowitz-etal-2026/data/leiserowitz-etal-2026.csv"

# The sheet has shown both a "Mon YYYY" string and, at least once, an Excel date serial
# for the same cell (spreadsheet auto-formatting), so both are handled here.
function parse_wave(s::AbstractString)
    s = strip(s)
    if all(isdigit, s)
        Date(1899, 12, 30) + Day(parse(Int, s))
    else
        Date(s, dateformat"u yyyy")
    end
end

# The sheet's columns come through with mixed types depending on what CSV.jl infers per
# column (plain ints most waves, but a comma-thousands string for "1,146" in the latest one),
# so these accept anything Real or String rather than assuming one.
parse_int(x::Real) = round(Int, x)
parse_int(s::AbstractString) = round(Int, parse(Float64, replace(strip(s), "," => "")))
parse_int(::Missing) = 0
parse_pct(x) = ismissing(x) || (x isa AbstractString && strip(x) == "") ? 0 : parse_int(x)

tmp = mktempdir()
csv_path = joinpath(tmp, "six-americas.csv")
println("Downloading $SHEET_URL ...")
download(SHEET_URL, csv_path)

file = CSV.File(csv_path; missingstring="")
records = NamedTuple[]
for row in file
    wave = row[Symbol("Wave")]
    (ismissing(wave) || (wave isa AbstractString && strip(wave) == "")) && continue
    date = wave isa AbstractString ? parse_wave(wave) : Date(1899, 12, 30) + Day(wave)
    segments = (
        alarmed=parse_pct(row[Symbol("% Alarmed")]), concerned=parse_pct(row[Symbol("% Concerned")]),
        cautious=parse_pct(row[Symbol("% Cautious")]), disengaged=parse_pct(row[Symbol("% Disengaged")]),
        doubtful=parse_pct(row[Symbol("% Doubtful")]), dismissive=parse_pct(row[Symbol("% Dismissive")]),
    )
    no_segment = parse_pct(row[Symbol("% No Segment")])
    total = sum(segments) + no_segment
    (95 <= total <= 105) || error("$(wave): segments + no_segment = $total, outside [95, 105]")
    push!(records, (
        wave=Dates.format(date, dateformat"u yyyy"), date=Dates.format(date, dateformat"yyyy-mm"),
        n=parse_int(row[Symbol("% n")]), segments..., no_segment=no_segment,
    ))
end
sort!(records, by=r -> r.date)

mkpath(dirname(OUT_PATH))
CSV.write(OUT_PATH, records)

println("Wrote $OUT_PATH ($(length(records)) waves, $(records[1].wave) to $(records[end].wave))")
last = records[end]
println("Latest wave $(last.wave): Alarmed $(last.alarmed)%, Concerned $(last.concerned)%, " *
        "Cautious $(last.cautious)%, Disengaged $(last.disengaged)%, Doubtful $(last.doubtful)%, " *
        "Dismissive $(last.dismissive)%, No segment $(last.no_segment)%")
