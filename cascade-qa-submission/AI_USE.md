This is my honest account of where AI helped, where I double-checked it, and where I ignored or
overruled it. Written in plain language so it's clear even to someone who's never used one of
these tools.

## What I used, and for what

| Tool | What I used it for |
|---|---|
| **Claude (an AI assistant), inside my code editor** | First drafts of my testing scripts and setup; first drafts of the write-up documents; a second pair of eyes on my test code looking for gaps; it suggested the specific approach I used for marking known problems in the tests |
| Playwright (not AI — a browser automation tool) | Actually controlling the browser, recording what happened, taking screenshots |
| Basic scripting and command-line tools (not AI) | Sending raw requests to the app directly, to check things without a browser |

No AI tool decided how serious any problem was, or whether to ship the product or not. Those were
my own judgement calls, and I explain my reasoning for each one in this file and in
`FINDINGS.md`.

## The main things I asked it to do (shortened)

1. *"Do this QA assessment following the pattern of my existing testing setup, and walk me through
   how you're solving it."* — set the overall direction.
2. *"This should be written in TypeScript, not plain JavaScript — please change everything."* — a
   correction I gave partway through; some early scripts were rewritten to match.
3. *"Just be fast and meet the requirements."* — told it to stop over-polishing things like exact
   word counts and move faster.

Other requests during the session covered: how to structure my testing plan around each risk, how
to split "must always work" tests from "known problem" tests, and shortening `QA_PIPELINE.md` down
to fit its word limit.

## What AI actually shaped, and what it didn't

- **The wording and structure** of every write-up document in this folder.
- **The first draft** of the testing scripts, the app-testing settings, and the helper files.
- **The specific technique** used to mark the five known-problem tests as "expected to fail for
  now" — it suggested this, and I checked it matched what the assessment rules actually required
  before using it.
- **What it did NOT decide:** which risks I ranked as most serious, which five problems made the
  final report, the decision to combine two related problems into one write-up, the decision to
  hold back the release, and the decision to take back one of my findings after I realised it was
  wrong.

## How I double-checked everything it produced

- **Every single problem I reported, I proved myself, twice** — once by sending raw requests
  directly and saving the exact result, and once again using a separate automated test. Nothing
  in this report is based on "the AI said so."
- **Every reproduction step written down was actually run**, starting from a freshly reset app,
  and the results pasted in are the real output, not a rewritten version of it.
- **How serious I rated each problem** was based on what a real customer would actually
  experience — money moving, data crossing into someone else's account — not something a model
  told me to write.
- **The hidden-program problem (Finding 4)** wasn't accepted just because I noticed something
  suspicious while reading the code. I proved it by actually watching it happen in a real browser
  — a hidden tag showed up on a different customer's screen, and it actually ran, on its own.
- **The test code itself was checked by running it** — the "must-pass" tests genuinely pass, and
  each "known problem" test was checked to make sure it fails for the *right* reason, not by
  accident.

## Something it suggested that I turned down

Early on, the draft testing code checked that resending the same request created *three* separate
jobs — in other words, it checked that the current, broken behaviour kept happening, which would
have made the tests pass right now.

**I rejected that.** The assessment rules are explicit: don't make broken behaviour look
acceptable by writing a test that expects it. A test like that would actually work *against*
fixing the bug — the day someone fixed it properly, that test would start failing, and it might
look like they'd broken something. I rewrote every one of these tests to check for the *correct*
behaviour instead, and marked them as "expected to fail for now." That way the tests describe what
should happen, they're honestly failing today, and the moment someone actually fixes the problem,
the test flips to "hey, this unexpectedly passed" — which is exactly the signal that tells the
team it's time to move that test into the must-pass group.

## Something it suggested that I changed significantly

It originally suggested writing up the "viewer can create work they shouldn't" problem as its own,
separate report — which would have meant six reports against a limit of five. I combined it into
one write-up with the account-boundary problem instead, because they come from the exact same
root cause and the exact same fix. Keeping them as two separate write-ups would have meant
dropping a more serious problem (the hidden-program one) just to stay under the limit. I say
plainly, right in that write-up, that I combined them — I don't hide it.

## Two times what I actually saw changed a guess it had made

**First — I suspected the wrong part of the app, and checking directly cleared it.** Based on the
scenario in the release notes, the early guess was that the customer's own browser was causing the
double-charge, by generating a new "ticket number" every time. I tested that directly: I cut off
the first request's confirmation before the browser saw it, then retried. The ticket number on
screen never changed, and both attempts used the identical one — the browser side is doing exactly
the right thing. That stopped me writing up the wrong part as broken, and it also told me my test
wasn't simulating the real problem properly — which led me to build a better one that actually
proved the bug lived on the server.

**Second — a tool I built myself gave me a wrong answer, and I only caught it by luck.** An
automated check I wrote reported that two dropdown menus on the page had no label for a screen
reader, and I wrote that down as a finding. A screenshot from a failed test run later happened to
show the page's actual accessibility description, and it clearly showed the label *was* there —
just written in a slightly different, still-valid way that my checking script didn't know to look
for. I took the finding back, said so openly instead of quietly deleting it, and fixed my checking
script so it wouldn't make the same mistake again.

## I stand behind all of it

Every test and every claim in this submission is something I can explain and defend. Every finding
can be recreated from scratch using the steps I've written down, and I can walk through any line
of test code, any severity rating I gave, and exactly what new evidence would change my mind about
any of it.
