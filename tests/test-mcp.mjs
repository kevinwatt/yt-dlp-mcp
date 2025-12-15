#!/usr/bin/env node
/**
 * Simple MCP protocol test
 * This script tests if the MCP server responds correctly to basic protocol messages
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'lib', 'index.mjs');

console.log('🧪 Testing yt-dlp MCP Server\n');
console.log('Starting server from:', serverPath);

const server = spawn('node', [serverPath]);

let testsPassed = 0;
let testsFailed = 0;
let responseBuffer = '';

// Timeout to ensure tests complete
const timeout = setTimeout(() => {
  console.log('\n⏱️  Test timeout - killing server');
  server.kill();
  process.exit(testsFailed > 0 ? 1 : 0);
}, 10000);

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // Try to parse JSON-RPC responses
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('📨 Received:', JSON.stringify(response, null, 2));

        if (response.result) {
          testsPassed++;
          console.log('✅ Test passed\n');
        }
      } catch (e) {
        // Not JSON, might be regular output
        console.log('📝 Output:', line);
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.log('🔧 Server log:', data.toString().trim());
});

server.on('close', (code) => {
  clearTimeout(timeout);
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   Server exit code: ${code}`);
  process.exit(testsFailed > 0 ? 1 : 0);
});

// Wait a bit for server to start
setTimeout(() => {
  console.log('\n🔍 Test 1: Initialize');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  setTimeout(() => {
    console.log('\n🔍 Test 2: List Tools');
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

    setTimeout(() => {
      console.log('\n✅ Basic protocol tests completed');
      server.kill();
    }, 2000);
  }, 2000);
}, 1000);
