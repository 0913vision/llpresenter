import {useContext, useRef, useState, type JSX, type ReactNode} from 'react';
import {SegmentedControl} from './SegmentedControl';
import {Panel, PanelHeader, PanelTitle} from './Panel';
import {PreviewFrame, type PreviewFrameProps} from './PreviewFrame';
import {PreviewScreenPicker} from './PreviewScreenPicker';
import {usePreviewRoom} from './usePreviewRoom';
import styles from './PreviewPanel.module.css';
import {PreviewSizingContext} from './PreviewSizingContext';
import {ResizeGap} from './ResizeGap';

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
  visible = true,
  onVisibleChange,
  children,
  ...frame
}: Omit<PreviewFrameProps<Id>, 'compact' | 'sizing' | 'tiles'> & {
  readonly blank?: boolean;
  readonly visible?: boolean;
  readonly onVisibleChange?: (visible: boolean) => void;
  readonly children?: ReactNode;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sizing = useContext(PreviewSizingContext);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const ratio = dragRatio ?? sizing?.ratio ?? 0.667;
  const room = usePreviewRoom(root, {
    tiles: Math.max(0, frame.screens.length - 1),
    extra: extraHeight,
  });
  return (
    <Panel label="미리보기">
      <PanelHeader>
        <PanelTitle title="미리보기" />
        {onVisibleChange === undefined ? null : (
          <SegmentedControl
            label="미리보기 배치"
            options={[
              {value: 'main', label: '메인 1 + 2'},
              {value: 'small', label: '3개 작게'},
            ]}
            value={visible ? 'main' : 'small'}
            onChange={value => onVisibleChange(value === 'main')}
          />
        )}
        {room || sizing !== null || blank || frame.screens.length < 2 ? null : (
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
        data-preview-tiles={
          (room || sizing !== null || !visible) && !blank ? 'on' : 'off'
        }
      >
        <div className={styles.frame} ref={frameRef}>
          <PreviewFrame
            {...frame}
            sizing="content"
            largeVisible={visible}
            tiles={(room || sizing !== null || !visible) && !blank}
            split={
              sizing !== null && visible && !blank && frame.screens.length > 1
                ? {
                    ratio,
                    divider: (
                      <ResizeGap
                        axis="row"
                        name="preview.split"
                        onReset={() => sizing.save(0.667)}
                        begin={() => {
                          const height = frameRef.current?.clientHeight ?? 0;
                          if (height <= 0) return undefined;
                          const start = ratio;
                          let next = start;
                          return {
                            move: delta => {
                              next = Math.max(
                                0.15,
                                Math.min(0.85, start + delta / height),
                              );
                              setDragRatio(next);
                            },
                            end: () => {
                              sizing.save(next);
                              setDragRatio(null);
                            },
                          };
                        }}
                      />
                    ),
                  }
                : undefined
            }
            caption={
              blank
                ? () => <span aria-hidden="true">&nbsp;</span>
                : frame.caption
            }
          />
        </div>
        {children}
      </div>
    </Panel>
  );
}
