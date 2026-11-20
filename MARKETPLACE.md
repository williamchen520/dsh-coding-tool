# Marketplace listing — SDD Contract Gate

## Short description

**Stop shipping code that passes tests but silently drifts from the spec a human approved.**

## Tagline

**Spec → Contract → Check → Human Approval. No auto-merge.**

## Long description

AI-assisted coding has a verification gap. Tests can pass while the repository
quietly stops matching the architecture, API contract, or release rules a human
actually approved.

**SDD Contract Gate** turns that invisible drift into a deterministic
**PASS / FAIL** before review or merge.

It compiles a human-approved spec into concrete checks, refuses stale generated
artifacts, binds approval to a spec hash, and makes every exception explicit and
expiring. It does not call an LLM, does not auto-approve, and does not merge.

**Make “it compiles” mean “it still matches what a human approved.”**

## What it solves

- **Spec drift:** code moves, the approved contract does not.
- **Route duplication:** two endpoints quietly claim the same path.
- **Stale generated artifacts:** the manifest says PASS but was built from an old spec.
- **Unreviewable diffs:** reviewers cannot tell which architectural promises changed.
- **Rubber-stamp approvals:** “approved” is a checkbox, not a hash-bound decision.

## What it achieves

- **One deterministic gate:** `sdd_gate` returns PASS only when the repo still matches the approved spec.
- **Smaller review surface:** reviewers inspect findings and spec changes, not a 100k-line diff.
- **Auditable exceptions:** exact target, reason, expiry; wildcards fail.
- **Fail-closed behavior:** unsupported rules and stale artifacts fail instead of silently passing.
- **Human control:** the plugin never approves, merges, or edits code.

## Built from a real system

Extracted from **SciPal**, an auditable biomedical RAG platform, then generalized
to remove all project-specific paths and data.

- SciPal public code: https://github.com/williamchen520/scipal-public
- Reference scale: 13,276 papers, 316 routes, 1,496 tests
- Evaluation: 50-question internal study + 300-claim SciFact sanity check

## Who it is for

- Teams using AI coding agents on production repositories
- Platform / backend teams with route or schema contracts
- Research engineers who need reproducible, auditable changes
- Anyone who wants a release gate that is not another LLM opinion

## Install

Install the bundle through the DSH Plugin Manager, then run:

```text
sdd_init
sdd_hash
# put the hash into sdd/approval.json and set approved_by / approved_at
sdd_compile
sdd_check
sdd_gate
```

## Safety boundary

```text
no LLM in compile/check
no shell command execution in MVP
no network
no secret reading
no auto-approval
no auto-merge
no project-specific paths
```

## Not a replacement for

Tests, CI, code review, or a human owner. It is a **spec-level gate** that sits
before those steps.

## Status

MVP, v0.1.0. Supported rules: `path.exists`, `json.unique`, `json.required`.

## License

MIT. SciPal's public snapshot is AGPL; this plugin is independent and contains
no SciPal code or data.
