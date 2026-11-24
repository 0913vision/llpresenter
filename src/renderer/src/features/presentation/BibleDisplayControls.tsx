import {withLiveBible} from '@core/bible';
import {useState, type JSX} from 'react';
import type {TranslationId} from '@core/schema/common/ids';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {withinLookupTimeout} from '@renderer/session/showOutput';
import {CheckRow} from '@renderer/ui/choices/Checkbox';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {openBiblePassage} from '../bible/actions';
import {displayOf, usePassageSwap} from '../bible/adjacent/usePassageSwap';
import type {BibleSource} from '@renderer/session/bibleSource';
import styles from './BiblePanel.module.css';

/** Changes how the passage that is open shows, without changing defaults. */
export function BibleDisplayControls({
  source,
}: {
  readonly source: BibleSource;
}): JSX.Element {
  const api = window.llp;
  const [readFailed, setReadFailed] = useState(false);
  const document = useSettingsDocument('bible', '성경', () =>
    setReadFailed(true),
  );
  const {busy, problem, swap} = usePassageSwap(source);
  const translations = withLiveBible(document?.value.translations ?? []);
  const changeTranslation = async (
    translation: TranslationId,
  ): Promise<void> => {
    if (translation === source.passage.translation) return;
    await swap(
      async llp => {
        const reply = await withinLookupTimeout(() =>
          llp.bible.lookup({translation, input: source.passage.ref}),
        );
        if (!reply.result.ok) throw Error(reply.result.error.message);
        return reply.result.value;
      },
      {
        log: 'Could not change the Bible preview translation',
        problem: '역본 불러오기 실패',
      },
    );
  };
  const reason = !api
    ? '구절을 불러올 수 없습니다.'
    : busy
      ? '역본 불러오는 중'
      : document === null
        ? readFailed
          ? '역본 불러오기 실패'
          : '역본 불러오는 중'
        : translations.length === 0
          ? '설치된 역본 없음'
          : problem;
  return (
    <div className={styles.options}>
      <div className={styles.translationGroup}>
        <SelectMenu
          aria-label="역본"
          size="sm"
          className={styles.translation}
          value={source.passage.translation}
          valueText={
            translations.find(item => item.id === source.passage.translation)
              ?.name ?? source.passage.translation
          }
          options={translations.map(item => ({
            value: item.id,
            label: item.name,
          }))}
          disabled={
            !api || busy || document === null || translations.length === 0
          }
          title={reason}
          onChange={translation => {
            changeTranslation(translation).catch((cause: unknown) =>
              console.error('Could not change the Bible preview', cause),
            );
          }}
        />
      </div>
      <CheckRow
        label="절 번호"
        checked={source.verseNumbers}
        disabled={!api || busy}
        onChange={verseNumbers => {
          openBiblePassage(source.passage, {
            ...displayOf(source),
            verseNumbers,
          });
        }}
      />
      <CheckRow
        label="역본 이름"
        checked={source.translationName ?? false}
        disabled={!api || busy}
        onChange={translationName => {
          openBiblePassage(source.passage, {
            ...displayOf(source),
            translationName,
          });
        }}
      />
    </div>
  );
}
