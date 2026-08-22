This table is essentially a **risk register** for a multi-tenant job/credit system. Each row says:

* **L (Likelihood):** how likely the problem is to occur.
* **I (Impact):** how serious it would be if it occurred.
* **Score:** `L × I`.
* **Why:** the evidence or reasoning behind the rating.

The important point is that these aren't just generic software risks. Most of them target **invariants**—rules the system must always preserve.

### R1 — Cross-workspace access: 20

> A user can see or modify another workspace's jobs.

This is the most serious security risk.

If the API accepts something like:

`x-workspace-id: workspace-B`

and trusts that header to decide which workspace the request belongs to, a malicious user from workspace A might simply change the header to B.

The fundamental problem is:

**The client is asserting its own authorization scope.**

The server should instead derive the user's permitted workspace(s) from their authenticated identity/session and then verify that the requested resource belongs to that workspace.

Why **4 × 5**?

* **Likelihood 4:** this is a very common multi-tenant implementation mistake.
* **Impact 5:** successful exploitation can expose or alter another customer's data.

So this deserves immediate testing.

---

### R2 — Double charge from idempotency failure: 20

Suppose a user submits a job and gets charged 1 credit.

The request times out before the UI receives the response.

The user thinks:

> "It probably didn't work. I'll retry."

If the server treats the retry as a brand-new job, the user gets charged again.

That's what **idempotency** is supposed to prevent.

For example, both requests might contain:

`idempotency-key = abc123`

The backend should recognize that `abc123` has already been processed and return the original result rather than performing the operation again.

Why **4 × 5**?

* **Likelihood 4:** timeouts and retries are normal in asynchronous systems.
* **Impact 5:** duplicate charging is direct financial/customer harm.

The editable idempotency key makes this especially worth testing: you can deliberately submit the same key multiple times.

---

### R3 — Incorrect refunds: 20

The invariant is:

> A failed job refunds its reserved credit **exactly once**.

"Exactly once" contains two separate failure cases.

**Case A — no refund**

1. Balance = 3
2. Job reserves 1 → balance = 2
3. Job fails
4. Refund logic doesn't run
5. Balance remains 2

The customer has effectively paid for a failed job.

**Case B — double refund**

1. Balance = 3
2. Job reserves 1 → balance = 2
3. Job fails
4. Refund happens → 3
5. Retry/error handler refunds again → 4

Now the system has created a credit.

This is particularly dangerous in asynchronous systems because multiple pieces of code may react to the same failure.

---

### R4 — Viewer can create jobs: 16

The intended rule is:

* **Editor:** can create jobs
* **Viewer:** can inspect jobs only

A weak implementation might enforce this only in the UI:

> "Hide the Create Job button for Viewers."

But hiding a button isn't authorization.

A Viewer can potentially call the API directly:

`POST /jobs`

If the backend doesn't independently check the user's role, the Viewer can create a job anyway.

This is a **privilege escalation** problem.

The key test is therefore not:

> "Can a Viewer see the Create button?"

It's:

> "Can a Viewer successfully make the create-job API request?"

---

### R5 — Job gets permanently stuck: 16

The job has something like:

`queued → processing → succeeded`

or

`queued → processing → failed`

The concern is that an error in the timer/state-transition logic could leave it permanently at:

`queued`

or

`processing`.

That matters because the system has already reserved a credit.

So the user could end up with:

> Job: Processing forever
> Credit: Gone forever

A good system needs a way to detect and recover from jobs that exceed a reasonable processing time—often through a timeout, watchdog, retry, or explicit failure transition.

---

### R6 — Credit accounting race condition: 15

This is a **concurrency** problem.

Imagine Ava has exactly **1 credit**.

Two requests arrive almost simultaneously.

If both effectively do:

1. Read balance = 1
2. Check `1 >= 1`
3. Deduct 1

both requests can succeed.

The resulting accounting could be:

`1 → 0 → -1`

even though the customer only had one credit.

The underlying issue is that:

**"Check balance" and "deduct credit" must behave as one atomic operation.**

This becomes particularly important because the system has both **reserve** and **refund** operations happening asynchronously.

---

### R7 — UI/API disagreement: 12

Here the backend might actually be correct, while the UI shows old information.

For example:

1. Balance = 3
2. User creates job
3. Backend correctly reserves 1
4. Backend balance = 2
5. UI still displays 3

The manual **Refresh** button is a clue that the UI isn't automatically synchronized.

This is less catastrophic than R1–R6, but it can make testing confusing because you might think the backend is broken when you're actually looking at stale client state.

It can also work in the opposite direction: a stale UI could hide a real backend defect.

---

### R8 — Tablet/accessibility problems: 9

This is primarily a **usability and compliance** risk rather than a data-integrity risk.

The explicit requirement says the workflow must work on:

* desktop Chromium
* tablet-sized viewport

That means the responsive layout is part of the contract.

Possible failures include:

* buttons becoming unreachable
* tables overflowing horizontally
* dialogs extending beyond the viewport
* form fields becoming difficult to use
* insufficient keyboard/focus accessibility
* poor contrast or missing labels

The impact is lower because this doesn't necessarily corrupt data or expose another customer's information.

---

## Why the ordering makes sense

The scores essentially prioritize the risks like this:

| Priority | Risks      | Main concern                                       |
| -------- | ---------- | -------------------------------------------------- |
| **20**   | R1, R2, R3 | Security + money + accounting                      |
| **16**   | R4, R5     | Authorization + workflow integrity                 |
| **15**   | R6         | Financial/accounting correctness under concurrency |
| **12**   | R7         | Data freshness / misleading UI                     |
| **9**    | R8         | Usability/accessibility                            |

The key insight is that **R1–R6 are backend/invariant risks**, whereas R7–R8 are mostly presentation/UX risks.

So if you're using this as a testing plan, I'd test in roughly this order:

**R1 → R2 → R3 → R4 → R6 → R5 → R7 → R8**

because you want to establish first that the system **cannot leak another tenant's data, charge incorrectly, create unauthorized jobs, or corrupt credits**. Those failures are much more consequential than a broken tablet layout.
