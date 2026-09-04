# Builds the tallies behind the "probability words" widget: three surveys that played the
# same game — show people a probability word, ask them to put a number on it — and one
# tally per (study, condition, word) of how many people gave each whole-percent answer.
#
# The widget draws one bubble per distinct answer, sized by how many people gave it, so a
# tally is all it needs; shipping one row per respondent would be an order of magnitude
# larger for the same picture.
#
# Sources, all openly downloadable and none needing registration:
#
#   Budescu, Por & Broomell (2012), Climatic Change 113, 181-200
#   https://doi.org/10.1007/s10584-011-0330-3
#   The study ran on Time-sharing Experiments for the Social Sciences (TESS, proposal
#   021/779), which archives the full response file on the OSF at https://osf.io/gf5sm/
#   (component https://osf.io/r4tzm/). The zip holds two nested zips; the SPSS file inside
#   one of them is what this reads. 556 US adults, eight IPCC sentences, three formats.
#
#   Wintle, Fraser, Wills, Nicholson & Fidler (2019), PLOS ONE 14, e0213522
#   https://doi.org/10.1371/journal.pone.0213522
#   Data on the OSF at https://osf.io/q78fu/ (Clean_Data_For_Analysis.csv). 924 people,
#   eight intelligence-analysis statements, four formats, the US intelligence community's
#   ICD 203 lexicon.
#
#   Mauboussin & Mauboussin (2018), Harvard Business Review, "If you say something is
#   'likely', how likely do people think it is?" https://hbr.org/2018/07/... — data and
#   code at https://github.com/amauboussin/probability-survey. 1,976 people, 23 everyday
#   phrases judged with no context and no official scale.
#
# Every answer is kept, including the 0s and the 100s. Budescu et al. recoded all extreme
# responses as missing before computing their own tables; applying that recoding to this
# script's output reproduces their Table 3 exactly, which is how the extraction was
# checked, but it drops 8.3% of real answers (and, for "very likely", answers of 100%,
# which are inside the range the IPCC means), so the widget does not apply it.
#
# Run from the repo root: julia --project=. scripts/probability-words.jl

using ZipFile, ReadStatTables, Tables, CSV, JSON

const OUT_PATH = "src/probability-words/data/probability-words.json"

const TESS_ZIP = "https://osf.io/download/hmgyz/"
const WINTLE_CSV = "https://osf.io/download/wafxj/"
const MAUBOUSSIN_CSV =
    "https://raw.githubusercontent.com/amauboussin/probability-survey/master/probability_survey_results.csv"

# tally(values) -> [[value, count], ...] ascending by value. The widget re-sorts by count
# for layout; ascending by value is simply what reads best in the file.
function tally(values)
    counts = Dict{Int,Int}()
    for v in values
        counts[v] = get(counts, v, 0) + 1
    end
    [[v, counts[v]] for v in sort(collect(keys(counts)))]
end

# --- Budescu, Por & Broomell 2012 -------------------------------------------------------
# The same eight sentences appear three times in the response file, once per presentation
# format: 1a plain, 1b with the IPCC translation table beside them, 1c with the numerical
# range printed in the sentence itself. Two sentences per word, pooled here the way the
# paper's own Figure 2 pools them.
function budescu_2012(tmp)
    zip_path = joinpath(tmp, "Budescu779.zip")
    println("Downloading $TESS_ZIP ...")
    download(TESS_ZIP, zip_path)

    sav_path = ""
    outer = ZipFile.Reader(zip_path)
    for f in outer.files
        endswith(lowercase(f.name), ".zip") || continue
        inner_path = joinpath(tmp, basename(f.name))
        write(inner_path, read(f))
        inner = ZipFile.Reader(inner_path)
        for g in inner.files
            if endswith(lowercase(g.name), ".sav")
                sav_path = joinpath(tmp, "budescu.sav")
                write(sav_path, read(g))
            end
        end
        close(inner)
    end
    close(outer)
    isempty(sav_path) && error("no .sav file found inside $TESS_ZIP")

    tb = readstat(sav_path)
    groups = [string(g) for g in tb[:xtess021]]

    # (experimental group prefix in the file, our condition id, variable-name infix)
    formats = [("CONTROL", "control", "1a"), ("TRANSLATION", "translation", "1b"),
               ("VERBAL-NUMERICAL", "vn", "1c")]
    # (our word id, the two item numbers that used it)
    words = [("very_likely", (1, 2)), ("likely", (3, 4)),
             ("unlikely", (5, 6)), ("very_unlikely", (7, 8))]

    conditions = []
    for (prefix, id, infix) in formats
        rows = findall(g -> startswith(g, prefix), groups)
        terms = []
        for (word, items) in words
            values = Int[]
            for item in items, i in rows
                v = unwrap(tb[Symbol("IPCC_", infix, "_", item)][i])
                ismissing(v) || push!(values, round(Int, v))
            end
            push!(terms, Dict("id" => word, "tally" => tally(values)))
        end
        push!(conditions, Dict("id" => id, "respondents" => length(rows), "terms" => terms))
    end
    Dict("id" => "budescu-2012", "conditions" => conditions)
