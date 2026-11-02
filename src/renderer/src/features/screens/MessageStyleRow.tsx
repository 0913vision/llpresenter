import type {JSX} from 'react';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/messages';
import type {MessageStyleId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import {resolveMessageStyle} from '@core/screens/messageStyle';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {PropertyRow, SelectMenu} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';

const LABEL = '메시지 스타일';
const LOAD_TITLE = '메시지 스타일을 불러오지 못했습니다';

/** Picks the style the screen draws a 메시지 in. */
export function MessageStyleRow({
  screen,
  onChange,
  onProblem,
  reason,
}: {
  readonly screen: Screen;
  readonly onChange: (id: MessageStyleId | null) => void;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly reason: string | undefined;
}): JSX.Element {
  const document = useSettingsDocument('messages', LOAD_TITLE, onProblem);
  const saved = document?.value.messageStyles ?? [];
  const current = resolveMessageStyle(saved, screen.messageStyleId);
  return (
    <PropertyRow label={LABEL}>
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          disabled={reason !== undefined}
          title={reason}
          block
          menuLabel={LABEL}
          options={[
            {
              value: DEFAULT_MESSAGE_STYLE.id,
              label: DEFAULT_MESSAGE_STYLE.name,
            },
            ...saved.map(style => ({value: style.id, label: style.name})),
          ]}
          value={current.id}
          onChange={value =>
            onChange(saved.find(style => style.id === value)?.id ?? null)
          }
        />
      )}
    </PropertyRow>
  );
}
