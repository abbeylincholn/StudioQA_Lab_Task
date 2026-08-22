# QA_PIPELINE.md, the smallest quality process worth trusting

For one QA person and a small team shipping often, only what one person can build and keep running.

## What runs, and when

| Stage | What happens | Time limit | Owner |
|---|---|---|---|
| Code proposed | Quick checks plus ~8 must-work journeys, fake data | Under 10 min | Engineer runs, QA owns |
| After merge | Full suite, every supported browser, accessibility scan | Under 20 min | QA |
| Overnight | Duplicate/out-of-order events, odd file types, tablets, real outside service | Under 1 hour | QA |
| Before release | Evidence review, riskiest change checked by hand, AI output review | 2 to 4 hrs, human | QA plus release owner |
| After release | Robot repeats core journey every 5 min, money math checked hourly | Ongoing | QA builds, on-call watches |

Only the first stage blocks engineers, so it stays strict; the rest move later.

## What must be true before we release

Must-work tests 100% passing (a retried pass doesn't count); zero serious open problems; this report's money/account-boundary bugs proven fixed, not assumed; under 0.5% job-creation failures over 24 hours; a written record attached.

Exceptions: the engineering lead may override the test-run or error-rate rule, never money or account-boundary — with a reason, a name, a ticket, expiring in 14 days.

## The kinds of tests, and what each is for
(setup is our smoke check, gating is our regression suite.)
- Small-piece tests: money math, status changes, ticket logic.
- Request/response tests: not just status code, but the right response.
- Whole-system tests: app, database, queue together, AI faked. Duplicate and partial failures live here.
- Real-browser tests, about 8, deliberately only money-touching journeys.
- Exploratory testing, one session per release.
- Screen-reader and keyboard checks: automated every run, a person quarterly.
- Security: automatic scans every change, tests for this report's bugs, checks typed text never runs as code, yearly professional review.
- Live-product checks: the always-on robot, no negative balance, no job unfinished past 30 min, no ticket charged twice.

## Test data and where tests run

Every run gets its own clean, fake accounts and balances, created and cleaned up through the app. Secrets live in a vault, never in code. Accounts touching the real AI service carry a spending cap. No test touches a real customer; live checks use one fake account kept out of billing and support. Fake AI handles everyday checks, the real one runs overnight, so drift shows within a day.

## Making background jobs behave

Every background job is tested for: a resend costing one charge; duplicate updates; out-of-order updates; a screen checking an already-finished job; a job succeeding but its save failing. Most useful check: screen, response, and saved state must all agree — a customer stuck on a stale screen is the hardest ticket to diagnose. Time limits come from real timing, never a guess.

## Judging AI-generated results

Split in two. What should always be exactly right — one result per job, correct file details, one charge — is tested normally and can block a release. How good it looks never blocks a release — no test can judge that. About 50 sample requests run nightly, scored on simple signals; a person reviews a sample weekly. A model-version shift raises an alert, not a failed build; the older version's results stay on hand so "is it worse" is answered fast.

## Testing file types and long projects

About 20 sample files, normal and deliberately awkward — odd formats, transparency, very long or short, damaged — plus one large project to check performance holds up. The check that matters most: preview must match what the customer downloads, compared frame by frame, since a mismatch is only spotted after the credit is already spent.

## When something breaks in production

Every problem is looked at within one business day; urgency follows customer impact: money or account-boundary first, a broken journey with no workaround next, one with a workaround after, cosmetic last. Every real problem gets a reproduction attempt within 48 hours, with enough detail saved to investigate. No urgent fix merges without a new test that fails first, then passes — otherwise the bug quietly comes back. Support gets a plain note per known problem: what it looks like, what to tell customers, when it's fixed.

## Keeping the tests themselves trustworthy

QA owns any test that fails randomly, not consistently. Two failures in two weeks pulls it from the required set within a day, with an owner and a two-week deadline — unfixed, it's deleted; an ignored test protects nothing. Only one automatic retry, always logged — a suite passing only on retries isn't really passing. Every quarter, remove tests that never caught a real problem.

## The numbers that actually matter

| Metric | Drives | How it's misread or gamed |
|---|---|---|
| Problems found after release, by severity | Where testing is needed | Under-reported, count and mix read together |
| Releases causing new problems | Whether release rules are right | Gamed by shipping tiny low-risk changes |
| Money and account-boundary problems slipping through | Direct harm | A broken detector reports zero silently |
| Engineer wait time for results | Whether QA is a bottleneck | Improved by deleting tests |
| Random test failures | Trust in the tests | Hidden by retries, count first attempt only |

Not tracking code coverage — it measures code that ran, not risk reduced.

## Not building, first 90 days

Cross-browser testing, automatic screenshot comparison, load testing, our own test infrastructure — expensive to maintain, none would have caught this report's real problems. One browser tested daily, two more overnight.

What changes my mind: browser complaints above 5% of tickets; two or more preview-doesn't-match-download cases; missed load-time targets two weeks running, or one visible slowdown incident. Reviewed monthly.