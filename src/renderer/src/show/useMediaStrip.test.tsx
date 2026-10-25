import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {createMediaId} from '@shared/schema/ids';
import {
  parseMediaDocument,
  type MediaDocument,
  type MediaImportProgress,
} from '@shared/schema/mediaEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {useMediaStrip} from './useMediaStrip';

const image = createMediaId('30000000-0000-4000-8000-000000000001');
const video = createMediaId('30000000-0000-4000-8000-000000000002');
const audio = createMediaId('30000000-0000-4000-8000-000000000003');

function mediaDocument(revision = 1): MediaDocument {
  const parsed = parseMediaDocument({
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: image,
          name: '새 빛',
          kind: 'image',
          file: 'invented.png',
          size: 1,
        },
        {
          id: video,
          name: '새 영상',
          kind: 'video',
          file: 'invented.mp4',
          size: 1,
        },
        {
          id: audio,
          name: '새 소리',
          kind: 'audio',
          file: 'invented.wav',
          size: 1,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!parsed.ok) throw new Error('Invalid invented media fixture');
  return parsed.value;
}

function setup() {
  let push: (document: MediaDocument) => void = () => undefined;
  let progress: (job: MediaImportProgress) => void = () => undefined;
  const stopMedia = vi.fn();
  const stopImports = vi.fn();
  const send = vi.fn();
  const report = vi.fn();
  const api = fakeLlpApi({
    live: {send},
    media: {
      get: async () => mediaDocument(),
      subscribe: listener => {
        push = listener;
        return stopMedia;
      },
      subscribeImports: listener => {
        progress = listener;
        return stopImports;
      },
    },
  });
  window.llp = api;
  const live = emptyLiveState();
  useLive.setState({state: live});
  return {
    api,
    send,
    report,
    live,
    stopMedia,
    stopImports,
    push: (document: MediaDocument) => push(document),
    progress: (job: MediaImportProgress) => progress(job),
  };
}

afterEach(() => {
  delete window.llp;
  useLive.setState({state: null});
});

it('outputs image/video choices with canonical playback props and leaves live confirmation to main', async () => {
  const {report, send, live, push} = setup();
  const {result} = renderHook(() => useMediaStrip(report));
  await waitFor(() => expect(result.current.document?.revision).toBe(1));
  act(() => {
    result.current.activate(image);
    result.current.activate(audio);
  });
  const next = mediaDocument(2);
  act(() =>
    push({
      ...next,
      value: {
        ...next.value,
        items: next.value.items.map(item =>
          item.id === video ? {...item, props: {end: 'stop'}} : item,
        ),
      },
    }),
  );
  act(() => result.current.activate(video));
  expect(send.mock.calls).toEqual([
    [{type: 'media.show', media: {mediaId: image, loop: true}}],
    [{type: 'media.show', media: {mediaId: video, loop: false}}],
  ]);
  expect(useLive.getState().state).toBe(live);
});

it('keeps a newer push over a slower initial read', async () => {
  const {api, report, push} = setup();
  let finish: (document: MediaDocument) => void = () => undefined;
  vi.spyOn(api.media, 'get').mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const {result} = renderHook(() => useMediaStrip(report));
  act(() => push(mediaDocument(2)));
  await act(async () => finish(mediaDocument()));
  expect(result.current.document?.revision).toBe(2);
});

it('blocks an active copy and releases it on completion, cancellation, or failure', async () => {
  const {report, progress, send, api} = setup();
  const log = vi.spyOn(api.log, 'write');
  const {result} = renderHook(() => useMediaStrip(report));
  await waitFor(() => expect(result.current.document).not.toBeNull());
  const job = {mediaId: video, fileName: 'invented.mp4'};
  act(() => progress({...job, phase: 'copying', percent: 25}));
  act(() => result.current.activate(video));
  expect(result.current.jobs).toHaveLength(1);
  expect(send).not.toHaveBeenCalled();
  act(() => progress({...job, phase: 'complete', percent: 100}));
  act(() => result.current.activate(video));
  expect(send).toHaveBeenCalledOnce();
  act(() => {
    progress({...job, phase: 'queued', percent: 0});
    progress({...job, phase: 'cancelled', percent: 0});
  });
  expect(result.current.jobs).toHaveLength(0);
  act(() =>
    progress({
      ...job,
      phase: 'failed',
      percent: 50,
      message: 'Invented copy cause',
    }),
  );
  expect(result.current.jobs).toHaveLength(0);
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({title: '미디어 복사 실패'}),
  );
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({detail: 'Invented copy cause'}),
  );
});

it('marks only current preview failures and keeps missing backgrounds off output until a new document', async () => {
  const {report, push, send} = setup();
  const {result} = renderHook(() => useMediaStrip(report));
  await waitFor(() => expect(result.current.document).not.toBeNull());
  act(() => result.current.markMissing(image, 1));
  act(() => result.current.activate(image));
  expect(result.current.missing.has(image)).toBe(true);
  expect(send).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({title: '미디어 다시 연결할 수 없음'}),
  );
  act(() => push(mediaDocument(2)));
  act(() => result.current.markMissing(image, 1));
  expect(result.current.missing.has(image)).toBe(false);
  act(() => result.current.activate(image));
  expect(send).toHaveBeenCalledOnce();
});

it('reports read/transport failures and ignores callbacks after unmount', async () => {
  const {api, report, send, push, progress, stopMedia, stopImports} = setup();
  vi.spyOn(api.media, 'get').mockRejectedValueOnce(
    new Error('Invented read cause'),
  );
  const {result, unmount} = renderHook(() => useMediaStrip(report));
  await waitFor(() =>
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({title: '미디어 불러오기 실패'}),
    ),
  );
  act(() => push(mediaDocument()));
  send.mockImplementation(() => {
    throw new Error('Invented send cause');
  });
  act(() => result.current.activate(image));
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({title: '미디어 출력 실패'}),
  );
  const previousReports = report.mock.calls.length;
  unmount();
  act(() => {
    push(mediaDocument(2));
    progress({
      mediaId: video,
      fileName: 'invented.mp4',
      phase: 'failed',
      percent: 1,
      message: 'Late cause',
    });
    result.current.activate(video);
  });
  expect(stopMedia).toHaveBeenCalledOnce();
  expect(stopImports).toHaveBeenCalledOnce();
  expect(report).toHaveBeenCalledTimes(previousReports);
});
