import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {PowerPointImageExportResult} from '@core/schema/powerpointImport';
import {pastDocument} from '@fixtures/core/serviceList';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {PowerPointImagesFlow} from '@renderer/app/PowerPointImagesFlow';
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
  it('stores an entire deck in one batch and adds one item', async () => {
    const slides = Array.from({length: 51}, (_, index) => ({
      path: `C:/temp/${index}.png`,
      number: index + 1,
    }));
    const ids = slides.map((_, index) =>
      createMediaId(
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      ),
    );
    const storeImages = vi.fn(async () => ({ok: true as const, value: ids}));
    const importMedia = vi.fn();
    const editMedia = vi.fn();
    const edit = vi.fn(async () => ({
      ok: true as const,
      value: {id: pastDocument.service.id, revision: 2},
    }));
    const onDone = vi.fn();
    const api = mockLlpApi({
      powerpoint: {
        images: async () => ({
          ok: true,
          value: {fileName: 'deck.pptx', slides},
        }),
        storeImages,
      },
      media: {import: importMedia, edit: editMedia},
      services: {get: async () => pastDocument},
      content: {edit},
    });
    render(
      <PowerPointImagesFlow api={api} onDone={onDone} onProblem={vi.fn()} />,
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(storeImages).toHaveBeenCalledOnce();
    expect(storeImages).toHaveBeenCalledWith({
      paths: slides.map(slide => slide.path),
    });
    expect(edit).toHaveBeenCalledOnce();
    expect(importMedia).not.toHaveBeenCalled();
    expect(editMedia).not.toHaveBeenCalled();
  });
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
        storeImages: async () => ({ok: true, value: [first]}),
        release,
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
