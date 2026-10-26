import {useMemo, type JSX} from 'react';
import {useLive} from '@renderer/state/live';
import type {Notice} from '@renderer/ui/notices';
import {ChoiceList} from './ChoiceList';
import {stageLayoutsInUse} from './choices';
import {useSettingsDocument} from './useSettingsDocument';
import {LookPanel} from './looks/LookPanel';

const LOOK_LABEL = 'Look';
const STAGE_LABEL = '무대 배치';
const SCREEN_LABEL = '화면';

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
  const layouts = useSettingsDocument('stage-layouts', STAGE_LABEL, onProblem);
  const looks = useSettingsDocument('looks', LOOK_LABEL, onProblem);
  const screens = useSettingsDocument('screens', SCREEN_LABEL, onProblem);
  const liveLookId = useLive(view => view.state?.lookId);
  const inUse = useMemo(
    () =>
      looks === null || screens === null
        ? new Set<string>()
        : stageLayoutsInUse(looks.value, screens.value, liveLookId),
    [looks, screens, liveLookId],
  );
  return (
    <ChoiceList
      label={STAGE_LABEL}
      kind="stage"
      choices={layouts?.value.layouts ?? []}
      inUse={inUse}
    />
  );
}
