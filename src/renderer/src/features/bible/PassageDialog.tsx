import {useEffect, useRef, useState, type JSX, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {RecentPassage, Translation} from '@core/schema/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import {recentPassages} from '@core/bible/bibleRecents';
import {isComposingKey} from '@renderer/ui/ime';
import {Icon} from '@renderer/ui/Icon';
import {KeyCombo} from '@renderer/ui/KeyCap';
import {layerContainer} from '@renderer/ui/layers';
import {useModal} from '@renderer/ui/useModal';
import {BibleReferenceForm} from './BibleReferenceForm';
import {RecentPassages} from './RecentPassages';
import styles from './PassageDialog.module.css';

/** The shared passage finder used by Show and preparation. */
export function PassageDialog({
  api,
  translation,
  translations,
  recents,
  action,
  onClose,
  onSubmit,
  onPick,
  onIntent,
  onKeyDownCapture,
}: {
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly translations: readonly Translation[];
  readonly recents: readonly RecentPassage[];
  readonly action: string;
  readonly onClose: () => void;
  readonly onSubmit: (passage: BibleLookupPassage) => void;
  readonly onPick: (recent: RecentPassage) => void;
  readonly onIntent?: (() => void) | undefined;
  readonly onKeyDownCapture?:
    ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
}): JSX.Element {
  const surface = useRef<HTMLElement>(null);
  const intentVersion = useRef(0);
  const [highlight, setHighlight] = useState(-1);
  const [resetKey, setResetKey] = useState(0);
  const [resolved, setResolved] = useState<{
    provided: TranslationId | undefined;
    value: TranslationId;
  } | null>(null);
  const effective =
    resolved !== null && resolved.provided === translation
      ? resolved.value
      : translation;
  const keys = useModal({
    surface,
    onEscape: onClose,
    onEnter: undefined,
    initialFocus: 'text-field',
  });
  const entries = recentPassages(recents);
  const firstRef = entries[0]?.ref;
  useEffect(() => {
    let active = true;
    const version = intentVersion.current;
    if (translation !== undefined && firstRef !== undefined) {
      api
        .lookup({input: firstRef, translation})
        .then(reply => {
          const value =
            reply.effectiveTranslation ??
            (reply.result.ok ? reply.result.value.translation : translation);
          if (active && intentVersion.current === version) {
            setResolved(previous =>
              previous !== null &&
              previous.provided === translation &&
              previous.value === value
                ? previous
                : {provided: translation, value},
            );
          }
        })
        .catch(() => {
          if (active && intentVersion.current === version) {
            setResolved({provided: translation, value: translation});
          }
        });
    }
    return () => {
      active = false;
    };
  }, [api, translation, firstRef]);
  const label =
    translations.find(item => item.id === effective)?.name ?? effective;
  const capture = (event: KeyboardEvent<HTMLElement>): void => {
    onKeyDownCapture?.(event);
    if (
      event.defaultPrevented ||
      isComposingKey(event.nativeEvent) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const hasText = Array.from(
        surface.current?.querySelectorAll<HTMLInputElement>(
          '[data-reference-part]',
        ) ?? [],
      ).some(field => field.value !== '');
      if (hasText) {
        intentVersion.current += 1;
        setHighlight(-1);
        onIntent?.();
        setResetKey(value => value + 1);
      } else onClose();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!entries.length) return;
      event.preventDefault();
      event.stopPropagation();
      surface.current
        ?.querySelector<HTMLInputElement>('[data-reference-part="book"]')
        ?.focus();
      setHighlight(value =>
        Math.max(
          0,
          Math.min(
            entries.length - 1,
            value + (event.key === 'ArrowDown' ? 1 : -1),
          ),
        ),
      );
    } else if (event.key === 'Enter' && highlight >= 0) {
      const recent = entries[highlight];
      if (recent) {
        event.preventDefault();
        event.stopPropagation();
        setHighlight(-1);
        onPick(recent);
      }
    } else if (highlight >= 0 && event.key.length === 1) setHighlight(-1);
  };
  return createPortal(
    <div className={styles.scrim}>
      <section
        ref={surface}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={'\uC131\uACBD \uAD6C\uC808'}
        onKeyDown={keys}
        onKeyDownCapture={capture}
        onCompositionStart={() => setHighlight(-1)}
      >
        <div className={styles.header}>
          <BibleReferenceForm
            key={resetKey}
            dialogMode
            submitAnyField
            autoFocus
            api={api}
            translation={translation}
            onEffectiveTranslation={value =>
              setResolved(previous =>
                previous !== null &&
                previous.provided === translation &&
                previous.value === value
                  ? previous
                  : {provided: translation, value},
              )
            }
            onIntent={() => {
              setHighlight(-1);
              intentVersion.current += 1;
              onIntent?.();
            }}
            onEscape={onClose}
            onPreview={() => undefined}
            onSubmit={onSubmit}
          />
          <span className={styles.accessory}>{label}</span>
        </div>
        <RecentPassages
          scope="dialog"
          recents={recents}
          translations={translations}
          translation={effective}
          showTranslation={
            (resolved !== null && resolved.provided === translation) ||
            firstRef === undefined
          }
          onPick={onPick}
          highlight={highlight}
        />
        <footer className={styles.footer}>
          <span className={styles.title}>
            <Icon name="book" size={16} />
            {'\uC131\uACBD \uAD6C\uC808'}
          </span>
          <span>
            {action}
            <KeyCombo keys={['Enter']} />
          </span>
          <span className={styles.next}>
            {'\uB2E4\uC74C \uCE78'}
            <KeyCombo keys={['Tab']} />
          </span>
        </footer>
      </section>
    </div>,
    layerContainer('dialog'),
  );
}
