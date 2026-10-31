import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {createSongId} from '@core/schema/ids';
import {defaultPreferences} from '@core/schema/preferences';
import {
  parseTextImportPreviewRequest,
  type TextImportOptions,
  type TextImportPreviewResult,
  type TextImportSource,
} from '@core/schema/textImport';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {convertTextImport} from '@core/songs/textImport';
import {DUPLICATE_TITLE_REASON} from '@core/songs/songTitle';
import {TextImportDialog} from './TextImportDialog';
import {useImportPreview} from './useImportPreview';

const source: TextImportSource = {
  source: 'file',
  fileName: 'Invented.txt',
  text: '[New]\nFirst invented line\nSecond invented line\n\nAnother invented paragraph',
};
const defaults = defaultPreferences.import.txt;
const options: TextImportOptions = {...defaults, unitsPerSlide: 1, symbol: '/'};
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(finish => {
    resolve = finish;
  });
  return {promise, resolve};
}
function fixture() {
  const preview = vi.fn<LlpApi['textImport']['preview']>(async request => {
    const checked = parseTextImportPreviewRequest(request);
    if (!checked.ok) {
      return {
        ok: false,
        error: {reason: 'invalid', message: checked.error.message},
      };
    }
    return convertTextImport(checked.value);
  });
  const api = mockLlpApi({textImport: {preview}}).textImport;
  const onProblem = vi.fn();
  const onEdit = vi.fn();
  const onDiscard = vi.fn();
  const props = {
    api,
    source,
    defaults,
    library: [],
    labels: [],
    onProblem,
    onEdit,
    onDiscard,
  };
  return {preview, api, onProblem, onEdit, onDiscard, props};
}
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('text import dialog', () => {
  it('keeps different candidate labels when section indices are equal', async () => {
    const f = fixture();
    f.preview.mockResolvedValue({
      ok: true,
      value: {
        title: 'Invented',
        slides: [
          {label: 'Verse', lines: ['Invented first'], section: 0},
          {label: 'Chorus', lines: ['Invented second'], section: 0},
        ],
      },
    });
    render(<TextImportDialog {...f.props} />);
    await screen.findByText('슬라이드 2');
    const options = screen.getAllByRole('option');
    const first = options[0];
    const second = options[1];
    if (first === undefined || second === undefined) {
      throw new Error('No preview options');
    }
    expect(within(first).getByText('Verse')).toBeTruthy();
    expect(within(second).getByText('Chorus')).toBeTruthy();
  });

  it('previews labels and counts, keeps an edited title through option changes, and hands off without saving', async () => {
    const f = fixture();
    render(<TextImportDialog {...f.props} />);
    await screen.findByText('슬라이드 2');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(
      screen.getByRole('textbox', {name: '제목'}).getAttribute('value'),
    ).toBe('Invented');
    fireEvent.change(screen.getByRole('textbox', {name: '제목'}), {
      target: {value: 'Edited title'},
    });
    await userEvent.click(
      screen.getByRole('button', {name: '슬라이드 나누기'}),
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name: '줄 바꿈'}));
    await waitFor(() =>
      expect(f.preview.mock.calls.at(-1)?.[0].options).toMatchObject({
        split: 'lineBreak',
        unitsPerSlide: 2,
      }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '편집'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    fireEvent.change(screen.getByRole('spinbutton', {name: '한 슬라이드에'}), {
      target: {value: '1'},
    });
    await waitFor(() =>
      expect(f.preview.mock.calls.at(-1)?.[0].options.unitsPerSlide).toBe(1),
    );
    fireEvent.click(screen.getByRole('checkbox', {name: '이름표 인식'}));
    await waitFor(() =>
      expect(f.preview.mock.calls.at(-1)?.[0].options).toMatchObject({
        labels: 'off',
      }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '편집'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({title: 'Edited title'}),
    );
    expect(screen.queryByRole('button', {name: '저장'})).toBeNull();
  });
  it('marks a duplicate title without preventing editing the unsaved draft', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        library={[
          {
            id: createSongId('00000000-0000-4000-8000-000000000001'),
            title: 'Invented',
            slideCount: 1,
            access: 'editable',
            usedBy: [],
          },
        ]}
      />,
    );
    await screen.findByText('슬라이드 2');
    expect(
      screen.getByRole('textbox', {name: '제목'}).getAttribute('aria-invalid'),
    ).toBe('true');
    expect(screen.getByText(DUPLICATE_TITLE_REASON)).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit).toHaveBeenCalledOnce();
  });
  it('requires a nonblank symbol, recomputes after correction, and discards on Escape', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        defaults={{...defaults, split: 'symbol'}}
      />,
    );
    await screen.findByText('슬라이드 1');
    fireEvent.change(screen.getByRole('textbox', {name: '기호'}), {
      target: {value: ''},
    });
    expect(
      screen.getByRole('button', {name: '편집'}).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      screen.getByRole('textbox', {name: '기호'}).getAttribute('aria-invalid'),
    ).toBe('true');
    fireEvent.change(screen.getByRole('textbox', {name: '기호'}), {
      target: {value: '|'},
    });
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '편집'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    await userEvent.keyboard('{Escape}');
    expect(f.onDiscard).toHaveBeenCalledOnce();
    expect(f.onEdit).not.toHaveBeenCalled();
  });
  it.each([
    {label: '빈 줄', split: 'blankLine'},
    {label: '줄 바꿈', split: 'lineBreak'},
  ])(
    'previews after clearing the symbol and switching to $split',
    async ({label, split}) => {
      const f = fixture();
      render(
        <TextImportDialog
          {...f.props}
          defaults={{...defaults, split: 'symbol'}}
        />,
      );
      await screen.findByText('슬라이드 1');
      fireEvent.change(screen.getByRole('textbox', {name: '기호'}), {
        target: {value: ''},
      });
      expect(
        screen
          .getByRole('button', {name: '편집'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
      await userEvent.click(
        screen.getByRole('button', {name: '슬라이드 나누기'}),
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: label}));
      await waitFor(() =>
        expect(f.preview.mock.calls.at(-1)?.[0].options.split).toBe(split),
      );
      expect(f.preview.mock.calls.at(-1)?.[0].options.symbol).toBeUndefined();
      await waitFor(() =>
        expect(
          screen
            .getByRole('button', {name: '편집'})
            .getAttribute('aria-disabled'),
        ).not.toBe('true'),
      );
      expect(f.onProblem).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', {name: '편집'}));
      expect(f.onEdit).toHaveBeenCalledOnce();
    },
  );
  it('bounds a large preview and reaches its final slide by keyboard', async () => {
    const f = fixture();
    f.preview.mockResolvedValue({
      ok: true,
      value: {
        title: 'Large',
        slides: Array.from({length: 5000}, () => ({lines: ['Invented line']})),
      },
    });
    render(<TextImportDialog {...f.props} />);
    await screen.findByText('슬라이드 5000');
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
    const first = screen.getAllByRole('option')[0];
    if (!first) throw new Error('Missing preview tile');
    first.focus();
    fireEvent.keyDown(first, {key: 'End'});
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-posinset')).toBe(
        '5000',
      ),
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
  });
  it('opens clipboard text with an empty title for editing rather than saving', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{source: 'clipboard', fileName: null, text: 'Invented line'}}
        defaults={{...defaults, firstLine: 'lyrics'}}
      />,
    );
    await screen.findByText('슬라이드 1');
    expect(screen.getByText('클립보드 텍스트')).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit).toHaveBeenCalledExactlyOnceWith({
      title: '',
      slides: [{lines: ['Invented line'], section: 0}],
    });
  });
  it.each(['reply', 'rejection'])(
    'reports a failed preview %s and keeps editing unavailable',
    async kind => {
      const f = fixture();
      if (kind === 'rejection') {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        f.preview.mockRejectedValue(new Error('Invented disconnection'));
      } else {
        f.preview.mockResolvedValue({
          ok: false,
          error: {reason: 'empty', message: 'Empty fixture'},
        });
      }
      render(<TextImportDialog {...f.props} />);
      await waitFor(() => expect(f.onProblem).toHaveBeenCalledOnce());
      expect(
        screen
          .getByRole('button', {name: '편집'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    },
  );
  it('previews candidate group boundaries and displays labels only on group start slides', async () => {
    const f = fixture();
    const groupedText =
      '[1절]\nFirst verse line\nSecond verse line\nThird verse line\nFourth verse line\n\n[후렴]\nChorus first line\nChorus second line\nChorus third line\nChorus fourth line';
    render(
      <TextImportDialog
        {...f.props}
        source={{source: 'file', fileName: 'Grouped.txt', text: groupedText}}
        defaults={{...defaults, split: 'lineBreak'}}
      />,
    );
    await screen.findByText('슬라이드 4');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    const firstOption = options[0];
    const secondOption = options[1];
    const thirdOption = options[2];
    const fourthOption = options[3];
    if (!firstOption || !secondOption || !thirdOption || !fourthOption) {
      throw new Error('Missing preview option');
    }
    expect(within(firstOption).getByText('1절')).toBeTruthy();
    expect(within(secondOption).queryByText('1절')).toBeNull();
    expect(within(thirdOption).getByText('후렴')).toBeTruthy();
    expect(within(fourthOption).queryByText('후렴')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'Grouped',
        slides: [
          {
            label: '1절',
            lines: ['First verse line', 'Second verse line'],
            section: 0,
          },
          {
            label: '1절',
            lines: ['Third verse line', 'Fourth verse line'],
            section: 0,
          },
          {
            label: '후렴',
            lines: ['Chorus first line', 'Chorus second line'],
            section: 1,
          },
          {
            label: '후렴',
            lines: ['Chorus third line', 'Chorus fourth line'],
            section: 1,
          },
        ],
      }),
    );
  });
  it('preserves section boundaries and candidate groups for adjacent sections with identical names', async () => {
    const f = fixture();
    const adjacentSameNameText =
      '[후렴]\nFirst chorus slide\n\n[후렴]\nSecond chorus slide';
    render(
      <TextImportDialog
        {...f.props}
        source={{
          source: 'file',
          fileName: 'Adjacent.txt',
          text: adjacentSameNameText,
        }}
        defaults={{...defaults, split: 'blankLine'}}
      />,
    );
    await screen.findByText('슬라이드 2');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    const firstOption = options[0];
    const secondOption = options[1];
    if (!firstOption || !secondOption) {
      throw new Error('Missing preview option');
    }
    expect(within(firstOption).getByText('후렴')).toBeTruthy();
    expect(within(secondOption).getByText('후렴')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'Adjacent',
        slides: [
          {label: '후렴', lines: ['First chorus slide'], section: 0},
          {label: '후렴', lines: ['Second chorus slide'], section: 1},
        ],
      }),
    );
  });
});

