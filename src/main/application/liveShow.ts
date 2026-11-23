import {app} from 'electron';
import {join} from 'node:path';
import {registerRecoveryChannels} from '../live/recovery/channels';
import {RecoveryController, recoverySources} from '../live/recovery/controller';
import {RECOVERY_RECORD_FILE} from '../live/recovery/session';
import {dispatchLogged} from '../live/store';
import {registerMacros} from '../macros/register';
import {registerAudioOutput} from '../outputs/audio';
import {showOutputsOnLaunch} from '../outputs/launch';
import type {registerPlaybackProblems} from '../outputs/playbackProblems';
import {
  deferSoakScenario,
  registerSoakRecorder,
  registerSoakScenario,
} from '../soak';
import {restoreRestartOutputs} from '../update/restartOutputs';
import type {Foundation} from './foundation';
import type {Graphics} from './graphics';
import type {Services} from './services';

/** The parts that run what is live. */
export type LiveShow = ReturnType<typeof startLiveShow>;

/** Turns the outputs on as they were before an update, or as set for launch. */
async function showOutputs({
  recoveryFolder: folder,
  session: {crashed},
  store,
  data: {settings},
  log,
}: Foundation): Promise<void> {
  const version = app.getVersion();
  const options = {folder, crashed, version, settings, store, log};
  if (await restoreRestartOutputs(options)) return;
  await showOutputsOnLaunch({store, settings, log});
}

/** Starts the audio, the macros, and what comes back after a crash. */
export function startLiveShow(
  foundation: Foundation,
  {record}: Services,
  parts: {
    readonly graphics: Graphics;
    readonly playbackProblems: ReturnType<typeof registerPlaybackProblems>;
  },
) {
  const {store, data, session, recoveryFolder, windowMode, log} = foundation;
  const stopAudio = registerAudioOutput({
    playbackProblems: parts.playbackProblems.board,
    store,
    media: data.media,
    log,
    windowMode,
  });
  const macros = registerMacros({
    store,
    data,
    log,
    launch: session.crashed ? 'restore' : 'normal',
  });
  // NOTE(0913vision): Registered after the overlays, so the store has its
  // settings reader before 켤 때 화면 출력 sends output.set.
  const recovery = new RecoveryController({
    crashed: session.crashed,
    file: join(recoveryFolder, RECOVERY_RECORD_FILE),
    store,
    sources: recoverySources(data, log),
    record: record.writer,
    showOutputsOnLaunch: () => showOutputs(foundation),
    runStartupMacros: macros.startFresh,
    log,
  });
  const stopRecoveryChannels = registerRecoveryChannels(recovery, log);
  recovery
    .start()
    .catch((error: unknown) => log.error('could not start recovery', error));
  const stopSoakScenario = deferSoakScenario(
    Promise.all([data.settings, data.media]),
    () =>
      registerSoakScenario(log, command => dispatchLogged(store, command, log)),
    log,
  );
  const stopSoakRecorder = registerSoakRecorder(log, {
    frameRates: () => parts.graphics.frameRates(),
  });
  return {
    stopAudio,
    stopMacros: macros.dispose,
    stopRecoveryChannels,
    stopSoakScenario,
    stopSoakRecorder,
  };
}
