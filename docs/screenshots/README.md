# Screenshots

Captured from the live app (https://ikawa-meek-0s-projects.vercel.app) on 2026-10-04 with `app/e2e/capture-readme.mjs` (Playwright, Chromium, 390x844 mobile viewport, device scale factor 2). All files are JPEG, quality 82, except `05-result-rust.jpg`, which is quality 78 so it stays under 300 KB.

| File | What it shows |
|---|---|
| `01-home.jpg` | Home screen: language picker (English), farmer ID, demo area Mutira, Kirinyaga, Kenya (-0.47, 37.23) selected, and the "Rain data up to" picker. |
| `02-consent.jpg` | Consent step (step 1 of 5): three separate yes/no questions with Play audio buttons, all answered Yes. |
| `03-photos.jpg` | Leaf photos step (step 3 of 5): worst row with 3 leaf-rust photos and good row with 3 healthy photos, each marked OK. |
| `04-question.jpg` | Question 3 of 6, "Do you see this bug on your trees?", with a photo of antestia bugs and Yes / No / Not sure buttons. |
| `05-result-rust.jpg` | `?demo=1` result (full page): "Most likely: leaf rust" (94%), the "What I used" and "What I could not check" lists, the farm area with rain caption, and the action card telling the farmer to ask the extension officer about an approved treatment. |
| `06-cannot-read.jpg` | `?demo=1&run=mite` result: "I cannot read this leaf", with Retake and Send to a person buttons. |
| `07-healthy.jpg` | Result for all-healthy leaf photos: "Your leaves look healthy", non-leaf causes ranked, and a card advising not to buy spray or fertiliser only because the harvest is smaller. |
| `08-escalate-sms.jpg` | Send to a person: the 84-character case SMS (`IK1\|...`), the officer phone number field and the Send SMS button. |
| `09-officer.jpg` | Officer page (full page): a pasted case SMS decoded into farmer, likely causes, leaf model, soil pH, rain, answers and location, plus the reply-card buttons A01 to A24. |
| `10-coop-storage.jpg` | Cooperative cases: phone storage summary (1 case, 0 synced, 1 not synced; MB used of available), "Photos are not stored on this phone", and the saved case. |
| `11-kiswahili.jpg` | Language set to Kiswahili: the machine-drafted translation notice (English and Kiswahili) and the consent step with its question and buttons in Kiswahili; the step instructions are still in English. |
| `12-asof-rain.jpg` | Close-up of the `?demo=1` result: farm area card showing "Rain data up to 2026-05-10" (nearest date to the "after the April 2026 heavy rains" shortcut) and "Heaviest day in the last 90 days: 86 mm (satellite estimate ...)". |
