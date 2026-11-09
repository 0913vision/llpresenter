import type {PlaybackProblemKind} from '@core/schema/playbackProblems';

const EVENT = 'llp-playback-problem';

class PlaybackProblemEvent extends Event {
  constructor(
    readonly kind: PlaybackProblemKind,
    readonly failed: boolean,
  ) {
    super(EVENT, {bubbles: true});
  }
}

/** Reports state without putting an error message in the output DOM. */
export function setPlaybackProblem(
  owner: HTMLElement,
  kind: PlaybackProblemKind,
  failed: boolean,
): void {
  owner.dispatchEvent(new PlaybackProblemEvent(kind, failed));
}

/** Aggregates only attached players; removing a failed layer retires its problem. */
export function followPlaybackProblems(
  root: HTMLElement,
  report: (kinds: readonly PlaybackProblemKind[]) => void,
): () => void {
  const failed = new Map<HTMLElement, Set<PlaybackProblemKind>>();
  let previous = '';
  const publish = (): void => {
    for (const owner of failed.keys()) {
      if (!root.contains(owner)) failed.delete(owner);
    }
    const kinds = [
      ...new Set([...failed.values()].flatMap(value => [...value])),
    ].sort();
    const key = kinds.join(',');
    if (key === previous) return;
    previous = key;
    report(kinds);
  };
  const receive = (event: Event): void => {
    if (!(event instanceof PlaybackProblemEvent)) return;
    const owner = event.target;
    if (!(owner instanceof HTMLElement)) return;
    const kinds = failed.get(owner) ?? new Set<PlaybackProblemKind>();
    if (event.failed) kinds.add(event.kind);
    else kinds.delete(event.kind);
    if (kinds.size === 0) failed.delete(owner);
    else failed.set(owner, kinds);
    publish();
  };
  root.addEventListener(EVENT, receive);
  const observer = new MutationObserver(publish);
  observer.observe(root, {childList: true, subtree: true});
  report([]);
  return () => {
    root.removeEventListener(EVENT, receive);
    observer.disconnect();
    failed.clear();
  };
}
