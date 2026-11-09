import {useRef, type JSX, type ReactNode} from 'react';
import {Panel, PanelHeader, PanelTitle} from './Panel';
import {PreviewFrame, type PreviewFrameProps} from './PreviewFrame';
import {PreviewScreenPicker} from './PreviewScreenPicker';
import {usePreviewRoom} from './usePreviewRoom';
import styles from './PreviewPanel.module.css';

function extraHeight(anchor: HTMLElement): number {
  let height = 0;
  for (const row of anchor.querySelectorAll('[data-preview-extra]')) {
    height += row.getBoundingClientRect().height;
  }
  return height;
}

/** The same monitoring layout for live output and local item previews. */
export function PreviewPanel<Id extends string>({
  blank = false,
  children,
  ...frame
}: Omit<PreviewFrameProps<Id>, 'compact' | 'sizing' | 'tiles'> & {
  readonly blank?: boolean;
  readonly children?: ReactNode;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const room = usePreviewRoom(root, {
    tiles: Math.max(0, frame.screens.length - 1),
    extra: extraHeight,
  });
  return (
    <Panel label="미리보기">
      <PanelHeader>
        <PanelTitle title="미리보기" />
        {room || blank || frame.screens.length < 2 ? null : (
          <PreviewScreenPicker
            screens={frame.screens}
            big={frame.big}
            onChange={frame.onBigChange}
          />
        )}
      </PanelHeader>
      <div
        ref={root}
        className={styles.body}
        data-preview-tiles={room && !blank ? 'on' : 'off'}
      >
        <PreviewFrame
          {...frame}
          sizing="content"
          tiles={room && !blank}
          caption={
            blank ? () => <span aria-hidden="true">&nbsp;</span> : frame.caption
          }
        />
        {children}
      </div>
    </Panel>
  );
}
