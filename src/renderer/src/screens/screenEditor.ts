import type {LlpApi} from '@shared/ipc';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import type {MonitorInfo, MonitorList} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';
import {assignScreenMonitor} from './assignScreenMonitor';
import {changeScreen, type ScreenChange} from './screenEdits';
import {SettingsDocumentEditor} from './settingsDocumentEditor';

type ScreensDocument = Extract<SettingsDocument, {name: 'screens'}>;
interface AssignmentSnapshot {
  screens: readonly Screen[] | null;
}

/** Where the editor reports a failed save; the window shows it as a notice. */
export type EditProblemReporter = (reason: string) => void;

/**
 * Saves changes to `screens.json` one at a time. Each save starts from the
 * newest revision it knows, which is the one it saved last or the one the
 * window was last given, so quick changes (typing, then a switch) never
 * conflict with each other. A refused save is reported and dropped; the
 * document the window shows is the one main holds.
 */
export class ScreenEditor {
  private readonly documents: SettingsDocumentEditor<ScreensDocument>;
  private readonly monitorSnapshots = new WeakMap<
    MonitorInfo,
    AssignmentSnapshot
  >();
  private initialSnapshot: AssignmentSnapshot | null = {screens: null};

  constructor(api: LlpApi, report: EditProblemReporter) {
    this.documents = new SettingsDocumentEditor<ScreensDocument>(api, {
      update: (base, value) => ({
        type: 'settings.update',
        name: 'screens',
        value,
        baseRevision: base.revision,
      }),
      report,
      failureTitle: '화면 설정 저장 실패',
      logMessage: 'Could not save the screens',
    });
  }

  /** Tells the editor the newest document the window has. Older ones are ignored. */
  adopt(document: ScreensDocument | null): void {
    if (document === null) return;
    if (this.initialSnapshot !== null) {
      this.initialSnapshot.screens = document.value.screens;
      this.initialSnapshot = null;
    }
    this.documents.adopt(document);
  }

  /** Records saved assignments for each immutable monitor publication. */
  observeMonitors(monitors: MonitorList): void {
    const base = this.documents.getSnapshot();
    const snapshot =
      base === null ? this.initialSnapshot : {screens: base.value.screens};
    if (snapshot === null) return;
    for (const monitor of monitors) {
      if (!this.monitorSnapshots.has(monitor)) {
        this.monitorSnapshots.set(monitor, snapshot);
      }
    }
  }

  /** Saves the change to one screen; resolves when it is saved or dropped. */
  change(screenId: string, change: ScreenChange): Promise<void> {
    return this.enqueue(screens => changeScreen(screens, screenId, change));
  }

  /** Assigns a monitor and clears its old assignment in one revision. */
  assign(screenId: string, monitor: MonitorInfo): Promise<void> {
    const observedScreens =
      this.monitorSnapshots.get(monitor)?.screens ??
      this.documents.getSnapshot()?.value.screens;
    return this.enqueue(screens =>
      assignScreenMonitor({screens, screenId, monitor, observedScreens}),
    );
  }

  private enqueue(
    change: (screens: readonly Screen[]) => readonly Screen[],
  ): Promise<void> {
    return this.documents
      .change(value => {
        const screens = change(value.screens);
        return screens === value.screens ? value : {...value, screens};
      })
      .then(() => undefined);
  }
}
