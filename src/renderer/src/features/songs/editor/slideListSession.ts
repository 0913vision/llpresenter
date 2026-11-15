import type {SlideListModel} from '@core/songs/slideListModel';
import type {SlideListCommand, SlideListItem} from '@core/songs/slideListEdits';
import type {SlideSelectionAction} from '@core/songs/slideListSelection';

/** The same command surface can edit any schema-owned slide list. */
export interface SlideListSession<T extends SlideListItem> {
  readonly slideModel: Pick<
    SlideListModel<T>,
    'subscribe' | 'getSnapshot' | 'limits'
  >;
  readonly clipboardOwner: object;
  readonly slideDocumentId: string;
  readonly slideIntent: number;
  readonly selectedOccurrence: number;
  readonly readOnly: boolean;
  readonly canUndo?: boolean;
  readonly canRedo?: boolean;
  selectSlides(action: SlideSelectionAction<T['id']>): void;
  commandSlides(command: SlideListCommand<T>): void;
  copySlides(): string | null;
  cutSlides(): string | null;
  pasteSlides(text?: string): void;
  edit(command: 'undo' | 'redo'): void;
}
