import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {ALL_TOOL_TABS, COMPACT_TOOL_TABS} from './showTools';
import {StageTab} from './tools/StageTab';
import {MessageTab} from './tools/MessageTab';
import styles from './ShowToolsPanel.module.css';

const MORE_LABEL = '더 보기';
const TAB_LIST = '[role="tablist"]';

// NOTE(0913vision): Only the full tab row can be measured, so when it
// overflows, the panel remembers how much wider it must be and shows all
// eight tabs again once it is that wide.
function useAllTabsFit(measuring: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);
  const neededWidth = useRef(0);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!measuring || root === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const check = (): void => {
      const width = root.clientWidth;
      if (!fits) {
        if (width >= neededWidth.current) setFits(true);
        return;
      }
      const tabs = root.querySelector(TAB_LIST);
      const overflow = tabs === null ? 0 : tabs.scrollWidth - tabs.clientWidth;
      if (overflow <= 0) return;
      neededWidth.current = width + overflow;
      setFits(false);
    };
    const observer = new ResizeObserver(check);
    observer.observe(root);
    check();
    return () => observer.disconnect();
  }, [measuring, fits]);
  return {rootRef, fits};
}

/**
 * The 진행 도구 panel frame: all eight tabs when they fit, otherwise 표시 중,
 * 무대, and the rest behind 더 보기, as a narrow window always shows them; and
 * the tab panel of the chosen tool.
 */
export function ShowToolsPanel({
  sizeClass,
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const tool = useShowToolTab(state => state.tool);
  const setTool = useShowToolTab(state => state.setTool);
  const narrow = sizeClass === 'narrow';
  const {rootRef, fits} = useAllTabsFit(!narrow);
  const {tabs, more} = narrow || !fits ? COMPACT_TOOL_TABS : ALL_TOOL_TABS;
  return (
    <div ref={rootRef} className={styles.root}>
      <Panel label="진행 도구" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={tabs}
            value={tool}
            onChange={setTool}
            more={{label: MORE_LABEL, tabs: more}}
          />
        </PanelHeader>
        <PanelBody variant="flush" tab={tool}>
          {tool === 'stage' ? <StageTab onProblem={onProblem} /> : null}
          {tool === 'message' ? <MessageTab onProblem={onProblem} /> : null}
        </PanelBody>
      </Panel>
    </div>
  );
}
