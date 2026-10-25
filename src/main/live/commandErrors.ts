/** A configured target that no longer exists; other batch commands can still run. */
export class MissingLiveTargetError extends Error {
  constructor(readonly target: {readonly kind: string; readonly id: string}) {
    super(`Missing ${target.kind}: ${target.id}`);
    this.name = 'MissingLiveTargetError';
  }
}
