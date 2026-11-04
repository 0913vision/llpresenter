import {useState, type JSX} from 'react';
import type {Translation} from '@core/schema/bible';
import {IconButton} from '@renderer/ui/IconButton';
import {Icon} from '@renderer/ui/Icon';
import {Menu} from '@renderer/ui/Menu';
import {menuAvailability} from '@renderer/ui/menuModel';
import {PropertyGroup} from '@renderer/ui/PropertyRow';
import type {BibleEdits} from './useBibleEdits';
import type {PreferenceEdits} from './usePreferenceEdits';
import {
  PREFERENCE_LIMITS,
  type PreferencesFile,
} from '@core/schema/preferences';
import {CountRow, CheckboxRow, SelectRow} from './PreferenceRows';
import styles from './BiblePage.module.css';

const ALREADY_DEFAULT = '이미 기본 역본입니다';

function TranslationRow({
  translation,
  reason,
  onMakeDefault,
}: {
  readonly translation: Translation;
  readonly reason: string | undefined;
  readonly onMakeDefault: () => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const label = `${translation.name} 메뉴`;
  return (
    <div className={styles.translation}>
      <Icon name="book" size={16} />
      <span className={styles.name}>{translation.name}</span>
      <span className={styles.language}>{translation.lang}</span>
      {translation.default ? <span className={styles.tag}>기본</span> : null}
      <IconButton
        icon="more"
        label={label}
        menu
        expanded={anchor !== null}
        onClick={event =>
          setAnchor(anchor === null ? event.currentTarget : null)
        }
      />
      {anchor === null ? null : (
        <Menu
          label={label}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={[
            {
              kind: 'item',
              id: 'make-default',
              label: '기본으로',
              ...menuAvailability(
                reason ?? (translation.default ? ALREADY_DEFAULT : undefined),
              ),
              onSelect: () => {
                onMakeDefault();
                setAnchor(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
}

const SPLIT_OPTIONS = [
  {value: 'verse', label: '한 슬라이드에 한 절'},
  {value: 'two', label: '두 절씩'},
  {value: 'fit', label: '길이에 맞춤'},
] as const;
const REFERENCE_OPTIONS = [
  {value: 'every', label: '슬라이드마다'},
  {value: 'first', label: '첫 슬라이드만'},
  {value: 'last', label: '마지막 슬라이드만'},
  {value: 'none', label: '없음'},
] as const;

/** 성경: the installed translations, and the defaults of a new passage. */
export function BiblePage({
  edits,
  bible,
}: {
  readonly edits: PreferenceEdits;
  readonly bible: BibleEdits;
}): JSX.Element {
  const {preferences, lockedReason, change} = edits;
  const changeDefaults = (
    changes: Partial<
      NonNullable<NonNullable<PreferencesFile['bible']>['defaults']>
    >,
  ): void =>
    change(stored => ({
      ...stored,
      bible: {
        ...stored.bible,
        defaults: {...stored.bible?.defaults, ...changes},
      },
    }));
  return (
    <>
      <PropertyGroup title="설치된 역본">
        {(bible.translations ?? []).map(translation => (
          <TranslationRow
            key={translation.id}
            translation={translation}
            reason={bible.lockedReason}
            onMakeDefault={() => bible.makeDefault(translation.id)}
          />
        ))}
      </PropertyGroup>
      {preferences === null ? null : (
        <PropertyGroup title="새 구절">
          <SelectRow
            label="나누기"
            disabled={lockedReason !== undefined}
            title={lockedReason}
            options={SPLIT_OPTIONS}
            value={preferences.bible.defaults.split}
            onChange={split => changeDefaults({split})}
          />
          <SelectRow
            label="참조"
            disabled={lockedReason !== undefined}
            title={lockedReason}
            options={REFERENCE_OPTIONS}
            value={preferences.bible.defaults.reference}
            onChange={reference => changeDefaults({reference})}
          />
          <CheckboxRow
            label="절 번호"
            disabled={lockedReason !== undefined}
            title={lockedReason}
            checked={preferences.bible.defaults.verseNumbers}
            onChange={verseNumbers => changeDefaults({verseNumbers})}
          />
          <CheckboxRow
            label="역본 이름"
            disabled={lockedReason !== undefined}
            title={lockedReason}
            checked={preferences.bible.defaults.translationName}
            onChange={translationName => changeDefaults({translationName})}
          />
          <CountRow
            label="한 슬라이드 최대 줄 수"
            unit="줄"
            disabled={lockedReason !== undefined}
            title={lockedReason}
            value={preferences.bible.maxLines}
            {...PREFERENCE_LIMITS.bibleMaxLines}
            onChange={maxLines =>
              change(stored => ({
                ...stored,
                bible: {...stored.bible, maxLines},
              }))
            }
          />
        </PropertyGroup>
      )}
    </>
  );
}
