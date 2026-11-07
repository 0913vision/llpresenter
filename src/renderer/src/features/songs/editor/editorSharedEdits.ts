import type {SongChange, SongDocument} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import type {Label} from '@core/schema/labels';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import type {EditorCatalog} from './editorCatalog';
import type {
  AppliedRename,
  EditorApi,
  EditorOperationHost,
  RenameApplied,
} from './editorContracts';
import type {SongSession} from './songSession';
import type {SongSessionPool} from './songSessionPool';

/** Named live ports, including the facade's single operation gate. */
export interface EditorSharedEditsOptions {
  readonly api: EditorApi;
  readonly pool: SongSessionPool;
  readonly catalog: EditorCatalog;
  readonly imported: () => SongSession | null;
  readonly host: EditorOperationHost;
}

/**
 * Runs the current global label/arrangement edits through the facade gate and
 * reconciles the newest buffered song pushes. It owns no busy flag, session
 * writer or durability retry queue; applied rename retry remains saves.retry.
 */
export class EditorSharedEdits {
  private readonly renamedSongs = new Map<SongId, SongDocument>();
  private renaming = false;

  constructor(private readonly context: EditorSharedEditsOptions) {}

  receive(change: SongChange): void {
    const session = this.context.pool.get(change.songId);
    if (session === undefined) return;
    if (change.document === null) this.context.pool.remove(change.songId);
    else if (this.renaming) {
      if (
        change.document.revision >
        (this.renamedSongs.get(change.songId)?.revision ?? 0)
      ) {
        this.renamedSongs.set(change.songId, change.document);
      }
    } else session.receive(change.document);
  }

  finishOperation(): void {
    this.renaming = false;
    for (const [id, document] of this.renamedSongs) {
      this.context.pool.get(id)?.receive(document);
    }
    this.renamedSongs.clear();
  }

  clearBuffered(): void {
    this.renamedSongs.clear();
  }

  updateLabels(labels: readonly Label[]): Promise<boolean> {
    const document = this.context.catalog.labelsDocument;
    if (document === null) return Promise.resolve(false);
    return this.editLabels({
      type: 'settings.update',
      name: 'labels',
      value: {...document.value, labels},
      baseRevision: document.revision,
    });
  }

  renameLabel(
    from: string,
    to: string,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    const document = this.context.catalog.labelsDocument;
    if (document === null) return Promise.resolve(false);
    if (from === to) {
      return Promise.resolve(
        document.value.labels.some(label => label.name === from),
      );
    }
    return this.editLabels(
      {
        type: 'labels.rename',
        name: 'labels',
        from,
        to,
        baseRevision: document.revision,
      },
      onApplied,
    );
  }

  /**
   * Persists an applied identity without replaying its rename or its reference
   * rewrites.
   */
  retryRename(identity: AppliedRename): Promise<boolean> {
    if (!this.context.host.alive() || this.context.host.locked()) {
      return Promise.resolve(false);
    }
    if (
      this.context.catalog.labelsDocument?.access !== 'editable' ||
      this.context.catalog.labelsDocument.revision < identity.revision ||
      !this.context.catalog.labelsDocument.value.labels.some(
        label => label.name === identity.name,
      )
    ) {
      return Promise.resolve(false);
    }

    return this.context.host.runOperation(async () => {
      try {
        const result = await this.context.api.content.edit({
          type: 'saves.retry',
        });
        if (!result.ok) {
          this.context.host.problem('이름표 파일 저장 실패');
        }
        return result.ok;
      } catch (cause: unknown) {
        console.error('Could not persist an applied rename:', cause);
        this.context.host.problem('이름 저장 실패');
        return false;
      }
    });
  }

  private editLabels(
    edit: SettingsEdit,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    if (
      !this.context.host.alive() ||
      this.context.host.locked() ||
      this.context.catalog.labelsDocument?.access !== 'editable'
    ) {
      return Promise.resolve(false);
    }
    return this.context.host.runOperation(() =>
      this.writeLabels(edit, onApplied),
    );
  }

  private async writeLabels(
    edit: SettingsEdit,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    try {
      if (edit.type === 'labels.rename') {
        const saved = await Promise.all(
          [...this.context.pool.values()].map(session => session.flush()),
        );
        if (saved.includes(false)) return false;
        this.renaming = true;
      }
      const result = await this.context.api.settings.edit(edit);
      const applied = result.ok || result.error.reason === 'write-failed';
      if (!applied) {
        this.context.host.problem('이름표 변경 실패');
        return false;
      }
      if (edit.type === 'labels.rename') {
        await this.acceptRename(edit.from, edit.to);
        this.renamedSongs.clear();
      }
      await this.context.catalog.readLabels();
      if (
        !result.ok &&
        result.error.reason === 'write-failed' &&
        edit.type === 'labels.rename' &&
        this.context.catalog.labelsDocument !== null
      ) {
        onApplied?.({
          kind: 'label',
          name: edit.to,
          revision:
            result.error.applied.revision ??
            this.context.catalog.labelsDocument.revision,
        });
      }
      if (!result.ok) this.context.host.problem('이름표 파일 저장 실패');
      return result.ok || edit.type !== 'labels.rename';
    } catch {
      this.context.host.problem('이름표 변경 실패');
      return false;
    }
  }

  private async acceptRename(from: string, to: string): Promise<void> {
    this.context.imported()?.renamed(from, to);
    for (const [id, session] of this.context.pool) {
      const document =
        this.renamedSongs.get(id) ??
        (session.itemSession ||
        session.document.song.slides.some(slide => slide.label === from)
          ? await this.context.pool.read(id)
          : undefined);
      if (document === null) this.context.pool.remove(id);
      else session.renamed(from, to, document);
    }
  }
}
