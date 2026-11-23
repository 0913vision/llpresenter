import {join} from 'node:path';
import {
  openServiceIdOf,
  RecoveryRecordWriter,
} from '../live/recovery/recordWriter';
import {RECOVERY_RECORD_FILE} from '../live/recovery/session';
import type {Foundation} from './foundation';

/**
 * Writes what is live for the next launch, and lists a problem while it can't.
 */
export function startRecoveryRecord({
  recoveryFolder,
  store,
  data,
  problems: {feed},
  log,
}: Foundation) {
  let hasFailed = false;
  const problem = (failed: boolean) =>
    ({kind: 'protection-write', target: 'record', failed}) as const;
  const removeProblem = feed.addStanding(() =>
    hasFailed ? [problem(true)] : [],
  );
  const writer = new RecoveryRecordWriter({
    file: join(recoveryFolder, RECOVERY_RECORD_FILE),
    store,
    serviceId: openServiceIdOf(data.content, log),
    onFailureChanged: failed => {
      hasFailed = failed;
      feed.push(problem(failed));
    },
    log,
  });
  const stopOutputs = store.connectOutputPersistence(state =>
    writer.persistOutputs(state),
  );
  return {
    writer,
    stop: async (): Promise<void> => {
      await store.settled();
      stopOutputs();
      writer.stop();
      removeProblem();
    },
  };
}
