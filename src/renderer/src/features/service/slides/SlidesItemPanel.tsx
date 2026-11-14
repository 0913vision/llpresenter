import type {SongEditorStore} from '../../songs/editor/songEditorStore';
import {cardOffset} from '@core/services/sectionCards';
import {sectionCardEntries} from '../items/sectionCardActions';
import {type JSX, useEffect, useMemo, useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {SlidesDraft, type SlidesItem} from '@core/services/slidesEdits';
import {
  Button,
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {useItemMedia, useItemSettings} from '../items/useItemSources';
import {SlidesCanvas, slideBand, useSlidesAppearance} from './SlidesVisuals';
import {useSlidesVerseProjection} from '@renderer/features/bible/useSlidesVerseProjection';
import {SongSlideSurface} from '../../songs/editor/SongSlideSurface';
import {VirtualSlides} from '../../songs/editor/VirtualSlides';
import {SlidesListSession} from './slidesListSession';
import type {SlidesEditorModel} from './useSlidesEditor';
import styles from '../../songs/editor/SongPanels.module.css';

export function SlidesItemPanel({
  api,
  store,
  items,
  item,
  openEditor,
  controller,
}: {
  readonly api: Pick<LlpApi, 'settings' | 'media' | 'bible'>;
  readonly store?: SongEditorStore | undefined;
  readonly items: ServiceItemStore;
  readonly item: SlidesItem;
  readonly openEditor: LlpApi['slidesEditor']['open'] | undefined;
  readonly controller?: SlidesEditorModel | undefined;
}): JSX.Element | null {
  const {service} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const session = useMemo(() => {
    if (service === null) return null;
    const target = {serviceId: service.service.id, itemId: item.id};
    const commands =
      controller?.sessionFor(item, target, service.access === 'readOnly') ??
      new SlidesListSession(new SlidesDraft(item), {
        locked: () => service.access === 'readOnly',
        problem: message => console.error(message),
        report: items.reportNotice,
      });
    return commands;
  }, [controller, item, items, service]);
  return session === null ? null : (
    <SlidesItemTiles
      api={api}
      store={store}
      items={items}
      session={session}
      openEditor={openEditor}
    />
  );
}

function SlidesItemTiles({
  api,
  store,
  items,
  session,
  openEditor,
}: {
  readonly api: Pick<LlpApi, 'settings' | 'media' | 'bible'>;
  readonly store?: SongEditorStore | undefined;
  readonly items: ServiceItemStore;
  readonly session: SlidesListSession;
  readonly openEditor: LlpApi['slidesEditor']['open'] | undefined;
}): JSX.Element {
  const {service} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const labelsDoc = useItemSettings(
    api.settings,
    'labels',
    store !== undefined,
  ).document;
  const labels = labelsDoc?.name === 'labels' ? labelsDoc.value.labels : [];
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const {item, selected} = session.draft.snapshot;
  const offset = cardOffset(item);
  const {appearance} = useSlidesAppearance(api, item);
  const {projection} = useSlidesVerseProjection(api, item);
  const media = useItemMedia(api.media).document?.value.items ?? [];
  useEffect(
    () => items.selectPosition(selected + offset),
    [items, selected, offset],
  );
  const edit = (index = selected): void => {
    if (service === null || openEditor === undefined) return;
    items.selectPosition(index + cardOffset(item));
    openEditor({serviceId: service.service.id, itemId: item.id}).catch(
      (error: unknown) => console.error('Could not open slides editor', error),
    );
  };
  return (
    <Panel label="항목 슬라이드" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={item.slides.name} />
        <PanelActions>
          <Button
            icon="edit"
            disabled={session.readOnly || openEditor === undefined}
            onClick={() => edit()}
          >
            슬라이드 편집…
          </Button>
        </PanelActions>
      </PanelHeader>
      <PanelBody variant="flush">
        <SongSlideSurface
          session={session}
          store={store}
          report={session.reportNotice}
          editLabel="슬라이드 편집…"
          className={styles.slideSurface}
          onEdit={edit}
          extraMenu={() => sectionCardEntries(items)}
        >
          <VirtualSlides
            session={session}
            song={{
              slides: view.slides.map(slide => ({
                label: slideBand(slide, media),
                lines: [],
              })),
            }}
            numbers={view.slides.map((_, i) => i + (1 + cardOffset(item)))}
            labels={labels}
            selected={selected}
            baseline={2}
            scale={100}
            onSelect={index => session.draft.select(index)}
            onEdit={edit}
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
      <PanelFooter count={view.slides.length + cardOffset(item)} />
    </Panel>
  );
}
