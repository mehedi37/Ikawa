# Problem evidence and the problem-statement sentence (verified 2026-10-04)

Every number here was read from a primary file or page by us. Anything we could only find second-hand is labelled.

## Verified facts (Kenya)
| Fact | Value | Source | How verified |
|---|---|---|---|
| Kenya green-coffee **yield** | **592 kg/ha (2000) → 262 kg/ha (2010) → 435 kg/ha (2023)** | FAOSTAT, *Crops and livestock products*, Kenya, "Coffee, green", Yield (kg/ha) | computed from the bulk file `Production_Crops_Livestock_E_Africa.zip` (downloaded 2026-10-03); script in `docs/problem-evidence.md` appendix |
| Coffee **area harvested** | 160,000 ha (2010) → 111,900 ha (2023) | same file | same |
| Coffee **production** | 42,000 t (2010), 36,900 t (2020), 48,700 t (2023) | same file | same |
| **Extension coverage** | "the ratio of extension staff to farmer **has not improved**… the Government… objective is to ensure that the country attains a ratio of one (1) extension personnel to six hundred (600) farmers by the year 2029… utilization of information and communication technology" | *Kenya Agricultural Sector Extension Policy (KASEP)*, Dec 2023, p. 8 — https://kilimo.go.ke/wp-content/uploads/2024/10/KENYA-AGRICULTURAL-SECTOR-EXTENSION-POLICY-2023.pdf | text extracted from the PDF and the paragraph read |
| Study-area context | Mutira ward, Kirinyaga county is at about −0.47°, 37.23° (JMuBEN, our main training set, was photographed in Mutira) | OpenStreetMap Nominatim; JMuBEN paper (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8165403/) | queried |

## Second-hand only (label as such if used)
- "Fewer than 5,000 public extension officers serve over 8 million farmers, far below FAO's 1:400 recommendation" — Kilimo Trust post on X (https://x.com/kilimoEAC/status/1922614393646284879). Not an official document; do not quote a precise figure in the video.
- "Ratio 1:1000 vs FAO-recommended 1:400" — attributed to NASEP (2012) in a secondary source. Not verified.
- GSMA Mobile Gender Gap Report 2025 (https://www.gsma.com/gender-gap-2025/): the search summary says Kenya's smartphone gender gap narrowed from 38% to 23%; **we have not opened the report**, so do not use the number. The GSMA site blocks scripts: open it in a browser and read the Kenya table before citing.

## What these facts do NOT prove
- The yield fall is **not** shown to be caused by missing advice (prices, weather, tree age, land-use change and disease all matter). We use the yield trend as *context for why better diagnosis matters*, not as proof of impact.
- FAOSTAT national yields are estimates and aggregate smallholder and estate farms.
- The KASEP quote shows the extension gap is acknowledged by government; it gives no number for the current ratio.

## The problem-statement sentence (template from the brief)
> **Because of Ikawa, a smallholder coffee farmer in Kirinyaga will identify the most likely cause of her falling yield, and choose one action (or send the case to an extension officer) within the same week she notices the problem, a decision she would otherwise make late or by guesswork; we know because Kenya's coffee yield was 435 kg/ha in 2023 against 592 kg/ha in 2000 (FAOSTAT), and Kenya's 2023 extension policy states that the extension-staff-to-farmer ratio "has not improved" and targets one officer per 600 farmers by 2029.**

Evidence that the tool itself works is separate and lives in `docs/evidence/README.md` (measured on held-out data, with its limits).

## Appendix — how the FAOSTAT numbers were computed
```python
import zipfile, pandas as pd
z = zipfile.ZipFile("data/raw/faostat/Production_Crops_Livestock_E_Africa.zip")
df = pd.read_csv(z.open("Production_Crops_Livestock_E_Africa.csv"), encoding="latin-1")
d = df[(df["Area"] == "Kenya") & (df["Item"] == "Coffee, green")]
d[d["Element"] == "Yield"][["Y2000", "Y2010", "Y2023"]]   # 592.4, 262.5, 435.2 kg/ha
```
