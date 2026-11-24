import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {parseServiceDocument} from '@core/schema/services/contentDocuments';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ShowService} from '@core/schema/services/showService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {applyService, useShow} from '@renderer/session/show/show';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';

const SERVICE_ID = '30000000-0000-4000-8000-000000000001';
const SONG_ITEM = '40000000-0000-4000-8000-000000000001';
const MEDIA_ITEM = '40000000-0000-4000-8000-000000000002';

const service: ShowService = {
  revision: 1,
  id: SERVICE_ID,
  name: '주일 예배',
  readOnly: false,
  rows: [
    {kind: 'song', id: SONG_ITEM, title: '새벽을 여는 노래'},
    {kind: 'media', id: MEDIA_ITEM, title: '배경 영상'},
  ],
  tiles: {},
};

const openSongEditor = vi.hoisted(() => vi.fn());
vi.mock('@renderer/features/songs/editor/songEditorRequests', () => ({
  requestSongEditor: openSongEditor,
}));

beforeEach(() => {
  openSongEditor.mockReset();
  openSongEditor.mockResolvedValue({ok: true, value: undefined});
  window.llp = mockLlpApi({
    services: {
      get: async () =>
        expectSuccess(
          parseServiceDocument({
            access: 'editable',
            revision: 1,
            service: {
              format: 'llservice',
              schemaVersion: 1,
              id: SERVICE_ID,
              name: 'Invented',
              date: '2026-11-08T09:00',
              order: [
                {
                  id: SONG_ITEM,
                  kind: 'song',
                  name: '곡',
                  song: '50000000-0000-4000-8000-000000000001',
                  slides: [],
                },
              ],
            },
          }),
        ),
    },
  });
  applyService(null);
  applyService(service);
  useShow.setState({openItemId: null});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

describe('ServiceOrderList 곡 편집 entry points', () => {
  it('does not open it for other rows, other keys, or 진행', () => {
    const {rerender} = render(<ServiceOrderList workspace="prep" />);
    fireEvent.doubleClick(screen.getByRole('option', {name: /배경 영상/}));
    fireEvent.keyDown(screen.getByRole('option', {name: /새벽을/}), {
      key: 'Enter',
      ctrlKey: true,
    });
    rerender(<ServiceOrderList workspace="show" />);
    fireEvent.doubleClick(screen.getByRole('option', {name: /새벽을/}));

    expect(openSongEditor).not.toHaveBeenCalled();
  });
});
