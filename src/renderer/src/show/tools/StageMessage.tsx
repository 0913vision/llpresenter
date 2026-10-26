import {useState, type JSX} from 'react';
import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import {sendLive, useLive} from '@renderer/state/live';
import {Button, LiveBadge, TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import styles from './StageTab.module.css';

const MAX_PRESETS = 50;

function messageReason(text: string, available: boolean): string | undefined {
  if (!available) return '무대 화면이 없습니다';
  if (text.trim() === '') return '메시지를 적어야 보낼 수 있습니다';
  if (text.length > LIVE_STATE_LIMITS.textCharacters) {
    return '메시지가 너무 깁니다';
  }
  return undefined;
}

export function StageMessage({
  available,
  presets,
}: {
  readonly available: boolean;
  readonly presets: readonly string[];
}): JSX.Element {
  const [text, setText] = useState('');
  const live = useLive(view => view.state?.stageMessage);
  const reason = messageReason(text, available);
  const send = (value: string): void => {
    if (messageReason(value, available) === undefined) {
      sendLive({type: 'stage.message.set', text: value.trim()});
    }
  };
  return (
    <section aria-label="무대 메시지" className={styles.message}>
      <div className={styles.heading}>
        <span>무대 메시지</span>
        {live ? <LiveBadge /> : null}
      </div>
      <TextField
        aria-label="무대 메시지"
        block
        value={text}
        onChange={setText}
        maxLength={LIVE_STATE_LIMITS.textCharacters}
        onKeyDown={event => {
          if (event.key !== 'Enter' || isComposing(event)) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat) return;
          send(text);
        }}
      />
      <div className={styles.actions}>
        <Button
          disabled={!live}
          title={!live ? '표시 중인 무대 메시지가 없습니다' : undefined}
          onClick={() => sendLive({type: 'stage.message.set', text: null})}
        >
          내리기
        </Button>
        <Button
          variant="primary"
          disabled={reason !== undefined}
          title={reason}
          onClick={() => send(text)}
        >
          보내기
        </Button>
      </div>
      <div
        className={styles.presets}
        role="group"
        aria-label="무대 메시지 프리셋"
      >
        {presets.slice(0, MAX_PRESETS).map((preset, index) => {
          const reason = messageReason(preset, available);
          return (
            <Button
              key={index}
              className={styles.preset}
              aria-pressed={live != null && live === preset.trim()}
              disabled={reason !== undefined}
              title={reason}
              onClick={() => send(preset)}
            >
              {preset.trim() || '이름 없음'}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
