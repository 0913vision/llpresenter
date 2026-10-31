import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type FocusEvent,
} from 'react';
import {isComposing} from './ime';
import {hasModifier} from './modifierKeys';

export interface RenameContract {
  readonly validate?: ((value: string) => string | undefined) | undefined;
  readonly onCommit: (name: string) => boolean | Promise<boolean>;
  readonly onClose: () => void;
}

const FIELD_COMMANDS = new Set([
  'KeyA',
  'KeyC',
  'KeyV',
  'KeyX',
  'KeyZ',
  'KeyY',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Backspace',
  'Delete',
]);

/** Keeps a recoverable name draft until its owner accepts the save. */
export function useRenameDraft(
  original: string,
  contract: RenameContract,
  locked = false,
) {
  const [initialName] = useState(() => original.trim());
  const [value, setValue] = useState(original);
  const [needsPersistence, setNeedsPersistence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string>();
  const pending = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(false);
  const keyboardFocus = useRef<{
    field: HTMLInputElement;
    row: HTMLElement | null;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const name = value.trim();
  const unchanged = name === initialName && !needsPersistence;
  const validation =
    contract.validate?.(name) ??
    (name === '' ? '이름을 입력하세요' : undefined);
  const problem = validation ?? failure;
  const close = (): void => {
    const focus = keyboardFocus.current;
    const restore = focus?.field === document.activeElement;
    finished.current = true;
    contract.onClose();
    if (restore) focus.row?.focus({preventScroll: true});
  };
  const cancel = (): void => {
    if (pending.current || finished.current) return;
    close();
  };
  const save = async (): Promise<boolean> => {
    if (locked || pending.current || finished.current) return false;
    if (unchanged) {
      cancel();
      return true;
    }
    if (validation !== undefined) return false;
    pending.current = true;
    setNeedsPersistence(true);
    setSaving(true);
    setFailure(undefined);
    try {
      const saved = await contract.onCommit(name);
      if (!mounted.current) return saved;
      if (!saved) setFailure('이름을 저장할 수 없습니다');
      else {
        setNeedsPersistence(false);
        close();
      }
      return saved;
    } catch (cause: unknown) {
      console.error('Could not save a renamed item:', cause);
      if (mounted.current) setFailure('이름을 저장할 수 없습니다');
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const commit = (): void => {
    save().catch((cause: unknown) =>
      console.error('Could not finish renaming:', cause),
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (
      hasModifier(event) &&
      (event.key === 'Enter' || event.key === 'Escape')
    ) {
      return;
    }
    if (
      !/^F\d{1,2}$/.test(event.key) &&
      !event.altKey &&
      (!(event.ctrlKey || event.metaKey) || FIELD_COMMANDS.has(event.code))
    ) {
      event.stopPropagation();
    }
    if (isComposing(event)) return;
    if (event.key === 'Enter' || event.key === 'Escape') {
      keyboardFocus.current = {
        field: event.currentTarget,
        row: event.currentTarget.closest<HTMLElement>('[role="option"]'),
      };
    }
    if (event.key === 'Enter') commit();
    else if (event.key === 'Escape') cancel();
    else return;
    event.preventDefault();
  };
  return {
    commit,
    save,
    changed: !unchanged,
    cancel,
    busy: locked || saving,
    valid: validation === undefined || unchanged,
    problem,
    field: {
      value,
      onChange: (next: string): void => {
        if (locked || pending.current) return;
        setValue(next);
        setFailure(undefined);
      },
      readOnly: locked || saving,
      invalid: problem !== undefined,
      invalidReason: problem,
      onKeyDown,
      onBlur: (event?: FocusEvent<HTMLInputElement>): void => {
        if (
          event?.relatedTarget instanceof Element &&
          event.relatedTarget.closest('button') &&
          event.currentTarget
            .closest('[role="dialog"]')
            ?.contains(event.relatedTarget)
        ) {
          return;
        }
        if (locked || pending.current) return;
        if (validation === undefined || unchanged) commit();
        else cancel();
      },
    },
  };
}
