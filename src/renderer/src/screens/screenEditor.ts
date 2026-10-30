import type {LlpApi} from '@contracts/ipc/api';
import type {Result} from '@core/common/result';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {MonitorInfo, MonitorList} from '@core/schema/monitors';
import type {Screen} from '@core/schema/screens';
import {assignScreenMonitor} from './assignScreenMonitor';
import {
  changeScreen,
  nameProblem,
  type NameProblem,
  type ScreenChange,
} from './screenEdits';
import {SettingsDocumentEditor} from './settingsDocumentEditor';
import {addScreen, type NewScreen} from './addScreen';

type ScreensDocument = Extract<SettingsDocument, {name: 'screens'}>;
interface AssignmentSnapshot {
  screens: readonly Screen[] | null;
}

/** Where the editor reports a failed save; the window shows it as a notice. */
export type EditProblemReporter = (reason: string) => void;

export type ScreenRenameProblem = NameProblem | 'missing';

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

  /** Creates one screen against the newest queued settings revision. */
  add(input: NewScreen): Promise<boolean> {
    const observedScreens =
      input.monitor === undefined
        ? undefined
        : this.observedScreensFor(input.monitor);
    return this.documents.change(value => ({
      ...value,
      screens: addScreen(value.screens, input, observedScreens),
    }));
  }

  /** Validates a row rename against the latest queued names before saving. */
  async rename(
    screenId: string,
    name: string,
  ): Promise<Result<boolean, ScreenRenameProblem>> {
    let problem: ScreenRenameProblem | undefined;
    const saved = await this.documents.change(value => {
      problem = value.screens.some(screen => screen.id === screenId)
        ? nameProblem(name, value.screens, screenId)
        : 'missing';
      if (problem !== undefined) return value;
      if (
        value.screens.find(screen => screen.id === screenId)?.name ===
        name.trim()
      ) {
        return value;
      }
      return {
        ...value,
        screens: changeScreen(value.screens, screenId, {name: name.trim()}),
      };
    });
    return problem === undefined
      ? {ok: true, value: saved}
      : {ok: false, error: problem};
  }

  /** Removes only the targeted screen; main reconciles its output after the save. */
  remove(screenId: string): Promise<boolean> {
    return this.documents.change(value => {
      const screens = value.screens.filter(screen => screen.id !== screenId);
      return screens.length === value.screens.length
        ? value
        : {...value, screens};
    });
  }

  /** Assigns a monitor and clears its old assignment in one revision. */
  assign(screenId: string, monitor: MonitorInfo): Promise<void> {
    const observedScreens = this.observedScreensFor(monitor);
    return this.enqueue(screens =>
      assignScreenMonitor({screens, screenId, monitor, observedScreens}),
    );
  }

  private observedScreensFor(
    monitor: MonitorInfo,
  ): readonly Screen[] | undefined {
    return (
      this.monitorSnapshots.get(monitor)?.screens ??
      this.documents.getSnapshot()?.value.screens
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
