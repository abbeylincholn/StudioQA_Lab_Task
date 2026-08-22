# RELEASE_DECISION.md

**My decision: don't ship yet. Hold it back.**

> **Confirmed, seen in testing:** a customer was charged twice after a slow request and a retry.
> A job stayed stuck "in progress" forever after a brief hiccup, even though it had actually
> finished. A video previewed fine but failed to download on one browser.
>
> **Not yet confirmed:** one reviewer says they saw another customer's data, but that's a single,
> unreproduced report.

**Why hold, not a small limited release?** The stuck screen is exactly what makes a customer
retry, and retrying is what's charging people twice — a smaller release just means fewer people
get double-charged, not zero. The unconfirmed report decides it: if a customer really can see
another customer's private data, no release size makes that acceptable.

**Right now:** stop the release. Disable retry, even if it just does nothing for now — that alone
closes the double-charge path. Fix the one known customer's balance and refund them.

**Check next, in order:** (1) search for any repeated "ticket number" across jobs — shows how
widespread the double-charging already is; (2) try hard to recreate the reviewer's report exactly,
and check the logs directly; (3) pin down which browser and file type causes the failed download.

**Before this ships:** build tests for each of these problems, watch them fail, fix until they
pass. Release quietly to staff first, then a small slice of customers, watching for repeat charges
and stuck jobs. Brief support today. Contact the affected customer directly. Start drafting a
formal notice now, in case the data-privacy report turns out real.

**What changes my mind:** the privacy report proven a display glitch with nothing in the logs,
plus both money problems fixed and tested — moves this to a small limited release. Any real proof
of the privacy report makes this a full incident, immediately.
