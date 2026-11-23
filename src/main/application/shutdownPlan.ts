import type {ShutdownStep} from '../base/shutdown';
import type {registerPlaybackProblems} from '../outputs/playbackProblems';
import type {ControlFeatures} from './controlFeatures';
import type {ControlOwner} from './controlOwner';
import type {Foundation} from './foundation';
import type {Graphics} from './graphics';
import type {LiveShow} from './liveShow';
import type {Services} from './services';

/** Everything that has to end before the app quits. */
export interface ApplicationParts {
  readonly foundation: Foundation;
  readonly services: Services;
  readonly control: ControlOwner;
  readonly features: ControlFeatures;
  readonly graphics: Graphics;
  readonly playbackProblems: ReturnType<typeof registerPlaybackProblems>;
  readonly show: LiveShow;
}

/** The order in which the parts of the app end. */
export function shutdownSteps({
  foundation: {session, problems, appConfig, data, ui, zoom},
  services,
  control,
  features,
  graphics,
  playbackProblems,
  show,
}: ApplicationParts): readonly ShutdownStep[] {
  // NOTE(0913vision): SAVE_LIMIT_MS can end the process before the last
  // step removes session.lock. The next launch then takes it for a crash,
  // the safe side (no startup macros), and logs that quitting didn't
  // finish. The record stops before the outputs close, so it keeps the
  // state from before the quit, and its last write is awaited only after
  // the data store closes, so it never delays a save.
  return [
    {
      name: 'mark the recovery session as quitting',
      run: () => session.markQuitting(),
    },
    {name: 'stop the recovery record', run: services.record.stop},
    // NOTE(0913vision): The soak scenario stops next, so it changes
    // nothing while the outputs close. Output windows turn a close into
    // "output off", so they are destroyed before Electron closes windows to
    // quit.
    {name: 'stop the soak scenario', run: show.stopSoakScenario},
    {name: 'stop text import', run: features.stopTextImport},
    {name: 'stop PowerPoint import', run: features.stopPowerPointImport},
    {name: 'stop the settings window', run: features.settingsWindow.dispose},
    {name: 'stop the Windows sign-in item', run: services.stopLaunchAtLogin},
    {name: 'stop the location channels', run: services.stopLocations},
    {name: 'stop Bible lookup', run: services.stopBible},
    {name: 'stop font enumeration', run: features.stopFonts},
    {name: 'stop the media backend', run: features.stopMediaBackend},
    {name: 'stop song reveal', run: features.stopSongReveal},
    {name: 'stop media analysis', run: services.analysis.dispose},
    {name: 'stop macros', run: show.stopMacros},
    {name: 'stop audio', run: show.stopAudio},
    {name: 'stop playback problems', run: playbackProblems.stop},
    {name: 'stop overlays', run: services.stopOverlays},
    {name: 'stop theme output', run: services.stopThemeOutput},
    {name: 'stop the outputs', run: () => graphics.stopOutputs()},
    {name: 'save the UI state', run: () => ui.dispose()},
    {name: 'stop UI zoom', run: () => zoom.dispose()},
    {name: 'save app.json', run: () => appConfig.savePending()},
    {name: 'finish the soak record', run: show.stopSoakRecorder},
    {name: 'save pending store edits', run: data.savePending},
    {name: 'close the data store', run: data.dispose},
    {name: 'stop serving media', run: services.stopServingMedia},
    {name: 'stop the close handshake', run: () => control.stopClosing()},
    {name: 'stop the problem feed', run: problems.dispose},
    {name: 'stop the control reload notice', run: () => control.stopNotice()},
    {name: 'remove the live channels', run: services.stopLiveChannels},
    {name: 'remove the window channels', run: services.stopWindowChannels},
    {name: 'stop the window log', run: services.stopWindowLog},
    {name: 'remove the recovery channels', run: show.stopRecoveryChannels},
    {
      name: 'finish the recovery record write',
      run: () => services.record.writer.settled(),
    },
    {name: 'finish the recovery session', run: () => session.cleanExit()},
  ];
}
