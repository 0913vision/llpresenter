import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import type {PowerPointImageExportResult} from '@core/schema/powerpointImport';
import {pastDocument} from '@fixtures/core/serviceList';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  PowerPointImagesFlow,
  importPictures,
} from '@renderer/app/PowerPointImagesFlow';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';

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

  it('does not edit the service when cancellation occurs during its read', async () => {
    let finish: (document: ServiceDocument | null) => void = () => undefined;
    const pending = new Promise<ServiceDocument | null>(resolve => {
      finish = resolve;
    });
    const getService = vi.fn(() => pending);
    const edit = vi.fn();
    const release = vi.fn(async () => true);
    const api = mockLlpApi({
      powerpoint: {
        images: async () => ({
          ok: true,
          value: {fileName: 'deck.pptx', slides: [slide]},
        }),
        release,
      },
      media: {
        import: async () => ({
          ok: true,
          value: [
            {
              mediaId: first,
              fileName: 'slide.png',
              phase: 'complete',
              percent: 100,
            },
          ],
        }),
        edit: async () => ({ok: true, value: null}),
      },
      services: {get: getService},
      content: {edit},
    });
    const report = vi.fn<(notice: Notice) => void>();
    render(
      <PowerPointImagesFlow api={api} onDone={vi.fn()} onProblem={report} />,
    );
    await waitFor(() => expect(getService).toHaveBeenCalledOnce());
    cancelFrom(report);
    await act(async () => finish(pastDocument));
    await waitFor(() =>
      expect(release).toHaveBeenCalledWith({path: slide.path}),
    );
    expect(edit).not.toHaveBeenCalled();
  });

  it('cancels and waits for other imports before rejecting', async () => {
    let progress: (event: MediaImportProgress) => void = () => undefined;
    const cancel = vi.fn(async () => ({ok: true as const, value: null}));
    const api = mockLlpApi({
      media: {
        import: async () => ({
          ok: true,
          value: [
            {mediaId: first, fileName: 'a.png', phase: 'queued', percent: 0},
            {mediaId: second, fileName: 'b.png', phase: 'queued', percent: 0},
          ],
        }),
        edit: cancel,
        subscribeImports: listener => {
          progress = listener;
          return () => undefined;
        },
      },
    });
    let settled = false;
    const result = importPictures(
      api,
      [slide, {...slide, path: 'C:/temp/b.png'}],
      'deck',
    ).then(
      () => {
        settled = true;
        return true;
      },
      () => {
        settled = true;
        return false;
      },
    );
    await act(async () => undefined);
    progress({
      mediaId: first,
      fileName: 'a.png',
      phase: 'failed',
      percent: 0,
      message: 'failed',
    });
    expect(cancel).toHaveBeenCalledWith({
      type: 'media.import.cancel',
      mediaId: second,
    });
    expect(settled).toBe(false);
    progress({
      mediaId: second,
      fileName: 'b.png',
      phase: 'cancelled',
      percent: 0,
    });
    expect(await result).toBe(false);
  });
});
