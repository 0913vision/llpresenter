import type {SongGroupId} from '@core/schema/ids';
import type {SongSlideSource} from '@core/schema/showService';
import type {Arrangement, Song} from '@core/schema/song';
import {sameOrder} from './songArrangements';
import {isGroupedSong, type AnySong} from '@core/schema/groupedSong';
import {assignSlideHotKey} from './slideHotKeyEditing';
import {
  blockSnapshot,
  editBlocks,
  slideCountOf,
  type BlockCommand,
  type BlockSelection,
  type BlockSnapshot,
} from './blockEdits';

const HISTORY_LIMIT = 100;
export const TYPING_PAUSE_MS = 1000;

/** One song's session history. The owner keeps it when switching songs. */
export class SongHistory<S extends AnySong = Song> {
  private value: BlockSnapshot<S>;
  private readonly past: Array<BlockSnapshot<S>> = [];
  private readonly future: Array<BlockSnapshot<S>> = [];
  private typing: {readonly block: number; readonly time: number} | undefined;

  constructor(song: S) {
    this.value = blockSnapshot(song);
  }

  get snapshot(): BlockSnapshot<S> {
    return this.value;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get inTypingGroup(): boolean {
    return this.typing !== undefined;
  }

  select(selection: BlockSelection): void {
    if (selection.block !== this.value.selection.block) this.endTyping();
    this.value = blockSnapshot(this.value.song, selection);
  }

  /** Ends a typing group on blur, even when focus later returns to this block. */
  endTyping(): void {
    this.typing = undefined;
  }

  /** Assigns one grouped source slide's key as a separate undo step. */
  setSlideHotKey(source: SongSlideSource, code: string | undefined): boolean {
    const song = this.value.song;
    if (!isGroupedSong(song)) return false;
    const result = assignSlideHotKey(song, source, code);
    if (!result.ok || result.value === song) return false;
    this.endTyping();
    this.remember();
    this.value = {
      ...this.value,
      song: {...song, groups: result.value.groups},
    };
    return true;
  }

  addArrangement(arrangement: Arrangement): void {
    if (isGroupedSong(this.value.song)) return;
    this.endTyping();
    this.remember();
    this.value = {
      ...this.value,
      song: {
        ...this.value.song,
        arrangements: [...(this.value.song.arrangements ?? []), arrangement],
      },
    };
  }

  /** Replaces a named 구성's order as one undo step; false when nothing changes. */
  setArrangementSlides(name: string, slides: readonly number[]): boolean {
    if (isGroupedSong(this.value.song)) return false;
    const arrangements = this.value.song.arrangements;
    const current = arrangements?.find(item => item.name === name);
    if (
      arrangements === undefined ||
      current === undefined ||
      sameOrder(current.slides, slides)
    ) {
      return false;
    }
    this.endTyping();
    this.remember();
    this.value = {
      ...this.value,
      song: {
        ...this.value.song,
        arrangements: arrangements.map(item =>
          item === current ? {...item, slides: [...slides]} : item,
        ),
      },
    };
    return true;
  }

  /** Replaces or adds a named 구성's group order as one undo step; false when nothing changes. */
  setArrangementGroups(name: string, groups: readonly SongGroupId[]): boolean {
    const song = this.value.song;
    if (!isGroupedSong(song)) return false;
    const arrangements = song.arrangements;
    const current = arrangements?.find(item => item.name === name);
    if (
      current?.groups.length === groups.length &&
      current.groups.every((id, index) => id === groups[index])
    ) {
      return false;
    }
    this.endTyping();
    this.remember();
    const updated =
      current === undefined
        ? [...(arrangements ?? []), {name, groups: [...groups]}]
        : (arrangements?.map(item =>
            item === current ? {...item, groups: [...groups]} : item,
          ) ?? [{name, groups: [...groups]}]);
    this.value = {
      ...this.value,
      song: {
        ...song,
        arrangements: updated,
      },
    };
    return true;
  }

  changeArrangement(from: string, to: string | undefined): void {
    const rewrite = (snapshot: BlockSnapshot<S>): BlockSnapshot<S> => {
      const song = snapshot.song;
      if (song.arrangements === undefined) {
        return snapshot;
      }
      if (isGroupedSong(song)) {
        return {
          ...snapshot,
          song: {
            ...song,
            arrangements: song.arrangements.flatMap(item =>
              item.name !== from
                ? [item]
                : to === undefined
                  ? []
                  : [{...item, name: to}],
            ),
          },
        };
      }
      return {
        ...snapshot,
        song: {
          ...song,
          arrangements: song.arrangements.flatMap(item =>
            item.name !== from
              ? [item]
              : to === undefined
                ? []
                : [{...item, name: to}],
          ),
        },
      };
    };
    this.endTyping();
    this.value = rewrite(this.value);
    for (const snapshots of [this.past, this.future]) {
      snapshots.forEach((snapshot, index) => {
        snapshots[index] = rewrite(snapshot);
      });
    }
  }

  /** A global rename also updates undo/redo snapshots without adding a step. */
  renameLabel(from: string, to: string): void {
    const rename = (snapshot: BlockSnapshot<S>): BlockSnapshot<S> => {
      const song = snapshot.song;
      if (isGroupedSong(song)) {
        if (!song.groups.some(group => group.name === from)) {
          return snapshot;
        }
        return {
          ...snapshot,
          song: {
            ...song,
            groups: song.groups.map(group =>
              group.name === from ? {...group, name: to} : group,
            ),
          },
        };
      }
      if (!song.slides.some(slide => slide.label === from)) {
        return snapshot;
      }
      return {
        ...snapshot,
        song: {
          ...song,
          slides: song.slides.map(slide =>
            slide.label === from ? {...slide, label: to} : slide,
          ),
        },
      };
    };
    this.endTyping();
    this.value = rename(this.value);
    for (const snapshots of [this.past, this.future]) {
      snapshots.forEach((snapshot, index) => {
        snapshots[index] = rename(snapshot);
      });
    }
  }

  apply(command: BlockCommand, time = Date.now()): BlockSnapshot<S> {
    const next = editBlocks(this.value, command);
    if (next.song === this.value.song) {
      this.value = next;
      return next;
    }
    const block = this.value.selection.block;
    const typing =
      command.type === 'text' ||
      (command.type === 'enter' &&
        slideCountOf(next.song) === slideCountOf(this.value.song));
    const grouped =
      typing &&
      this.typing?.block === block &&
      time >= this.typing.time &&
      time - this.typing.time < TYPING_PAUSE_MS;
    if (!grouped) this.remember();
    else this.future.length = 0;
    this.typing = typing ? {block, time} : undefined;
    this.value = next;
    return next;
  }

  undo(): BlockSnapshot<S> {
    this.endTyping();
    const previous = this.past.pop();
    if (previous !== undefined) {
      this.future.push(this.value);
      this.value = previous;
    }
    return this.value;
  }

  redo(): BlockSnapshot<S> {
    this.endTyping();
    const next = this.future.pop();
    if (next !== undefined) {
      this.past.push(this.value);
      this.value = next;
    }
    return this.value;
  }

  private remember(): void {
    this.past.push(this.value);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future.length = 0;
  }
}
