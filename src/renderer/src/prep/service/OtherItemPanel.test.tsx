import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {
  createServiceItemId,
  noticeSetIdSchema,
  screenIdSchema,
  translationIdSchema,
} from '@shared/schema/ids';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import type {ServiceItem} from '@shared/schema/service';
import {fixtureMedia, itemFixture} from './itemFixture';
import {OtherItemPanel} from './OtherItemPanel';

afterEach(() => {
  delete window.llp;
});

const noticeSet = v.parse(
  noticeSetIdSchema,
  '80000000-0000-4000-8000-000000000001',
);
const itemId = createServiceItemId('50000000-0000-4000-8000-000000000009');

function noticesDocument() {
  const parsed = parseSettingsDocument({
    name: 'notices',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llsettings.notices',
      schemaVersion: 1,
      sets: [
        {
          id: noticeSet,
          name: '주보 공지',
          media: [fixtureMedia.warm, fixtureMedia.dawn],
          interval: 5,
          loop: true,
          targets: [
            v.parse(screenIdSchema, '90000000-0000-4000-8000-000000000001'),
          ],
        },
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid notices fixture');
  return parsed.value;
}

function show(item: ServiceItem | null): void {
  const fixture = itemFixture();
  const read = fixture.api.settings.get;
  window.llp = {
    ...fixture.api,
    settings: {
      ...fixture.api.settings,
      get: request =>
        request.name === 'notices'
          ? Promise.resolve(noticesDocument())
          : read(request),
    },
  };
  render(<OtherItemPanel item={item} sizeClass="normal" />);
}

describe('the center panel of other item kinds', () => {
  it('shows the images of a 공지 set without a way to change them', async () => {
    show({id: itemId, notice: noticeSet});
    expect(await screen.findByText('주보 공지')).toBeDefined();
    expect(screen.getByText('슬라이드 2개')).toBeDefined();
    const names = screen
      .getAllByRole('option')
      .map(tile => tile.getAttribute('aria-label'));
    expect(names).toEqual(['따뜻한 빛', '새벽 하늘']);
  });

  it('shows the passage of a Bible item in the header', () => {
    show({
      id: itemId,
      bible: {
        translation: v.parse(translationIdSchema, 'krv'),
        ref: '요한복음 3:16',
        split: 'verse',
        reference: 'every',
        verseNumbers: true,
        translationName: false,
      },
    });
    expect(screen.getByText('요한복음 3:16')).toBeDefined();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows the name of a media item in the header', async () => {
    show({id: itemId, media: fixtureMedia.dawn});
    expect(await screen.findByText('새벽 하늘')).toBeDefined();
  });

  it('leaves the panel empty for a header, a slot, and no selection', () => {
    show({id: itemId, header: '찬양'});
    const panel = screen.getByRole('region', {name: '예배 순서 항목'});
    expect(panel.textContent).toBe('');
    render(<OtherItemPanel item={null} sizeClass="normal" />);
    expect(
      screen.getAllByRole('region', {name: '예배 순서 항목'}),
    ).toHaveLength(2);
  });
});
