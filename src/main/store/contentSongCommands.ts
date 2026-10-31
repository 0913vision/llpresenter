import {join} from 'node:path';
import {NO_LABEL_COLOR} from '@core/labels/colors';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {checkPart} from '@core/schema/fileFormat';
import {preserveUnknownFields} from '@core/schema/preserveUnknown';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {createSongGroupId, createSongId, type SongId} from '@core/schema/ids';
import {
  groupedSongSchema,
  sourceSlideCount,
  type GroupedSong,
} from '@core/schema/groupedSong';
import {migrateImportedSongGroups} from '@core/schema/songGroupMigration';
import {parseSettingsEdit} from '@core/schema/settingsDocuments';
import {
  freeTitle,
  normalizeSongTitle,
  withImportGroupIds,
  withoutArrangement,
  withRenamedArrangement,
  type ArrangementPick,
} from './contentEdits';
import {importPicks, picksToRewrite, rewritePicks} from './contentPickRewrites';
import type {
  ContentCommandContext,
  ContentHandlers,
  Written,
} from './contentCommands';
import type {StoredDocument} from './documents';

const SONG_SCHEMA_VERSION = 2;
const NEW_SONG_TITLE = '새 곡';
const SONG_EXTENSION = '.llsong';

type SongContentCommandsHandlers = Pick<
  ContentHandlers,
  Extract<ContentEdit['type'], `song.${string}`>
>;

class SongContentCommands {
  constructor(private readonly context: ContentCommandContext) {}

  readonly handlers: SongContentCommandsHandlers = {
    'song.import': edit => this.importSong(edit),
    'song.create': () => this.createSong(),
    'song.update': edit => this.updateSong(edit.song, edit.baseRevision),
    'song.delete': edit => this.deleteSong(edit.songId),
    'song.arrangement.rename': edit =>
      this.changeArrangement(edit.songId, edit.from, edit.to),
    'song.arrangement.delete': edit =>
      this.changeArrangement(edit.songId, edit.name, null),
  };

  private async importSong({
    draft,
    target,
  }: Extract<ContentEdit, {type: 'song.import'}>): Promise<EditResult> {
    await this.context.flushAutosave();
    const current =
      target.kind === 'overwrite'
        ? this.context.songs.get(target.songId)
        : undefined;
    if (target.kind === 'overwrite') {
      const checked = this.context.checkEditable(current);
      if (!checked.ok) return checked.error;
      if (checked.value.revision !== target.baseRevision) {
        return this.context.refuse('stale', 'The song changed before import');
      }
    }
    const id = current?.data.id ?? createSongId(this.context.newId());
    const title = normalizeSongTitle(draft.title);
    if (this.hasOtherSongTitled(title, id)) {
      return this.context.refuse(
        'duplicate-title',
        `Another song is titled ${title}`,
      );
    }
    const migrated = checkPart(groupedSongSchema, {
      ...migrateImportedSongGroups({
        ...draft,
        format: 'llsong',
        schemaVersion: 1,
        id,
        title,
      }),
      schemaVersion: SONG_SCHEMA_VERSION,
    });
    if (!migrated.ok) {
      return this.context.refuse('invalid', migrated.error.message);
    }
    const checked = checkPart(
      groupedSongSchema,
      preserveUnknownFields(
        groupedSongSchema,
        current?.data,
        withImportGroupIds(
          {
            ...migrated.value,
            updatedAt: this.context.now(),
          },
          current?.data,
        ),
      ),
    );
    if (!checked.ok) {
      return this.context.refuse('invalid', checked.error.message);
    }
    const song = checked.value;
    const file =
      current?.file ??
      join(this.context.locations.songs, `${id}${SONG_EXTENSION}`);
    const servicePicks = importPicks(this.context.services, song);
    const templatePicks = importPicks(this.context.templates, song);
    const full = this.context.savesFull([
      file,
      ...servicePicks.map(pick => pick.document.file),
      ...templatePicks.map(pick => pick.document.file),
    ]);
    if (full !== null) return full;
    const labels = await this.importLabels(song);
    if (!labels.ok && labels.error.reason !== 'write-failed') return labels;
    const stored =
      current === undefined
        ? this.context.songs.add(song, file)
        : this.context.songs.replace(current, song);
    const services = rewritePicks(this.context.services, servicePicks);
    const templates = rewritePicks(this.context.templates, templatePicks);
    this.context.announceSong(id);
    for (const service of services) {
      this.context.announceService(service.data.id);
    }
    for (const template of templates) {
      this.context.announceTemplate(template.data.id);
    }
    const written: Written[] = [];
    if (!labels.ok && labels.error.reason === 'write-failed') {
      const {message, unchangedFiles} = labels.error;
      for (const file of unchangedFiles) {
        written.push({file, result: {ok: false, error: {file, message}}});
      }
    }
    written.push(await this.context.write(this.context.kinds.song, stored));
    for (const service of services) {
      written.push(
        await this.context.write(this.context.kinds.service, service),
      );
    }
    for (const template of templates) {
      written.push(
        await this.context.write(this.context.kinds.template, template),
      );
    }
    return this.context.answer({id, revision: stored.revision}, written);
  }

