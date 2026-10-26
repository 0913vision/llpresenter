import type {Arrangement, Song} from '@shared/schema/song';
import {
  blockSnapshot,
  editBlocks,
  type BlockCommand,
  type BlockSelection,
  type BlockSnapshot,
} from './blockEdits';

const HISTORY_LIMIT = 100;
export const TYPING_PAUSE_MS = 1000;

function sameNumbers(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/** One song's session history. The owner keeps it when switching songs. */
export class SongHistory {
  private value: BlockSnapshot;
  private readonly past: BlockSnapshot[] = [];
  private readonly future: BlockSnapshot[] = [];
  private typing: {readonly block: number; readonly time: number} | undefined;

  constructor(song: Song) {
    this.value = blockSnapshot(song);
  }

  get snapshot(): BlockSnapshot {
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

  addArrangement(arrangement: Arrangement): void {
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
    const arrangements = this.value.song.arrangements;
    const current = arrangements?.find(item => item.name === name);
    if (
      arrangements === undefined ||
      current === undefined ||
      sameNumbers(current.slides, slides)
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

  changeArrangement(from: string, to: string | undefined): void {
    const rewrite = (snapshot: BlockSnapshot): BlockSnapshot => ({
      ...snapshot,
      song: {
        ...snapshot.song,
        ...(snapshot.song.arrangements === undefined
          ? {}
          : {
              arrangements: snapshot.song.arrangements.flatMap(item =>
                item.name !== from
                  ? [item]
                  : to === undefined
                    ? []
                    : [{...item, name: to}],
              ),
            }),
      },
    });
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
    const rename = (snapshot: BlockSnapshot): BlockSnapshot => {
      if (!snapshot.song.slides.some(slide => slide.label === from)) {
        return snapshot;
      }
      return {
        ...snapshot,
        song: {
          ...snapshot.song,
          slides: snapshot.song.slides.map(slide =>
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

  apply(command: BlockCommand, time = Date.now()): BlockSnapshot {
    const next = editBlocks(this.value, command);
    if (next.song === this.value.song) {
      this.value = next;
      return next;
    }
    const block = this.value.selection.block;
    const typing =
      command.type === 'text' ||
      (command.type === 'enter' &&
        next.song.slides.length === this.value.song.slides.length);
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

  undo(): BlockSnapshot {
    this.endTyping();
    const previous = this.past.pop();
    if (previous !== undefined) {
      this.future.push(this.value);
      this.value = previous;
    }
    return this.value;
  }

  redo(): BlockSnapshot {
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
