import type {Slide, SlidesDraft} from '@core/services/slidesEdits';
import type {SlideListCommand} from '@core/songs/slideListEdits';
import type {SlideSelectionAction} from '@core/songs/slideListSelection';
import type {SlideListSession} from '../../songs/editor/slideListSession';
import type {Notice} from '@renderer/ui/notices';

/** Borrows the draft's only model for the shared row and grid command surface. */
export class SlidesListSession implements SlideListSession<Slide> {
  private intent = 0;
  constructor(
    readonly draft: SlidesDraft,
    private host: {
      readonly locked: () => boolean;
      readonly problem: (message: string) => void;
      readonly report?: ((notice: Notice) => void) | undefined;
    },
  ) {}
  configure(host: {
    readonly locked: () => boolean;
    readonly problem: (message: string) => void;
    readonly report?: ((notice: Notice) => void) | undefined;
  }): void {
    this.host = host;
  }
  get slideModel() {
    return this.draft.model;
  }
  readonly reportNotice = (notice: Notice): void => {
    if (this.host.report !== undefined) this.host.report(notice);
    else this.host.problem(notice.title);
  };
  get clipboardOwner(): object {
    return this.draft.clipboard;
  }
  get slideDocumentId(): string {
    return this.draft.snapshot.item.id;
  }
  get slideIntent(): number {
    return this.intent;
  }
  get selectedOccurrence(): number {
    return this.draft.snapshot.selected;
  }
  get readOnly(): boolean {
    return this.host.locked();
  }
  invalidate(): void {
    this.intent++;
  }
  selectSlides(action: SlideSelectionAction<Slide['id']>): void {
    this.invalidate();
    this.draft.selectRows(action);
  }
  commandSlides(command: SlideListCommand<Slide>): void {
    if (this.readOnly) return;
    this.invalidate();
    if (!this.draft.commandRows(command)) {
      this.host.problem('슬라이드를 변경할 수 없습니다');
    }
  }
  copySlides(): string | null {
    const result = this.slideModel.copy();
    if (!result.ok) this.host.problem('복사할 수 없는 슬라이드');
    return result.ok ? result.value : null;
  }
  cutSlides(): string | null {
    if (this.readOnly) return null;
    this.invalidate();
    this.draft.endTyping();
    const result = this.slideModel.cut();
    if (!result.ok) this.host.problem('잘라낼 수 없는 슬라이드');
    return result.ok ? result.value : null;
  }
  pasteSlides(text?: string): void {
    if (this.readOnly) return;
    this.draft.endTyping();
    const result =
      text === undefined
        ? this.slideModel.paste()
        : this.slideModel.pasteText(text);
    if (!result.ok) this.host.problem('붙여넣을 수 없는 슬라이드');
  }
  edit(command: 'undo' | 'redo'): void {
    if (this.readOnly) return;
    this.invalidate();
    if (command === 'undo') this.draft.undo();
    else this.draft.redo();
  }
}
