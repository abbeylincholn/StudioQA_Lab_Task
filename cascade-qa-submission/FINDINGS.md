# FINDINGS.md, StudioQA Lab

Five reports, ordered by fix priority. When fix priority differs from severity, I say why.

**Setup for every report:** Windows 11, Node v24, lab running unmodified at http://localhost:4173, Chromium via Playwright. Reset the lab first (Reset lab button, or POST /api/reset). Seed data: Ava is an editor in Alpha with 3 credits, Vic is a viewer in Alpha, Bea is an editor in Beta with 2 credits.

**On labelling:** F1, F2 and F3 were found before I looked at any source code. For F4 and F5 I found the exact trigger by reading the source after the black box window closed, marked below as [FOUND IN SOURCE], but I then reproduced and watched the actual behaviour happen in a browser either way, so the evidence itself is always something I observed, not just read. Anywhere I'm guessing at the cause rather than stating what I saw, I call it a guess.

**Summary**

| # | Title | Severity | Fix priority |
|---|-------|----------|--------------|
| F1 | Retrying a slow request charges the customer twice | Critical | P0 |
| F2 | Any user can read and write any workspace; roles aren't checked | Critical | P0 |
| F3 | A failed job never gives the credit back | High | P1 |
| F4 | A prompt can run as a script in another team's browser | High | P1 |
| F5 | One bad status check leaves the job stuck on screen forever | Medium | P2 |

---

## F1, Retrying a slow request charges the customer twice

**Severity:** Critical **Fix priority:** P0, same as severity. This is silent, it costs real money, and it happens from the single most normal thing a user does when something feels slow, pressing the button again.

**Preconditions:** reset the lab, act as Ava.

**Steps, sending the same request three times in a row:**
```bash
curl -X POST http://localhost:4173/api/reset

for i in 1 2 3; do
  curl -s -X POST http://localhost:4173/api/jobs \
    -H 'content-type: application/json' \
    -H 'x-user-id: ava' -H 'x-workspace-id: alpha' \
    -d '{"prompt":"duplicate submission","idempotencyKey":"retry-key-fixed"}'
done
curl -s "http://localhost:4173/api/session?userId=ava&workspaceId=alpha"
```
Sent one after another, not at the same time, so this can't be blamed on a timing accident.

**Expected:** only the first request should create a job. The other two, using the same key, should hand back that same job. Credits should read 2.

**Actual:** all three succeed. Three different job numbers, credits drop to 0. The same key is stored on every job, so the app clearly knows it was reused, it just never checks.

**A more realistic version, through the real screen:** a real timeout doesn't mean the request never arrived, it means the server did the work but the reply got lost. I recreated that exactly: let the real request go through, then threw away the response before it reached the browser. The screen showed "Failed to fetch" and still said 3 credits. I clicked Generate again, same as any real user would. Result: two jobs got created, credits dropped to 1, and the screen never told the customer any of it happened. The app itself did nothing wrong here, it kept sending the same key both times.

**Evidence:** screenshot of the screen showing 3 credits while only 1 remains. Automated: src/tests/known-defects/idempotency.spec.ts.

**Why this matters:** the customer pays twice for one thing they asked for once, and the screen gives them no way to know it happened, so they can't even complain accurately. At any real scale this becomes refunds, chargebacks, and support tickets that are hard to trace back to one cause.

**What I saw vs what I think is happening:** I saw the same key produce two different job numbers and two charges, every time, both through the API directly and through the real screen. My guess, not confirmed by reading code, is that the app saves the key on the job but never actually checks it against past requests before making a new one.

**Smallest check worth automating:** send the same request twice, check only one job and one credit resulted. Runs in under a second.

**Still need to know before shipping:** whether this credit number is the same thing the real billing system charges against, or a separate counter that might already be protected somewhere else.

---

## F2, Any user can read and write any workspace, and roles aren't checked

**Severity:** Critical **Fix priority:** P0, same as severity. This is the same missing check causing two different problems, being able to see another team's data, and a viewer being able to create things they shouldn't. I'm reporting them together since they share one cause and one fix, rather than using up two of my five report slots on the same root problem.

**Worth saying plainly:** this has nothing to do with the login being fake, which the brief already says not to report. Even someone honestly telling the app their real workspace still gets handed someone else's data. That's the point below.

**Preconditions:** reset the lab, then create one job in each workspace so there's something to find.

**Proof 1, listing another team's jobs:**
```bash
curl -s "http://localhost:4173/api/jobs?workspaceId=beta" -H 'x-user-id: ava' -H 'x-workspace-id: beta'
```
Expected: blocked. Actual: Beta's full job list comes back, Ava isn't on that team.

