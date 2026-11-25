import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import type {PowerPointImageExportResult} from '@core/schema/songs/powerpointImport';
import {pastDocument} from '@fixtures/core/serviceList';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {PowerPointImagesFlow} from '@renderer/app/PowerPointImagesFlow';
import type {Notice} from '@renderer/ui/popups/notices';
import {useShow} from '@renderer/session/show/showStore';

const first = createMediaId('00000000-0000-4000-8000-000000000011');
const second = createMediaId('00000000-0000-4000-8000-000000000012');
const slide = {path: 'C:/temp/slide.png', number: 1};

beforeEach(() => {
  useShow.setState({
    serviceId: pastDocument.service.id,
    readOnly: false,
    openItemId: null,
  });
});

function cancelFrom(
  report: ReturnType<typeof vi.fn<(notice: Notice) => void>>,
): void {
  const action = report.mock.calls
    .flatMap(([notice]) => notice.actions ?? [])
    .at(-1);
  if (!action) throw new Error('Missing cancel action');
  act(() => action.onSelect());
}

describe('PowerPoint image cancellation', () => {
  it('releases exported files if cancellation races a successful export', async () => {
    let finish: (result: PowerPointImageExportResult) => void = () => undefined;
    const pending = new Promise<PowerPointImageExportResult>(resolve => {
      finish = resolve;
    });
    const release = vi.fn(async () => true);
    const importMedia = vi.fn(async () => ({ok: true as const, value: []}));
    const api = mockLlpApi({
      powerpoint: {images: () => pending, release},
      media: {import: importMedia},
    });
    const report = vi.fn<(notice: Notice) => void>();
    render(
      <PowerPointImagesFlow api={api} onDone={vi.fn()} onProblem={report} />,
    );
    await waitFor(() => expect(report).toHaveBeenCalled());
    cancelFrom(report);
    await act(async () =>
      finish({ok: true, value: {fileName: 'deck.pptx', slides: [slide]}}),
    );
    await waitFor(() =>
      expect(release).toHaveBeenCalledWith({path: slide.path}),
    );
    expect(importMedia).not.toHaveBeenCalled();
  });

  it('releases temporary exports when cancellation races storage', async () => {
    let finish: (value: {ok: true; value: Array<typeof first>}) => void = () =>
      undefined;
    const pending = new Promise<{ok: true; value: Array<typeof first>}>(
      resolve => {
        finish = resolve;
      },
    );
    const storeImages = vi.fn(() => pending);
    const release = vi.fn(async () => true);
    const edit = vi.fn();
    const api = mockLlpApi({
      powerpoint: {
        images: async () => ({
          ok: true,
          value: {fileName: 'deck.pptx', slides: [slide]},
        }),
        storeImages,
        release,
      },
      content: {edit},
    });
    const report = vi.fn<(notice: Notice) => void>();
    render(
      <PowerPointImagesFlow api={api} onDone={vi.fn()} onProblem={report} />,
    );
    await waitFor(() => expect(storeImages).toHaveBeenCalledOnce());
    cancelFrom(report);
    await act(async () => finish({ok: true, value: [first, second]}));
    await waitFor(() => expect(release).toHaveBeenCalledOnce());
    expect(edit).not.toHaveBeenCalled();
  });
});

describe('PowerPoint image failures', () => {
  it('says the pictures could not be stored, and logs why', async () => {
    const write = vi.fn();
    const api = mockLlpApi({
      powerpoint: {
        images: async () => ({
          ok: true,
          value: {fileName: 'deck.pptx', slides: [slide]},
        }),
        storeImages: async () => ({ok: false, message: 'Copy failed'}),
        release: async () => true,
      },
      log: {write},
    });
    const report = vi.fn<(notice: Notice) => void>();
    render(
      <PowerPointImagesFlow api={api} onDone={vi.fn()} onProblem={report} />,
    );
    await waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'PowerPoint 이미지 가져오기 실패',
          meta: ['그림을 미디어에 저장하지 못했습니다.'],
        }),
      ),
    );
    const logged = write.mock.calls.map(([entry]) => JSON.stringify(entry));
    expect(logged.some(entry => entry.includes('Copy failed'))).toBe(true);
  });
});

it('names the PowerPoint failure and what to do when the slides could not be drawn', async () => {
  const api = mockLlpApi({
    powerpoint: {
      images: async () => ({
        ok: false,
        message: 'PowerPoint가 응답하지 않습니다.',
        failure: 'unresponsive',
      }),
    },
  });
  const report = vi.fn<(notice: Notice) => void>();
  render(
    <PowerPointImagesFlow api={api} onDone={vi.fn()} onProblem={report} />,
  );
  await waitFor(() =>
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title:
          'PowerPoint가 응답하지 않아 슬라이드 그림을 가져오지 못했습니다.',
        meta: [
          '열린 PowerPoint의 대화 상자를 닫거나 PowerPoint를 모두 닫은 뒤 다시 가져오세요.',
        ],
      }),
    ),
  );
});
