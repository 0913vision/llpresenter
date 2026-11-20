import * as songEditorRequests from '@renderer/features/songs/editor/songEditorRequests';
import {StrictMode, useContext, useLayoutEffect, useRef} from 'react';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, vi} from 'vitest';
import {createServiceItemId, createThemeId} from '@core/schema/ids';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {newSlidesItem} from '@core/services/slidesEdits';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {applyService} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {isItemOfKind} from '@core/schema/service';
import {otherItems, templateOrder} from '@fixtures/core/serviceList';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    ready = () => true;
    revealIncomplete = () => undefined;
    render = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock(
  '@renderer/rendering/pictures/Picture',
  () => import('@fixtures/renderer/picture'),
);
vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: () => {
    const ready = useContext(PictureReadiness);
    const source = useRef({});
    useLayoutEffect(() => ready?.(source.current), [ready]);
    return null;
  },
}));

const sessions: ControlSession[] = [];

// NOTE(0913vision): jsdom has no layout for the hidden preparation frame.
vi.mock('@renderer/rendering/drawnPictures', () => ({
  drawnPictures: () => 1,
}));

function setup(extraSlides = false, songCard = false, strict = false) {
  const f = itemFixture();
  const slides = newSlidesItem('blank', fixtureItems.lost);
  const announcement = newSlidesItem(
    'ad',
    createServiceItemId('50000000-0000-4000-8000-000000000097'),
  );
  const section = {
    ...newSlidesItem(
      'blank',
      createServiceItemId('50000000-0000-4000-8000-000000000098'),
    ),
    sectionCard: {
      name: 'Section',
      english: 'Section',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
  };
  const sourceBible = templateOrder.find(item => isItemOfKind(item, 'bible'));
  if (!sourceBible) throw new Error('Missing Bible fixture');
  const media = otherItems[0];
  if (!media || !isItemOfKind(media, 'media')) {
    throw new Error('Missing media fixture');
  }
  const bible = {
    ...sourceBible,
    id: createServiceItemId('50000000-0000-4000-8000-000000000099'),
  };
  f.pushService({
    ...f.service(),
    service: {
      ...f.service().service,
      order: [
        ...f
          .service()
          .service.order.filter(item => item.id !== slides.id)
          .map(item =>
            songCard &&
            item.id === fixtureItems.arranged &&
            isItemOfKind(item, 'song')
              ? {
                  ...item,
                  sectionCard: {
                    name: 'Song section',
                    english: 'Section',
                    theme: createThemeId(
                      '00000000-0000-4000-8000-000000000111',
                    ),
                  },
                }
              : item,
          ),
        slides,
        bible,
        media,
        ...(extraSlides ? [announcement, section] : []),
      ],
    },
  });
  vi.spyOn(songEditorRequests, 'requestSongEditor');
  const items = new Set<(target: SlidesEditorTarget | null) => void>();
  vi.spyOn(f.api.slidesEditor, 'onRetarget').mockImplementation(listener => {
    items.add(listener);
    return () => {
      items.delete(listener);
    };
  });
  vi.spyOn(f.api.slidesEditor, 'open').mockImplementation(async target => {
    for (const listener of items) listener(target);
    return {ok: true, value: undefined};
  });
  applyService({
    revision: 1,
    id: fixtureServiceId,
    name: 'Service',
    readOnly: false,
    rows: [
      {kind: 'song', id: fixtureItems.arranged, title: 'Service song'},
      {kind: 'slides', form: 'blank', id: slides.id, title: 'Sermon item'},
      {kind: 'bible', id: bible.id, title: 'Bible item'},
      {kind: 'media', id: media.id, title: 'Media item'},
      ...(extraSlides
        ? [
            {
              kind: 'slides' as const,
              form: 'ad' as const,
              id: announcement.id,
              title: 'Announcement item',
            },
            {
              kind: 'slides' as const,
              form: 'blank' as const,
              id: section.id,
              title: 'Section item',
            },
          ]
        : []),
    ],
    tiles: {
      [fixtureItems.arranged]: f.first.song.slides.map(slide => ({
        labelColor: 'none' as const,
        lines: slide.lines,
        label: slide.label ?? null,
        sourceSlide: {songId: f.first.song.id, slideId: slide.id},
      })),
      [slides.id]: [{lines: [], label: null, labelColor: 'none'}],
      [bible.id]: [{lines: [], label: null, labelColor: 'none'}],
      ...(extraSlides
        ? {
            [announcement.id]: [
              {lines: [], label: null, labelColor: 'none' as const},
            ],
            [section.id]: [
              {lines: [], label: null, labelColor: 'none' as const},
            ],
          }
        : {}),
    },
  });
  window.llp = f.api;
  const session = new ControlSession(f.api);
  sessions.push(session);
  const app = (
    <App session={session} columnWidthStore={createMemoryColumnWidthStore()} />
  );
  render(strict ? <StrictMode>{app}</StrictMode> : app);
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  return {...f, session};
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => {
  cleanup();
  resetTooltips();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  applyService(null);
  useLive.setState({state: null});
  delete window.llp;
  vi.restoreAllMocks();
});

function commandList(): HTMLElement {
  const editor =
    screen.queryByRole('region', {name: '곡 편집'}) ??
    screen.getByLabelText('슬라이드 편집', {selector: 'div'});
  return within(editor).getByRole('group', {name: '슬라이드 편집 명령'});
}
export {setup, commandList};
