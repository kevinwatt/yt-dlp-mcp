#!/usr/bin/env node
/**
 * Real-world MCP server test with actual YouTube video
 * Tests multiple tools with https://www.youtube.com/watch?v=dQw4w9WgXcQ
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'lib', 'index.mjs');
const TEST_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

console.log('🎬 Testing yt-dlp MCP Server with Real Video\n');
console.log('Video:', TEST_VIDEO);
console.log('Starting server from:', serverPath, '\n');

const server = spawn('node', [serverPath]);

let testsPassed = 0;
let testsFailed = 0;
let responseBuffer = '';
let requestId = 0;
let currentTest = '';

// Timeout to ensure tests complete
const timeout = setTimeout(() => {
  console.log('\n⏱️  Test timeout - killing server');
  server.kill();
  printResults();
}, 60000); // 60 seconds for real API calls

function printResults() {
  clearTimeout(timeout);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Final Test Results:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`${'='.repeat(60)}`);
  process.exit(testsFailed > 0 ? 1 : 0);
}

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // Try to parse JSON-RPC responses
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);

        if (response.error) {
          console.log(`❌ ${currentTest} - ERROR`);
          console.log('   Error:', response.error.message);
          testsFailed++;
        } else if (response.result) {
          handleTestResult(response);
        }
      } catch (e) {
        // Not JSON, might be regular output
      }
    }
  });
});

server.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output && !output.includes('ExperimentalWarning')) {
    console.log('🔧 Server:', output);
  }
});

server.on('close', (code) => {
  printResults();
});

function handleTestResult(response) {
  const content = response.result.content?.[0]?.text || JSON.stringify(response.result);

  if (currentTest === 'Initialize') {
    console.log('✅ Initialize - PASSED');
    console.log(`   Protocol: ${response.result.protocolVersion}`);
    console.log(`   Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}\n`);
    testsPassed++;
  }
  else if (currentTest === 'Get Metadata Summary') {
    if (content.includes('Rick Astley') || content.includes('Never Gonna Give You Up')) {
      console.log('✅ Get Metadata Summary - PASSED');
      console.log('   Response preview:');
      const lines = content.split('\n').slice(0, 5);
      lines.forEach(line => console.log(`   ${line}`));
      console.log('   ...\n');
      testsPassed++;
    } else {
      console.log('❌ Get Metadata Summary - FAILED');
      console.log('   Expected Rick Astley content, got:', content.substring(0, 100));
      testsFailed++;
    }
  }
  else if (currentTest === 'List Subtitle Languages') {
    if (content.includes('en') || content.includes('English')) {
      console.log('✅ List Subtitle Languages - PASSED');
      console.log('   Found subtitle languages\n');
      testsPassed++;
    } else {
      console.log('❌ List Subtitle Languages - FAILED');
      console.log('   Response:', content.substring(0, 200));
      testsFailed++;
    }
  }
  else if (currentTest === 'Get Metadata (Filtered)') {
    try {
      const metadata = JSON.parse(content);
      if (metadata.title && metadata.channel) {
        console.log('✅ Get Metadata (Filtered) - PASSED');
        console.log(`   Title: ${metadata.title}`);
        console.log(`   Channel: ${metadata.channel}`);
        console.log(`   Duration: ${metadata.duration || 'N/A'}\n`);
        testsPassed++;
      } else {
        console.log('❌ Get Metadata (Filtered) - FAILED');
        console.log('   Missing expected fields');
        testsFailed++;
      }
    } catch (e) {
      console.log('❌ Get Metadata (Filtered) - FAILED');
      console.log('   Invalid JSON response');
      testsFailed++;
    }
  }
  else if (currentTest === 'Download Transcript (first 500 chars)') {
    if (content.length > 100) {
      console.log('✅ Download Transcript - PASSED');
      console.log('   Transcript length:', content.length, 'characters');
      console.log('   Preview:', content.substring(0, 150).replace(/\n/g, ' ') + '...\n');
      testsPassed++;
    } else {
      console.log('❌ Download Transcript - FAILED');
      console.log('   Response too short:', content.substring(0, 100));
      testsFailed++;
    }
  }
}

function sendRequest(method, params, testName) {
  requestId++;
  currentTest = testName;
  console.log(`🔍 Test ${requestId}: ${testName}`);

  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method: method,
    params: params
  };

  server.stdin.write(JSON.stringify(request) + '\n');
}

// Run tests sequentially with delays
setTimeout(() => {
  // Test 1: Initialize
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }, 'Initialize');

  setTimeout(() => {
    // Test 2: Get video metadata summary
    sendRequest('tools/call', {
      name: 'ytdlp_get_video_metadata_summary',
      arguments: { url: TEST_VIDEO }
    }, 'Get Metadata Summary');

    setTimeout(() => {
      // Test 3: List subtitle languages
      sendRequest('tools/call', {
        name: 'ytdlp_list_subtitle_languages',
        arguments: { url: TEST_VIDEO }
      }, 'List Subtitle Languages');

      setTimeout(() => {
        // Test 4: Get specific metadata fields
        sendRequest('tools/call', {
          name: 'ytdlp_get_video_metadata',
          arguments: {
            url: TEST_VIDEO,
            fields: ['id', 'title', 'channel', 'duration', 'view_count']
          }
        }, 'Get Metadata (Filtered)');

        setTimeout(() => {
          // Test 5: Download transcript (might take longer)
          console.log('   (This may take 10-20 seconds...)\n');
          sendRequest('tools/call', {
            name: 'ytdlp_download_transcript',
            arguments: { url: TEST_VIDEO, language: 'en' }
          }, 'Download Transcript (first 500 chars)');

          setTimeout(() => {
            console.log('\n✅ All tests completed!');
            server.kill();
          }, 25000); // Wait 25 seconds for transcript
        }, 3000);
      }, 5000);
    }, 5000);
  }, 2000);
}, 1000);