**Proof 2, the clearest one, asking for one job by its number:**
```bash
curl -s "http://localhost:4173/api/jobs/job_1002" -H 'x-user-id: ava' -H 'x-workspace-id: alpha'
```
Here Ava is being completely honest about her own team, and still gets Beta's job back. Job numbers just count up one at a time, so anyone could try a few numbers and read someone else's private work.

**Proof 3, spending someone else's credits:** posting a new job while claiming Beta as the workspace actually creates it in Beta and spends Beta's credit, even though the request came from Ava.

**Proof 4, visible on screen with no tools at all:** open the app as Ava, just change the workspace dropdown to Beta, and Beta's jobs and credit balance show up. This matches the brief's own release scenario almost exactly.

**Proof 5, a viewer creating a job:**
```bash
curl -s -X POST http://localhost:4173/api/jobs -H 'content-type: application/json' \
  -H 'x-user-id: vic' -H 'x-workspace-id: alpha' \
  -d '{"prompt":"viewer must not create this","idempotencyKey":"viewer-1"}'
```
Expected: blocked, viewers can only look. Actual: succeeds, credit spent. The Generate button isn't even disabled for Vic on screen, so this isn't a case of a good server rule behind a broken screen, there's no rule at all.

**Evidence:** screenshots of Ava on Beta's screen and of Vic's role next to a job he created. Automated: src/tests/known-defects/authorisation.spec.ts.

**Why this matters:** prompts often contain real, unreleased client work, so one company reading another's is a genuine confidentiality problem, not just an inconvenience, and in many places it would legally count as a data breach that has to be reported. It also means one team can spend a different team's paid credits, and a viewer can spend the whole team's credits despite being the one role that's supposed to only look.

**What I saw vs what I think is happening:** I saw all five proofs above happen directly. My guess is that the app just trusts whatever workspace name is sent to it instead of checking who the person actually is, and that the job-lookup-by-number address skips that check completely, while job creation never looks at the person's role at all.

**Smallest check worth automating:** three checks, Ava listing Beta's jobs should fail, Ava fetching one Beta job by number should fail, Vic creating a job should fail. All three run in under a second and this is the single most important thing to keep testing on every change.

**Still need to know before shipping:** whether the real product decides a user's team from a proper login session instead of a header like this lab does. Even if it does, proof 2 shows the job-lookup address has no check of any kind, so that part needs fixing regardless.

---

## F3, A failed job never gives the credit back

**Severity:** High **Fix priority:** P1. Severity is High because customers lose real money, but I've placed it below F1 and F2 because the damage here is capped at one credit per failure and can be fixed with a support credit, while leaked private data can't be undone.

**Preconditions:** reset the lab, act as Ava.

**Steps:**
```bash
curl -X POST http://localhost:4173/api/reset
curl -s -X POST http://localhost:4173/api/jobs -H 'content-type: application/json' \
  -H 'x-user-id: ava' -H 'x-workspace-id: alpha' \
  -d '{"prompt":"fail on purpose","idempotencyKey":"refund-1"}'
sleep 3
curl -s "http://localhost:4173/api/session?userId=ava&workspaceId=alpha"
```
(A prompt with the word fail in it makes the job fail on purpose, found by trying prompts, not by reading code.)

**Expected:** credits go back to 3 once the job fails.

**Actual:** credits stay at 2, checked again a full 1.5 seconds later in case it was just slow, still 2. Repeated on a second failed job with the same result.

| | before | right after | after it fails | 1.5s later |
|---|---|---|---|---|
| job 1 | 3 | 2 | 2 | 2 |
| job 2 | 2 | 1 | 1 | 1 |

**Evidence:** the ledger above. Automated: src/tests/known-defects/refund.spec.ts, which checks both that the credit comes back and that it doesn't come back twice.

**Why this matters:** the customer pays for something that never worked, and if the real generation service ever has a bad day, this quietly drains every affected customer's balance with no way to trace who's owed what.

**What I saw vs what I think is happening:** I saw the credit get taken and never returned, twice in a row, checked at multiple points in time. My guess is that whatever code marks a job as failed just never has a matching step to give the credit back.

**Smallest check worth automating:** make a job fail, wait for it, check the balance matches where it started.

**Still need to know before shipping:** how often the real generation service actually fails. If it's rare this is a minor annoyance, if it's common this becomes urgent, and that one number decides which.

---

## F4, A prompt can run as a script in another team's browser

**Severity:** High **Fix priority:** P1. [FOUND IN SOURCE] I noticed the page builds job cards by pasting text straight into HTML, then confirmed it actually runs in a real browser. On its own this needs a job to already exist in the victim's workspace, but combined with F2 above, any team can plant it into any other team, which makes the pair Critical together. Listed as P1 because fixing F2 closes the delivery path but not this bug itself, both need their own fix.

