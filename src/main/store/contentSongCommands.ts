import {join} from 'node:path';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {checkPart} from '@core/schema/fileFormat';
import {preserveUnknownFields} from '@core/schema/preserveUnknown';
import {createSongSlideId, createSongId, type SongId} from '@core/schema/ids';
import {
  songSchema,
  SONG_SCHEMA_VERSION,
  sourceSlideCount,
  type Song,
} from '@core/schema/song';
import {freeTitle, normalizeSongTitle} from './contentEdits';
import type {ContentCommandContext, ContentHandlers} from './contentCommands';

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
    'song.saveAs': edit => this.saveSongAs(edit.song),
    'song.update': edit => this.updateSong(edit.song, edit.baseRevision),
    'song.delete': edit => this.deleteSong(edit.songId),
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
    const checked = checkPart(
      songSchema,
      preserveUnknownFields(songSchema, current?.data, {
        format: 'llsong',
        schemaVersion: SONG_SCHEMA_VERSION,
        id,
        title,
        slides: draft.slides,
        ...(draft.background === undefined
          ? {}
          : {background: draft.background}),
        updatedAt: this.context.now(),
      }),
    );
    if (!checked.ok) {
      return this.context.refuse('invalid', checked.error.message);
    }
    const file =
      current?.file ??
      join(this.context.locations.songs, `${id}${SONG_EXTENSION}`);
    const full = this.context.savesFull([file]);
    if (full !== null) return full;
    const stored =
      current === undefined
        ? this.context.songs.add(checked.value, file)
        : this.context.songs.replace(current, checked.value);
    this.context.announceSong(id);
    return this.context.answer({id, revision: stored.revision}, [
      await this.context.write(this.context.kinds.song, stored),
    ]);
  }

  private async createSong(): Promise<EditResult> {
    const id = createSongId(this.context.newId());
    const titles = new Set(
      this.context.songs.all().map(({data}) => normalizeSongTitle(data.title)),
    );
    const title = freeTitle(NEW_SONG_TITLE, titles);
    const song: Song = {
      format: 'llsong',
      schemaVersion: SONG_SCHEMA_VERSION,
      id,
      title,
      slides: [
        {
          id: createSongSlideId(this.context.newId()),
          titleSlide: true,
          lines: [title],
        },
        {id: createSongSlideId(this.context.newId()), lines: []},
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

  private async saveSongAs(input: Song): Promise<EditResult> {
    const title = normalizeSongTitle(input.title);
    if (title === '') {
      return this.context.refuse('invalid', 'The song title must not be blank');
    }
    if (this.hasOtherSongTitled(title, '')) {
      return this.context.refuse(
        'duplicate-title',
        `Another song is titled ${title}`,
      );
    }
    const id = createSongId(this.context.newId());
    const checked = checkPart(songSchema, {
      ...input,
      id,
      title,
      updatedAt: this.context.now(),
    });
    if (!checked.ok) {
      return this.context.refuse('invalid', checked.error.message);
    }
    const file = join(this.context.locations.songs, `${id}${SONG_EXTENSION}`);
    const full = this.context.savesFull([file]);
    if (full !== null) return full;
    const stored = this.context.songs.add(checked.value, file);
    const written = await this.context.write(this.context.kinds.song, stored);
    this.context.announceSong(id);
    return this.context.answer({id, revision: stored.revision}, [written]);
  }

  private updateSong(input: Song, baseRevision: number): EditResult {
    const checked = this.context.checkUpdate(
      this.context.songs.get(input.id),
      baseRevision,
      input,
    );
    if (!checked.ok) {
      return checked.error;
    }
    const validated = checkPart(
      songSchema,
      preserveUnknownFields(songSchema, checked.value.data, input),
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
