import {useSyncExternalStore, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  PanelFooter,
} from '@renderer/ui';
import {useItemMedia} from '../items/useItemSources';
import {useSlidesVerseProjection} from '../../bible/useSlidesVerseProjection';
import {SongSlideSurface} from '../../songs/editor/SongSlideSurface';
import {VirtualSlides} from '../../songs/editor/VirtualSlides';
import {
  SlidesCanvas,
  SlidesPreview,
  slideBand,
  useSlidesAppearance,
} from './SlidesVisuals';
import type {SlidesListSession} from './slidesListSession';
import styles from '../../songs/editor/SongPanels.module.css';

/** Both panels read the same draft and selection as the center rows. */
export function InlineSlidesPanels({
  api,
  session,
  preview = false,
  onBack,
}: {
  readonly api: LlpApi;
  readonly session: SlidesListSession;
  readonly preview?: boolean;
  readonly onBack: () => void;
}): JSX.Element {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const {item, selected} = session.draft.snapshot;
  const media = useItemMedia(api.media).document?.value.items ?? [];
  const {appearance} = useSlidesAppearance(api, item);
  const {projection} = useSlidesVerseProjection(api, item);
  if (preview) {
    return (
      <SlidesPreview
        api={api}
        item={item}
        selected={selected}
        media={media}
        projection={projection}
      />
    );
  }
  return (
    <Panel label="항목 슬라이드" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={item.slides.name} />
      </PanelHeader>
      <PanelBody variant="flush">
        <SongSlideSurface
          session={session}
          onBack={onBack}
          className={styles.slideSurface}
        >
          <VirtualSlides
            sourceId={item.id}
            session={session}
            song={{
              slides: view.slides.map(slide => ({
                label: slideBand(slide, media),
                lines: [],
              })),
            }}
            numbers={view.slides.map((_, i) => i + 1)}
            labels={[]}
            selected={selected}
            baseline={2}
            scale={100}
            onSelect={index => session.draft.select(index)}
            canvasFor={index => (
              <SlidesCanvas
                item={item}
                index={index}
                appearance={appearance}
                projection={projection}
                thumbnail
              />
            )}
          />
        </SongSlideSurface>
      </PanelBody>
      <PanelFooter count={view.slides.length} />
    </Panel>
  );
}
