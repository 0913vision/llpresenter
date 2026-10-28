import type {JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {AVAILABLE_TOOL_TABS} from './showTools';
import {ShowingTab} from './tools/ShowingTab';
import {StageTab} from './tools/StageTab';
import {MessageTab} from './tools/MessageTab';
import {TimerTab} from './tools/TimerTab';
import {useShowingCount} from './tools/showingRows';
import styles from './ShowToolsPanel.module.css';

/** Shows the 진행 도구 tabs whose panels have working controls. */
export function ShowToolsPanel({
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const tool = useShowToolTab(state => state.tool);
  const setTool = useShowToolTab(state => state.setTool);
  const selected = AVAILABLE_TOOL_TABS.some(tab => tab.value === tool)
    ? tool
    : 'stage';

  const screensDoc = useSettingsDocument('screens', '화면', onProblem);
  const looksDoc = useSettingsDocument('looks', 'Look', onProblem);
  const screens = screensDoc?.value.screens ?? [];
  const looks = looksDoc?.value ?? null;
  const showingCount = useShowingCount(screens, looks);

  const tabs = AVAILABLE_TOOL_TABS.map(tab =>
    tab.value === 'showing' ? {...tab, count: showingCount} : tab,
  );
  return (
    <div className={styles.root}>
      <Panel label="진행 도구" className={styles.panel}>
        <PanelHeader>
          <PanelTabs tabs={tabs} value={selected} onChange={setTool} />
        </PanelHeader>
        <PanelBody variant="flush" tab={selected}>
          {selected === 'showing' ? (
            <ShowingTab
              screensDoc={screensDoc}
              looksDoc={looksDoc}
              onProblem={onProblem}
            />
          ) : null}
          {selected === 'stage' ? <StageTab onProblem={onProblem} /> : null}
          {selected === 'timer' ? <TimerTab onProblem={onProblem} /> : null}
          {selected === 'message' ? <MessageTab onProblem={onProblem} /> : null}
        </PanelBody>
      </Panel>
    </div>
  );
}
