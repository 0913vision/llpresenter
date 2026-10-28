import {useEffect, useRef, useState, type JSX} from 'react';
import type {Look} from '@shared/schema/looks';
import type {MessageStyleId} from '@shared/schema/ids';
import {MessageStyleSelect} from './MessageStyleSelect';
import {MessageStyleProperties} from './MessageStyleProperties';
import type {MessageStyleChange} from './messageStyleEdits';
import type {LookPreviewInput} from './lookPreviewFrame';
import type {Timer} from '@shared/schema/timers';
import {CheckRow} from '@renderer/ui/Checkbox';
import {Icon} from '@renderer/ui/Icon';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {LookPreview} from './LookPreview';
import {screenCard, type LookCardChange} from './lookCardEdits';
import styles from './LookEditor.module.css';

type Layer = Extract<LookCardChange, {kind: 'layer'}>['layer'];
const AUDIENCE_LAYERS: readonly Layer[] = [
  'media',
  'slide',
  'notice',
  'prop',
  'message',
];
const STAGE_LAYERS: readonly Layer[] = [
  'media',
  'slide',
  'clock',
  'stageMessage',
  'message',
];
const LAYER_LABELS: Readonly<Record<Layer, string>> = {
  media: '배경 미디어',
  slide: '가사',
  notice: '공지',
  prop: '소품',
  message: '메시지',
  clock: '시계',
  stageMessage: '무대 메시지',
};
const BACKGROUNDS = [
  {value: 'green', label: '초록'},
  {value: 'black', label: '검정'},
  {value: 'media', label: '미디어'},
] as const;

function VisiblePreview(
  props: Omit<LookPreviewInput, 'state'> & {readonly timers: readonly Timer[]},
): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    if (root.current === null || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry !== undefined) setVisible(entry.isIntersecting);
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className={styles.preview}>
      {visible ? <LookPreview {...props} /> : null}
    </div>
  );
}

/** A screen's layer switches and style or layout under the selected Look. */
export function LookScreenCard({
  look,
  screen,
  looks,
  stageLayouts,
  timers,
  target,
  reason,
  onChange,
  onProblem,
  onMessageChange,
  onMessageCreate,
  onMessageStyleChange,
}: Omit<LookPreviewInput, 'lookId' | 'state'> & {
  readonly look: Look;
  readonly timers: readonly Timer[];
  readonly target: string;
  readonly reason: string | undefined;
  readonly onChange: (change: LookCardChange) => void;
  readonly onProblem: (title: string) => void;
  readonly onMessageChange: (id: MessageStyleId | null) => void;
  readonly onMessageCreate: () => void;
  readonly onMessageStyleChange: (
    id: MessageStyleId,
    change: MessageStyleChange,
  ) => Promise<boolean> | undefined;
}): JSX.Element {
  const card = screenCard(look, screen.id);
  const messageStyle = looks.messageStyles?.find(
    style => style.id === look.screens[screen.id]?.messageStyle,
  );
  const stage = screen.kind === 'stage';
  const caption =
    !stage && (screen.method === 'capture' || screen.method === 'ndi');
  const color =
    card.background?.kind === 'color'
      ? card.background.color.toUpperCase()
      : undefined;
  const background =
    color === undefined
      ? 'media'
      : color === '#000000'
        ? 'black'
        : color === '#00B140'
          ? 'green'
          : 'custom';
  const backgrounds =
    background === 'custom'
      ? [...BACKGROUNDS, {value: 'custom' as const, label: color ?? ''}]
      : BACKGROUNDS;
  const backgroundChange = (
    value: (typeof BACKGROUNDS)[number]['value'] | 'custom',
  ): void => {
    if (value === 'custom') return;
    if (value === 'media') {
      onChange({kind: 'background', value: {kind: 'media'}});
      return;
    }
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue(value === 'green' ? '--chroma' : '--output-black')
      .trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      onProblem('배경색을 불러올 수 없음');
      return;
    }
    onChange({kind: 'background', value: {kind: 'color', color}});
  };
  return (
    <section aria-label={screen.name} className={styles.card}>
      <div className={styles.cardHeader}>
        <Icon name={caption ? 'capture' : 'monitor'} />
        <span title={screen.name}>{screen.name}</span>
      </div>
      <div className={styles.target} title={target}>
        {target}
      </div>
      <VisiblePreview
        screen={screen}
        lookId={look.id}
        looks={looks}
        stageLayouts={stageLayouts}
        timers={timers}
      />
      {(stage ? STAGE_LAYERS : AUDIENCE_LAYERS).map(layer => (
        <div className={styles.layer} key={layer}>
          <CheckRow
            label={layer === 'media' && caption ? '배경' : LAYER_LABELS[layer]}
            checked={card.layers[layer] === true}
            disabled={reason !== undefined}
            title={reason}
            onChange={on => onChange({kind: 'layer', layer, on})}
          />
          {layer === 'slide' ? (
            stage ? (
              <SelectMenu
                aria-label={`${screen.name} 무대 배치`}
                value={card.stageLayout ?? ''}
                valueText={
                  stageLayouts.find(layout => layout.id === card.stageLayout)
                    ?.name ??
                  (card.stageLayout === undefined ? '없음' : '없는 무대 배치')
                }
                options={[
                  {value: '', label: '없음'},
                  ...stageLayouts.map(layout => ({
                    value: layout.id,
                    label: layout.name,
                  })),
                ]}
                disabled={reason !== undefined}
                title={reason}
                onChange={id =>
                  onChange({
                    kind: 'stageLayout',
                    id:
                      stageLayouts.find(layout => layout.id === id)?.id ?? null,
                  })
                }
              />
            ) : (
              <SelectMenu
                aria-label={`${screen.name} 가사 스타일`}
                value={card.lyricStyle ?? ''}
                valueText={
                  looks.lyricStyles.find(style => style.id === card.lyricStyle)
                    ?.name ??
                  (card.lyricStyle === undefined
                    ? '기본값'
                    : '없는 가사 스타일')
                }
                options={[
                  {value: '', label: '기본값'},
                  ...looks.lyricStyles.map(style => ({
                    value: style.id,
                    label: style.name,
                  })),
                ]}
                disabled={reason !== undefined}
                title={reason}
                onChange={id =>
                  onChange({
                    kind: 'lyricStyle',
                    id:
                      looks.lyricStyles.find(style => style.id === id)?.id ??
                      null,
                  })
                }
              />
            )
          ) : null}
          {layer === 'message' ? (
            <MessageStyleSelect
              file={looks}
              look={look}
              screenId={screen.id}
              screenName={screen.name}
              reason={reason}
              onChange={onMessageChange}
              onCreate={onMessageCreate}
            />
          ) : null}
          {layer === 'media' && caption ? (
            <SelectMenu
              aria-label={`${screen.name} 배경색`}
              options={backgrounds}
              value={background}
              disabled={reason !== undefined}
              title={reason}
              onChange={backgroundChange}
            />
          ) : null}
        </div>
      ))}
      {messageStyle === undefined ? null : (
        <MessageStyleProperties
          style={messageStyle}
          reason={reason}
          onChange={change => onMessageStyleChange(messageStyle.id, change)}
        />
      )}
    </section>
  );
}
