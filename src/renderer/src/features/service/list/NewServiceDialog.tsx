import type {JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {DateSelect} from '@renderer/ui/DateSelect';
import type {Notice} from '@renderer/ui/notices';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TextField} from '@renderer/ui/TextField';
import {timeChoices} from './serviceDates';
import {SourceList} from './SourceList';
import {SourceTree} from './SourceTree';
import {useSourceActions} from './useSourceActions';
import {useNewService} from './useNewService';

const DIALOG_HEIGHT = 700;
const NAME_NEEDED = '이름을 적어야 만들 수 있습니다';
const MISSING = '예배 순서를 읽을 수 없습니다';

/**
 * The 새 예배 dialog: start empty, from a 템플릿, or from a past service. 취소,
 * Esc, and the close button wait while a create is on its way.
 */
export function NewServiceDialog({
  onClose,
  onProblem,
  saveTemplate,
}: {
  readonly onClose: () => void;
  readonly onProblem: (notice: Notice) => void;
  /** 지금 예배를 템플릿으로 저장 under the source list, when given. */
  readonly saveTemplate?:
    | {
        readonly disabled: boolean;
        readonly reason?: string | undefined;
        readonly onSave: () => void;
      }
    | undefined;
}): JSX.Element {
  const state = useNewService({onProblem, onDone: onClose});
  const actions = useSourceActions({onProblem});
  return (
    <>
      <Dialog
        title="새 예배"
        size="l"
        height={DIALOG_HEIGHT}
        onCancel={() => {
          if (!state.busy) onClose();
        }}
        primary={{
          label: '만들기',
          onSelect: state.create,
          disabled: !state.canCreate,
          title: state.name.trim() === '' ? NAME_NEEDED : undefined,
        }}
        aside={
          <SourceList
            templates={state.lists.templates}
            services={state.lists.services}
            selected={state.source}
            onSelect={state.choose}
            withEmpty
            onRetry={state.lists.failed ? state.lists.retry : undefined}
            onRowMenu={actions.openMenu}
          />
        }
        asideFoot={
          saveTemplate === undefined ? undefined : (
            <Button
              variant="ghost"
              icon="plus"
              disabled={saveTemplate.disabled}
              title={saveTemplate.reason}
              onClick={saveTemplate.onSave}
            >
              지금 예배를 템플릿으로 저장
            </Button>
          )
        }
        bottomBar={
          <>
            <DialogField label="이름">
              <TextField
                aria-label="이름"
                value={state.name}
                onChange={state.setName}
              />
            </DialogField>
            <DialogField label="날짜">
              <DateSelect
                aria-label="날짜"
                value={state.date}
                onChange={state.setDate}
              />
            </DialogField>
            <DialogField label="시간">
              <SelectMenu
                aria-label="시간"
                options={timeChoices(state.time)}
                value={state.time}
                onChange={state.setTime}
              />
            </DialogField>
          </>
        }
      >
        <SourceTree
          rows={state.rows}
          selection={state.selection}
          onChange={state.setSelection}
          empty={state.missing ? MISSING : undefined}
        />
      </Dialog>
      {actions.overlays}
    </>
  );
}
