import type {JSX} from 'react';
import type {Notice} from '@renderer/ui/notices';
import {LookPanel} from './looks/LookPanel';
import {StagePanel} from './stage/StagePanel';

/** The Look list; the Look on output carries the LIVE badge. */
export function LookList({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  return <LookPanel onProblem={onProblem} />;
}

/** The 무대 배치 list; the layouts the Look in use gives the 무대 screens carry the LIVE badge. */
export function StageLayoutList({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  return <StagePanel onProblem={onProblem} />;
}
