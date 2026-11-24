import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import type {PowerPointImageExportResult} from '@core/schema/powerpointImport';
import {pastDocument} from '@fixtures/core/serviceList';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {PowerPointImagesFlow} from '@renderer/app/PowerPointImagesFlow';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/popups/notices';

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
