import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  memo,
  useState,
  type Dispatch,
  type SetStateAction,
  type JSX,
} from 'react';
import type {MessageTemplate} from '@core/schema/messages';
import type {Screen} from '@core/schema/screens';
import {
  messageBlankNames,
  MAX_MESSAGE_CHARACTERS,
} from '@core/overlays/messageText';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {sendLive} from '@renderer/session/live';
import {
  Button,
  ListBox,
  ListRow,
  Properties,
  PropertyRow,
  SelectMenu,
  TextField,
} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {
  currentMessageTargets,
  toggleMessageScreen,
  prepareMessage,
  type DraftTargets,
} from '@core/overlays/messageDraft';
import styles from './MessageTab.module.css';
import {MessageEditing} from './MessageEditing';
import {ActiveMessages} from './ActiveMessages';

function Sentence({text}: {readonly text: string}): JSX.Element {
  const names = messageBlankNames(text);
  const parts = text.slice(0, MAX_MESSAGE_CHARACTERS).split(/(\{[^{}]+\})/gu);
  return (
    <span className={styles.sentence}>
      {parts.map((part, index) =>
        part.startsWith('{') &&
        part.endsWith('}') &&
        names.includes(part.slice(1, -1)) ? (
          <span key={index} className={styles.blank}>
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

const BlankField = memo(
  ({
    name,
    value,
    setValues,
  }: {
    readonly name: string;
    readonly value: string;
    readonly setValues: Dispatch<SetStateAction<ReadonlyMap<string, string>>>;
  }): JSX.Element => (
    <PropertyRow label={name.trim() || '빈칸'}>
      {({controlId}) => (
        <TextField
          id={controlId}
          block
          value={value}
          maxLength={MAX_MESSAGE_CHARACTERS}
          onChange={value =>
            setValues(current => new Map(current).set(name, value))
          }
        />
      )}
    </PropertyRow>
  ),
);

const TemplateRow = memo(
  ({template}: {readonly template: MessageTemplate}): JSX.Element => (
    <ListRow
      value={template.id}
      title={template.name || '이름 없음'}
      icon={template.icon}
      sub={[<Sentence key="sentence" text={template.text} />]}
    />
  ),
);

function Composer({
  template,
  screens,
}: {
  readonly template: MessageTemplate;
  readonly screens: readonly Screen[];
}): JSX.Element {
  const [values, setValues] = useState<ReadonlyMap<string, string>>(new Map());
  const [selectedTargets, setTargets] = useState<DraftTargets>(
    template.targets ?? 'all',
  );
  const [duration, setDuration] = useState<number | null>(
    template.duration ?? null,
  );
  const targets = currentMessageTargets(selectedTargets, screens);
  const ready = prepareMessage({
    template,
    values,
    targets,
    screenCount: screens.length,
  });
  const send = (): void => {
    if (ready.reason === undefined) {
      sendLive({
        type: 'message.send',
        text: ready.text,
        targets,
        duration,
      });
    }
  };
  useWindowShortcuts([{id: 'message.send', run: send}]);
  const durations = [
    {value: 'until', label: '계속'},
    ...[30, 60, 120].map(value => ({
      value: String(value),
      label: value < 60 ? `${value}초` : `${value / 60}분`,
    })),
  ];
  if (
    template.duration !== undefined &&
    template.duration !== null &&
    !durations.some(option => option.value === String(template.duration))
  ) {
    durations.push({
      value: String(template.duration),
      label: `${template.duration}초`,
    });
  }
  return (
    <div className={styles.composer}>
      <Properties>
        {messageBlankNames(template.text).map(name => (
          <BlankField
            key={name}
            name={name}
            value={values.get(name) ?? ''}
            setValues={setValues}
          />
        ))}
        <PropertyRow label="보낼 화면" alignTop>
          {({labelId, controlId}) => (
            <div
              id={controlId}
              role="group"
              aria-labelledby={labelId}
              className={styles.targets}
            >
              <Button
                aria-pressed={targets === 'all'}
                onClick={() => setTargets(targets === 'all' ? [] : 'all')}
              >
                모든 화면
              </Button>
              {screens.map(screen => (
                <Button
                  key={screen.id}
                  aria-pressed={
                    targets !== 'all' && targets.includes(screen.id)
                  }
                  onClick={() =>
                    setTargets(current =>
                      toggleMessageScreen(current, screen.id),
                    )
                  }
                >
                  {screen.name || '이름 없음'}
                </Button>
              ))}
            </div>
          )}
        </PropertyRow>
        <PropertyRow label="표시 시간">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              aria-label="메시지 표시 시간"
              block
              value={duration === null ? 'until' : String(duration)}
              options={durations}
              onChange={value =>
                setDuration(value === 'until' ? null : Number(value))
              }
            />
          )}
        </PropertyRow>
      </Properties>
      <output className={styles.preview} aria-label="메시지 미리보기">
        {ready.text}
      </output>
      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={ready.reason !== undefined}
          title={ready.reason}
          onKeyDown={event => {
            if (event.key === 'Enter' && event.repeat) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onClick={send}
        >
          보내기
        </Button>
      </div>
    </div>
  );
}

export function MessageTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const messages = useSettingsDocument('messages', '메시지', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    messages?.value.templates.find(template => template.id === selectedId) ??
    messages?.value.templates[0];
  return (
    <>
      <ActiveMessages />
      <MessageEditing
        document={messages}
        onProblem={onProblem}
        onSelect={setSelectedId}
      >
        <ListBox
          label="메시지 템플릿"
          workspace="show"
          selected={selected?.id}
          onSelect={setSelectedId}
        >
          {messages?.value.templates.map(template => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </ListBox>
      </MessageEditing>
      {selected === undefined ? null : (
        <Composer
          key={JSON.stringify([
            selected.id,
            selected.text,
            selected.targets ?? 'all',
            selected.duration ?? null,
          ])}
          template={selected}
          screens={screens?.value.screens ?? []}
        />
      )}
    </>
  );
}
