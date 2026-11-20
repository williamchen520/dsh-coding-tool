# RUNBOOK — SDD Contract Gate

Last updated: 2026-11-20

This is the short version to resume the project after a long gap.

## What it is

A DSH plugin that turns an approved spec into a deterministic PASS/FAIL gate.
It is not an AI code generator, does not call an LLM, and never auto-merges.

Extracted from SciPal:

- https://github.com/williamchen520/scipal-public

## Canonical links

```text
Plugin repo:
https://github.com/williamchen520/dsh-coding-tool

Release:
https://github.com/williamchen520/dsh-coding-tool/releases/tag/v0.1.0

Market index:
https://raw.githubusercontent.com/williamchen520/dsh-coding-tool/main/market/index.json

SciPal:
https://github.com/williamchen520/scipal-public

dsh.so submission:
issue #771, pending review
```

## Current state

```text
version: 0.1.0
license: MIT
tests: 7/7
DSH install: verified locally
PASS path: verified
FAIL path: verified
dsh.so: submitted, not yet listed
```

## Quick verification

```bash
cd D:\dsh-coding-tool
node --test test/*.test.js
```

Expected:

```text
7 tests passed
```

## Use in DSH

Install the local bundle:

```text
D:\dsh-coding-tool
```

Then in a workspace:

```text
sdd_init
sdd_hash
# write the hash into sdd/approval.json
# set approved_by and approved_at
sdd_compile
sdd_check
sdd_gate
```

## Update the plugin

```text
1. edit code / README
2. node --test test/*.test.js
3. bump version in package.json
4. commit
5. tag vX.Y.Z
6. push main and tag
7. create GitHub Release
8. update market/index.json version + source.commit + publishTimestamp
9. validate market/index.json with parseMarketIndex
10. commit/push market/index.json
```

Do not move an existing tag; create a new one.

## Validate the market index

Use the official parser:

```js
import { parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index';
const parsed = parseMarketIndex(json, indexUrl);
```

The index must satisfy format 1. A checked entry currently points at commit
`e162924`.

## dsh.so status

```text
submitted: 2026-11-20
submission id: 0f2cd7916e7ef411305dac2c100ea620
issue: #771
state: pending maintainer review
```

Do not resubmit repeatedly. dsh.so merges schema-valid entries manually and
does not guarantee an ETA.

## What not to claim

```text
production-grade
solves model hallucination
guarantees biological correctness
already listed on dsh.so
```

The honest boundary:

```text
It checks whether the repository still matches the spec a human approved.
It does not verify biological conclusions.
```
