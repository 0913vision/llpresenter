const COMMIT_DRAFT = 'llp:commit-draft';

/** Ask the focused editor to commit before a global command runs. */
export function commitDraftBeforeShortcut(target: EventTarget | null): void {
  target?.dispatchEvent(new Event(COMMIT_DRAFT));
}

/** Subscribe an editor to a global command's commit request. */
export function onShortcutCommit(
  target: HTMLElement,
  commit: () => void,
): () => void {
  target.addEventListener(COMMIT_DRAFT, commit);
  return () => target.removeEventListener(COMMIT_DRAFT, commit);
}