describe('import preview ordering', () => {
  it('coalesces slow pending previews and runs only the newest waiting options', async () => {
    const f = fixture();
    const held = deferred<TextImportPreviewResult>();
    f.preview.mockReturnValueOnce(held.promise);
    const {result, rerender, unmount} = renderHook(
      ({options}) =>
        useImportPreview({api: f.api, source, options, onProblem: f.onProblem}),
      {initialProps: {options}},
    );
    rerender({options: {...options, unitsPerSlide: 2}});
    rerender({options: {...options, unitsPerSlide: 3}});
    expect(f.preview).toHaveBeenCalledTimes(1);
    await act(async () =>
      held.resolve({ok: true, value: {title: 'Stale', slides: [{lines: []}]}}),
    );
    await waitFor(() => expect(f.preview).toHaveBeenCalledTimes(2));
    expect(f.preview.mock.calls[1]?.[0].options.unitsPerSlide).toBe(3);
    await waitFor(() => expect(result.current.draft?.title).toBe('Invented'));
    unmount();
  });
  it('ignores a reply after closing and skips the queued preview', async () => {
    const f = fixture();
    const held = deferred<TextImportPreviewResult>();
    f.preview.mockReturnValueOnce(held.promise);
    const {rerender, unmount} = renderHook(
      ({options}) =>
        useImportPreview({api: f.api, source, options, onProblem: f.onProblem}),
      {initialProps: {options}},
    );
    rerender({options: {...options, unitsPerSlide: 2}});
    unmount();
    await act(async () =>
      held.resolve({
        ok: false,
        error: {reason: 'empty', message: 'Closed fixture'},
      }),
    );
    expect(f.preview).toHaveBeenCalledTimes(1);
    expect(f.onProblem).not.toHaveBeenCalled();
  });
});
