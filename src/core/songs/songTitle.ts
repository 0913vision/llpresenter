export const EMPTY_TITLE_REASON = '곡 제목을 적어야 저장할 수 있습니다';
export const DUPLICATE_TITLE_REASON = '라이브러리에 같은 제목의 곡이 있습니다';

/** Matches main's title identity before duplicate checks and persistence. */
export function normalizeSongTitle(value: string): string {
  return value.trim().normalize('NFC');
}

/** A title draft stays outside lyric undo and never sends invalid text. */
export class SongTitleDraft {
  value: string;
  private edited = false;
  private rejected: string | undefined;

  constructor(
    private saved: string,
    private readonly isDuplicate: (value: string) => boolean = () => false,
  ) {
    this.value = saved;
  }

  get reason(): string | undefined {
    const value = normalizeSongTitle(this.value);
    if (value === '') return EMPTY_TITLE_REASON;
    if (this.isDuplicate(value) || this.rejected === value) {
      return DUPLICATE_TITLE_REASON;
    }
    return undefined;
  }
  get changed(): boolean {
    return (
      this.edited &&
      this.reason === undefined &&
      normalizeSongTitle(this.value) !== this.saved
    );
  }
  get hasDraft(): boolean {
    return this.edited;
  }
  get nextValue(): string {
    return normalizeSongTitle(
      this.reason === undefined ? this.value : this.saved,
    );
  }

  edit(value: string): void {
    this.value = value;
    this.edited = true;
    this.rejected = undefined;
  }

  accept(saved: string, sent?: string): void {
    this.saved = saved;
    if (!this.edited || this.value === sent) {
      this.value = saved;
      this.edited = false;
      this.rejected = undefined;
    }
  }

  reject(sent: string): void {
    if (normalizeSongTitle(this.value) === sent) this.rejected = sent;
  }

  revertInvalid(): void {
    if (this.reason === undefined) return;
    this.value = this.saved;
    this.edited = false;
    this.rejected = undefined;
  }
}
