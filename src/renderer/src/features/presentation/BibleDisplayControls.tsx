import {showsTranslationName, withLiveBible} from '@core/bible';
import {useState, type JSX} from 'react';
import type {TranslationId} from '@core/schema/common/ids';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {CheckRow} from '@renderer/ui/choices/Checkbox';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {restyleBiblePassage} from '../bible/passageActions';
import {displayOf, usePassageSwap} from '../bible/adjacent/usePassageSwap';
import type {BibleSource} from '@renderer/session/show/bibleSource';
import styles from './BiblePanel.module.css';
import {warningNotice, type Notice} from '@renderer/ui/popups/notices';
import {withinLookupTimeout} from '@renderer/session/lookupTimeout';

/** Changes how the passage that is open shows, without changing defaults. */
export function BibleDisplayControls({
  source,
  onProblem,
}: {
  readonly source: BibleSource;
  /** Shows a translation that could not be loaded. */
  readonly onProblem: (notice: Notice) => void;
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
        // NOTE(0913vision): Main reads another translation when this one's file
        // is missing; the passage would stay as it is without a word.
        if (reply.result.value.translation !== translation) {
          throw Error(`No file for the translation ${translation}`);
        }
        return reply.result.value;
      },
      {
        log: 'Could not change the Bible preview translation',
        problem: '역본 불러오기 실패',
        report: problem =>
          onProblem(
            warningNotice('bible-panel:translation', problem, [
              translations.find(item => item.id === translation)?.name ??
                translation,
            ]),
          ),
      },
      passage => {
        restyleBiblePassage(
          source,
          {
            ...displayOf(source),
            translationName: showsTranslationName(
              passage.translation,
              translations,
            ),
          },
          passage,
        );
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
          restyleBiblePassage(source, {...displayOf(source), verseNumbers});
        }}
      />
      <CheckRow
        label="역본 이름"
        checked={source.translationName ?? false}
        disabled={!api || busy}
        onChange={translationName => {
          restyleBiblePassage(source, {...displayOf(source), translationName});
        }}
      />
    </div>
  );
}
