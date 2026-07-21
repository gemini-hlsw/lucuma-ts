#!/usr/bin/env node
// @ts-check

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const prismaCli = fileURLToPath(import.meta.resolve('prisma/build/index.js'));
const serverEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

const signals = /** @type {NodeJS.Signals[]} */ (['SIGTERM', 'SIGINT']);

/**
 * @type {import('node:child_process').ChildProcess | undefined}
 */
let activeChild;

/** @param {NodeJS.Signals} sig */
const forwardSignal = (sig) => activeChild?.kill(sig);
signals.forEach((sig) => process.on(sig, forwardSignal));

/**
 * Run a Node subprocess to completion, throwing if it exits non-zero.
 * @param {string[]} args
 * @param {string} label
 */
async function run(args, label) {
  console.log(`[start-production] ${label}...`);
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  activeChild = child;
  try {
    const [code, signal] = await once(child, 'exit');
    if (code !== 0) {
      throw new Error(`${label} failed (code: ${code}, signal: ${signal})`);
    }
  } finally {
    activeChild = undefined;
  }
}

try {
  await run([prismaCli, 'migrate', 'deploy'], 'Applying database migrations');
  await run([serverEntry, 'populate'], 'Seeding database');
} catch (error) {
  console.error(`[start-production] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
} finally {
  signals.forEach((sig) => process.removeListener(sig, forwardSignal));
}

console.log('[start-production] Starting server...');

await import(serverEntry);
