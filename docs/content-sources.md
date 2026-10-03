# Content sources (action cards)

Every URL below was opened in this session (WebFetch). Cards contain no product names, no doses, no brands.
Where a treatment is mentioned the card says "ask the extension officer which treatment is approved".
All cards are `reviewed:false`: no agronomist has checked them.

| Source id | URL | Opened as |
|---|---|---|
| KCS | https://www.globalcoffeeplatform.org/wp-content/uploads/2021/03/KCS-MANUAL-review-03112020.pdf (Kenya Coffee Sustainability Manual, KCS training) | PDF downloaded, text read |
| BIO | https://infonet-biovision.org/crops-fruits-vegetables/coffee-revised (icipe Infonet-Biovision) | page |
| HI | https://www3.ctahr.hawaii.edu/oc/freepubs/pdf/PD-126.pdf (Univ. of Hawaii CTAHR, PD-126, pruning for leaf rust and berry borer; **Hawaii, not Kenya**) | PDF downloaded, text searched |
| FR | https://www.frontiersin.org/journals/climate/articles/10.3389/fclim.2025.1699037/full (review, climate stress in East African coffee) | page |
| EU | https://www.eurekalert.org/news-releases/793119 (press release on coffee biennial effect) | page |
| KSF | https://kenyacoffeeschool.golearn.co.ke/kcs-coffee-agronomy-2b-soil-science-and-soil-fertility/83821/uncategorized/bep3zc5cbf/ (Kenya Coffee School) | page |

## Claims and where they come from
| Card(s) | Claim | Source |
|---|---|---|
| A01, A04 | Timely pruning is a cultural control for leaf rust and other coffee diseases; pruning opens the canopy for airflow and light | KCS (cultural control: "proper and timely pruning"), HI, BIO |
| A02 | Leaf rust chemical control uses registered fungicides; timing matters; follow the Coffee Research Institute spray programme; improper use causes resistance | KCS |
| A03 | Resistant varieties are a control option | KCS |
| A05 | (Practical advice, no factual claim beyond "pests/diseases need correct identification") | KCS pest/disease modules |
| A06 | Berry borer makes small round holes; sanitation by complete harvest and collection of affected berries | BIO; HI (strip-pick all berries) |
| A07 | Antestia bugs prefer dense foliage; regular pruning and desuckering | BIO |
| A08 | Use only registered products; scout before spraying | KCS (responsible pesticide use), BIO |
| A09 | Terraces / soil conservation structures on steep land | KCS (land preparation) |
| A10 | Cool, wet weather favours disease; pruning for airflow; excess shade plus heavy rain raised fungal risk in parts of East Africa | BIO, FR |
| A11, A12 | Mulch conserves soil moisture; mulch kept away from the stem; irrigate when flower buds are ready and rain has not come | KCS, FR |
| A13 | Drought-tolerant varieties exist | KCS |
| A14, A15 | Soil analysis every 2-3 years; lime as advised by the soil analysis report | KCS, KSF |
| A16 | Continuous phosphate (DAP) use without soil analysis can lead to big cherries without beans | KCS |
| A17 | Change of cycle / clean stumping preferably after about every 5 major crops | KCS |
| A18 | Stump pruning during drought is not advised; trees need rain to regrow | HI |
| A19 | Top-working to a disease-resistant variety, replanting | KCS, BIO |
| A20 | Heavy crops are often followed by low crops (biennial effect); overbearing causes dieback | EU, KCS |
| A21 | Do not buy inputs without a soil test (see A14-A16) | KCS, KSF |
| A22 | Pruning/canopy management addresses overbearing and biennial cropping; soil analysis decides fertiliser | KCS |
| A23 | Unknown cause: send a person to check | (design decision, no agronomic claim) |
| A24 | Escalation | (design decision) |

## Could NOT verify (dropped or flagged)
- Whether the **Hawaii** pruning advice (HI) transfers to Kenyan smallholder conditions: used only for generic ideas (airflow, no stumping in drought); needs a Kenyan agronomist.
- Specific advice to **cut the number of berries to reduce next year's off-year**: dropped (not sourced in a Kenyan source).
- **Heavy-rain damage** specifics (flower drop, drainage, waterlogging): no Kenyan extension source opened; cards A09-A10 are general. Needs expert input.
- Exact **soil pH threshold** for liming: sources disagree (5.5-6.5 in KSF; 4.4-5.4 in KCS). No number is given on any card (open item in decisions.md).
- Stumping "after about 5 major crops" is a KCS rule of thumb, not a tree age; the `treeAgeOver20` question is a proxy.
- Pages that returned 403 and were therefore NOT relied on: MDPI leaf rust review, ScienceDirect alternate bearing abstract, Taylor and Francis resilience review, Sweet Maria's.
- No source for "the officer visit is free" or for any Kenyan cooperative/extension structure (D-019 [verify] remains).
- Swahili text is machine-drafted (NLLB-200); see `app/src/content/packs/sw_qa.json`. Known bad drafts: A05 (mistranslates "sick leaves"), A17 (says "roots" instead of stems), Q06 (loses the yes/no meaning), several UI words. Native review needed.
