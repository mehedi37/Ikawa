# Native-speaker review of the Kiswahili pack (30 minutes of someone's time)

**File to send:** `docs/review/sw_review.csv` (opens in Excel/Google Sheets; safety-critical lines are sorted first).

**Message you can paste (HackOS FAQ / Hack-Nation Discord / friends):**
> Hi! I'm building an offline app that gives Kenyan coffee farmers short advice (what to do about a sick coffee leaf, and "don't buy anything yet, ask an extension officer"). I used a machine translation into Kiswahili and I need a native speaker to check about 55 very short lines. It takes ~30 minutes. In the sheet, please fill the last two columns: your correction (if any) and OK = Y/N. Priority is the first ~15 rows (they mention spending money or safety). Thank you — you will be credited in the project.

**What to do with the answers:** paste corrections into `app/src/content/packs/sw.json`, set `reviewed:true` only for the lines the reviewer marked Y, set `machineDrafted:false` only if the reviewer approved the whole pack, re-run `uv run python audio/render.py <ids>` for corrected ids, and record the reviewer's first name (with their permission) in `docs/decisions.md`.

**Until then:** the app and the video say "Machine-drafted translation — not checked by a native speaker." Do not remove that notice.
