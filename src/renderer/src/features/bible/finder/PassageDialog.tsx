import {
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {RecentPassage, Translation} from '@core/schema/bible/bible';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {TranslationId} from '@core/schema/common/ids';
import {recentPassages} from '@core/bible';
import {isComposingKey} from '@renderer/ui/fields/ime';
import {Icon} from '@renderer/ui/Icon';
import {Button} from '@renderer/ui/buttons/Button';
import {keepFocusInModal} from '@renderer/ui/popups/Dialog';
import {KeyCombo} from '@renderer/ui/keys/KeyCap';
import {layerContainer} from '@renderer/ui/popups/layers';
import {useModal} from '@renderer/ui/popups/useModal';
import {BibleReferenceForm} from '../reference/BibleReferenceForm';
import {RecentPassages} from './RecentPassages';
import {useShownTranslation} from './useShownTranslation';
import styles from './PassageDialog.module.css';

/** Some field of the reference has text in it. */
function hasTypedReference(surface: HTMLElement | null): boolean {
  return Array.from(
    surface?.querySelectorAll<HTMLInputElement>('[data-reference-part]') ?? [],
  ).some(field => field.value !== '');
}

/**
 * Whether the key belongs to a text field of the dialog's own, such as the
 * 설교 제목: its arrows and Enter edit and move the caret there, and never
 * choose a recent passage.
 */
function ownFieldTakes(event: KeyboardEvent<HTMLElement>): boolean {
  return (
    event.target instanceof HTMLInputElement &&
    event.target.dataset.referencePart === undefined &&
    event.key !== 'Escape'
  );
}

/** Whether the open book list under the 책 field takes this key. */
function bookListTakes(event: KeyboardEvent<HTMLElement>): boolean {
  return (
    event.target instanceof HTMLInputElement &&
    event.target.dataset.referencePart === 'book' &&
    event.target.getAttribute('aria-expanded') === 'true' &&
    ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)
  );
}

