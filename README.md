# SDD Contract Gate

> Human-in-the-loop spec → contract → check → approval gate for DeepSeek Harness.
>
> Status: MVP (0.1.0). This plugin never approves, merges, or edits code.

## Why

Most "AI coding" tools optimize for producing more code. This plugin optimizes
for a smaller, auditable question:

```text
Does the repository still match the spec a human approved?
```

It is generic: no SciPal paths, no project-specific names, no LLM in the
compile/check path.

## Tools

| Tool | Purpose |
|---|---|
| `sdd_init` | Create `sdd/spec.json`, `sdd/approval.json`, `sdd/exceptions.json` |
| `sdd_hash` | Return the canonical SHA-256 of the spec for human approval |
| `sdd_compile` | Compile an approved spec into `sdd/out/` |
| `sdd_check` | Check approval, findings, and generated-artifact freshness |
| `sdd_gate` | Return `PASS` / `FAIL`; never auto-approves or merges |

## Quick start

```text
1. sdd_init
2. edit sdd/spec.json
3. sdd_hash
4. put the returned hash into sdd/approval.json
   and set approved_by / approved_at
5. sdd_compile
6. sdd_check
7. sdd_gate
```

`approval.json` must look like:

```json
{
  "schema_version": 1,
  "spec_sha256": "<hash from sdd_hash>",
  "approved_by": "human",
  "approved_at": "2026-11-20"
}
```

Blank approval is rejected. The plugin does not provide an "approve" tool.

## Spec example

```json
{
  "schema_version": 1,
  "project": "my-app",
  "rules": [
    {
      "id": "repo.required",
      "kind": "path.exists",
      "severity": "blocking",
      "paths": ["README.md"]
    },
    {
      "id": "api.routes.unique",
      "kind": "json.unique",
      "severity": "blocking",
      "file": "architecture.json",
      "pointer": "api.endpoints",
      "key": "route"
    }
  ]
}
```

## Supported rules (MVP)

```text
path.exists
json.unique
json.required
```

Unsupported rule kinds fail closed. More adapters are intentionally not added
until the core is stable.

## Exceptions

```json
{
  "schema_version": 1,
  "exceptions": [
    {
      "rule_id": "repo.required",
      "target": "LICENSE",
      "reason": "vendored fixture",
      "expires_on": "2026-12-31"
    }
  ]
}
```

Targets are exact; wildcards and expired exceptions fail.

## Output

```text
sdd/out/manifest.json
sdd/out/checks.json
sdd/out/coverage.json
sdd/out/report.md
```

`manifest.json` is deterministic: same spec + same repository -> same bytes.

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

## Development

```bash
node --test test/*.test.js
```

For a local DSH bundle, install the directory through the DSH Plugin Manager
(`install_bundle` with this absolute package directory). Then call
`sdd_init` from the workspace.

## License

MIT. The public SciPal snapshot is AGPL; this plugin is independent and
contains no SciPal code or data.
