import {useMemo, useLayoutEffect, useRef, type JSX} from 'react';
import {useLive} from '@renderer/state/live';
import {IconButton} from '@renderer/ui/IconButton';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {ChoiceRows} from '../ChoiceRows';
import {stageLayoutsInUse} from '../choices';
import {selectedIdIn, useScreensSelection} from '../selection';
import {useSettingsDocument} from '../useSettingsDocument';
import {STAGE_LAYOUT_LIMIT} from './stageEditor';
import {useStageEditor} from './useStageEditor';
import styles from '../looks/LookList.module.css';

/** Stage selection and creation share the screen settings document lifecycle. */
export function StagePanel({
  onProblem,
}: {
  onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const layouts = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  const looks = useSettingsDocument('looks', 'Look', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const live = useLive(view => view.state?.lookId);
  const select = useScreensSelection(view => view.select);
  const selection = useScreensSelection(view => view.selection);
  const run = useStageEditor(layouts, onProblem);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const inUse = useMemo(
    () =>
      looks === null || screens === null
        ? new Set<string>()
        : stageLayoutsInUse(looks.value, screens.value, live),
    [looks, screens, live],
  );
  return (
    <Panel label="무대 배치" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="무대 배치" />
        <PanelActions>
          <IconButton
            icon="plus"
            label="새 배치"
            disabled={
              layouts?.access !== 'editable' ||
              layouts.value.layouts.length >= STAGE_LAYOUT_LIMIT
            }
            onClick={() =>
              run(
                editor => editor.create(),
                id => {
                  if (mounted.current && id !== null) select('stage', id);
                },
              )
            }
          />
        </PanelActions>
      </PanelHeader>
      <PanelBody variant="flush" className={styles.body}>
        <ChoiceRows
          label="무대 배치"
          selected={selectedIdIn(selection, 'stage')}
          onSelect={id => select('stage', id)}
          renaming={null}
          choices={layouts?.value.layouts ?? []}
          inUse={inUse}
        />
      </PanelBody>
    </Panel>
  );
}