  private async importLabels(song: GroupedSong): Promise<EditResult> {
    const settings = this.context.settings;
    const current = settings?.get('labels');
    if (!settings || current?.name !== 'labels') {
      return this.context.refuse('not-found', 'The label list is unavailable');
    }
    const existing = new Set(current.value.labels.map(label => label.name));
    const names = new Set(
      song.groups.flatMap(group => (group.name ? [group.name] : [])),
    );
    const added = [...names]
      .filter(name => !existing.has(name))
      .map(name => ({name, color: NO_LABEL_COLOR, key: null}));
    if (added.length === 0) {
      return {ok: true, value: {id: 'labels', revision: current.revision}};
    }
    if (
      current.value.labels.length + added.length >
      SONG_IMPORT_LIMITS.labels
    ) {
      return this.context.refuse('invalid', 'Too many labels after import');
    }
    const edit = parseSettingsEdit({
      type: 'settings.update',
      name: 'labels',
      baseRevision: current.revision,
      value: {...current.value, labels: [...current.value.labels, ...added]},
    });
    if (!edit.ok) return this.context.refuse('invalid', edit.error.message);
    const result = settings.apply(edit.value);
    await settings.savePending();
    return result;
  }

  private async createSong(): Promise<EditResult> {
    const id = createSongId(this.context.newId());
    const titles = new Set(
      this.context.songs.all().map(({data}) => normalizeSongTitle(data.title)),
    );
    const song: GroupedSong = {
      format: 'llsong',
      schemaVersion: SONG_SCHEMA_VERSION,
      id,
      title: freeTitle(NEW_SONG_TITLE, titles),
      groups: [
        {
          id: createSongGroupId(this.context.newId()),
          name: '',
          slides: [{lines: []}],
        },
      ],
    };
    const file = join(this.context.locations.songs, `${id}${SONG_EXTENSION}`);
    const full = this.context.savesFull([file]);
    if (full !== null) return full;
    const stored = this.context.songs.add(song, file);
    const written = await this.context.write(this.context.kinds.song, stored);
    this.context.announceSong(id);
    return this.context.answer({id, revision: stored.revision}, [written]);
  }

