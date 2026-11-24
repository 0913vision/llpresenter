import type {JSX} from 'react';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/popups/notices';
import {MacroPanel} from './MacroPanel';

/** The 매크로 tab of the 진행 tools, which marks the macro that ran last. */
export function MacroTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const lastRunId = useLive(view => view.state?.lastMacroId);
  return <MacroPanel lastRunId={lastRunId} onProblem={onProblem} />;
}
