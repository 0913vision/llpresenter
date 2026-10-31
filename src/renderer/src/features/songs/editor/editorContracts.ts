import type {LlpApi} from '@contracts/ipc/api';
import type {LibrarySong} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {SongSession} from './songSession';

/**
 * The existing editor IPC capabilities; it does not own their subscriptions.
 */
export type EditorApi = Pick<
  LlpApi,
  'songs' | 'content' | 'settings' | 'media'
>;

/** The revisioned labels document, retaining its current access contract. */
export type EditorLabels = Extract<SettingsDocument, {name: 'labels'}>;

/**
 * An identity already applied by main. Retry persists it without replaying
 * reference rewrites.
 */
export type AppliedRename =
  | {readonly kind: 'label'; readonly name: string; readonly revision: number}
  | {
      readonly kind: 'arrangement';
      readonly name: string;
      readonly revision: number;
      readonly songId: SongId;
    };

/**
 * Reports an applied identity without deciding its durability or retry
 * policy.
 */
export type RenameApplied = (identity: AppliedRename) => void;

/** The existing editor actions, without executing or scheduling them. */
export type SongEditorAction =
  | 'create-arrangement'
  | 'rename-arrangement'
  | 'delete-arrangement'
  | 'edit-arrangement'
  | 'hot-key';

/**
 * Captures the selected arrangement and a one-shot action serial; it does
 * not reread selection.
 */
export interface EditorActionRequest {
  readonly action: SongEditorAction;
  readonly serial: number;
  readonly arrangement: string | undefined;
}

/**
 * The current facade snapshot. Sessions and catalog arrays retain their
 * existing reference identity.
 */
export interface EditorState {
  readonly actionRequest: EditorActionRequest | null;
  readonly session: SongSession | null;
  readonly labels: EditorLabels | null;
  readonly busy: boolean;
  readonly library: readonly LibrarySong[];
  readonly libraryStatus: 'loading' | 'ready' | 'failed';
  readonly titleFocus: number;
  readonly imported: boolean;
  readonly discardRequested: boolean;
}

/**
 * Borrows the facade's live lifecycle checks, one operation gate and publication
 * callbacks. Collaborators never create another busy flag or edit queue.
 */
export interface EditorOperationHost {
  readonly alive: () => boolean;
  readonly locked: () => boolean;
  readonly runOperation: (task: () => Promise<boolean>) => Promise<boolean>;
  readonly publish: () => void;
  readonly problem: (title: string, retry?: () => unknown) => void;
}
