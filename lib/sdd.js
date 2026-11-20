import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SPEC = {
  schema_version: 1,
  project: 'my-app',
  rules: [
    {
      id: 'repo.required',
      kind: 'path.exists',
      severity: 'blocking',
      paths: ['README.md']
    },
    {
      id: 'api.routes.unique',
      kind: 'json.unique',
      severity: 'blocking',
      file: 'architecture.json',
      pointer: 'api.endpoints',
      key: 'route'
    }
  ]
};

const DEFAULT_EXCEPTIONS = { schema_version: 1, exceptions: [] };

export function normalizeText(text) {
  return String(text).replace(/\r\n/g, '\n');
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function pointerGet(value, pointer = '') {
  if (!pointer) return value;
  const parts = pointer.startsWith('/')
    ? pointer.slice(1).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    : pointer.split('.');
  let current = value;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function isBlocking(rule) {
  return (rule.severity || 'blocking') === 'blocking';
}

function exceptionMatches(exception, finding) {
  return exception.rule_id === finding.rule_id && exception.target === finding.target;
}

function validateExceptions(exceptions, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  for (const exception of exceptions.exceptions || []) {
    if (!exception.rule_id || !exception.target || !exception.reason) {
      errors.push(`exception must include rule_id, target, reason: ${JSON.stringify(exception)}`);
    }
    if (exception.target && /[*?]/.test(exception.target)) {
      errors.push(`exception target must be exact, no wildcards: ${exception.target}`);
    }
    if (exception.expires_on && exception.expires_on < today) {
      errors.push(`exception expired: ${exception.rule_id} -> ${exception.target}`);
    }
  }
  return errors;
}

async function evaluateRule(root, rule) {
  const findings = [];
  const push = (target, message) => findings.push({
    rule_id: rule.id,
    kind: rule.kind,
    severity: rule.severity || 'blocking',
    target,
    message
  });

  if (rule.kind === 'path.exists') {
    for (const rel of rule.paths || []) {
      try {
        await fs.access(path.join(root, rel));
      } catch {
        push(rel, `required path is missing: ${rel}`);
      }
    }
    return findings;
  }

  if (rule.kind === 'json.unique') {
    const file = path.join(root, rule.file || '');
    let value;
    try {
      value = await readJson(file);
    } catch (error) {
      push(rule.file || '<json>', `cannot read JSON: ${error.message}`);
      return findings;
    }
    const rows = pointerGet(value, rule.pointer || '');
    if (!Array.isArray(rows)) {
      push(`${rule.file}#${rule.pointer}`, 'JSON pointer is not an array');
      return findings;
    }
    const seen = new Map();
    for (const row of rows) {
      const key = row?.[rule.key];
      if (key == null) continue;
      if (seen.has(key)) {
        push(`${rule.file}#${rule.pointer}/${key}`, `duplicate ${rule.key}: ${key}`);
      }
      seen.set(key, true);
    }
    return findings;
  }

  if (rule.kind === 'json.required') {
    const file = path.join(root, rule.file || '');
    let value;
    try {
      value = await readJson(file);
    } catch (error) {
      push(rule.file || '<json>', `cannot read JSON: ${error.message}`);
      return findings;
    }
    const rows = pointerGet(value, rule.pointer || '');
    if (!Array.isArray(rows)) {
      push(`${rule.file}#${rule.pointer}`, 'JSON pointer is not an array');
      return findings;
    }
    for (const row of rows) {
      for (const field of rule.fields || []) {
        if (row?.[field] == null || row[field] === '') {
          push(`${rule.file}#${rule.pointer}/${rule.key || 'id'}`, `missing field ${field}`);
        }
      }
    }
    return findings;
  }

  push(rule.id, `unsupported rule kind: ${rule.kind}`);
  return findings;
}

export async function evaluate(root, write = true) {
  const base = path.resolve(root || '.');
  const specPath = path.join(base, 'sdd', 'spec.json');
  const approvalPath = path.join(base, 'sdd', 'approval.json');
  const exceptionsPath = path.join(base, 'sdd', 'exceptions.json');

  const specText = await fs.readFile(specPath, 'utf8');
  const spec = JSON.parse(specText);
  const approval = await readJson(approvalPath).catch(() => ({}));
  const exceptions = await readJson(exceptionsPath).catch(() => DEFAULT_EXCEPTIONS);
  const specHash = sha256Text(specText);

  if (!approval.approved_by || !approval.approved_at) {
    throw new Error(`spec is not human-approved: set approved_by and approved_at in sdd/approval.json`);
  }
  if (approval.spec_sha256 !== specHash) {
    throw new Error(`spec approval mismatch: approval=${approval.spec_sha256 || 'missing'} current=${specHash}`);
  }
  const exceptionErrors = validateExceptions(exceptions);
  if (exceptionErrors.length) throw new Error(exceptionErrors.join('; '));

  const findings = [];
  const rules = [];
  for (const rule of spec.rules || []) {
    if (!rule.id || !rule.kind) {
      findings.push({
        rule_id: rule.id || '<rule>',
        kind: rule.kind || '<kind>',
        severity: 'blocking',
        target: rule.id || '<rule>',
        message: 'rule must include id and kind'
      });
      continue;
    }
    const ruleFindings = await evaluateRule(base, rule);
    findings.push(...ruleFindings);
    rules.push({
      id: rule.id,
      kind: rule.kind,
      status: ruleFindings.length ? 'fail' : 'pass'
    });
  }

  const blocking = findings.filter((f) => isBlocking(f) && !(exceptions.exceptions || []).some((e) => exceptionMatches(e, f)));
  const status = blocking.length ? 'fail' : 'pass';
  const manifest = {
    schema_version: 1,
    project: spec.project || 'unnamed',
    spec_sha256: specHash,
    status,
    rules,
    findings
  };

  if (write) {
    const out = path.join(base, 'sdd', 'out');
    await writeJson(path.join(out, 'manifest.json'), manifest);
    await writeJson(path.join(out, 'checks.json'), { findings });
    await writeJson(path.join(out, 'coverage.json'), {
      project: manifest.project,
      spec_sha256: specHash,
      rules: rules.map((r) => ({ ...r, status: r.status }))
    });
    await fs.writeFile(path.join(out, 'report.md'), renderReport(manifest), 'utf8');
  }

  return { manifest, findings, status, specHash };
}

export function renderReport(manifest) {
  const lines = [
    `# SDD report: ${manifest.project}`,
    '',
    `Status: **${manifest.status.toUpperCase()}**`,
    '',
    `Spec: \`${manifest.spec_sha256}\``,
    '',
    '| Rule | Kind | Status |',
    '|---|---|---|',
    ...manifest.rules.map((r) => `| ${r.id} | ${r.kind} | ${r.status} |`),
    ''
  ];
  if (manifest.findings.length) {
    lines.push('## Findings', '');
    for (const f of manifest.findings) {
      lines.push(`- [${f.severity}] ${f.rule_id}: ${f.message} (${f.target})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export async function compile(root, { write = true } = {}) {
  return evaluate(root, write);
}

export async function check(root) {
  const base = path.resolve(root || '.');
  const result = await evaluate(base, false);
  const manifestPath = path.join(base, 'sdd', 'out', 'manifest.json');
  let actual;
  try {
    actual = await readJson(manifestPath);
  } catch {
    return { ok: false, errors: ['missing generated manifest: run sdd compile'], result };
  }
  const expected = JSON.stringify(result.manifest);
  const observed = JSON.stringify(actual);
  if (expected !== observed) {
    return { ok: false, errors: ['generated artifacts are stale: rerun sdd compile'], result };
  }
  return { ok: true, errors: [], result };
}

export async function gate(root) {
  const checked = await check(root);
  return { ...checked, verdict: checked.ok ? 'PASS' : 'FAIL' };
}

export async function init(root, { force = false } = {}) {
  const base = path.resolve(root || '.');
  const sdd = path.join(base, 'sdd');
  await fs.mkdir(sdd, { recursive: true });
  const specPath = path.join(sdd, 'spec.json');
  const approvalPath = path.join(sdd, 'approval.json');
  const exceptionsPath = path.join(sdd, 'exceptions.json');
  for (const file of [specPath, approvalPath, exceptionsPath]) {
    try {
      await fs.access(file);
      if (!force) throw new Error(`refusing to overwrite ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await writeJson(specPath, DEFAULT_SPEC);
  await writeJson(approvalPath, {
    schema_version: 1,
    spec_sha256: '',
    approved_by: 'human',
    approved_at: ''
  });
  await writeJson(exceptionsPath, DEFAULT_EXCEPTIONS);
  return { root: base, files: [specPath, approvalPath, exceptionsPath] };
}

export async function hashSpec(root) {
  const base = path.resolve(root || '.');
  const specPath = path.join(base, 'sdd', 'spec.json');
  const text = await fs.readFile(specPath, 'utf8');
  return { spec_sha256: sha256Text(text), spec_path: specPath };
}
