import {parentPort, workerData} from 'node:worker_threads';
import {parseJob, runPowerPointJob} from './powerpointWorkerJob';

// NOTE(0913vision): The worker answers one job and ends; a failure is thrown
// on the next turn, so the worker's error event carries it to main.
async function run(): Promise<void> {
  const input: unknown = workerData;
  parentPort?.postMessage(await runPowerPointJob(parseJob(input)));
}

run().catch((error: unknown) => {
  setImmediate(() => {
    throw error;
  });
});
