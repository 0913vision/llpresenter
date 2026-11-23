import type {JSX} from 'react';
import {clearButtons, type ClearButtonSpec} from '@core/live';
import {
  clearLayer,
  toggleItem,
  undoClear,
  useCanUndo,
  useClearRestores,
  useSomethingToClear,
} from '@renderer/session/clear';
import {useLive} from '@renderer/session/live';
import {
  ClearButton,
  ClearGroup,
  ClearRow as Row,
} from '@renderer/ui/ClearButton';

function StandbyButton(): JSX.Element {
  const hasItem = useLive(
    view =>
      view.state?.item != null || (view.state?.testPatterns?.length ?? 0) > 0,
  );
  const restores = useLive(
    view =>
      (view.state?.testPatterns?.length ?? 0) === 0 &&
      (view.state?.canRestoreItem ?? false),
  );
  return (
    <ClearButton
      name="대기 화면"
      icon="slides"
      label={restores ? '항목 되돌리기' : '대기 화면으로'}
      command="item.stop"
      active={hasItem || restores}
      restores={restores}
      onPress={toggleItem}
    />
  );
}

function LayerButton({spec}: {readonly spec: ClearButtonSpec}): JSX.Element {
  const restores = useClearRestores(spec.target);
  return (
    <ClearButton
      name={spec.label}
      icon={spec.icon}
      label={`${spec.label} ${restores ? '되돌리기' : '지우기'}`}
      command={spec.command}
      active={useSomethingToClear(spec.target)}
      restores={restores}
      onPress={() => clearLayer(spec.target)}
    />
  );
}

// NOTE(0913vision): 되돌리기 is always in the row, off while there is nothing to
// bring back, like the buttons that have nothing to clear. Showing it only
// when it can act made the other buttons shrink and move under the operator's
// hand (design README, principle 6).
function UndoButton(): JSX.Element {
  return (
    <ClearButton
      name="되돌리기"
      icon="undo"
      label="되돌리기"
      command="clear.undo"
      active={useCanUndo()}
      onPress={undoClear}
    />
  );
}

/** The 지우기 row of 진행, on the live output. */
export function ClearRow({compact}: {readonly compact: boolean}): JSX.Element {
  return (
    <Row compact={compact}>
      <StandbyButton />
      <ClearGroup>
        {clearButtons.map(spec => (
          <LayerButton key={spec.target} spec={spec} />
        ))}
      </ClearGroup>
      <UndoButton />
    </Row>
  );
}
