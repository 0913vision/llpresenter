import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {RecentPassage, Translation} from '@core/schema/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import {recentPassages} from '@core/bible/bibleRecents';
import {isComposingKey} from '@renderer/ui/ime';
import {Icon} from '@renderer/ui/Icon';
import {keepFocusInModal} from '@renderer/ui/Dialog';
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
  initialRef,
  children,
  disabled = false,
}: {
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly translations: readonly Translation[];
  readonly recents: readonly RecentPassage[];
  readonly action: string;
  readonly initialRef?: string | undefined;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (passage: BibleLookupPassage) => void;
  readonly onPick: (recent: RecentPassage) => void;
  readonly onIntent?: (() => void) | undefined;
  readonly onKeyDownCapture?:
    ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
}): JSX.Element {
  const surface = useRef<HTMLElement>(null);
  const intentVersion = useRef(0);
  const submissionVersion = useRef(0);
  const formVersion = submissionVersion.current;
  const [highlight, setHighlight] = useState(-1);
  const [ready, setReady] = useState<BibleLookupPassage | null>(null);
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
  const pickRecent = (recent: RecentPassage): void => {
    if (disabled) return;
    submissionVersion.current += 1;
    intentVersion.current += 1;
    setHighlight(-1);
    setResetKey(value => value + 1);
    onPick(recent);
  };
  const capture = (event: KeyboardEvent<HTMLElement>): void => {
    onKeyDownCapture?.(event);
    if (event.target instanceof HTMLTextAreaElement) return;
    if (
      event.defaultPrevented ||
      isComposingKey(event.nativeEvent) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.referencePart === 'book' &&
      event.target.getAttribute('aria-expanded') === 'true' &&
      ['Escape', 'ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)
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
        submissionVersion.current += 1;
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
    } else if (
      event.key === 'Enter' &&
      highlight >= 0 &&
      !Array.from(
        surface.current?.querySelectorAll<HTMLInputElement>(
          '[data-reference-part]',
        ) ?? [],
      ).some(field => field.value !== '')
    ) {
      const recent = entries[highlight];
      if (recent) {
        event.preventDefault();
        event.stopPropagation();
        pickRecent(recent);
      }
    } else if (highlight >= 0 && event.key.length === 1) setHighlight(-1);
  };
  return createPortal(
    <div className={styles.scrim} onMouseDown={keepFocusInModal}>
      <section
        ref={surface}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={'성경 구절'}
        onKeyDown={keys}
        onKeyDownCapture={capture}
        onCompositionStart={() => setHighlight(-1)}
      >
        {children}
        <div className={styles.header}>
          <BibleReferenceForm
            key={resetKey}
            dialogMode
            autoFocus={children === undefined}
            api={api}
            initialRef={resetKey === 0 ? initialRef : undefined}
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
            onReady={setReady}
            onSubmit={passage => {
              if (!disabled && submissionVersion.current === formVersion) {
                onSubmit(passage);
              }
            }}
          />
          <span className={styles.accessory}>{label}</span>
        </div>
        <RecentPassages
          scope="dialog"
          disabled={disabled}
          recents={recents}
          translations={translations}
          translation={effective}
          showTranslation={
            (resolved !== null && resolved.provided === translation) ||
            firstRef === undefined
          }
          onPick={pickRecent}
          highlight={highlight}
        />
        <footer className={styles.footer}>
          <span className={styles.title}>
            <Icon name="book" size={16} />
            {'성경 구절'}
          </span>
          <span aria-disabled={disabled || ready === null}>
            {action}
            <KeyCombo keys={['Enter']} />
          </span>
          <span className={styles.next}>
            {'다음 칸'}
            <KeyCombo keys={['Tab']} />
          </span>
        </footer>
      </section>
    </div>,
    layerContainer('dialog'),
  );
}
