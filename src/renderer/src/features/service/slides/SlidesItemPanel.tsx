import {type JSX, useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SlidesItem} from '@core/services/slidesEdits';
import {
  Button,
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
  SlideThumbnail,
  ThumbnailGrid,
} from '@renderer/ui';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {useItemMedia} from '../items/useItemSources';
import {SlidesCanvas, slideBand, useSlidesAppearance} from './SlidesVisuals';
import {useSlidesVerseProjection} from '@renderer/features/bible/useSlidesVerseProjection';
import styles from './SlidesEditor.module.css';

export function SlidesItemPanel({
  api,
  items,
  item,
  openEditor,
}: {
  readonly api: Pick<LlpApi, 'settings' | 'media' | 'bible'>;
  readonly items: ServiceItemStore;
  readonly item: SlidesItem;
  readonly openEditor: LlpApi['slidesEditor']['open'] | undefined;
}): JSX.Element {
  const {service, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const {appearance} = useSlidesAppearance(api, item);
  const {projection} = useSlidesVerseProjection(api, item);
  const mediaSource = useItemMedia(api.media);
  const media = mediaSource.document?.value.items ?? [];
  const selected = Math.max(
    0,
    Math.min(position, item.slides.slides.length - 1),
  );
  const edit = (): void => {
    if (service === null || openEditor === undefined) return;
    openEditor({serviceId: service.service.id, itemId: item.id}).then(
      result => {
        if (!result.ok) {
          console.error('Could not open slides editor', result.error);
        }
      },
      (error: unknown) => console.error('Could not open slides editor', error),
    );
  };
  return (
    <Panel label="항목 슬라이드" className={styles.itemPanel}>
      <PanelHeader>
        <PanelTitle title={item.slides.name} />
        <PanelActions>
          <Button
            icon="edit"
            disabled={
              service?.access === 'readOnly' || openEditor === undefined
            }
            onClick={edit}
          >
            슬라이드 편집…
          </Button>
        </PanelActions>
      </PanelHeader>
      <PanelBody>
        <div onDoubleClick={edit}>
          <ThumbnailGrid
            label="슬라이드"
            workspace="prep"
            columns={3}
            tileWidth={128}
            selected={selected}
            onSelect={index => items.selectPosition(index)}
          >
            {item.slides.slides.map((slide, index) => (
              <SlideThumbnail
                key={slide.id}
                number={index + 1}
                label={slideBand(slide, media)}
                selected={index === selected}
                canvas={
                  <SlidesCanvas
                    item={item}
                    index={index}
                    appearance={appearance}
                    projection={projection}
                    thumbnail
                  />
                }
              />
            ))}
          </ThumbnailGrid>
        </div>
      </PanelBody>
      <PanelFooter count={item.slides.slides.length} />
    </Panel>
  );
}
