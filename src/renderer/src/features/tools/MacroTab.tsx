import type {JSX} from 'react';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/notices';
import {MacroPanel} from './MacroPanel';

export function MacroTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const lastRunId = useLive(view => view.state?.lastMacroId);
  return <MacroPanel lastRunId={lastRunId} onProblem={onProblem} />;
}
