import type {JSX} from 'react';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {Panel, PanelBody, PanelHeader} from '@renderer/ui/Panel';
import {ResponsivePanelTabs} from '@renderer/ui/ResponsivePanelTabs';
import type {Notice} from '@renderer/ui/notices';
import {AVAILABLE_TOOL_TABS} from './showTools';
import {AudioTab} from './AudioTab';
import {StageTab} from './StageTab';
import {MessageTab} from './MessageTab';
import {TimerTab} from './TimerTab';
import {PropTab} from './PropTab';
import {NoticeTab} from './NoticeTab';
import {MacroTab} from './MacroTab';
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

  return (
    <div className={styles.root}>
      <Panel label="진행 도구" className={styles.panel}>
        <PanelHeader>
          <ResponsivePanelTabs
            tabs={AVAILABLE_TOOL_TABS}
            value={selected}
            onChange={setTool}
            moreLabel="더 보기"
          />
        </PanelHeader>
        <PanelBody variant="flush" tab={selected}>
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
