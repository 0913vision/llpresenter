import type {LlpApi} from '@shared/ipc';
import type {SongDocument} from '@shared/schema/contentDocuments';
import type {SongId} from '@shared/schema/ids';
import type {Label} from '@shared/schema/labels';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import type {Notice} from '@renderer/ui/notices';
import {SongSession} from './songSession';
import {editorTask} from './editorTask';

export type EditorApi = Pick<LlpApi, 'songs' | 'content' | 'settings'>;
export type EditorLabels = Extract<SettingsDocument, {name: 'labels'}>;
interface EditorState {
  readonly session: SongSession | null;
  readonly labels: EditorLabels | null;
  readonly busy: boolean;
}

/** One control window's editor sessions. The host disposes it at window close. */
export class SongEditorStore {
  private readonly sessions = new Map<SongId, SongSession>();
  private readonly listeners = new Set<() => void>();
  private readonly stops: ReadonlyArray<() => void>;
  private readonly renamedSongs = new Map<SongId, SongDocument>();
  private labels: EditorLabels | null = null;
  private active: SongId | null = null;
  private busy = false;
  private renaming = false;
  private alive = true;
  private operation: Promise<boolean> | undefined;
  private state: EditorState = {session: null, labels: null, busy: false};

  constructor(
    readonly api: EditorApi,
    private readonly onProblem: (notice: Notice) => void,
  ) {
    this.stops = [
      api.settings.subscribe(document => this.acceptLabels(document)),
      api.songs.subscribe(change => {
        const session = this.sessions.get(change.songId);
        if (session === undefined) return;
        if (change.document === null) this.remove(change.songId);
        else if (this.renaming) {
          if (
            change.document.revision >
            (this.renamedSongs.get(change.songId)?.revision ?? 0)
          ) {
            this.renamedSongs.set(change.songId, change.document);
          }
        } else session.receive(change.document);
      }),
      api.songs.subscribeList(entries => {
        const ids = new Set(entries.map(entry => entry.id));
        for (const id of this.sessions.keys()) {
          if (!ids.has(id)) this.remove(id);
        }
      }),
    ];
    editorTask(this.readLabels());
  }

  readonly getSnapshot = (): EditorState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  open(document: SongDocument | null): void {
    if (!this.alive) return;
    if (this.active !== null && this.active !== document?.song.id) {
      this.sessions.get(this.active)?.endTyping();
    }
    this.active = document?.song.id ?? null;
    if (document !== null) {
      const session = this.sessions.get(document.song.id);
      if (session !== undefined) session.receive(document);
      else {
        this.sessions.set(
          document.song.id,
          new SongSession({
            document,
            api: this.api.content,
            changed: () => this.publish(),
            problem: () =>
              this.problem('곡 저장 실패', () => this.reload(document.song.id)),
          }),
        );
      }
    }
    this.publish();
  }

  updateLabels(labels: readonly Label[]): Promise<boolean> {
    const document = this.labels;
    if (document === null) return Promise.resolve(false);
    return this.editLabels({
      type: 'settings.update',
      name: 'labels',
      value: {...document.value, labels},
      baseRevision: document.revision,
    });
  }

  renameLabel(from: string, to: string): Promise<boolean> {
    const document = this.labels;
    if (document === null) return Promise.resolve(false);
    return this.editLabels({
      type: 'labels.rename',
      name: 'labels',
      from,
      to,
      baseRevision: document.revision,
    });
  }

  /** Preflight shutdown before unmounting; false keeps a refused draft alive. */
  async flush(): Promise<boolean> {
    await this.operation;
    const results = await Promise.all(
      [...this.sessions.values()].map(session => session.flush()),
    );
    return results.every(Boolean);
  }

  async dispose(): Promise<void> {
    this.alive = false;
    for (const stop of this.stops) stop();
    await this.operation;
    await Promise.all(
      [...this.sessions.values()].map(session => session.close()),
    );
    this.sessions.clear();
    this.renamedSongs.clear();
    this.listeners.clear();
  }

  private editLabels(edit: SettingsEdit): Promise<boolean> {
    if (!this.alive || this.busy || this.labels?.access !== 'editable') {
      return Promise.resolve(false);
    }
    this.busy = true;
    this.publish();
    this.operation = this.writeLabels(edit).finally(() => {
      this.renaming = false;
      for (const [id, document] of this.renamedSongs) {
        this.sessions.get(id)?.receive(document);
      }
      this.renamedSongs.clear();
      this.busy = false;
      this.operation = undefined;
      this.publish();
    });
    return this.operation;
  }

  private async writeLabels(edit: SettingsEdit): Promise<boolean> {
    try {
      if (edit.type === 'labels.rename') {
        const saved = await Promise.all(
          [...this.sessions.values()].map(session => session.flush()),
        );
        if (saved.includes(false)) return false;
        this.renaming = true;
      }
      const result = await this.api.settings.edit(edit);
      const applied = result.ok || result.error.reason === 'write-failed';
      if (!applied) {
        this.problem('이름표 변경 실패');
        return false;
      }
      if (edit.type === 'labels.rename') {
        await this.acceptRename(edit.from, edit.to);
        this.renamedSongs.clear();
      }
      await this.readLabels();
      if (!result.ok) this.problem('이름표 파일 저장 실패');
      return true;
    } catch {
      this.problem('이름표 변경 실패');
      return false;
    }
  }

  private async acceptRename(from: string, to: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      const document =
        this.renamedSongs.get(id) ??
        (session.document.song.slides.some(slide => slide.label === from)
          ? await this.api.songs.get(id)
          : undefined);
      if (document === null) this.remove(id);
      else session.renamed(from, to, document);
    }
  }

  private async readLabels(): Promise<void> {
    try {
      this.acceptLabels(await this.api.settings.get({name: 'labels'}));
    } catch {
      this.problem('이름표 불러오기 실패', () => this.readLabels());
    }
  }

  private acceptLabels(document: SettingsDocument): void {
    if (
      this.alive &&
      document.name === 'labels' &&
      (this.labels === null || document.revision > this.labels.revision)
    ) {
      this.labels = document;
      this.publish();
    }
  }

  private async reload(id: SongId): Promise<void> {
    try {
      const document = await this.api.songs.get(id);
      if (!this.alive) return;
      if (document === null) this.remove(id);
      else this.sessions.get(id)?.install(document);
    } catch {
      this.problem('곡 불러오기 실패', () => this.reload(id));
    }
  }

  private remove(id: SongId): void {
    this.sessions.get(id)?.discard();
    this.sessions.delete(id);
    if (this.active === id) this.active = null;
    this.publish();
  }

  private problem(title: string, retry?: () => unknown): void {
    if (this.alive) {
      this.onProblem({
        key: `editor:${this.active}:${title}`,
        kind: 'warning',
        icon: 'warning',
        title,
        time: new Date().toTimeString().slice(0, 5),
        ...(retry === undefined
          ? {}
          : {
              actions: [
                {icon: 'refresh', label: '다시 불러오기', onSelect: retry},
              ],
            }),
      });
    }
  }

  private publish(): void {
    if (!this.alive) return;
    this.state = {
      session:
        this.active === null ? null : (this.sessions.get(this.active) ?? null),
      labels: this.labels,
      busy: this.busy,
    };
    for (const listener of this.listeners) listener();
  }
}
