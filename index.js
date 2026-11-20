import { defineTool } from '@deepseek-ai/dsh-tools';
import { check, compile, gate, hashSpec, init } from './lib/sdd.js';

export const name = 'sdd-gate';
export const inject = ['tools'];

function text(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}

function tool(name, description, handler, parameters = {}) {
  return defineTool({
    name,
    description,
    parameters: {
      root: { type: 'string', required: false, description: 'Workspace root; defaults to cwd' },
      ...parameters
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => text(value)
    },
    async execute(args) {
      try {
        return JSON.stringify(await handler(args.root || process.cwd(), args));
      } catch (error) {
        return JSON.stringify({ ok: false, error: error.message });
      }
    }
  });
}

export function apply(ctx) {
  ctx.tools.register(tool(
    'sdd_init',
    'Create sdd/spec.json, approval.json and exceptions.json in a workspace.',
    (root, args) => init(root, { force: Boolean(args.force) }),
    { force: { type: 'boolean', required: false, description: 'Overwrite existing sdd files' } }
  ));

  ctx.tools.register(tool(
    'sdd_hash',
    'Return the canonical SHA-256 of sdd/spec.json for human approval.',
    (root) => hashSpec(root)
  ));

  ctx.tools.register(tool(
    'sdd_compile',
    'Compile the approved sdd/spec.json into deterministic sdd/out artifacts.',
    (root) => compile(root, { write: true })
  ));

  ctx.tools.register(tool(
    'sdd_check',
    'Check approval, findings and generated-artifact freshness without writing.',
    (root) => check(root)
  ));

  ctx.tools.register(tool(
    'sdd_gate',
    'Return PASS/FAIL for a release gate. Never approves, merges, or edits code.',
    (root) => gate(root)
  ));
}
