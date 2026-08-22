# Session Log, StudioQA Lab

Tester: Abiodun Ezekiel. 21 August 2026, UK time. Windows 11, Chrome, driven through Playwright. The app itself was left completely unchanged the whole time, I'm testing it, not fixing it.

I was only allowed to poke at the app like an ordinary user for the first 75 minutes, no looking at the code. Anything after that point where I did look at the code is marked **[Looked at the code]**, since the rules ask for that to be called out separately.

This is the order I actually tried things in, including the guesses that didn't pan out, and the two times I caught myself being wrong.

---

### 09:14, getting ready, before touching anything

Wrote down my predictions of what was most likely broken, and why, that's RISK_MAP.md, done before sending a single request. If I'd written it after already finding bugs it would just be me sounding smart in hindsight. The three things I decided to check first: whether resending the same request charges someone twice, whether one customer can see another customer's data, and whether failed jobs give credits back. Those felt like the riskiest things that would also be fastest to prove one way or the other.

Only read the app's own instructions file and its settings file before starting, nothing else.

### 09:16, figuring out how to log in as someone

My first guess at a test customer's name didn't work, the app just said "unknown user." Rather than keep guessing blind, I looked at the actual dropdown menus on the page, completely fair game, same as using the browser's inspect tool, and found the real names: three test customers called Ava, Vic, and Bea, and two test accounts called Alpha and Beta.

A copy of the app was already running before I started mine, so I used that one instead of starting a second, checked it worked correctly first.

### 09:18, checking what working normally actually looks like

Before hunting for what's broken, I wanted to see correct behaviour first, otherwise every slightly odd result is a coin flip between "that's a bug" and "I don't understand this app yet."

Starting balances matched the instructions. One normal request went from waiting to in progress to done in about a second and a half, produced exactly one result, balance dropped by exactly one credit.

That second and a half turned out to matter later, it's the reason I picked ten seconds as the cutoff for "this has taken too long" in my automated checks, roughly six times normal, enough slack for a slow computer without letting a genuinely frozen job slip through unnoticed.

### 09:22, the first real problem

**What I suspected:** sending the exact same request twice, using the same ticket number, charges twice instead of once.

Sent the identical request three times in a row, one after another, not all at once, wanted this unmistakable, not explainable as bad timing.

**What happened:** all three accepted as three separate new jobs, balance dropped from 3 to 0. A direct hit on the very first thing I went looking for.

### 09:26, the account boundary problem, worse than expected

Planted one clearly labelled test job in each account, then tried six ways of getting Ava, who only belongs to Alpha, to see or touch Beta's data.

The result that actually changed my thinking wasn't claiming to be in Beta and seeing Beta's stuff, that's a fairly ordinary mistake to make. It was asking for one specific Beta item by its number while completely honestly saying "I'm in Alpha." That still worked. The app isn't trusting the wrong answer to "which account are you in," for that one request it isn't asking the question at all. And since these items are just numbered in order, nobody even needs to guess, they can count upward and read through everyone's data.

Same pass, also found Vic, set up as look only, could successfully create a new item anyway, and it spent a shared credit doing it. Not the rule being followed most of the way, not enforced at all.

### 09:27, refunds, and one genuinely good result worth writing down

Found the trick that makes a job fail on purpose just by trying different wording, nothing technical, just experimenting.

Balance went from 3 to 2 the moment the job started, expected, the credit is set aside while it runs, then it just stayed at 2. Through the job finishing. Still 2 a full second and a half later, added that check specifically so a slow-but-real refund couldn't fool me. Ran it twice. Same result both times, nothing ever came back.

Worth saying plainly, since it's tempting to only write down bad news: I also drained a balance to zero and tried four more times, every attempt cleanly and correctly refused, balance never went below zero. That's a different risk I'd worried about, and it turned out fine. Only reporting problems would paint a more broken picture than what's actually true.

### 09:28, a guess that turned out wrong

**What I suspected:** the "check if it's done yet" part is unreliable, and that's what strands jobs.

