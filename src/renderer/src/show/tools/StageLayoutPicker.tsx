import {useContext, useState, type JSX} from 'react';
import type {StageLayout} from '@core/schema/stageLayouts';
import {Menu, Select} from '@renderer/ui';
import {WorkspaceNavigation} from '@renderer/state/WorkspaceNavigation';
import {useScreensSelection} from '@renderer/screens/selection';
import {stageLayoutMenuEntries} from './stageLayoutMenu';

export function StageLayoutPicker({
  id,
  label,
  layouts,
  value,
  reason,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly layouts: readonly StageLayout[] | null;
  readonly value: StageLayout['id'] | undefined;
  readonly reason: string | undefined;
  readonly onChange: (id: StageLayout['id']) => void;
}): JSX.Element {
  const navigate = useContext(WorkspaceNavigation);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const current = layouts?.find(layout => layout.id === value);
  const missing =
    layouts !== null && value !== undefined && current === undefined;
  return (
    <>
      <Select
        ref={setTrigger}
        id={id}
        aria-label={label}
        popup="menu"
        block
        value={
          current
            ? current.name || '이름 없음'
            : missing
              ? '삭제된 배치'
              : '없음'
        }
        title={reason ?? (missing ? '무대 배치를 찾을 수 없습니다' : undefined)}
        disabled={reason !== undefined}
        expanded={open}
        onExpandedChange={setOpen}
      />
      {open && trigger ? (
        <Menu
          label={label}
          anchor={{kind: 'element', element: trigger}}
          minWidth={trigger.getBoundingClientRect().width}
          entries={stageLayoutMenuEntries({
            layouts: layouts ?? [],
            value,
            onChange,
            onEdit:
              current && navigate
                ? () => {
                    useScreensSelection.getState().select('stage', current.id);
                    navigate('screens');
                  }
                : undefined,
          })}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
