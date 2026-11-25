import {isUnsaved} from '../songDraftModel';
import {closeSongDraft} from './draftOpen';
import {draftView as view, useSongDraft, type SongQuestion} from './draftStore';

/**
 * Shows `question`, or closes the open one with null; a pending 'leave'
 * question that is replaced is cancelled.
 */
export function ask(question: SongQuestion | null): void {
  const before = view().question;
  if (before?.kind === 'leave' && question?.kind !== 'leave') {
    before.cancel?.();
  }
  useSongDraft.setState({question});
}

/** Goes on once the open song may be left, asking about unsaved changes. */
export function requestLeaveSong(
  proceed: () => void,
  cancel?: () => void,
): void {
  const {draft} = view();
  const untouched =
    draft !== null &&
    draft.document === null &&
    !draft.imported &&
    draft.past.length === 0;
  if (draft === null || untouched || !isUnsaved(draft)) {
    closeSongDraft();
    proceed();
    return;
  }
  ask({kind: 'leave', proceed, cancel});
}