end

# --- Wintle et al. 2019 -----------------------------------------------------------------
# Already tidy: one row per respondent per statement, with the format in `condition` and
# the target phrase in `phrase`. Two statements per phrase, pooled the same way.
function wintle_2019(tmp)
    path = joinpath(tmp, "wintle.csv")
    println("Downloading $WINTLE_CSV ...")
    download(WINTLE_CSV, path)
    tb = CSV.File(path, missingstring = ["NA", ""])

    formats = ["control", "table", "tool", "brackets"]
    words = [("VL", "very_likely"), ("L", "likely"), ("U", "unlikely"), ("VU", "very_unlikely")]

    conditions = []
    for fmt in formats
        rows = [r for r in tb if r.condition == fmt]
        # Respondents assigned to the format, not respondents who answered: one person who
        # skipped every item is still one person in that group, which is how the Budescu
        # counts above are taken too.
        respondents = length(unique(r.ResponseId for r in rows))
        terms = []
        for (code, word) in words
            values = [round(Int, r.BestEstimate) for r in rows
                      if r.phrase == code && !ismissing(r.BestEstimate)]
            push!(terms, Dict("id" => word, "tally" => tally(values)))
        end
        push!(conditions, Dict("id" => fmt, "respondents" => respondents, "terms" => terms))
    end
    Dict("id" => "wintle-2019", "conditions" => conditions)
end

# --- Mauboussin & Mauboussin 2018 -------------------------------------------------------
# One wide row per respondent, one column per phrase, no experimental conditions and no
# official scale to be right or wrong about. Rows come out ordered by median so the chart
# reads as a ladder from "always" down to "never".
function mauboussin_2018(tmp)
    path = joinpath(tmp, "mauboussin.csv")
    println("Downloading $MAUBOUSSIN_CSV ...")
    download(MAUBOUSSIN_CSV, path)
    tb = CSV.File(path, missingstring = [""])

    skip = ("age_bin", "gender", "esl")
    phrases = [String(c) for c in propertynames(tb) if !(String(c) in skip)]

    terms = []
    for phrase in phrases
        values = [round(Int, v) for v in getproperty(tb, Symbol(phrase)) if !ismissing(v)]
        isempty(values) && continue
        sorted = sort(values)
        med = sorted[cld(length(sorted), 2)]
        push!(terms, (med, Dict("id" => phrase, "tally" => tally(values))))
    end
    # Highest median first, ties broken by the phrase id so the order is reproducible.
    sort!(terms, by = t -> (-t[1], t[2]["id"]))

    Dict("id" => "mauboussin-2018", "conditions" => [Dict(
        "id" => "all",
        "respondents" => length(tb),
        "terms" => [t[2] for t in terms],
    )])
end

function main()
    tmp = mktempdir()
    studies = [budescu_2012(tmp), wintle_2019(tmp), mauboussin_2018(tmp)]

    mkpath(dirname(OUT_PATH))
    open(OUT_PATH, "w") do io
        JSON.print(io, Dict("studies" => studies))
    end

    println("\nWrote $OUT_PATH ($(round(filesize(OUT_PATH) / 1024, digits=1)) kB)")
    for study in studies
        println("  ", study["id"])
        for cond in study["conditions"]
            answers = sum(sum(p[2] for p in t["tally"]) for t in cond["terms"])
            biggest = maximum(maximum(p[2] for p in t["tally"]) for t in cond["terms"])
            println("    $(rpad(cond["id"], 12)) respondents=$(cond["respondents"])  " *
                    "words=$(length(cond["terms"]))  answers=$answers  biggest pile=$biggest")
        end
    end
end

main()
