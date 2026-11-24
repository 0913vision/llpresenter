import type {JSX, ReactNode} from 'react';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/panels/Panel';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import type {PreviewScreen} from './SlidePreview';
import styles from './SlideSidePanel.module.css';

/** The right panel of 준비, whose header chooses the screen of its preview. */
export function SlideSidePanel({
  label,
  screen,
  children,
  footer,
}: {
  readonly label: string;
  /** None while the panel shows no slide. */
  readonly screen?: PreviewScreen | undefined;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}): JSX.Element {
  return (
    <Panel label={label} className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="미리보기" />
        {screen?.id === undefined ? null : (
          <PanelActions>
            <SegmentedControl
              label="화면"
              options={screen.choices}
              value={screen.id}
              onChange={screen.select}
            />
          </PanelActions>
        )}
      </PanelHeader>
      <PanelBody>{children}</PanelBody>
      {footer}
    </Panel>
  );
}