  private updateSong(input: GroupedSong, baseRevision: number): EditResult {
    const checked = this.context.checkUpdate(
      this.context.songs.get(input.id),
      baseRevision,
      input,
    );
    if (!checked.ok) {
      return checked.error;
    }
    const validated = checkPart(
      groupedSongSchema,
      preserveUnknownFields(groupedSongSchema, checked.value.data, input),
    );
    if (!validated.ok) {
      return this.context.refuse('invalid', validated.error.message);
    }
    const song = validated.value;
    const title = normalizeSongTitle(song.title);
    if (title === '') {
      return this.context.refuse('invalid', 'The song title must not be blank');
    }
    if (this.hasOtherSongTitled(title, song.id)) {
      return this.context.refuse(
        'duplicate-title',
        `Another song is titled ${title}`,
      );
    }
    const full = this.context.savesFull([checked.value.file]);
    if (full !== null) return full;
    const {
      background: _background,
      arrangements: _arrangements,
      updatedAt: _updatedAt,
      ...kept
    } = checked.value.data;
    const stored = this.context.songs.replace(checked.value, {
      ...kept,
      ...song,
      title,
    });
    this.context.saveLater(
      this.context.kinds.song,
      this.context.songs,
      song.id,
    );
    this.context.events.songChanged({
      songId: song.id,
      document: this.context.song(song.id),
    });
    if (
      checked.value.data.title !== title ||
      sourceSlideCount(checked.value.data) !== sourceSlideCount(song)
    ) {
      this.context.announceList(
        'songs',
        this.context.songList(),
        this.context.events.songsListChanged,
      );
    }
    return {ok: true, value: {id: song.id, revision: stored.revision}};
  }

  private async deleteSong(songId: SongId): Promise<EditResult> {
    const checked = this.context.checkEditable(this.context.songs.get(songId));
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.context.savesFull([checked.value.file]);
    if (full !== null) return full;
    this.context.songs.remove(songId);
    const written = await this.context.remove(
      this.context.kinds.song,
      checked.value,
    );
    this.context.announceSong(songId);
    return this.context.answer({id: songId, revision: null}, [written]);
  }

  private async changeArrangement(
    songId: SongId,
    from: string,
    to: string | null,
  ): Promise<EditResult> {
    const checked = this.context.checkEditable(this.context.songs.get(songId));
    if (!checked.ok) {
      return checked.error;
    }
    const song = checked.value.data;
    if (to !== null && song.arrangements?.some(({name}) => name === to)) {
      return this.context.refuse(
        'invalid',
        `The song already has a 구성 named ${to}`,
      );
    }
    const changed =
      to === null
        ? withoutArrangement(song, from)
        : withRenamedArrangement(song, from, to);
    if (changed === null) {
      return this.context.refuse(
        'not-found',
        `The song has no 구성 named ${from}`,
      );
    }
    return this.rewriteArrangement(checked.value, changed, {songId, from, to});
  }

  private async rewriteArrangement(
    current: StoredDocument<GroupedSong>,
    changed: GroupedSong,
    pick: ArrangementPick,
  ): Promise<EditResult> {
    const servicePicks = picksToRewrite(this.context.services, pick);
    const templatePicks = picksToRewrite(this.context.templates, pick);
    const full = this.context.savesFull([
      current.file,
      ...servicePicks.map(({document}) => document.file),
      ...templatePicks.map(({document}) => document.file),
    ]);
    if (full !== null) return full;
    const stored = this.context.songs.replace(current, changed);
    const services = rewritePicks(this.context.services, servicePicks);
    const templates = rewritePicks(this.context.templates, templatePicks);
    this.context.announceSong(pick.songId);
    for (const service of services) {
      this.context.announceService(service.data.id);
    }
    for (const template of templates) {
      this.context.announceTemplate(template.data.id);
    }
    const written = [await this.context.write(this.context.kinds.song, stored)];
    for (const service of services) {
      written.push(
        await this.context.write(this.context.kinds.service, service),
      );
    }
    for (const template of templates) {
      written.push(
        await this.context.write(this.context.kinds.template, template),
      );
    }
    return this.context.answer(
      {id: pick.songId, revision: stored.revision},
      written,
    );
  }

  private hasOtherSongTitled(title: string, songId: string): boolean {
    return this.context.songs
      .all()
      .some(
        ({data}) =>
          data.id !== songId && normalizeSongTitle(data.title) === title,
      );
  }
}

/**
 * Builds song handlers over live store ports. The facade owns serialization and
 * exception reporting; these handlers do not create a second write queue.
 */
export function createSongContentCommands(
  context: ContentCommandContext,
): SongContentCommandsHandlers {
  return new SongContentCommands(context).handlers;
}