Checked one job's status 120 times in a row, a tenth of a second apart. All 120 came back clean, moved smoothly through waiting, in progress, done. Nothing unreliable about it.

Didn't cross it off completely though, the release notes specifically mention a job getting stuck after "a temporary status error," so something in that shape clearly exists somewhere, just not findable this way. Moved on to the other two priorities and planned to circle back from inside the actual app, which is exactly what happened at 09:49.

### 09:31, switching my test scripts to a stricter language

Rewrote all the test scripts in TypeScript instead of plain JavaScript and reran everything from scratch. All four problems already found showed up again, exactly the same way. Took about fifteen minutes longer, not wasted time, the more careful data shapes built here got reused directly in the automated tests later.

### 09:40, two things only found by actually using the app

Switching from raw requests to clicking around the real app surfaced things no amount of behind the scenes checking would have shown:

Vic's Create button is right there, clickable, doing nothing to stop him. Not a server check missing behind an already-correct button, nothing stops him at either level.

Ava, still logged in as herself, flips the account dropdown to Beta Studio, and Beta's jobs and balance just appear on screen. Nearly word for word a scenario from the release notes, a reviewer seeing data from an account they never selected, and it happens every single time, not a one-off fluke.

### 09:42, tablet layout and screen reader check, mostly good news

At a typical tablet size, nothing overflowed, every button stayed reachable, the whole process worked start to finish. A genuine relief, I'd flagged this as a real possibility beforehand and it turned out fine. Later built an automated test specifically to lock this in rather than just noting "it's fine" and moving on.

Also ran a quick automated screen reader check, it said the User and Workspace dropdowns were missing their labels. **That flag turned out wrong, see 10:25.** What did hold up: the parts of the page that update automatically are correctly marked so a screen reader announces the change, exactly one main heading on the page, every button has real readable text.

### 09:44, another guess that turned out wrong

**What I suspected:** clicking Create twice quickly, same as resending a request, would also double charge.

Two fast clicks resulted in exactly one job and one credit spent, the button disables itself the instant it's clicked, so a second click can't do anything. Not a bug, noting it as checked and fine, not silently skipping past it.

### 09:46, wrong about who was at fault, glad I checked before writing it down

Going in, I'd started to suspect the customer's own browser was the real problem, maybe generating a brand new ticket number on every click, which would explain a double charge without the server being broken at all.

Tested it directly: cut off the first request's confirmation before it reached the browser, then clicked try again the way a real customer would. The ticket number on screen never changed through any of this, both attempts sent the identical number. The browser side is doing exactly the right thing, it only makes a new number after a successful confirmation.

That mattered twice over. First, it stopped me writing up the wrong part as broken. Second, it told me my setup wasn't actually simulating the real scenario, a real slow-internet problem doesn't drop the request, it processes it and just loses the confirmation on the way back. Which is exactly what I built next.

### 09:48, proving the double charge the way it actually happens to a real customer

Let the real request go all the way through and get processed, then deliberately threw away the confirmation before the browser saw it, that's what a genuinely slow connection actually looks like, as opposed to the request never arriving.

Through the real app, browser behaving correctly the entire time: the same ticket number sent both times, two separate jobs created, balance dropped from 3 to 1, and the whole time the screen told the customer "Failed to fetch" and kept showing 3. The customer was charged twice and shown nothing wrong. Saved a screenshot of this exact moment. This became the single most important thing found.

---

## 09:49, I start reading the actual code

Read the two main files behind the app's back end and front end. Looking for confirmation of why the things already proven were happening, and whether anything was hiding behind a trigger I could never have guessed from outside.

**Everything already found black box, confirmed at the code level:**
- The ticket number does get saved on every job, but nothing anywhere checks it against past tickets before creating a new one. Write-only.
- Which account a request belongs to comes straight from a value the browser sends, with zero check the person actually belongs to that account. The "get one specific item" request doesn't even go that far, no check whatsoever.
- Creating a new job never once looks at whether the person is a viewer or an editor.
- When a job fails, the code updates its status and error message, and that's it, no path anywhere gives the credit back.

