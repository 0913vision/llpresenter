import {afterEach, expect, it, vi} from 'vitest';
import type {RendererLogEntry} from '@core/schema/app/ipcPayloads';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {reportStillFailure} from '@renderer/rendering/slideStill';

afterEach(() => {
  delete window.llp;
});

it('writes a picture a slide still can not show once, as a warning that names it', () => {
  const write = vi.fn<(entry: RendererLogEntry) => void>();
  window.llp = mockLlpApi({log: {write}});
  const gone = {mediaId: '1d26a4f8-fa96-4f90-9623-612b097f7ef5'};
  for (let thumbnail = 0; thumbnail < 20; thumbnail++) {
    reportStillFailure('could not load a preview picture', gone);
  }
  reportStillFailure('could not load a preview picture', {mediaId: 'other'});
  expect(write.mock.calls.map(([entry]) => entry)).toEqual([
    {
      level: 'warn',
      message: 'could not load a preview picture',
      detail: JSON.stringify(gone),
    },
    {
      level: 'warn',
      message: 'could not load a preview picture',
      detail: '{"mediaId":"other"}',
    },
  ]);
});
