# EVIDENCE.md, StudioQA Lab

This page is a map. Every claim in FINDINGS.md points to something real you can go open and check for yourself, a saved request and response, a screenshot, an automated test, not just my word for it. Nothing here has been cleaned up after the fact, what's saved is exactly what happened when it ran.

Everything below can be recreated from scratch. `npm run evidence` regenerates the saved requests in `evidence/api/`. `npm test` regenerates everything the automated tests produce.

## How to read the saved request files

Each file in `evidence/api/` is a plain, ordered list of everything sent to the app and everything it sent back, for every check in that batch. Nothing is summarised. If a finding says "the balance went from 3 to 0," open the file and watch that number change, step by step, rather than take my word for it.

## Saved requests and responses

| File | What it proves | What to actually look at inside it |
|---|---|---|
| `evidence/api/p01-baseline.json` | What working correctly looks like, the baseline everything else is measured against, including the timing used for the automated tests' time limits | Balance drops from 3 to 2 after starting a job; the job moves through queued to processing to succeeded; exactly one result comes back |
| `evidence/api/p02-idempotency.json` | Finding 1, the double charge | The same request sent three times with the same idempotency key creates three separate jobs, all accepted; the balance ends at 0 |
| `evidence/api/p03-tenancy-role.json` | Finding 2, seeing or changing another account's data, and a viewer creating work | Ava can list Beta's jobs; Ava can read one specific Beta job while honestly saying she's in Alpha; Ava can create a job inside Beta; Vic, a viewer, can create a job |
| `evidence/api/p04-refund.json` | Finding 3, no refund on failure, and separately, proof that spending down to zero is handled correctly | A failed job's balance goes from 3 to 2 and stays at 2, checked right after failure and again 1.5 seconds later. Then several attempts once the balance is exhausted, each one correctly refused, balance never negative |
| `evidence/api/p05-transient.json` | The frozen-screen problem, tested from outside the app, and it came back clean, which is why the code itself was checked next | 120 status checks in a row, all successful, no errors at all |

Regenerate these with:
```bash
npm run lab        # starts the app in one terminal, leave it running
npm run evidence    # in a second terminal, runs the five probes above and writes the JSON files
```

## Screenshots

These have to be captured by hand while actually using the app, or pulled from a Playwright trace after a real test run, there's no way to generate a meaningful screenshot without a real browser watching the real screen.

| File | What it should show |
|---|---|
| `evidence/screenshots/ui-01-initial.png` | The normal starting screen, Ava, Alpha, 3 credits |
| `evidence/screenshots/ui-02-viewer.png` | Finding 2, Vic set up as a viewer, with the Create button sitting there enabled anyway |
| `evidence/screenshots/ui-04-ava-on-beta.png` | Finding 2, Ava, still logged in as herself, looking straight at Beta's job and Beta's balance |
| `evidence/screenshots/ui-05-tablet.png` | The tablet landscape layout, working correctly, nothing overflows |
| `evidence/screenshots/ui-06-double-click.png` | Proof that double-clicking Create does not cause a double charge |
| `evidence/screenshots/ui-07-after-timeout.png` | Finding 1, proof the browser side is innocent, it keeps the same idempotency key on screen after a failed attempt |
| `evidence/screenshots/ui-09-double-charge.png` | Finding 1, the single most important screenshot, the screen says "Failed to fetch" and still shows 3 credits, while 2 have actually been spent and 2 jobs actually exist |
| `evidence/screenshots/ui-10-stuck-processing.png` | Finding 5, the screen stuck showing processing, while the app itself, checked at that same moment, says the job is finished |
| `evidence/screenshots/ui-11-xss.png` | Finding 4, a hidden tag sitting inside the victim's page, already triggered |

## Automated tests

| Test file | What it checks | How to run it |
|---|---|---|
| `src/tests/gating/journey.ui.spec.ts` | The whole normal customer journey works, start to finish | `npm run test:ui` |
| `src/tests/gating/job-contract.api.spec.ts` | The app's responses are shaped correctly, not just the right status code, the right content too | `npm run test:api` |
| `src/tests/gating/device.tablet.spec.ts` | The tablet landscape layout keeps working, with no overflow | `npm run test:tablet` |
| `src/tests/known-defects/authorisation.spec.ts` | Finding 2, reading and writing another account's data, and a viewer being able to create work | `npm run test:known-defects` |
| `src/tests/known-defects/idempotency.spec.ts` | Finding 1, the double charge on retry | `npm run test:known-defects` |
| `src/tests/known-defects/refund.spec.ts` | Finding 3, the missing refund on a failed job | `npm run test:known-defects` |
| `src/tests/known-defects/xss.spec.ts` | Finding 4, typed text stays as plain text, including when it's planted across accounts | `npm run test:known-defects` |
| `src/tests/known-defects/poll-recovery.spec.ts` | Finding 5, recovering from the frozen screen, and the screen matching reality | `npm run test:known-defects` |

## What gets saved when a test fails

Every failing test automatically saves a step-by-step recording, a screenshot of the moment it failed, a full video, and a written description of what the page looked like at that point. These land in a `test-results` folder.

To watch the step-by-step recording of any failed test:
```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

There's also a browsable report (`npm run report`) listing every test run, including which "this is supposed to fail" tests behaved exactly as expected.

Worth explaining plainly rather than just noting: the tests for the five findings are deliberately marked as expected to fail, so the testing tool reports them as passed while the underlying problem still exists, which really means "failed the way I said it would." Those tests describe what correct behaviour looks like, not the bug itself, so the actual proof of each problem isn't the test result, it's the saved requests and screenshots above. The tests exist to catch the exact moment someone fixes the problem, not to be the evidence that it's broken in the first place.

## Recreating everything from scratch

```bash
npm install
npx playwright install chromium
npm run lab            # terminal 1, leave running
npm run evidence        # terminal 2, regenerates evidence/api/*.json
npm test                 # runs everything, regenerates the recordings and the report
```