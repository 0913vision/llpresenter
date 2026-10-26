import type {JSX} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {Notice} from '@renderer/ui/notices';
import {RecoveryDialog} from './RecoveryDialog';
import {useRecovery} from './useRecovery';

/** Asks about the output state once after a crash, when main offers rows. */
export function RecoveryPrompt({
  api,
  onProblem,
}: {
  readonly api: Pick<LlpApi, 'recovery' | 'log'> | undefined;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const recovery = useRecovery(api, onProblem);
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
