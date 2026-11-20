import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { check, compile, gate, hashSpec, init, sha256Text } from '../lib/sdd.js';

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-gate-'));
  await fs.mkdir(path.join(root, 'sdd'), { recursive: true });
  await fs.writeFile(path.join(root, 'README.md'), '# demo\n');
  await fs.writeFile(path.join(root, 'architecture.json'), JSON.stringify({
    api: { endpoints: [{ route: '/health' }, { route: '/items' }] }
  }));
  const spec = {
    schema_version: 1,
    project: 'demo',
    rules: [
      { id: 'repo.required', kind: 'path.exists', paths: ['README.md'] },
      { id: 'routes.unique', kind: 'json.unique', file: 'architecture.json', pointer: 'api.endpoints', key: 'route' }
    ]
  };
  const specText = JSON.stringify(spec, null, 2) + '\n';
  await fs.writeFile(path.join(root, 'sdd', 'spec.json'), specText);
  await fs.writeFile(path.join(root, 'sdd', 'approval.json'), JSON.stringify({
    schema_version: 1,
    spec_sha256: sha256Text(specText),
    approved_by: 'human',
    approved_at: '2026-11-20'
  }));
  await fs.writeFile(path.join(root, 'sdd', 'exceptions.json'), JSON.stringify({
    schema_version: 1,
    exceptions: []
  }));
  return root;
}

test('compile/check pass and produce deterministic artifacts', async () => {
  const root = await workspace();
  const result = await compile(root);
  assert.equal(result.status, 'pass');
  const checked = await check(root);
  assert.equal(checked.ok, true);
  const first = await fs.readFile(path.join(root, 'sdd', 'out', 'manifest.json'), 'utf8');
  await compile(root);
  const second = await fs.readFile(path.join(root, 'sdd', 'out', 'manifest.json'), 'utf8');
  assert.equal(first, second);
});

test('duplicate routes fail the gate', async () => {
  const root = await workspace();
  await fs.writeFile(path.join(root, 'architecture.json'), JSON.stringify({
    api: { endpoints: [{ route: '/health' }, { route: '/health' }] }
  }));
  const result = await compile(root);
  assert.equal(result.status, 'fail');
  assert.ok(result.findings.some((f) => f.message.includes('duplicate')));
});

test('missing generated manifest is reported by check', async () => {
  const root = await workspace();
  const checked = await check(root);
  assert.equal(checked.ok, false);
  assert.match(checked.errors[0], /missing generated manifest/);
});

test('stale artifacts are reported after a rule finding changes', async () => {
  const root = await workspace();
  await compile(root);
  await fs.rm(path.join(root, 'README.md'));
  const checked = await check(root);
  assert.equal(checked.ok, false);
  assert.match(checked.errors[0], /stale/);
});

test('init creates templates and blank approval is rejected', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-init-'));
  await init(root);
  const spec = await fs.readFile(path.join(root, 'sdd', 'spec.json'), 'utf8');
  assert.ok(spec.includes('repo.required'));
  const hashed = await hashSpec(root);
  assert.match(hashed.spec_sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(() => compile(root), /not human-approved/);
});

test('approval JSON with UTF-8 BOM is accepted', async () => {
  const root = await workspace();
  const file = path.join(root, 'sdd', 'approval.json');
  const approval = JSON.parse(await fs.readFile(file, 'utf8'));
  await fs.writeFile(file, '\uFEFF' + JSON.stringify(approval, null, 2) + '\n');
  const result = await compile(root);
  assert.equal(result.status, 'pass');
});

test('gate returns FAIL when a blocking rule fails', async () => {
  const root = await workspace();
  await fs.writeFile(path.join(root, 'architecture.json'), JSON.stringify({
    api: { endpoints: [{ route: '/health' }, { route: '/health' }] }
  }));
  await compile(root);
  const result = await gate(root);
  assert.equal(result.ok, false);
  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.errors.some((error) => error.includes('duplicate')));
});
