# Cascade QA Engineer Assessment — StudioQA Lab

This folder is everything I put together for the assessment: automated tests, plus the write-ups
explaining what I found, why it matters, and what I'd do about it. It's written so that both a
technical reviewer and someone non-technical can follow along — technical details are there when
you need them, but every technical term is explained in plain words the first time it shows up.

**The test app itself was never changed.** The `qa_candidate_lab/` folder is exactly as it was
given to me — I found problems, I didn't fix them, per the assessment's own rules.

## What's in each document

| File | What it is, in plain terms |
|---|---|
| [RISK_MAP.md](RISK_MAP.md) | The eight things I predicted were most likely to be broken, and how risky each one is — written *before* I touched the app at all |
| [SESSION_LOG.md](SESSION_LOG.md) | A timeline of everything I actually tried, including the guesses that turned out wrong and two mistakes I caught in my own work |
| [FINDINGS.md](FINDINGS.md) | The five real problems I found, explained one at a time, with proof for each — plus a list of things I checked that turned out fine |
| [QA_PIPELINE.md](QA_PIPELINE.md) | My design for the smallest quality-checking process a single person could realistically run for this kind of product |
| [RELEASE_DECISION.md](RELEASE_DECISION.md) | My answer to "should we ship this" (it's "not yet"), and exactly what I'd need to see to change my mind |
| [EVIDENCE.md](EVIDENCE.md) | An index pointing at exactly which saved file or screenshot proves each thing I claimed |
| [AI_USE.md](AI_USE.md) | An honest account of how I used AI help while doing this, and how I double-checked everything it produced |

## How to actually run this (for anyone technical)

You'll need **Node.js version 18 or newer** installed (I used version 24.13.1, on Windows 11).
The tests run in Chrome, using a tool called Playwright, which the setup step below installs for
you. Nothing else needs to be installed.

```bash
cd cascade-qa-submission
npm ci
npx playwright install chromium
```

Or, one command that does the whole setup and runs everything at once:

```bash
npm run setup && npm test
```

The test app starts itself automatically when the tests run (if a copy is already running, it
just reuses that one instead of starting a second copy). To start it by itself: `npm run lab`.

### The commands you'd actually use

| Command | What it does |
|---|---|
| `npm test` | Runs everything — both the "must always pass" tests and the "known problem" tests |
| `npm run test:gate` | Runs only the tests that must be 100% passing before shipping |
| `npm run test:known-defects` | Runs only the tests proving the five problems I found still exist |
| `npm run typecheck` | Checks the test code itself for mistakes |
| `npm run report` | Opens a readable summary of the last test run |
| `npm run evidence` | Regenerates the saved request/response files (needs the app running) |

## How the project is organised

```
StudioQA_Lab-Task/
├── cascade-qa-submission/         (the QA test suite)
│   ├── playwright.config.ts         (settings for the testing tool)
│   ├── tsconfig.json                (settings for the programming language)
│   ├── package.json                 (list of what needs installing)
│   ├── .env                         (a couple of simple settings)
│   └── src/
│       ├── pages/
│       │   └── StudioPage.ts        (one file describing where every button/box is on screen)
│       ├── tests/
│       │   ├── setup/               (a quick check that the app is up before testing starts)
│       │   ├── gating/              (tests that must always pass)
│       │   └── known-defects/       (tests proving the five problems still exist)
│       └── utils/
│           ├── api.ts               (a helper for talking to the app directly)
│           ├── types.ts             (describes the shape of the app's data)
│           └── TestData.json        (the test accounts, balances, and sample text used)
│
└── qa_candidate_lab/               (the actual app being tested)
    ├── package.json                 (list of what needs installing)
    ├── server.mjs                    (the small web server that runs the app and its fake data)
    └── public/                       (what you see and click in the browser)
        ├── index.html                 (the page's layout)
        ├── styles.css                  (how it looks)
        └── app.js                      (what happens when you click things)

```

The `evidence/` folder (saved requests and screenshots) sits outside this structure, at the very
top level, since it's investigation notes, not part of the testing tool itself.

## Why the tests are split into two groups

I split things into two groups on purpose, because mixing them together is exactly how a team
ends up ignoring warning signs over time.

- **`src/tests/gating/`** — things that already work correctly today, and must keep working.
  These have to be 100% passing before anything ships.
- **`src/tests/known-defects/`** — the five problems I found. These tests check for *correct*
  behaviour, so right now, honestly, they fail — because the problem is still there.

**Why write them this way, instead of just writing a test that matches the current (broken)
behaviour?** Because if I wrote a test that says "sending the same request twice should create
two jobs," that test would actually work *against* fixing the bug — the moment someone fixed it
properly, my own test would start failing and someone might think they'd broken something. Instead
these tests describe what *should* happen, so they're honestly red right now, and the moment
someone actually fixes the problem, the test flips to "hey, this unexpectedly passed now" — which
is exactly the signal that tells the team "this is fixed, go move this test into the must-pass
group."

### Which test covers which requirement

| What's required | Where it's covered |
|---|---|
| A full customer journey through the screen | `gating/journey.ui.spec.ts` |
| Direct checks of the app's raw responses | `gating/job-contract.api.spec.ts` |
| One customer not being able to touch another's data, or a viewer creating work | `known-defects/authorisation.spec.ts` |
| Money and repeat-request problems | `known-defects/idempotency.spec.ts`, `known-defects/refund.spec.ts` |
| Working on a tablet, and recovering from a glitch | `gating/device.tablet.spec.ts` and `known-defects/poll-recovery.spec.ts` |

### Why each of these is worth automating

Every test file starts with a short note explaining why it's automated. The short version: these
are all things that fail *silently* — money moving incorrectly, one customer's data leaking into
another's account, a customer's screen freezing while everything is actually fine behind the
scenes. A person just using the app normally would likely never notice any of these on their own.

### One thing I left for a human to check, on purpose

**Whether a generated picture actually looks like what someone asked for.** No automated check can
honestly judge that — it would either always pass no matter what, or fail randomly for reasons
that have nothing to do with an actual bug. The parts that *can* be checked automatically — that
exactly one result comes back, attached to the right job, costing exactly one credit — already
are. Judging the actual quality belongs to a person, sampling results regularly (see
QA_PIPELINE.md).

## Why the tests never just "wait a few seconds and hope"

None of these tests use a fixed pause. Every single one either watches for a real change to
happen on screen, or checks repeatedly with a clearly stated giving-up point.

| What it's waiting for | How long it waits | Why that number |
|---|---|---|
| A normal check | 10 seconds | Jobs normally finish in about 1.7 seconds — 10 gives plenty of room for a slow computer, without letting a genuinely stuck job slip through as "just slow" |
| A whole test | 45 seconds | Covers the slowest test (several jobs in a row) without letting a real hang go unnoticed |
| A single action (click, load) | 10 seconds | This is a simple local app — anything slower than that really is a problem |
| Waiting for a job to finish on screen | 15 seconds | A little extra room, since it's waiting on the screen's own background checking |

## Making sure tests don't interfere with each other

Every test resets the app back to its known starting point before it runs — three test accounts,
with known starting balances, listed in `src/utils/TestData.json`. That way, every test compares
against a known, fixed starting point, not whatever was left over from the last test. Tests can
run in any order and be re-run any number of times with the same result.

## What gets saved when something fails

A step-by-step recording, a screenshot, and a video, for every failed test — plus a readable
summary of the whole run. See EVIDENCE.md for exactly how to open these.

## Automatic checking on every code change

Set up in `.github/workflows/ci.yml`, in two parts:
- **The must-pass group** — blocks any change from being merged if it fails.
- **The known-problems group** — never blocks anything. If one of these tests unexpectedly starts
  passing, that's the signal a real problem just got fixed.

## Honest limitations of this testing setup

1. **Tests run one at a time, not in parallel.** The test app shares one single memory store
   across everything, so running tests at the same time would make them interfere with each
   other. That's a limit of the test app itself, not a choice I'd make with a real product. The
   full run takes about 1.8 minutes because of this.
2. **Some on-screen elements had to be found by their internal code name**, because the app
   doesn't provide easier, more human-readable ways to find them for a couple of spots (the
   credit number and the role badge). Everything else is found the same way a screen reader would
   find it.
3. **Status words on screen are lowercase but styled to look uppercase** — so my checks ignore
   capitalisation on purpose.
4. **One of the five problems (the frozen screen) only happens with a very specific trigger word**
   that's built into this test app specifically for testing purposes — a real product would need
   a different way to simulate a similar hiccup.
5. **That same trigger only works once per job**, so the order things happen in matters a lot in
   those particular tests — explained in detail right inside that test file.
6. **Only tested in one browser (Chrome).** Testing every browser is something I deliberately
   chose not to build yet — explained in QA_PIPELINE.md.
7. **How serious Finding 4 (the hidden-program problem) really is depends on how the real
   product is built** — some modern tools protect against this automatically. That's the first
   thing I'd check.

## How much time this took

Roughly **5 hours, 15 minutes**: about 75 minutes predicting risks and testing without looking at
the code, 30 minutes reading the code to confirm things, 110 minutes building the automated tests
(including finding and fixing two mistakes in my own tests), 75 minutes writing the process design
and release decision, and 25 minutes double-checking everything was in order.

## The order things were actually built in

At least four real commits, in the order the work actually happened: the risk predictions first,
then the proof for each finding, then the automated tests, then the write-ups explaining it all.
Running `git log --stat` shows that progression.
