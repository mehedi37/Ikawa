# Data access report — what we actually checked

*Checked 2026-10-03 from our machine with `curl`/API calls. "Reachable" means the page loads. "Pulled" means we downloaded real data from it.*

Scope: **Annex B (Agriculture)** + **Common datasets (§7.3)** only. Health (Annex A) and Tourism (Annex C) datasets are deliberately excluded.

## Annex B — Agriculture datasets

| Dataset (link from the PDF)                                 | Status                        | What we found                                                                                                                                                                | How we get it                                                                |
| ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **BRACOL** — data.mendeley.com/datasets/yy2k5y8mxg/1 | ✅ Pulled metadata            | **CC BY 4.0**. One zip, **165 MB**                                                                                                                               | Direct download from Mendeley                                                |
| **CHIRPS** — chc.ucsb.edu/data/chirps                | ✅ Reachable, files listed    | Africa daily 0.05° GeoTIFFs; final files confirmed to**2025-12-31**                                                                                                   | `data.chc.ucsb.edu/products/CHIRPS-2.0/africa_daily/tifs/p05/`             |
| **NASA POWER** — power.larc.nasa.gov                 | ✅**Pulled**            | Daily rain + temperature for a Nyamasheke (Rwanda) point, no key needed                                                                                                      | REST API,`community=AG`                                                    |
| **iSDAsoil** — isda-africa.com/isdasoil              | ✅ Bucket listed              | Public S3:`isdasoil/soil_data/ph/ph.tif` (+ N, P, OC…), Africa-wide cloud GeoTIFF                                                                                         | GDAL`/vsicurl/` window read, so we never download the whole continent      |
| **SoilGrids** — soilgrids.org                        | ✅**Pulled**            | topsoil pH =**5.1** (0–5 cm) at 29.22E, −2.45 (Nyamasheke area). A point at 29.09E returned null (Lake Kivu), so **check that coordinates are on land**        | REST`rest.isric.org/soilgrids/v2.0/properties/query`                       |
| **WFP food prices** (HDX)                             | ✅**Pulled** Rwanda CSV | 157,691 rows, 2000-01 →**2026-08**. **No coffee.** Has **maize, beans**, cassava, potatoes…                                                              | HDX CSV`wfp_food_prices_rwa.csv`                                           |
| **FAOSTAT** — fao.org/faostat                        | ✅ Bulk reachable             | The REST API now returns*"Missing Authorization Header"* (needs a token). The bulk zip works                                                                               | `bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Africa.zip` |
| **PlantVillage** (Kaggle)                             | ⚠️ Reachable                | Needs a Kaggle account + API token                                                                                                                                           | `kaggle datasets download abdallahalidev/plantvillage-dataset`             |
| **Cassava Leaf Disease** (Kaggle competition)         | ⚠️ Reachable                | Needs Kaggle + accepting the competition rules.**Not needed for coffee**                                                                                               | skip                                                                         |
| **iBean** (GitHub, Makerere)                          | ✅ Reachable                  | Bean leaf field photos (Uganda). Useful for a**bean pack** stretch                                                                                                     | GitHub                                                                       |
| **PlantDoc** (GitHub)                                 | ✅ Reachable                  | Field-condition images (no coffee class)                                                                                                                                     | `git clone`                                                                |
| **LSMS-ISA** (World Bank Microdata)                   | ⚠️ Reachable                | Downloads need a free Microdata account + a short use statement. Rwanda is**not** an LSMS-ISA country; use Rwanda EICV / agricultural surveys in the Microdata Library | Microdata Library                                                            |
| **Digital Earth Africa**                              | ✅ Reachable                  | Not needed for the core build (we don't use satellite in the weekend scope)                                                                                                  | —                                                                           |
| **Sentinel-2 / Landsat** (Copernicus)                 | ✅ Reachable                  | Needs free registration. Not in the weekend scope                                                                                                                            | —                                                                           |

## Our additions (not in the annex, but better fit)

| Dataset                                                     | Status      | What we found                                                                                                                                         |
| ----------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JMuBEN** (data.mendeley.com/datasets/t2r6rszp5c/1)  | ✅ Metadata | **CC BY 4.0**. Arabica, **Kenya** (Kirinyaga), real field conditions, pathologist-assisted. Rust 8,337 · cercospora 7,682 · phoma 6,572 |
| **JMuBEN2** (data.mendeley.com/datasets/tgv3zb82nd/1) | ✅ Metadata | **CC BY 4.0**. Miner 16,979 · healthy 18,985                                                                                                   |
| **RoCoLe** (data.mendeley.com/datasets/c5yvn32dzg/2)  | ✅ Metadata | **CC BY 4.0**. 1,560 Robusta leaves, smartphone, field, rust severity labels                                                                    |

⚠️ **JMuBEN is heavily augmented.** Split train/test by original-image group, otherwise near-duplicates leak and accuracy is inflated.

## Common datasets (§7.3) we use

| Dataset                                       | Status                       | Note                                                                                                                                |
| --------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Meta MMS-TTS `kin`** (Hugging Face) | ✅                           | Licence**CC BY-NC 4.0**: fine for the hackathon, **not** for commercial use. Production needs native-speaker recordings |
| **Meta MMS-1b-all**                     | ✅ Reachable                 | Not used on the phone (too large); possible build-time helper only                                                                  |
| **Mozilla Common Voice**                | ✅ Reachable                 | Kinyarwanda download needs an account/email                                                                                         |
| **GSMA Mobile Gender Gap**              | ⚠️**403 to scripts** | Open in a browser, download the PDF manually                                                                                        |
| **Global Findex**                       | ✅ Reachable                 | Data downloadable from the site / Data360                                                                                           |
| **OpenCelliD**                          | ✅ Reachable                 | Needs a free API token for the downloads                                                                                            |
| **World Bank Data360 / WDI / HDX**      | ✅ Reachable                 | Open                                                                                                                                |

## Bottom line

- **Everything the core build needs is open and downloadable today**: BRACOL, JMuBEN, RoCoLe, CHIRPS, NASA POWER, iSDAsoil, SoilGrids, WFP.
- **Accounts to create now** (each takes a few minutes): Kaggle (PlantVillage), Mozilla Common Voice, World Bank Microdata, OpenCelliD.
- **Two corrections to the brief's assumptions:** (1) WFP has **no coffee price** for Rwanda; (2) the FAOSTAT API now needs a token, but bulk download works.


---

## Updates 2026-10-04 (verified by running things)

| Finding | Detail | Decision |
|---|---|---|
| **BRACOL's official zip is truncated upstream** | The file's SHA-256 matches Mendeley's published hash, yet 7-Zip reports "Unexpected end of archive": only **1,402 of 1,747** labelled images are recoverable. | We use the 1,402 and say so. Re-uploaded privately as Kaggle dataset `ikawa-bracol` (CC BY 4.0, attribution kept). |
| **JMuBEN is mostly copies** | "Leaf rust": 8,192 files, **1,024 byte-unique**, about **458 groups** after merging rotated/flipped copies (verified by thumbnail correlation). | D-023: split by group; report duplicate ratios. |
| **Everything is also on Kaggle** | JMuBEN (`noamaanabdulazeem/jmuben-coffee-dataset`, 3 diseases only), RoCoLe (`nirmalsankalana/rocole-a-robusta-coffee-leaf-images-dataset`: healthy 791 · rust 602 · red spider mite 167), PlantVillage, Cassava (competition, joined). JMuBEN2 (healthy + miner) is **not** on Kaggle, so the data-prep kernel downloads all five Mendeley zips with SHA-256 checks. | D-022 |
| **NASA POWER is too coarse for plot-level rain** | ~0.5°: all 49 cells identical, 0 days ≥ 40 mm. | D-024: CHIRPS for heavy-rain days. |
| **iSDAsoil pH** | stored as raw ints; back-transform `x/10` (from the layer's own `ph.json`); band 1 = mean 0–20 cm. 48 of 49 cells filled; the missing cell is likely Lake Kivu (SoilGrids fallback timed out). | built into `geo/build_grid.py` |
| **Flowering window** | Sep 1 – Oct 31 for the Rwanda grid, **UNVERIFIED** (secondary sources: NAEB, Sweet Maria's). Re-check for Kenya (two flowering seasons are common there; **[verify]**). | revisit if D-019 is accepted |
| **Kaggle account** | Authenticated; token in `.env` (gitignored). Username `mdmehedihasanmaruf`. | — |
