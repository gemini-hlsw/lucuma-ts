import cluster from 'node:cluster';
import { createServer } from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { log } from './logger.ts';
import { prisma } from './prisma/db.ts';
import { populateDb } from './prisma/queries/main.ts';
import { makeYogaServer } from './server.ts';

const signals = ['SIGTERM', 'SIGINT'] satisfies NodeJS.Signals[];

if (process.argv.includes('populate')) {
  // Populate DB
  try {
    await populateDb(prisma, log);
  } finally {
    await prisma.$disconnect();
  }
} else {
  if (cluster.isPrimary) {
    forkWorkers();
  } else {
    startServer();
  }
}

function forkWorkers() {
  const numOfWorkers =
    parseInt(process.env.HEROKU_AVAILABLE_PARALLELISM ?? process.env.WEB_CONCURRENCY!, 10) || os.availableParallelism();

  log.info(`🚀 Primary running with ${numOfWorkers} workers`);
  cluster.setupPrimary({ exec: fileURLToPath(new URL(import.meta.url)) });
  for (let i = 0; i < numOfWorkers; i++) {
    cluster.fork();
  }

  let shuttingDown = false;
  cluster.on('exit', (worker, code, signal) => {
    if (!shuttingDown) {
      log.error(`worker [${worker.process.pid}] died (${signal || code})`);
    }
  });

  // forward the signal to workers so they can exit gracefully
  for (const signal of signals) {
    process.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      log.info(`Primary received ${signal}, shutting down workers`);
      for (const worker of Object.values(cluster.workers ?? {})) {
        worker?.kill(signal);
      }
    });
  }
}

function startServer() {
  const port = parseInt(process.env.SERVER_PORT ?? process.env.PORT!, 10) || 4000;
  const yoga = makeYogaServer({ prisma, log });
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(yoga);

  server.listen(port, () => {
    log.info(`Worker ready at http://localhost:${port}`);
  });

  let shuttingDown = false;
  for (const signal of signals) {
    process.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;

      server.closeIdleConnections();
      server.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
      });
    });
  }
}
