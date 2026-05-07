import cluster from 'node:cluster';
import { createServer } from 'node:http';
import os from 'node:os';

import { log } from './logger.ts';
import { prisma } from './prisma/db.ts';
import { populateDb } from './prisma/queries/main.ts';
import { makeYogaServer } from './server.ts';

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
  for (let i = 0; i < numOfWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    log.error(`worker [${worker.process.pid}] died (${signal || code})`);
  });
}

function startServer() {
  const port = parseInt(process.env.SERVER_PORT ?? process.env.PORT!, 10) || 4000;
  const yoga = makeYogaServer({ prisma, log });
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(yoga);

  server.listen(port, () => {
    log.info(`Worker ready at http://localhost:${port}`);
  });
}
