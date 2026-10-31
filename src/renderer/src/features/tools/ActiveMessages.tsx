import {useEffect, useState, type JSX} from 'react';
import {liveMessages, messageTimeLeft} from '@core/overlays/messagePlayback';
import {useLive} from '@renderer/session/live';
import {IconButton, TruncatedText} from '@renderer/ui';
import {dismissMessage} from './messageDismiss';
import styles from './MessageTab.module.css';

const SECOND_MS = 1000;

/** Controls sent messages independently of the template currently being composed. */
export function ActiveMessages(): JSX.Element | null {
  const layer = useLive(view => view.state?.layers.message);
  const [tick, setTick] = useState(() => Date.now());
  const now = tick;
  const messages = liveMessages(layer, now);
  const timed = messages.some(message => message.expiresAt !== null);
  useEffect(() => {
    if (!timed) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setTick(Date.now());
    });
    const timer = setInterval(() => setTick(Date.now()), SECOND_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [timed, layer]);
  if (messages.length === 0) return null;
  return (
    <div role="list" aria-label="보낸 메시지" className={styles.sent}>
      {messages.map(message => (
        <div
          key={message.messageId}
          role="listitem"
          aria-label={message.text}
          className={styles.sentRow}
        >
          <TruncatedText text={message.text} className={styles.sentText} />
          <span className={styles.time}>
            {messageTimeLeft(message.expiresAt, now)}
          </span>
          <IconButton
            icon="x"
            label="내리기"
            title="메시지 내리기"
            onClick={() => dismissMessage(message.messageId)}
          />
        </div>
      ))}
    </div>
  );
}