function consume(event: KeyboardEvent<HTMLElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * The foot of the dialog: in 준비, 취소 and the action; in 진행, the keys
 * that act (Enter) and move to the next field (Tab).
 */
function PassageDialogFooter({
  name,
  action,
  preparation,
  disabled,
  ready,
  submitCandidate,
  onCancel,
  onSubmit,
}: {
  readonly name: string;
  readonly action: string;
  readonly preparation: boolean;
  readonly disabled: boolean;
  /** A whole passage is looked up and can be acted on. */
  readonly ready: boolean;
  /** The typed reference can be acted on once it is looked up. */
  readonly submitCandidate: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}): JSX.Element {
  return (
    <footer className={styles.footer}>
      <span className={styles.title}>
        <Icon name="book" size={16} />
        {name}
      </span>
      {preparation ? (
        <>
          <Button onClick={onCancel}>{'취소'}</Button>
          <Button
            variant="primary"
            disabled={disabled || (!ready && !submitCandidate)}
            onClick={onSubmit}
          >
            {action}
          </Button>
        </>
      ) : (
        <>
          <span aria-disabled={disabled || !ready}>
            {action}
            <KeyCombo keys={['Enter']} />
          </span>
          <span className={styles.next}>
            {'다음 칸'}
            <KeyCombo keys={['Tab']} />
          </span>
        </>
      )}
    </footer>
  );
}

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
  name = '성경 구절',
  disabled = false,
  preparation = false,
  onSubmitIntent,
  onAhead,
}: {
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly translations: readonly Translation[];
  readonly recents: readonly RecentPassage[];
  readonly action: string;
  readonly initialRef?: string | undefined;
  readonly children?: ReactNode;
  readonly name?: string;
  readonly disabled?: boolean;
  readonly preparation?: boolean;
  readonly onSubmitIntent?: (() => void) | undefined;
  /** A whole reference typed in the 책 field, looked up before Enter. */
  readonly onAhead?: ((passage: BibleLookupPassage) => void) | undefined;
  readonly onClose: () => void;
  readonly onSubmit: (passage: BibleLookupPassage) => void;
  readonly onPick: (recent: RecentPassage) => void;
  readonly onIntent?: (() => void) | undefined;
  readonly onKeyDownCapture?:
    ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
}): JSX.Element {
  const surface = useRef<HTMLElement>(null);
  const form = useRef<{submit: () => void}>(null);
  const intentVersion = useRef(0);
  const submissionVersion = useRef(0);
  const formVersion = submissionVersion.current;
  const [highlight, setHighlight] = useState(-1);
  const [ready, setReady] = useState<BibleLookupPassage | null>(null);
  const [submitCandidate, setSubmitCandidate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  /** A lookup or submit still on its way is for a passage no longer asked. */
  const dropPending = (): void => {
    intentVersion.current += 1;
    submissionVersion.current += 1;
  };
  /** Empties the fields and the highlight, as for a new passage. */
  const restart = (): void => {
    dropPending();
    setHighlight(-1);
    setResetKey(value => value + 1);
  };
  const close = (): void => {
    dropPending();
    onClose();
  };
  const keys = useModal({
    surface,
    onEscape: close,
    onEnter: undefined,
    initialFocus: 'text-field',
  });
  const entries = recentPassages(recents);
  const firstRef = entries[0]?.ref;
  const named = useShownTranslation({
    api,
    translation,
    firstRef,
    intent: intentVersion,
  });
  const effective = named.shown;
  const label =
    translations.find(item => item.id === effective)?.name ?? effective;
  const pickRecent = (recent: RecentPassage): void => {
    if (disabled) return;
    restart();
    onPick(recent);
  };
  /** Esc with a typed reference empties the fields and starts over. */
  const startOver = (): void => {
    restart();
    onIntent?.();
  };
  /** The arrows walk the recent passages while the 책 field keeps focus. */
  const moveHighlight = (by: 1 | -1): void => {
    surface.current
      ?.querySelector<HTMLInputElement>('[data-reference-part="book"]')
      ?.focus();
    setHighlight(value =>
      Math.max(0, Math.min(entries.length - 1, value + by)),
    );
  };
  const capture = (event: KeyboardEvent<HTMLElement>): void => {
    onKeyDownCapture?.(event);
    const modified = event.altKey || event.ctrlKey || event.metaKey;
    if (
      event.defaultPrevented ||
      isComposingKey(event.nativeEvent) ||
      modified
    ) {
      return;
    }
    if (preparation && event.key === 'Escape') {
      consume(event);
      close();
      return;
    }
    if (
      event.target instanceof HTMLTextAreaElement ||
      bookListTakes(event) ||
      ownFieldTakes(event)
    ) {
      return;
    }
    const typed = hasTypedReference(surface.current);
    const highlighted = highlight >= 0 ? entries[highlight] : undefined;
    if (event.key === 'Escape') {
      consume(event);
      if (typed) startOver();
      else onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (entries.length === 0) return;
      consume(event);
      moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && !typed && highlighted !== undefined) {
      consume(event);
      pickRecent(highlighted);
    } else if (highlight >= 0 && event.key.length === 1) {
      setHighlight(-1);
    }
  };
  return createPortal(
    <div className={styles.scrim} onMouseDown={keepFocusInModal}>
      <section
        ref={surface}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onKeyDown={keys}
        onKeyDownCapture={capture}
        onCompositionStart={() => setHighlight(-1)}
      >
        {children}
        <div className={styles.header}>
          <BibleReferenceForm
            submitRef={form}
            submissionDisabled={preparation && disabled}
            key={resetKey}
            dialogMode
            autoFocus={children === undefined}
            api={api}
            initialRef={resetKey === 0 ? initialRef : undefined}
            translation={translation}
            onEffectiveTranslation={named.found}
            onIntent={() => {
              setHighlight(-1);
              intentVersion.current += 1;
              onIntent?.();
            }}
            onEscape={close}
            onPreview={() => undefined}
            onReady={setReady}
            onAhead={onAhead}
            onSubmitCandidate={setSubmitCandidate}
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
          showTranslation={named.known}
          onPick={pickRecent}
          highlight={highlight}
        />
        <PassageDialogFooter
          name={name}
          action={action}
          preparation={preparation}
          disabled={disabled}
          ready={ready !== null}
          submitCandidate={submitCandidate}
          onCancel={close}
          onSubmit={() => {
            onSubmitIntent?.();
            form.current?.submit();
          }}
        />
      </section>
    </div>,
    layerContainer('dialog'),
  );
}
