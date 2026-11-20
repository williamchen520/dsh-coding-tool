# DSH plugin market index

This directory hosts a format-1 DSH plugin market index for **SDD Contract Gate**.

Index URL:

```text
https://raw.githubusercontent.com/williamchen520/dsh-coding-tool/main/market/index.json
```

## Use it in DSH

1. Open **Plugins → Discover**
2. Enable the experimental **Custom plugin indexes** bundle if needed
3. **Add index source**
4. Paste the URL above

The index is validated with the official
`@deepseek-ai/dsh-plugin-market-index` parser.

## Entry

```text
name: dsh-coding-tool
version: 0.1.0
source: git commit e162924
category: dev
```

The version is pinned to a commit, not a moving branch.

## dsh.so submission

```text
submitted: 2026-11-20
submission id: 0f2cd7916e7ef411305dac2c100ea620
issue: #771
status: pending maintainer review
```

Submission is not the same as being listed. dsh.so merges schema-valid
entries manually; no ETA is guaranteed.

