import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {RecentPassage, Translation} from '@core/schema/bible';
import type {TranslationId} from '@core/schema/ids';
import {recentPassages} from '@core/bible/bibleRecents';
import {displayReference} from '@core/bible/displayReference';
import {commandBindings} from '@core/shortcuts/bindings';
import {editsText, matchesBinding} from '@core/shortcuts/matching';
import {shortcutNames} from '@core/shortcuts/keys';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {isInputMethodKey} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import styles from './RecentPassages.module.css';

/** Shared recent-passage list. The caller owns lookup and the next step. */
export function RecentPassages({
  recents,
  translations,
  translation,
  onPick,
  scope = 'show',
  disabled = false,
}: {
  readonly recents: readonly RecentPassage[];
  readonly translations: readonly Translation[];
  readonly translation: TranslationId | undefined;
  readonly onPick: (passage: RecentPassage) => void;
  readonly scope?: 'show' | 'dialog';
  readonly disabled?: boolean;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  const entries = recentPassages(recents).slice(0, 10);
  useWindowShortcuts(
    scope === 'show'
      ? Array.from({length: 10}, (_, index) => ({
          id: `bible.recent${index + 1}`,
          when: () => !disabled && entries[index] !== undefined,
          run: () => {
            const recent = entries[index];
            if (recent) onPick(recent);
          },
        }))
      : [],
  );
  const pickInDialog = useEffectEvent((event: KeyboardEvent): void => {
    const dialog = root.current?.closest('[role="dialog"]');
    if (
      !dialog ||
      !(event.target instanceof Node) ||
      !dialog.contains(event.target) ||
      event.defaultPrevented ||
      isInputMethodKey(event) ||
      editsText(event) ||
      event.repeat ||
      disabled
    ) {
      return;
    }
    const index = entries.findIndex((_entry, at) =>
      commandBindings(`bible.recent${at + 1}`, bindings).some(binding =>
        matchesBinding(event, binding),
      ),
    );
    const recent = entries[index];
    if (!recent) return;
    if (
      commandBindingStore
        .conflicts()
        .some(
          conflict =>
            conflict.second === `bible.recent${index + 1}` &&
            matchesBinding(event, conflict.binding),
        )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onPick(recent);
  });
  useLayoutEffect(() => {
    if (scope !== 'dialog') return undefined;
    const keydown = (event: KeyboardEvent): void => pickInDialog(event);
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [scope]);
  return (
    <div ref={root} className={styles.recents} aria-label="최근 성경 구절">
      {Array.from({length: 10}, (_, index) => {
        const recent = entries[index];
        const otherTranslation = recent && recent.translation !== translation;
        const entry = translations.find(
          item => item.id === recent?.translation,
        );
        const name = entry?.name ?? recent?.translation;
        const ambiguous =
          entry &&
          translations.some(
            item => item.id !== entry.id && item.name === entry.name,
          );
        const translationName = ambiguous
          ? `${name} (${recent?.translation})`
          : name;
        const binding = commandBindings(
          `bible.recent${index + 1}`,
          bindings,
        )[0];
        return (
          <div className={styles.recentSlot} key={index}>
            {recent ? (
              <button
                type="button"
                className={styles.recent}
                disabled={disabled}
                onClick={() => onPick(recent)}
              >
                <span>{index + 1}</span>
                <span className={styles.ref}>
                  {displayReference(recent.ref)}
                </span>
                {otherTranslation ? (
                  <span className={styles.translation}>{translationName}</span>
                ) : null}
                {binding ? (
                  <span className={styles.keys}>
                    {shortcutNames(binding).join('+')}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
