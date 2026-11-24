import {useState, type JSX} from 'react';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import type {Screen} from '@core/schema/screens/screens';
import type {MessageTemplate} from '@core/schema/tools/messages';
import {MAX_MESSAGE_CHARACTERS} from '@core/overlays';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {nameReason} from '@renderer/ui/fields/nameReason';
import {TextArea} from '@renderer/ui/fields/TextArea';
import {TextField} from '@renderer/ui/fields/TextField';
import {Properties, PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {Dialog} from '@renderer/ui/popups/Dialog';
import {DisplayTimeRow} from '../DisplayTimeRow';
import {ScreenTargetsRow} from '../ScreenTargetsRow';
import {messageTextReason, type MessageFields} from './messageEdits';

/** Which dialog is open: 메시지 추가, or 메시지 수정 of one template. */
export type MessageEditor =
  | {readonly kind: 'add'}
  | {readonly kind: 'edit'; readonly item: MessageTemplate};

/** Every field of the dialog, as a new template starts or as `item` has it. */
type DialogFields = Required<Omit<MessageFields, 'duration'>> & {
  readonly duration: number | null;
};

function startFields(editor: MessageEditor): DialogFields {
  if (editor.kind === 'add') {
    return {name: '', text: '', icon: 'msg', targets: 'all', duration: null};
  }
  const {item} = editor;
  return {
    name: item.name,
    text: item.text,
    icon: item.icon,
    targets: item.targets ?? 'all',
    duration: item.duration ?? null,
  };
}

/** The 메시지 추가 and 메시지 수정 dialog. */
export function MessageTemplateDialog({
  editor,
  screens,
  locked,
  onCancel,
  onSave,
}: {
  readonly editor: MessageEditor;
  readonly screens: readonly Screen[];
  readonly locked: boolean;
  readonly onCancel: () => void;
  readonly onSave: (fields: MessageFields) => void;
}): JSX.Element {
  const [fields, setFields] = useState(() => startFields(editor));
  const change = (patch: Partial<DialogFields>): void =>
    setFields(current => ({...current, ...patch}));
  const nameProblem = nameReason(fields.name, NAME_LIMIT);
  const textReason = messageTextReason(fields.text);
  // NOTE(0913vision): A blank field is not marked; 추가 stays off and says
  // why, as in the other 추가 dialogs.
  const nameShown = fields.name.trim() === '' ? undefined : nameProblem;
  const textShown = fields.text.trim() === '' ? undefined : textReason;
  return (
    <Dialog
      title={editor.kind === 'add' ? '메시지 추가' : '메시지 수정'}
      size="s"
      onCancel={onCancel}
      primary={{
        label: editor.kind === 'add' ? '추가' : '저장',
        disabled:
          locked || nameProblem !== undefined || textReason !== undefined,
        title: nameProblem ?? textReason,
        onSelect: () => onSave(fields),
      }}
    >
      <Properties placement="window">
        <PropertyRow label="이름">
          {({controlId}) => (
            <TextField
              id={controlId}
              block
              value={fields.name}
              onChange={name => change({name})}
              maxLength={NAME_LIMIT}
              readOnly={locked}
              invalid={nameShown !== undefined}
              invalidReason={nameShown}
            />
          )}
        </PropertyRow>
        <PropertyRow label="문구" alignTop>
          {({controlId}) => (
            <TextArea
              id={controlId}
              value={fields.text}
              onChange={text => change({text})}
              maxLength={MAX_MESSAGE_CHARACTERS}
              readOnly={locked}
              invalid={textShown !== undefined}
              invalidReason={textShown}
            />
          )}
        </PropertyRow>
        <PropertyRow label="아이콘">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              value={fields.icon}
              disabled={locked}
              options={[
                {value: 'msg', label: '메시지'},
                {value: 'user', label: '사람'},
              ]}
              onChange={icon => change({icon})}
            />
          )}
        </PropertyRow>
        <ScreenTargetsRow
          screens={screens}
          targets={fields.targets}
          locked={locked}
          onChange={targets => change({targets})}
        />
        <DisplayTimeRow
          duration={fields.duration}
          saved={editor.kind === 'edit' ? (editor.item.duration ?? null) : null}
          locked={locked}
          onChange={duration => change({duration})}
        />
      </Properties>
    </Dialog>
  );
}
