import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type RefObject,
} from 'react';
import {Button} from '@renderer/ui/buttons/Button';
import {Icon} from '@renderer/ui/Icon';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {NoticeMeta} from '@renderer/ui/popups/Notification';
import {Popover} from '@renderer/ui/popups/Popover';
import type {Notice, NoticeRecord} from '@renderer/ui/popups/notices';
import type {ControlSession} from '../controlSession';
import styles from './NoticeHistory.module.css';

const ROW_ICON_SIZE = 16;
const TITLE = '알림';
const NEW_LABEL = '새 알림';

function RecordRow({record}: {readonly record: NoticeRecord}): JSX.Element {
  const meta = record.meta ?? [];
  return (
    <li
      className={styles.row}
      data-state={record.kind === 'warning' ? 'warning' : undefined}
    >
      <Icon name={record.icon} size={ROW_ICON_SIZE} className={styles.icon} />
      <div className={styles.text}>
        <span className={styles.title}>{record.title}</span>
        {meta.length === 0 ? null : <NoticeMeta values={meta} />}
      </div>
      <span className={styles.time}>{record.time}</span>
    </li>
  );
}

function useCloseAway(
  surface: RefObject<HTMLElement | null>,
  bell: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const away = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (surface.current?.contains(target) === true) return;
      if (bell.current?.contains(target) === true) return;
      onClose();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape);
    };
  }, [surface, bell, onClose]);
}

function HistoryPanel({
  records,
  bell,
  onClear,
  onClose,
}: {
  readonly records: readonly NoticeRecord[];
  readonly bell: RefObject<HTMLElement | null>;
  readonly onClear: () => void;
  readonly onClose: () => void;
}): JSX.Element {
  const surface = useRef<HTMLElement | null>(null);
  useCloseAway(surface, bell, onClose);
  useEffect(() => surface.current?.focus({preventScroll: true}), []);
  return (
    <Popover>
      <section
        ref={surface}
        role="dialog"
        aria-label={TITLE}
        tabIndex={-1}
        className={styles.panel}
      >
        <header className={styles.head}>
          <span className={styles.heading}>{TITLE}</span>
          <Button
            variant="ghost"
            disabled={records.length === 0}
            onClick={onClear}
          >
            모두 지우기
          </Button>
          <IconButton icon="x" label="닫기" onClick={onClose} />
        </header>
        {records.length === 0 ? (
          <p className={styles.empty}>알림이 없습니다.</p>
        ) : (
          <ul className={styles.list}>
            {records.map(record => (
              <RecordRow key={record.id} record={record} />
            ))}
          </ul>
        )}
      </section>
    </Popover>
  );
}

/**
 * The bell at the right end of the status bar and the 알림 기록 it opens
 * above it: every notice of this window, newest first. A dot on the bell marks
 * notices that came since the list was last opened.
 */
export function NoticeHistoryButton({
  session,
}: {
  readonly session: ControlSession;
}): JSX.Element {
  const history = useSyncExternalStore(session.subscribe, session.getHistory);
  const [open, setOpen] = useState(false);
  const bell = useRef<HTMLSpanElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (open && history.unseen) session.seeHistory();
  }, [open, history.unseen, session]);
  return (
    <span ref={bell} className={styles.bell}>
      <IconButton
        icon="bell"
        label={history.unseen ? NEW_LABEL : TITLE}
        expanded={open}
        onClick={() => setOpen(!open)}
      />
      {history.unseen ? <span className={styles.dot} /> : null}
      {open ? (
        <HistoryPanel
          records={history.records}
          bell={bell}
          onClear={session.clearHistory}
          onClose={close}
        />
      ) : null}
    </span>
  );
}

/**
 * Writes a notice shown outside the session's stack, such as the update
 * notice, into the 알림 기록 once per wording: its object is new at every
 * render.
 */
export function useRememberNotice(
  session: ControlSession,
  notice: Notice | null,
): void {
  const remember = useEffectEvent(() => {
    if (notice !== null) session.remember(notice);
  });
  const title = notice?.title;
  useEffect(() => {
    if (title !== undefined) remember();
  }, [title]);
}
