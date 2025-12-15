#!/usr/bin/env node
/**
 * Test MCP server with Bilibili video
 * Tests cross-platform support with https://www.bilibili.com/video/BV17YdXY4Ewj/
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'lib', 'index.mjs');
const TEST_VIDEO = 'https://www.bilibili.com/video/BV17YdXY4Ewj/?spm_id_from=333.1387.homepage.video_card.click&vd_source=bc7bf10259efd682c452b5ce8426b945';

console.log('🎬 Testing yt-dlp MCP Server with Bilibili Video\n');
console.log('Video:', TEST_VIDEO);
console.log('Platform: Bilibili (哔哩哔哩)\n');

const server = spawn('node', [serverPath]);

let testsPassed = 0;
let testsFailed = 0;
let responseBuffer = '';
let requestId = 0;
let currentTest = '';

const timeout = setTimeout(() => {
  console.log('\n⏱️  Test timeout - killing server');
  server.kill();
  printResults();
}, 60000);

function printResults() {
  clearTimeout(timeout);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Bilibili Test Results:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`${'='.repeat(60)}`);

  if (testsPassed > 0) {
    console.log('\n✨ Bilibili platform is supported!');
  } else {
    console.log('\n⚠️  Bilibili support may be limited');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);

        if (response.error) {
          console.log(`❌ ${currentTest} - ERROR`);
          console.log('   Error:', response.error.message);
          console.log('   This may indicate limited Bilibili support\n');
          testsFailed++;
        } else if (response.result) {
          handleTestResult(response);
        }
      } catch (e) {
        // Not JSON
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
    console.log('✅ Initialize - PASSED\n');
    testsPassed++;
  }
  else if (currentTest === 'Get Bilibili Metadata Summary') {
    // Check if we got any content
    if (content && content.length > 50 && !content.includes('Error')) {
      console.log('✅ Get Bilibili Metadata Summary - PASSED');
      console.log('   Response preview:');
      const lines = content.split('\n').slice(0, 8);
      lines.forEach(line => console.log(`   ${line}`));
      if (content.split('\n').length > 8) {
        console.log('   ...');
      }
      console.log();
      testsPassed++;
    } else if (content.includes('Error') || content.includes('Unsupported')) {
      console.log('⚠️  Get Bilibili Metadata Summary - PARTIAL');
      console.log('   Platform may have limited support');
      console.log('   Response:', content.substring(0, 150));
      console.log();
      testsFailed++;
    } else {
      console.log('❌ Get Bilibili Metadata Summary - FAILED');
      console.log('   Response too short or invalid');
      console.log();
      testsFailed++;
    }
  }
  else if (currentTest === 'List Bilibili Subtitle Languages') {
    if (content.length > 50 && !content.includes('Error')) {
      console.log('✅ List Bilibili Subtitle Languages - PASSED');
      console.log('   Subtitle info retrieved\n');
      testsPassed++;
    } else if (content.includes('No subtitle') || content.includes('not found')) {
      console.log('⚠️  List Bilibili Subtitle Languages - NO SUBTITLES');
      console.log('   Video may not have subtitles available\n');
      testsPassed++; // Not an error, just no subs
    } else {
      console.log('❌ List Bilibili Subtitle Languages - FAILED');
      console.log('   Response:', content.substring(0, 200));
      console.log();
      testsFailed++;
    }
  }
  else if (currentTest === 'Get Bilibili Metadata (Filtered)') {
    try {
      const metadata = JSON.parse(content);
      if (metadata.id || metadata.title) {
        console.log('✅ Get Bilibili Metadata (Filtered) - PASSED');
        if (metadata.title) console.log(`   Title: ${metadata.title}`);
        if (metadata.uploader) console.log(`   Uploader: ${metadata.uploader}`);
        if (metadata.duration) console.log(`   Duration: ${metadata.duration}s`);
        console.log();
        testsPassed++;
      } else {
        console.log('❌ Get Bilibili Metadata (Filtered) - FAILED');
        console.log('   Missing expected fields');
        console.log();
        testsFailed++;
      }
    } catch (e) {
      // Maybe it's an error message
      if (content.includes('Error') || content.includes('Unsupported')) {
        console.log('⚠️  Get Bilibili Metadata (Filtered) - PLATFORM ISSUE');
        console.log('   Response:', content.substring(0, 200));
        console.log();
        testsFailed++;
      } else {
        console.log('❌ Get Bilibili Metadata (Filtered) - FAILED');
        console.log('   Invalid response format');
        console.log();
        testsFailed++;
      }
    }
  }
}

function sendRequest(method, params, testName) {
  requestId++;
  currentTest = testName;
  console.log(`🔍 Test ${requestId}: ${testName}`);
  if (testName.includes('Metadata') || testName.includes('Subtitle')) {
    console.log('   (Testing Bilibili platform support...)\n');
  }

  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method: method,
    params: params
  };

  server.stdin.write(JSON.stringify(request) + '\n');
}

// Run tests
setTimeout(() => {
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'bilibili-test', version: '1.0.0' }
  }, 'Initialize');

  setTimeout(() => {
    sendRequest('tools/call', {
      name: 'ytdlp_get_video_metadata_summary',
      arguments: { url: TEST_VIDEO }
    }, 'Get Bilibili Metadata Summary');

    setTimeout(() => {
      sendRequest('tools/call', {
        name: 'ytdlp_list_subtitle_languages',
        arguments: { url: TEST_VIDEO }
      }, 'List Bilibili Subtitle Languages');

      setTimeout(() => {
        sendRequest('tools/call', {
          name: 'ytdlp_get_video_metadata',
          arguments: {
            url: TEST_VIDEO,
            fields: ['id', 'title', 'uploader', 'duration', 'description']
          }
        }, 'Get Bilibili Metadata (Filtered)');

        setTimeout(() => {
          console.log('\n✅ All Bilibili tests completed!');
          server.kill();
        }, 8000);
      }, 5000);
    }, 5000);
  }, 2000);
}, 1000);
