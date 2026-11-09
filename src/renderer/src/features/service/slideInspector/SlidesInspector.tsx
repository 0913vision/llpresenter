import {useSyncExternalStore, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {useItemMedia} from '../items/useItemSources';
import {useSlidesVerseProjection} from '../../bible/useSlidesVerseProjection';
import {
  SlidesCanvas,
  slideBand,
  useSlidesAppearance,
} from '../slides/SlidesVisuals';
import type {SlidesListSession} from '../slides/slidesListSession';
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {Properties} from '@renderer/ui/PropertyRow';
import {TransitionRows} from './TransitionRows';
import {slideTransitionUndo} from '@renderer/features/songs/editor/slideTransitionSelection';
import styles from './SlideInspector.module.css';

/** Inspect a local slide item through its existing draft and selection. */
export function SlidesInspector({
  api,
  session,
}: {
  readonly api: LlpApi;
  readonly session: SlidesListSession;
}): JSX.Element {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const {item, selected} = session.draft.snapshot;
  const media = useItemMedia(api.media).document?.value.items ?? [];
  const {appearance} = useSlidesAppearance(api, item);
  const {projection} = useSlidesVerseProjection(api, item);
  const slide = view.slides[selected];
  return (
    <Panel label="슬라이드 속성">
      <PanelBody>
        {view.selection.ids.size === 0 || slide === undefined ? null : (
          <div
            onKeyDown={event =>
              slideTransitionUndo(event, session, session.readOnly)
            }
          >
            <div className={styles.picture}>
              <SlidesCanvas
                item={item}
                index={selected}
                appearance={appearance}
                projection={projection}
              />
            </div>
            <div className={styles.caption}>
              {slideBand(slide, media)}
              <span>
                {selected + 1} / {view.slides.length}
              </span>
            </div>
            <Properties>
              <TransitionRows session={session} disabled={false} />
            </Properties>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
