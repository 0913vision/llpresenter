import type {LlpApi} from '@contracts/ipc/api';
import type {Label} from '@core/schema/labels';
import type {LabelColor} from '@core/labels';
import type {LabelColorPreview} from '@core/schema/labelColorPreview';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';

type LabelApi = Pick<LlpApi, 'settings' | 'content'>;
export type LabelsDocument = Extract<SettingsDocument, {name: 'labels'}>;

/** A rename the main process has; saving it again never repeats it. */
export interface AppliedRename {
  readonly name: string;
  readonly revision: number;
}

export interface LabelCatalogState {
  readonly labels: LabelsDocument | null;
  readonly status: 'loading' | 'ready' | 'failed';
  readonly busy: boolean;
}

/** Follows a rename in slides that no file has yet. */
type Renamed = (from: string, to: string) => void;

/** The 이름표 of the app, as this window lists and edits them. */
export class LabelCatalog {
  private stored: LabelsDocument | null = null;
  private preview: LabelColorPreview | null = null;
  private state: LabelCatalogState = {
    labels: null,
    status: 'loading',
    busy: false,
  };
  private readonly listeners = new Set<() => void>();
  private readonly renames = new Set<Renamed>();
  private readonly stops: ReadonlyArray<() => void>;
  private disposed = false;

  constructor(
    readonly api: LabelApi,
    private readonly report: (notice: Notice) => void,
  ) {
    this.stops = [
      api.settings.subscribe(document => this.accept(document)),
      api.settings.subscribeLabelColorPreview(preview => {
        this.preview = preview;
        this.publish();
      }),
    ];
    this.load();
  }

  readonly getSnapshot = (): LabelCatalogState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onRenamed(renamed: Renamed): () => void {
    this.renames.add(renamed);
    return () => this.renames.delete(renamed);
  }

  /** The stored labels, without a color that is only being tried. */
  getStoredLabels(): readonly Label[] {
    return this.stored?.value.labels ?? [];
  }

  previewLabelColor(name: string, color: LabelColor | null): void {
    this.preview = color === null ? null : {name, color};
    this.publish();
    this.api.settings
      .previewLabelColor({name, color})
      .catch((error: unknown) =>
        console.error('Could not preview a label color', error),
      );
  }

  updateLabels(
    labels: readonly Label[],
    onApplied?: (revision: number) => void,
  ): Promise<boolean> {
    const {stored} = this;
    if (stored === null) return Promise.resolve(false);
    return this.edit(
      {
        type: 'settings.update',
        name: 'labels',
        value: {...stored.value, labels},
        baseRevision: stored.revision,
      },
      ({revision}) => {
        if (revision !== null) onApplied?.(revision);
      },
    );
  }

  renameLabel(
    from: string,
    to: string,
    onApplied?: (identity: AppliedRename) => void,
  ): Promise<boolean> {
    const {stored} = this;
    if (stored === null) return Promise.resolve(false);
    if (from === to) {
      return Promise.resolve(
        stored.value.labels.some(label => label.name === from),
      );
    }
    return this.edit(
      {
        type: 'labels.rename',
        name: 'labels',
        from,
        to,
        baseRevision: stored.revision,
      },
      ({revision, saved}) => {
        for (const renamed of this.renames) renamed(from, to);
        if (!saved) {
          onApplied?.({
            name: to,
            revision: revision ?? this.stored?.revision ?? 0,
          });
        }
      },
    );
  }

  /** Saves a rename that was applied but not written. */
  retryRename(identity: AppliedRename): Promise<boolean> {
    const {stored} = this;
    if (
      stored?.access !== 'editable' ||
      stored.revision < identity.revision ||
      !stored.value.labels.some(label => label.name === identity.name)
    ) {
      return Promise.resolve(false);
    }
    return this.run(async () => {
      const result = await this.api.content.edit({type: 'saves.retry'});
      if (!result.ok) this.problem('이름표 파일 저장 실패');
      return result.ok;
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const stop of this.stops) stop();
    this.listeners.clear();
  }

  private edit(
    edit: SettingsEdit,
    applied: (outcome: {
      readonly revision: number | null;
      readonly saved: boolean;
    }) => void,
  ): Promise<boolean> {
    if (this.stored?.access !== 'editable') return Promise.resolve(false);
    return this.run(async () => {
      // NOTE(0913vision): A rename rewrites the files, so what was typed has
      // to be in them first.
      if (
        edit.type === 'labels.rename' &&
        !(await pendingWritesOf(this.api).settle())
      ) {
        return false;
      }
      const result = await this.api.settings.edit(edit);
      const outcome = result.ok
        ? result.value
        : result.error.reason === 'write-failed'
          ? result.error.applied
          : null;
      if (outcome === null) {
        this.problem('이름표 변경 실패');
        return false;
      }
      applied({revision: outcome.revision, saved: result.ok});
      await this.read();
      if (!result.ok) this.problem('이름표 파일 저장 실패');
      return result.ok || edit.type !== 'labels.rename';
    });
  }

  private async run(task: () => Promise<boolean>): Promise<boolean> {
    if (this.disposed || this.state.busy) return false;
    this.state = {...this.state, busy: true};
    this.publish();
    try {
      return await task();
    } catch (error) {
      console.error('Could not change the labels', error);
      this.problem('이름표 변경 실패');
      return false;
    } finally {
      this.state = {...this.state, busy: false};
      this.publish();
    }
  }

  private load(): void {
    this.read().catch((error: unknown) =>
      console.error('Could not read the labels', error),
    );
  }

  private async read(): Promise<void> {
    try {
      this.accept(await this.api.settings.get({name: 'labels'}));
    } catch {
      if (this.disposed) return;
      this.state = {...this.state, status: 'failed'};
      this.publish();
      this.problem('이름표 불러오기 실패', () => this.load());
    }
  }

  private accept(document: SettingsDocument): void {
    if (
      this.disposed ||
      document.name !== 'labels' ||
      (this.stored !== null && document.revision <= this.stored.revision)
    ) {
      return;
    }
    this.stored = document;
    this.preview = null;
    this.state = {...this.state, status: 'ready'};
    this.publish();
  }

  private publish(): void {
    const {preview, stored} = this;
    const labels =
      stored === null || preview === null
        ? stored
        : {
            ...stored,
            value: {
              ...stored.value,
              labels: stored.value.labels.map(label =>
                label.name === preview.name
                  ? {...label, color: preview.color}
                  : label,
              ),
            },
          };
    this.state = {...this.state, labels};
    for (const listener of this.listeners) listener();
  }

  private problem(title: string, retry?: () => void): void {
    if (this.disposed) return;
    this.report({
      key: `labels:${title}`,
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
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
