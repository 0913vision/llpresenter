import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, onTestFinished, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {SavedTitle} from '@core/schema/screens/themes';
import {useThemes} from '@renderer/platform/documents/themes';
import {OwnTitles} from '@renderer/features/service/items/OwnTitles';
import {titlesAfter} from '@renderer/features/service/items/ownTitleList';
import {failureReasonLines} from '@renderer/platform/problemReasons';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {themes, themesDocument} from '@fixtures/core/themeOutput';

const OPENING: SavedTitle = {
  id: '00000000-0000-4000-8000-000000000701',
  name: '예배의 부름',
  english: 'Call to Worship',
};
const BLESSING: SavedTitle = {
  id: '00000000-0000-4000-8000-000000000702',
  name: '축도',
  english: 'Benediction',
};

beforeEach(() => {
  useThemes.setState({themes: {...themes(), titles: [OPENING]}});
});
afterEach(cleanup);

it('saves a title in its place, adds a new one at the end, and takes one out', () => {
  const kept = [OPENING, BLESSING];
  const renamed = {...OPENING, name: '부름'};
  expect(titlesAfter(kept, OPENING.id, renamed)).toEqual([renamed, BLESSING]);
  expect(titlesAfter([OPENING], BLESSING.id, BLESSING)).toEqual(kept);
  expect(titlesAfter(kept, OPENING.id, null)).toEqual([BLESSING]);
});

function withApi(edit: LlpApi['settings']['edit']) {
  const write = vi.fn();
  window.llp = mockLlpApi({
    log: {write},
    settings: {get: async () => themesDocument(), edit},
  });
  onTestFinished(() => {
    delete window.llp;
  });
  return {write};
}

function addTitle(name: string): void {
  render(<OwnTitles disabled={false} insert={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name: '+ 타이틀'}));
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: name},
  });
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
}

it('says why a title could not be saved, in the standard words, and logs the cause', async () => {
  const {write} = withApi(async () => ({
    ok: false,
    error: {reason: 'stale', message: 'themes changed meanwhile'},
  }));
  addTitle('봉헌');
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    ['타이틀을 저장할 수 없습니다.', ...failureReasonLines('stale')].join(' '),
  );
  expect(write).toHaveBeenCalledWith(
    expect.objectContaining({message: 'Saving the kept titles was refused'}),
  );
  expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
    'value',
    '봉헌',
  );
});

it('says a title could not be saved when the request itself failed, and logs it', async () => {
  const {write} = withApi(() => Promise.reject(new Error('main is gone')));
  addTitle('봉헌');
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    '타이틀을 저장할 수 없습니다.',
  );
  expect(write).toHaveBeenCalledWith(
    expect.objectContaining({message: 'Could not save the kept titles'}),
  );
});
