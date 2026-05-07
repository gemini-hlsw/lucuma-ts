#!/usr/bin/env node

// @ts-check
import assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';

const url = `http://localhost:${process.env.PORT ?? process.env.SERVER_PORT ?? 4000}/health`;

const formatTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Executes a healthcheck against the server. Retries on failure, up to a maximum number of retries.
 */
async function executeHealthcheck(retries = 3, sleepTime = 500) {
  try {
    const response = await fetch(url);
    const responseBody = await response.text();
    assert.ok(response.ok, `Failed to execute query: ${response.statusText}\nResponse body: ${responseBody}`);
    assert.strictEqual(responseBody, '', `Unexpected response body: ${responseBody}`);

    console.log(`Success!`);
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`Retrying ${formatTime.format(sleepTime / 1000, 'second')}...`);

    await setTimeout(sleepTime);
    return executeHealthcheck(retries - 1, sleepTime * 2);
  }
}

console.log(`Checking server health at ${url}...`);

await executeHealthcheck();
