import type {SongChange, SongDocument} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import type {Label} from '@core/schema/labels';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
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

  renameArrangement(
    from: string,
    to: string,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    return this.editArrangement(from, to, onApplied);
  }

  deleteArrangement(name: string): Promise<boolean> {
    return this.editArrangement(name, undefined);
  }

  private editArrangement(
    from: string,
    to: string | undefined,
    onApplied?: RenameApplied,
  ): Promise<boolean> {
    const session =
      this.context.imported() ??
      (this.context.pool.editorSongId === null
        ? undefined
        : this.context.pool.get(this.context.pool.editorSongId));
    if (
      !this.context.host.alive() ||
      this.context.host.locked() ||
      session === undefined ||
      session.readOnly
    ) {
      return Promise.resolve(false);
    }
    if (
      !session.history.snapshot.song.arrangements?.some(
        item => item.name === from,
      )
    ) {
      return Promise.resolve(false);
    }
    if (this.context.imported() === session) {
      if (
        to !== undefined &&
        (!to.trim() ||
          to === DEFAULT_ARRANGEMENT_NAME ||
          session.history.snapshot.song.arrangements.some(
            item => item.name === to && item.name !== from,
          ))
      ) {
        return Promise.resolve(false);
      }
      session.arrangementChanged(from, to);
      return Promise.resolve(true);
    }
    if (from === to) return Promise.resolve(true);
    return this.context.host.runOperation(() =>
      this.writeArrangement(session, {from, to, onApplied}),
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
    if (identity.kind === 'label') {
      if (
        this.context.catalog.labelsDocument?.access !== 'editable' ||
        this.context.catalog.labelsDocument.revision < identity.revision ||
        !this.context.catalog.labelsDocument.value.labels.some(
          label => label.name === identity.name,
        )
      ) {
        return Promise.resolve(false);
      }
    } else {
      const session = this.context.pool.get(identity.songId);
      if (
        session === undefined ||
        session.readOnly ||
        session.document.revision < identity.revision ||
        !session.history.snapshot.song.arrangements?.some(
          item => item.name === identity.name,
        )
      ) {
        return Promise.resolve(false);
      }
    }
    return this.context.host.runOperation(async () => {
      try {
        const result = await this.context.api.content.edit({
          type: 'saves.retry',
        });
        if (!result.ok) {
          this.context.host.problem(
            identity.kind === 'label'
              ? '이름표 파일 저장 실패'
              : '구성 파일 저장 실패',
          );
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

  private async writeArrangement(
    session: SongSession,
    {
      from,
      to,
      onApplied,
    }: {
      readonly from: string;
      readonly to: string | undefined;
      readonly onApplied?: RenameApplied | undefined;
    },
  ): Promise<boolean> {
    try {
      const saved = await Promise.all(
        [...this.context.pool.values()].map(item => item.flush()),
      );
      if (saved.includes(false)) return false;
      this.renaming = true;
      const songId = session.document.song.id;
      const result = await this.context.api.content.edit(
        to === undefined
          ? {type: 'song.arrangement.delete', songId, name: from}
          : {type: 'song.arrangement.rename', songId, from, to},
      );
      if (!result.ok && result.error.reason !== 'write-failed') {
        this.context.host.problem('구성 변경 실패');
        return false;
      }
      const accepted = await this.acceptArrangement(session, from, to);
      if (accepted && !result.ok && to !== undefined) {
        onApplied?.({
          kind: 'arrangement',
          name: to,
          songId,
          revision: session.document.revision,
        });
      }
      if (!result.ok) this.context.host.problem('구성 파일 저장 실패');
      return accepted && (to === undefined || result.ok);
    } catch (error) {
      console.error('Arrangement edit failed', error);
      session.blocked = true;
      this.context.host.problem('구성 변경 실패', () =>
        this.context.pool.reload(session.document.song.id),
      );
      return false;
    }
  }

  private async acceptArrangement(
    session: SongSession,
    from: string,
    to: string | undefined,
  ): Promise<boolean> {
    const songId = session.document.song.id;
    const read =
      this.renamedSongs.get(songId) ??
      (await this.context.api.songs.get(songId));
    if (this.context.pool.get(songId) !== session) return false;
    const pushed = this.renamedSongs.get(songId);
    const document =
      pushed !== undefined && (read === null || pushed.revision > read.revision)
        ? pushed
        : read;
    if (document === null) this.context.pool.remove(songId);
    else session.arrangementChanged(from, to, document);
    this.renamedSongs.delete(songId);
    return document !== null;
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
        (session.document.song.groups.some(group => group.name === from)
          ? await this.context.api.songs.get(id)
          : undefined);
      if (document === null) this.context.pool.remove(id);
      else session.renamed(from, to, document);
    }
  }
}
