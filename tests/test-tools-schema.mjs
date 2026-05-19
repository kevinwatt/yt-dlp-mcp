#!/usr/bin/env node
/**
 * Regression test: tools/list inputSchema wire format.
 *
 * Guards against the bug fixed in v0.8.5 where each tool's inputSchema was a
 * serialized Zod object instead of valid JSON Schema. Clients could connect
 * and even call tools (the server did its own Zod parse), but tools/list
 * payloads were not introspectable.
 *
 * What this asserts, for every tool returned by tools/list:
 *   - inputSchema is an object with type === "object"
 *   - inputSchema.properties is a non-empty plain object
 *   - JSON.stringify -> JSON.parse round-trip preserves the schema shape
 *     (a serialized Zod object would lose its content under round-trip)
 *
 * Run from repo root:
 *   npm run prepare && node tests/test-tools-schema.mjs
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_PATH = join(__dirname, '..', 'lib', 'index.mjs');

const EXPECTED_TOOLS = [
  'ytdlp_download_audio',
  'ytdlp_download_transcript',
  'ytdlp_download_video',
  'ytdlp_download_video_subtitles',
  'ytdlp_get_video_comments',
  'ytdlp_get_video_comments_summary',
  'ytdlp_get_video_metadata',
  'ytdlp_get_video_metadata_summary',
  'ytdlp_list_subtitle_languages',
  'ytdlp_search_videos',
];

const failures = [];
function fail(msg) { failures.push(msg); console.log(`  ✗ ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }

const child = spawn('node', [SERVER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });

let stdoutBuf = '';
const pending = new Map();
let nextId = 1;

child.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString('utf8');
  let nl;
  while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
    const line = stdoutBuf.slice(0, nl).trim();
    stdoutBuf = stdoutBuf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      // ignore non-JSON noise
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write('[server stderr] ' + d));

function send(method, params) {
  const id = nextId++;
  const req = { jsonrpc: '2.0', id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify(req) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout for ${method}`));
      }
    }, 10000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

async function main() {
  console.log('Regression: tools/list inputSchema wire format\n');

  // 1. Initialize
  const initRes = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'regression-tools-schema', version: '1' },
  });
  if (!initRes.result?.serverInfo?.name) {
    fail('initialize did not return serverInfo.name');
  } else {
    pass(`initialize -> ${initRes.result.serverInfo.name}@${initRes.result.serverInfo.version}`);
  }
  notify('notifications/initialized');

  // 2. tools/list
  const listRes = await send('tools/list', {});
  const tools = listRes.result?.tools;
  if (!Array.isArray(tools)) {
    fail('tools/list did not return a tools array');
    child.kill();
    return;
  }

  // 3. All expected tools present
  const got = tools.map((t) => t.name).sort();
  const want = [...EXPECTED_TOOLS].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fail(`tool name set mismatch\n    got:  ${got.join(', ')}\n    want: ${want.join(', ')}`);
  } else {
    pass(`tools/list returned all ${tools.length} expected tools`);
  }

  // 4. Per-tool schema validation
  for (const tool of tools) {
    const ctx = `[${tool.name}]`;

    if (!isPlainObject(tool.inputSchema)) {
      fail(`${ctx} inputSchema is not a plain object (got ${typeof tool.inputSchema})`);
      continue;
    }
    if (tool.inputSchema.type !== 'object') {
      fail(`${ctx} inputSchema.type must be "object" (got ${JSON.stringify(tool.inputSchema.type)})`);
      continue;
    }
    if (!isPlainObject(tool.inputSchema.properties)) {
      fail(`${ctx} inputSchema.properties is not a plain object`);
      continue;
    }
    const propCount = Object.keys(tool.inputSchema.properties).length;
    if (propCount === 0) {
      fail(`${ctx} inputSchema.properties is empty`);
      continue;
    }

    // JSON round-trip: the original bug serialized a Zod object whose enumerable
    // surface didn't actually carry the schema content. After parse-back, the
    // shape disappeared. Valid JSON Schema survives unchanged.
    const roundTripped = JSON.parse(JSON.stringify(tool.inputSchema));
    if (roundTripped.type !== 'object') {
      fail(`${ctx} round-tripped inputSchema lost type:"object"`);
      continue;
    }
    if (Object.keys(roundTripped.properties).length !== propCount) {
      fail(`${ctx} round-tripped properties changed (was ${propCount}, now ${Object.keys(roundTripped.properties).length})`);
      continue;
    }

    // Each property descriptor should itself be a plain object with a type or anyOf/oneOf/$ref.
    for (const [propName, propSchema] of Object.entries(roundTripped.properties)) {
      if (!isPlainObject(propSchema)) {
        fail(`${ctx} property "${propName}" is not a plain object`);
        continue;
      }
      const hasShape = 'type' in propSchema || 'anyOf' in propSchema || 'oneOf' in propSchema || '$ref' in propSchema || 'enum' in propSchema;
      if (!hasShape) {
        fail(`${ctx} property "${propName}" has no type/anyOf/oneOf/$ref/enum — likely a serialized Zod object`);
      }
    }

    pass(`${ctx} inputSchema is valid JSON Schema (${propCount} properties)`);
  }

  // 5. Spot-check that annotations from registerTool reach the client.
  const search = tools.find((t) => t.name === 'ytdlp_search_videos');
  if (search?.annotations?.readOnlyHint !== true) {
    fail('ytdlp_search_videos annotations.readOnlyHint should be true');
  } else {
    pass('annotations.readOnlyHint forwarded for ytdlp_search_videos');
  }
  const dlVideo = tools.find((t) => t.name === 'ytdlp_download_video');
  if (dlVideo?.annotations?.readOnlyHint !== false) {
    fail('ytdlp_download_video annotations.readOnlyHint should be false');
  } else {
    pass('annotations.readOnlyHint forwarded for ytdlp_download_video');
  }

  child.kill();
}

main()
  .catch((err) => {
    fail(`fatal: ${err.message}`);
    child.kill();
  })
  .finally(() => {
    setTimeout(() => {
      console.log('');
      if (failures.length === 0) {
        console.log(`✅ PASS — all assertions held`);
        process.exit(0);
      } else {
        console.log(`❌ FAIL — ${failures.length} assertion(s) failed:`);
        for (const f of failures) console.log(`   - ${f}`);
        process.exit(1);
      }
    }, 100);
  });
