import {followTitle} from '@core/songs/newSongTitle';
import type {Song, SongSlide} from '@core/schema/song';
import type {SongSlideSource} from '@core/schema/showService';
import {
  blockSnapshot,
  editBlocks,
  type BlockCommand,
  type BlockSelection,
  type BlockSnapshot,
} from '@core/songs/blockEdits';
import {assignSlideHotKey} from '@core/songs/slideHotKeyEditing';
import {selectSlideList} from '@core/songs/slideListSelection';
import {songSlideListAdapter} from '@core/songs/songSlideListAdapter';
import {TYPING_PAUSE_MS} from '@core/songs/songHistory';
import {SlideListClipboard, SlideListModel} from './slideListModel';

const clipboards = new WeakMap<object, SlideListClipboard<SongSlide>>();
export function songSlideClipboardFor(
  owner: object,
): SlideListClipboard<SongSlide> {
  let clipboard = clipboards.get(owner);
  if (clipboard === undefined) {
    clipboard = new SlideListClipboard<SongSlide>();
    clipboards.set(owner, clipboard);
  }
  return clipboard;
}

/** Adapts text rows and persistence to the shared slide selection and history. */
export class SongSlideHistory {
  readonly model: SlideListModel<SongSlide>;
  private value: BlockSnapshot;
  private typing: {readonly id: string; readonly time: number} | undefined;

  constructor(
    song: Song,
    readonly clipboard = new SlideListClipboard<SongSlide>(),
    minimum: 0 | 1 = 1,
  ) {
    this.value = blockSnapshot(song);
    this.model = new SlideListModel({
      slides: song.slides,
      adapter: songSlideListAdapter({
        minimum: song.slides.length === 0 ? 0 : minimum,
      }),
      clipboard,
    });
    const first = song.slides[0];
    if (first !== undefined) this.model.select({type: 'click', id: first.id});
  }

  get snapshot(): BlockSnapshot {
    const state = this.model.getSnapshot();
    const focus = state.selection.focus;
    const id =
      state.textSelection?.id ??
      (focus?.kind === 'slide' ? focus.id : undefined);
    const index = state.slides.findIndex(slide => slide.id === id);
    const selection = {
      block: index < 0 ? this.value.selection.block : index,
      start: state.textSelection?.start ?? 0,
      end: state.textSelection?.end ?? 0,
    };
    if (
      this.value.song.slides !== state.slides ||
      this.value.selection.block !== selection.block ||
      this.value.selection.start !== selection.start ||
      this.value.selection.end !== selection.end
    ) {
      const song =
        this.value.song.slides === state.slides
          ? this.value.song
          : {...this.value.song, slides: state.slides};
      this.value = blockSnapshot(song, selection);
    }
    return this.value;
  }
  get canUndo(): boolean {
    return this.model.getSnapshot().canUndo;
  }
  get canRedo(): boolean {
    return this.model.getSnapshot().canRedo;
  }
  get inTypingGroup(): boolean {
    return this.typing !== undefined;
  }
  endTyping(): void {
    this.typing = undefined;
  }

  select(selection: BlockSelection): void {
    if (selection.block !== this.snapshot.selection.block) this.endTyping();
    const id = this.snapshot.song.slides[selection.block]?.id;
    if (id === undefined) return;
    const state = this.model.getSnapshot();
    if (!state.selection.ids.has(id)) this.model.select({type: 'click', id});
    this.model.selectText(id, selection.start, selection.end);
  }

  apply(command: BlockCommand, time = Date.now()): BlockSnapshot {
    const before = this.snapshot;
    if (command.type === 'label') {
      this.endTyping();
      this.model.command({type: 'label', label: command.name});
      return this.snapshot;
    }
    const next = editBlocks(before, command);
    if (next.song === before.song) {
      this.select(next.selection);
      return this.snapshot;
    }
    const id = before.song.slides[before.selection.block]?.id ?? '';
    const typing = command.type === 'text' || command.type === 'enter';
    const coalesce =
      typing &&
      this.typing?.id === id &&
      time >= this.typing.time &&
      time - this.typing.time < TYPING_PAUSE_MS;
    this.typing = typing ? {id, time} : undefined;
    const slide = next.song.slides[next.selection.block];
    const state = this.model.getSnapshot();
    const selection =
      slide === undefined
        ? state.selection
        : selectSlideList(
            next.song.slides.map(entry => entry.id),
            state.selection,
            {type: 'click', id: slide.id},
          );
    this.model.edit(
      {
        slides: next.song.slides,
        selection,
        ...(slide === undefined
          ? {}
          : {
              textSelection: {
                id: slide.id,
                start: next.selection.start,
                end: next.selection.end,
              },
            }),
      },
      coalesce,
    );
    return this.snapshot;
  }

  updateMatchingTitle(previous: string, next: string): void {
    if (previous === next) return;
    this.model.mapSlides(slides => followTitle(slides, previous, next));
  }

  setSlideHotKey(source: SongSlideSource, code: string | undefined): boolean {
    const song = this.snapshot.song;
    const result = assignSlideHotKey(song, source, code);
    if (!result.ok || result.value === song) return false;
    this.endTyping();
    return this.model.edit({
      ...this.model.getSnapshot(),
      slides: result.value.slides,
    }).ok;
  }
  renameLabel(from: string, to: string): void {
    this.endTyping();
    this.model.renameLabel(from, to);
  }
  undo(): BlockSnapshot {
    this.endTyping();
    this.model.undo();
    return this.snapshot;
  }
  redo(): BlockSnapshot {
    this.endTyping();
    this.model.redo();
    return this.snapshot;
  }
}
