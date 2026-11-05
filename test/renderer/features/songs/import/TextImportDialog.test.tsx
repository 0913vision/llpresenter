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
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {createSongId} from '@core/schema/ids';
import {defaultPreferences} from '@core/schema/preferences';
import {
  parseTextImportPreviewRequest,
  type TextImportDraft,
  type TextImportOptions,
  type TextImportPreviewResult,
  type TextImportSource,
} from '@core/schema/textImport';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {convertTextImport} from '@core/songs/textImport';
import {DUPLICATE_TITLE_REASON} from '@core/songs/songTitle';
import {TextImportDialog} from '@renderer/features/songs/import/TextImportDialog';
import {useImportPreview} from '@renderer/features/songs/import/useImportPreview';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {limitReason} from '@core/common/limitReason';
import {hoverForTooltip} from '@fixtures/renderer/ui/tooltipTesting';
import * as labelMenus from '@renderer/features/songs/editor/labelMenuEntries';

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
  const onEdit = vi.fn<(draft: TextImportDraft) => void>();
  const onDiscard = vi.fn();
  const props = {
    api,
    source,
    defaults,
    library: [],
    labels: ['New', 'Verse', 'Chorus', '1절', '후렴'].map(name => ({
      name,
      color: 'none' as const,
      key: null,
    })),
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
  it('refuses a mapping that expands 3000 accepted sections beyond the saved-song limit and recovers after correction', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{...source, text: '[Tag]\nInvented\n'.repeat(3000)}}
      />,
    );
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    const field = within(dialog).getByRole('textbox', {name: '[Tag] 이름표'});
    fireEvent.change(field, {
      target: {value: 'x'.repeat(SONG_IMPORT_LIMITS.name)},
    });
    const apply = within(dialog).getByRole('button', {name: '적용'});
    expect(apply.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(apply))?.textContent).toBe(
      limitReason('글자', SONG_IMPORT_LIMITS.characters),
    );
    fireEvent.click(apply);
    fireEvent.keyDown(field, {key: 'Enter'});
    expect(screen.getByRole('dialog', {name: '이름표 맞추기'})).toBe(dialog);
    expect(f.onEdit).not.toHaveBeenCalled();
    fireEvent.change(field, {target: {value: 'Short'}});
    expect(apply.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(apply);
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit.mock.calls[0]?.[0].slides).toHaveLength(3000);
    expect(
      f.onEdit.mock.calls[0]?.[0].slides.every(
        slide => slide.label === 'Short',
      ),
    ).toBe(true);
  });

  it('bounds mounted fields for 19999 accepted distinct headers, builds only an opened menu, and retains offscreen choices', async () => {
    const f = fixture();
    const menuEntries = vi.spyOn(labelMenus, 'labelMenuEntries');
    onTestFinished(() => menuEntries.mockRestore());
    const text = `${Array.from(
      {length: 19999},
      (_, index) => `[Header ${index}]`,
    ).join('\n')}\nInvented`;
    render(<TextImportDialog {...f.props} source={{...source, text}} />);
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    expect(screen.getByText('슬라이드 1')).toBeTruthy();
    expect(
      within(dialog).getByRole('table').getAttribute('aria-rowcount'),
    ).toBe('20000');
    expect(within(dialog).getAllByRole('textbox').length).toBeLessThan(20);
    expect(menuEntries).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole('button', {name: '[Header 0] 이름표 목록'}),
    );
    expect(menuEntries).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    const viewport = within(dialog).getByRole('rowgroup', {
      name: '머리줄 목록',
    });
    fireEvent.scroll(viewport, {target: {scrollTop: 19999}});
    const last = within(dialog).getByRole('textbox', {
      name: '[Header 19998] 이름표',
    });
    const pinnedFirst = within(dialog).getByRole('textbox', {
      name: '[Header 0] 이름표',
    });
    act(() => pinnedFirst.focus());
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', {name: '닫기'}),
    );
    fireEvent.change(last, {target: {value: 'Last choice'}});
    fireEvent.scroll(viewport, {target: {scrollTop: 0}});
    expect(
      within(dialog).queryByRole('textbox', {name: '[Header 19998] 이름표'}),
    ).toBeNull();
    fireEvent.scroll(viewport, {target: {scrollTop: 19999}});
    expect(
      within(dialog)
        .getByRole('textbox', {name: '[Header 19998] 이름표'})
        .getAttribute('value'),
    ).toBe('Last choice');
    expect(within(dialog).getAllByRole('textbox').length).toBeLessThan(20);
    fireEvent.click(within(dialog).getByRole('button', {name: '적용'}));
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit.mock.calls[0]?.[0].slides[0]?.label).toBe('Last choice');
  });

  it('tabs across virtual row boundaries and reaches both ends without consuming caret keys', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{
          ...source,
          text: `${Array.from(
            {length: 100},
            (_, index) => `[Header ${index}]`,
          ).join('\n')}\nInvented`,
        }}
      />,
    );
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    const first = within(dialog).getByRole('textbox', {
      name: '[Header 0] 이름표',
    });
    fireEvent.keyDown(first, {key: 'End'});
    expect(document.activeElement).toBe(first);
    const firstButton = within(dialog).getByRole('button', {
      name: '[Header 0] 이름표 목록',
    });
    act(() => firstButton.focus());
    fireEvent.keyDown(firstButton, {key: 'End'});
    const lastButton = within(dialog).getByRole('button', {
      name: '[Header 99] 이름표 목록',
    });
    expect(document.activeElement).toBe(lastButton);
    await userEvent.tab({shift: true});
    const lastField = within(dialog).getByRole('textbox', {
      name: '[Header 99] 이름표',
    });
    expect(document.activeElement).toBe(lastField);
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', {name: '[Header 98] 이름표 목록'}),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(lastField);
    fireEvent.keyDown(lastField, {key: 'PageUp'});
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      '[Header 91] 이름표',
    );
    expect(within(dialog).getAllByRole('textbox').length).toBeLessThan(20);
  });

  it('uses the exact list spelling without opening mapping for case-insensitive matches', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{...source, text: '[ chorus ]\nFirst'}}
      />,
    );
    await screen.findByText('슬라이드 1');
    expect(screen.queryByRole('dialog', {name: '이름표 맞추기'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit.mock.calls[0]?.[0].slides[0]?.label).toBe('Chorus');
  });

  it('keeps unmatched headers as lyrics when recognition starts off', async () => {
    const f = fixture();
    render(
      <TextImportDialog {...f.props} defaults={{...defaults, labels: 'off'}} />,
    );
    await screen.findByText('슬라이드 2');
    expect(screen.queryByRole('dialog', {name: '이름표 맞추기'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.onEdit.mock.calls[0]?.[0].slides[0]?.lines).toContain('[New]');
  });

  it('opens the list by keyboard and Esc closes the list before the mapping dialog', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{...source, text: '[Chrous]\nFirst'}}
      />,
    );
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    await userEvent.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu');
    expect(document.activeElement).toBe(menu);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', {name: '이름표 맞추기'})).toBe(dialog);
    expect(document.activeElement).toBe(within(dialog).getByRole('textbox'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', {name: '이름표 맞추기'})).toBeNull();
    expect(f.onDiscard).not.toHaveBeenCalled();
  });

  it('opens mapping only for unmatched headers and includes exact matches in file order', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{
          ...source,
          text: '[Chrous]\nFirst\n[ 후렴 ]\nSecond\n[chrous]\nThird\n[Tag]\nLast',
        }}
      />,
    );
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    expect(
      within(dialog)
        .getAllByRole('textbox')
        .map(field => field.getAttribute('value')),
    ).toEqual(['후렴', '후렴', 'Tag']);
    expect(within(dialog).getAllByRole('row')).toHaveLength(4);
    expect(within(dialog).getByText('First')).toBeTruthy();
    expect(within(dialog).queryByText('Third')).toBeNull();
    expect(f.onEdit).not.toHaveBeenCalled();
  });

  it.each(['[ 후렴 ]\nExact', 'No headers'])(
    'does not ask when all headers match or none exist: %s',
    async text => {
      const f = fixture();
      render(<TextImportDialog {...f.props} source={{...source, text}} />);
      await screen.findByText('슬라이드 1');
      expect(screen.queryByRole('dialog', {name: '이름표 맞추기'})).toBeNull();
    },
  );

  it('applies suggestions and a typed new name to every band and the draft, and retains choices when toggled', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{
          ...source,
          text: '[Chrous]\nFirst\n[Tag]\nSecond\n[chrous]\nThird',
        }}
      />,
    );
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    const field = within(dialog).getByRole('textbox', {name: '[Tag] 이름표'});
    await userEvent.click(field);
    expect(screen.getByRole('menu', {name: '[Tag] 이름표'})).toBeTruthy();
    await userEvent.keyboard('직접 입력');
    expect(field.getAttribute('value')).toBe('직접 입력');
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', {name: '적용'}));
    expect(
      screen.getAllByRole('option').map(option => option.textContent),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('후렴'),
        expect.stringContaining('직접 입력'),
      ]),
    );
    fireEvent.click(screen.getByRole('checkbox', {name: '이름표 인식'}));
    await screen.findByText('슬라이드 1');
    expect(screen.queryByRole('dialog', {name: '이름표 맞추기'})).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', {name: '이름표 인식'}));
    const reopened = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    expect(
      within(reopened)
        .getByRole('textbox', {name: '[Tag] 이름표'})
        .getAttribute('value'),
    ).toBe('직접 입력');
    await userEvent.click(within(reopened).getByRole('button', {name: '적용'}));
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(
      f.onEdit.mock.calls[0]?.[0].slides.map(slide => slide.label),
    ).toEqual(['후렴', '직접 입력', '후렴']);
    expect(f.onDiscard).not.toHaveBeenCalled();
  });

  it.each(['머리줄 그대로 쓰기', 'Escape', '닫기'])(
    'keeps original headers through %s without discarding the import',
    async action => {
      const f = fixture();
      render(
        <TextImportDialog
          {...f.props}
          source={{...source, text: '[Chrous]\nInvented'}}
        />,
      );
      const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
      if (action === 'Escape') {
        await userEvent.keyboard('{Escape}');
      } else {
        await userEvent.click(
          within(dialog).getByRole('button', {name: action}),
        );
      }
      expect(screen.queryByRole('dialog', {name: '이름표 맞추기'})).toBeNull();
      expect(f.onDiscard).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', {name: '편집'}));
      expect(f.onEdit.mock.calls[0]?.[0].slides[0]?.label).toBe('Chrous');
    },
  );

  it('picks an existing colorless label and no label from the editor menu without management', async () => {
    const f = fixture();
    render(
      <TextImportDialog
        {...f.props}
        source={{...source, text: '[Chrous]\nFirst\n[Tag]\nSecond'}}
      />,
    );
    const dialog = await screen.findByRole('dialog', {name: '이름표 맞추기'});
    await userEvent.click(
      within(dialog).getByRole('button', {name: '[Chrous] 이름표 목록'}),
    );
    expect(screen.queryByRole('menuitem', {name: '이름표 관리…'})).toBeNull();
    expect(
      screen
        .getByRole('menuitemradio', {name: '후렴'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('menuitemradio', {name: '1절'}));
    expect(
      within(dialog)
        .getByRole('textbox', {name: '[Chrous] 이름표'})
        .getAttribute('value'),
    ).toBe('1절');
    await userEvent.click(
      within(dialog).getByRole('button', {name: '[Tag] 이름표 목록'}),
    );
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: '이름표 없음'}),
    );
    expect(
      within(dialog)
        .getByRole('textbox', {name: '[Tag] 이름표'})
        .getAttribute('value'),
    ).toBe('');
    expect(within(dialog).queryByText('새 이름표')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', {name: '적용'}));
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(
      f.onEdit.mock.calls[0]?.[0].slides.map(slide => slide.label),
    ).toEqual(['1절', '']);
  });

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