**Preconditions:** reset the lab.

**Steps:**
```bash
curl -X POST http://localhost:4173/api/reset
curl -s -X POST http://localhost:4173/api/jobs -H 'content-type: application/json' \
  -H 'x-user-id: ava' -H 'x-workspace-id: beta' \
  -d '{"prompt":"<img src=x onerror=\"alert(document.domain)\">","idempotencyKey":"xss-1"}'
```
Then open the app as Bea, on her own Beta team, the actual victim just looking at her own work.

**Expected:** the prompt shows up as plain, harmless text on screen.

**Actual:** it runs. The image tag gets added to the page for real and its error handler fires, in Bea's own browser, on her own honest visit to her own workspace.

**Evidence:** screenshot of the alert firing. Automated: src/tests/known-defects/xss.spec.ts, which plants the payload using the same F2 hole and checks nothing runs and nothing gets added to the page.

**Why this matters:** a script running in someone else's session can read and send out anything that session can see, and can act as if it were that person, so in a real product this is how an account gets fully taken over, not just a display glitch. Because it's saved on the job, it fires again for every single person who ever looks at that workspace.

**What I saw vs what I think is happening:** I saw the tag get added to the page and its handler run, in a different team's browser than the one that sent it. My guess is the page builds each job card as a raw block of HTML text with the prompt pasted straight in, with nothing stripping out tags first.

**Smallest check worth automating:** save a job with a tag like this in the prompt, load the page, check no image or script element shows up and nothing ran.

**Still need to know before shipping:** whether the real product's screen is built with something like React, which blocks this automatically, or with raw HTML like this lab, since that changes whether this is a real risk at all in production.

---

## F5, One bad status check leaves the job stuck on screen forever

**Severity:** Medium **Fix priority:** P2. [FOUND IN SOURCE] the specific trigger, checking status on a job with the word poll500 in it, isn't something I could have guessed, I found it reading the server code, after 120 clean status checks in a row taught me the app wasn't just randomly flaky. Severity is Medium since nothing is lost or leaked and the result genuinely exists on the server. Priority is only P2 because clicking Refresh fixes it immediately, so there's already a workaround.

**Preconditions:** reset the lab, act as Ava.

**Steps:** type a prompt containing poll500, click Generate, then just watch the screen for ten seconds without touching Refresh.

**Expected:** one bad check gets retried and the job eventually shows as done.

**Actual:** the screen shows "Temporary job status failure" and never checks again on its own, for as long as I watched. Meanwhile the server had already marked the job as succeeded within about two seconds. Clicking Refresh fixes it instantly, proving the result was there the whole time and only the screen had stopped asking.

**Evidence:** screenshot of the stuck screen next to the server showing succeeded. Automated: src/tests/known-defects/poll-recovery.spec.ts.

**Why this matters:** to the customer this looks exactly like losing their work and their credit, so the obvious next move is to try again, which given F1 above charges them a second time. It's also the hardest kind of support ticket to solve, because by the time anyone looks, the server shows everything worked fine.

**What I saw vs what I think is happening:** I saw the screen stop checking after exactly one error and never recover by itself, while the server had already finished successfully. My guess is that the screen treats any error as final and simply gives up, instead of trying again.

**Smallest check worth automating:** trigger this one error, then check that what the screen shows and what the server says eventually match.

**Still need to know before shipping:** how often this kind of temporary error actually happens for real customers, not just in this test lab.

---

## A few smaller things, noticed but not in the top five

- The screen shows raw browser errors like "Failed to fetch" directly to the customer, which is exactly why F1 above goes unnoticed by the person it's happening to.
- The credits number and role badge don't have their own clear label for a screen reader. Small, but a five minute fix.

**One I raised and then took back:** I first flagged the user and workspace dropdowns as having no accessible label at all. That was wrong, they use a label wrapped around the dropdown instead of the more common separate-label style, which is valid and does work for screen readers. I only caught this because a test failure screenshot happened to show it. I'm leaving the mistake here instead of deleting it, since it's also why the automated tests now find these dropdowns by their label text instead of by id.

## Things I checked and found working correctly

- Credits never go negative. Draining a team's balance to zero and trying four more times always returns the same clear "no credits" answer.
- The status check endpoint isn't flaky, 120 checks in a row all came back clean.
- Clicking Generate twice fast doesn't double charge, the button disables itself the moment it's clicked.
- The screen keeps using the same retry key after a failure and only changes it after a real success, so the double-charge bug in F1 is not the screen's fault.
- The tablet sized layout works properly, nothing overflows and the whole flow completes.
- An empty prompt is rejected and doesn't spend a credit.