**Something genuinely new, could never have guessed from outside:** if a request contains one specific word, the very next status check for that job fails exactly once. Combined with how the front end reacts to any failed check, it just gives up entirely and never checks again, that's the full explanation for the frozen screen I couldn't trigger from outside.

**Also new:** the app builds parts of the page directly out of raw customer-typed text, without checking or cleaning it first.

### 09:51, making sure both of those were real, not just theoretical

Only used the code to find where to poke, both of the following I then went and actually watched happen in a real browser before writing either one up.

**The frozen screen.** Submitted a job using that special trigger word. At one, two, four, and eight seconds in, the screen still showed the job as waiting, with a temporary-problem error, while the app itself, checked at those exact same moments, said the job was already finished. The automatic checking is dead and never comes back on its own, the screen simply never updates again. Pressing manual Refresh fixes it instantly, that's the only thing support could currently tell a customer.

**The hidden-program problem, across two accounts.** As Ava, in Alpha, planted a hidden-program tag into Beta's account, using the same account-boundary hole from earlier. Loaded the page as Bea, looking at her own, completely legitimate account. A popup appeared on her screen that she never asked for, and a hidden marker silently ran in her browser too. Not two separate bugs, a chain, the account-boundary hole delivers it into the wrong account, this bug lets it actually run once it's there.

### 09:58, deciding what makes the final list

Ended up with seven real problems, a limit of five write-ups. Combined the account-boundary problem and the viewer-role problem into one write-up, same root cause, same fix, and that's specifically what left room for the hidden-program problem instead of quietly dropping it.

Also made a deliberate call, before knowing it would turn out to be a mistake, to leave the screen-reader label issue off the final five, a missing label was never going to outrank silent double billing, leaked customer data, missing refunds, or a hidden program running in someone else's browser, whatever its eventual outcome.

### 10:05, building the automated checks

Split the automated tests into two groups on purpose: one that has to stay fully passing (things that already work correctly), and a second that checks for the correct behaviour on the five problems above, which means those currently fail, honestly and on purpose, and flip to unexpectedly passing the moment someone actually fixes the underlying problem. Nothing uses a fixed pause and wait, everything watches for a real change or gives up after a clearly stated time limit.

**One thing deliberately left for a human to check, not a machine:** whether a generated image actually looks like what someone asked for. No automated check can honestly judge that.

### 10:20, a mistake in my own test, not the app

My checks around the frozen screen kept failing for the wrong reason. The app only allows that one trigger word to fail once per job, and my own automated check's behind the scenes polling was using it up before the on-screen version ever got a chance to see it. The screen never actually froze during the test, my check was accidentally testing nothing meaningful.

Fixed it by being explicit about order, every check now waits until the on-screen version has definitely hit the error before it's allowed to do any checking of its own. A related issue, the manual Refresh button only checks once, it doesn't keep trying, so clicking it before the job had actually finished behind the scenes was also, legitimately, sometimes going to fail. Fixed by waiting for the job to genuinely finish first, safe to do at that point.

Writing this down plainly, since it would be tempting to just quietly fix it and never mention it: both of these were mistakes in my own testing, not problems with the app. A test that fails for the wrong reason is worse than no test at all, it teaches everyone to stop trusting it when it turns red.

### 10:25, taking back a finding, because my own tool was wrong

A screenshot from a failed test run happened to include exactly how the page looks to a screen reader, and it clearly showed the User dropdown was correctly labelled, flatly disagreeing with what I'd written down earlier.

Checked the actual page markup. The label genuinely is there, written in a slightly different but perfectly valid way than what my checking script knew to look for. My script only checked for one style of labelling and never considered this other, equally valid one. A gap in the tool I built, not a problem with the app.

Correcting it here, out in the open, rather than quietly deleting what I originally wrote. One good thing came out of it, fixing that gap made the checking tool more reliable for everything that came after.

The bigger lesson: whenever one of my own tools tells me something is broken, that's a claim about two things at once, the app, and the tool itself, and I only caught the difference here because a screenshot happened to show it. Next time, that's something to check on purpose, not stumble into by luck.