import {useState, type JSX} from 'react';
import type {Translation} from '@core/schema/bible';
import {IconButton} from '@renderer/ui/IconButton';
import {Icon} from '@renderer/ui/Icon';
import {Menu} from '@renderer/ui/Menu';
import {menuAvailability} from '@renderer/ui/menuModel';
import {PropertyGroup} from '@renderer/ui/PropertyRow';
import type {BibleEdits} from './useBibleEdits';
import type {PreferenceEdits} from './usePreferenceEdits';
import {PREFERENCE_LIMITS} from '@core/schema/preferences';
import {CountRow, CheckboxRow} from './PreferenceRows';
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

/** 성경: the installed translations, and 절 번호. */
export function BiblePage({
  edits,
  bible,
}: {
  readonly edits: PreferenceEdits;
  readonly bible: BibleEdits;
}): JSX.Element {
  const {preferences, lockedReason, change} = edits;
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
        <PropertyGroup title="표시">
          <CheckboxRow
            label="절 번호"
            disabled={lockedReason !== undefined}
            title={lockedReason}
            checked={preferences.bible.verseNumbers}
            onChange={verseNumbers =>
              change(stored => ({
                ...stored,
                bible: {...stored.bible, verseNumbers},
              }))
            }
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
