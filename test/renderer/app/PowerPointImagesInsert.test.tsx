import {render, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import type {ServiceItem} from '@core/schema/services/service';
import {pastDocument} from '@fixtures/core/serviceList';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {PowerPointImagesFlow} from '@renderer/app/PowerPointImagesFlow';
import {insertItems} from '@renderer/session/service/serviceOrderEdits';
import {useShow} from '@renderer/session/show/showStore';
import type {Notice} from '@renderer/ui/popups/notices';

vi.mock('@renderer/session/service/serviceOrderEdits', () => ({
  insertItems: vi.fn(),
}));

const SELECTED = '00000000-0000-4000-8000-000000000801';
const first = createMediaId('00000000-0000-4000-8000-000000000811');
const second = createMediaId('00000000-0000-4000-8000-000000000812');
const slides = [
  {path: 'C:/temp/slide1.png', number: 1},
  {path: 'C:/temp/slide2.png', number: 2},
];

beforeEach(() => {
  vi.mocked(insertItems).mockReset();
  useShow.setState({
    serviceId: pastDocument.service.id,
    readOnly: false,
    openItemId: SELECTED,
    rows: [{kind: 'song', id: SELECTED, title: '은혜로다'}],
  });
});

function setUp() {
  const release = vi.fn(async () => true);
  const write = vi.fn();
  const api = mockLlpApi({
    powerpoint: {
      images: async () => ({
        ok: true,
        value: {fileName: '광고 슬라이드.pptx', slides},
      }),
      storeImages: async () => ({ok: true, value: [first, second]}),
      release,
    },
    log: {write},
  });
  const report = vi.fn<(notice: Notice) => void>();
  const onDone = vi.fn();
  render(<PowerPointImagesFlow api={api} onDone={onDone} onProblem={report} />);
  return {release, write, report, onDone};
}

function inserted(call = 0): {item: ServiceItem | undefined; after: unknown} {
  const [items, after] = vi.mocked(insertItems).mock.calls[call] ?? [];
  return {item: items?.[0], after};
}

it('puts one item of the pictures after the open one, named after the file, and frees the drawn files', async () => {
  vi.mocked(insertItems).mockResolvedValue({ok: true, value: true});
  const {release, report, onDone} = setUp();
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  const {item, after} = inserted();
  expect(after).toBe(SELECTED);
  expect(item?.name).toBe('광고 슬라이드');
  expect(
    item !== undefined && 'slides' in item ? item.slides : [],
  ).toHaveLength(2);
  expect(report).toHaveBeenLastCalledWith(
    expect.objectContaining({title: 'PowerPoint 이미지 2개를 가져왔습니다.'}),
  );
  expect(release).toHaveBeenCalledTimes(2);
});

it('puts the item at the end when the open one left the order meanwhile', async () => {
  vi.mocked(insertItems)
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'not-found', message: 'The paste target is gone'},
    })
    .mockResolvedValueOnce({ok: true, value: true});
  const {onDone} = setUp();
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(inserted(0).after).toBe(SELECTED);
  expect(inserted(1).after).toBeNull();
});

it('says where it stopped when the order refuses the item, and logs why', async () => {
  vi.mocked(insertItems).mockResolvedValue({
    ok: false,
    error: {
      reason: 'read-only',
      message: 'A newer app version wrote this file',
    },
  });
  const {report, write, release} = setUp();
  await waitFor(() =>
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'PowerPoint 이미지 가져오기 실패',
        meta: ['예배 순서에 넣지 못했습니다.'],
      }),
    ),
  );
  expect(JSON.stringify(write.mock.calls)).toContain('read-only');
  expect(release).toHaveBeenCalledTimes(2);
});

it('asks for an open service it can change before it draws anything', async () => {
  useShow.setState({readOnly: true});
  const {report, onDone} = setUp();
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({title: '열린 예배가 필요합니다.'}),
  );
  expect(insertItems).not.toHaveBeenCalled();
});
