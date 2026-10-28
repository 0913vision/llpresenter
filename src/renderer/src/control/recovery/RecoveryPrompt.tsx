import type {JSX} from 'react';
import {RecoveryDialog} from './RecoveryDialog';
import {useRecovery} from './useRecovery';

/** Asks about the output state once after a crash, when main offers rows. */
export function RecoveryPrompt({
  recovery,
}: {
  readonly recovery: ReturnType<typeof useRecovery>;
}): JSX.Element | null {
  if (recovery.offer === null) return null;
  return (
    <RecoveryDialog
      key={recovery.offer.savedAt}
      summary={recovery.offer}
      busy={recovery.busy}
      onRestore={recovery.restore}
      onStartFresh={recovery.startFresh}
    />
  );
}
