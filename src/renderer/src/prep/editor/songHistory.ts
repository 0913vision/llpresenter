import type {Song} from '@shared/schema/song';
import {
  blockSnapshot,
  editBlocks,
  type BlockCommand,
  type BlockSelection,
  type BlockSnapshot,
} from './blockEdits';

const HISTORY_LIMIT = 100;
const TYPING_PAUSE_MS = 1000;

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

  select(selection: BlockSelection): void {
    if (selection.block !== this.value.selection.block) this.endTyping();
    this.value = blockSnapshot(this.value.song, selection);
  }

  /** Ends a typing group on blur, even when focus later returns to this block. */
  endTyping(): void {
    this.typing = undefined;
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
    if (!grouped) {
      this.past.push(this.value);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.future.length = 0;
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
}
