# Evidence log (what we measured, in order)

Every number below comes from a file in this folder. Nothing here is tuned on the held-out sets.

| Run | What changed | In-distribution test | Held-out field clusters (RoCoLe) | Unseen mites |
|---|---|---|---|---|
| **1** `run1_zero_shot/` | Baseline: RoCoLe held out entirely | 98.96% | **0.0%** (all 1,477 labelled `not_coffee`: background shortcut) | 97% mean confidence, wrong |
| **2** `run2_cluster_split/` | RoCoLe split by whole field cluster (C1-7 train, C8 val, C9-12 held out) + low-res augmentation | 98.44% | **96.6%** (healthy 96.2%, rust 97.1%) | 2.6% flagged; 95% mean confidence, wrong |
| **3** `run3_mites_as_unreadable/` | Mite photos taught as the "cannot read" class | **98.51%** (int8 phone model: 98.67%) | 89.2% overall; **96.6% when it answers**; declines 7.6% | **50% flagged** (23/46) |

| 4 `run4_lite0_comparison/` | Same as run 3 but EfficientNet-Lite0 (pre-registered comparison, D-032) | 98.81% | 89.7% | 34.8% flagged → **not adopted** (validation gain +0.04 < +0.5 rule; worse on unknown pests) |

Data facts (from `ikawa-data-prep`, 65,427 files read): JMuBEN 58,550 files = **1,082 independent groups** (98.2% copies); healthy has only 63 distinct files. BRACOL 0-4% copies; RoCoLe ~4%.

Honest limits: held-out clusters share the camera, species and field with the training clusters (a within-dataset test, not a country shift); 46 unseen mite photos is a small sample; healthy test n = 35 on the in-distribution split; no Kenyan phone photos were available.
