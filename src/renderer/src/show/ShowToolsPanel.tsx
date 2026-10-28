import type {JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {AVAILABLE_TOOL_TABS} from './showTools';
import {ShowingTab} from './tools/ShowingTab';
import {AudioTab} from './tools/AudioTab';
import {StageTab} from './tools/StageTab';
import {MessageTab} from './tools/MessageTab';
import {TimerTab} from './tools/TimerTab';
import {PropTab} from './tools/PropTab';
import {NoticeTab} from './tools/NoticeTab';
import {MacroTab} from './tools/MacroTab';
import {useShowingCount} from './tools/showingHooks';
import styles from './ShowToolsPanel.module.css';

/** Shows the 진행 도구 tabs whose panels have working controls. */
export function ShowToolsPanel({
  sizeClass,
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

  const showingCount = useShowingCount(onProblem);

  const tabs = AVAILABLE_TOOL_TABS.map(tab =>
    tab.value === 'showing' ? {...tab, count: showingCount} : tab,
  );
  const visible = tabs.filter(tab =>
    sizeClass === 'narrow'
      ? tab.value === 'showing' || tab.value === 'stage'
      : tab.value === 'showing' ||
        tab.value === 'audio' ||
        tab.value === 'stage' ||
        tab.value === 'timer',
  );
  const more = tabs.filter(
    tab => !visible.some(item => item.value === tab.value),
  );
  return (
    <div className={styles.root}>
      <Panel label="진행 도구" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={visible}
            value={selected}
            onChange={setTool}
            more={{label: '\ub354 \ubcf4\uae30', tabs: more}}
          />
        </PanelHeader>
        <PanelBody variant="flush" tab={selected}>
          {selected === 'showing' ? <ShowingTab onProblem={onProblem} /> : null}
          {selected === 'audio' ? <AudioTab onProblem={onProblem} /> : null}
          {selected === 'stage' ? <StageTab onProblem={onProblem} /> : null}
          {selected === 'timer' ? <TimerTab onProblem={onProblem} /> : null}
          {selected === 'message' ? <MessageTab onProblem={onProblem} /> : null}
          {selected === 'notice' ? <NoticeTab onProblem={onProblem} /> : null}
          {selected === 'prop' ? <PropTab onProblem={onProblem} /> : null}
          {selected === 'macro' ? <MacroTab onProblem={onProblem} /> : null}
        </PanelBody>
      </Panel>
    </div>
  );
}
