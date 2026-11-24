import {useState} from 'react';
import {
  isAnyOutputOn,
  hasAnyLayer,
  type LiveState,
} from '@core/schema/live/live';
import {useLive} from '@renderer/session/live';
import {AlertDialog} from '@renderer/ui/popups/AlertDialog';
import {objectParticle} from '@renderer/ui/text/korean';

/**
 * Whether leaving the open service needs a confirmation: something is on air.
 */
export function serviceChangeNeedsConfirmation(
  state: LiveState | null,
): boolean {
  return (
    state !== null &&
    isAnyOutputOn(state) &&
    (hasAnyLayer(state.layers) ||
      state.item != null ||
      state.blackScreen === true ||
      (state.testPatterns?.length ?? 0) > 0 ||
      (state.stageMessage?.trim().length ?? 0) > 0)
  );
}

/**
 * Holds a request to open or create a service and asks for confirmation first
 * when something is on air; otherwise it goes on at once.
 */
export function useServiceSwitchGuard() {
  const [pending, setPending] = useState<{
    readonly kind: 'open' | 'create';
    readonly name: string;
    readonly proceed: () => void;
  } | null>(null);
  const request = (
    target:
      | {readonly kind: 'open'; readonly name: string}
      | {readonly kind: 'create'},
    proceed: () => void,
  ): void => {
    if (serviceChangeNeedsConfirmation(useLive.getState().state)) {
      setPending({
        kind: target.kind,
        name: target.kind === 'open' ? target.name : '',
        proceed,
      });
    } else proceed();
  };
  const dialog =
    pending === null ? null : (
      <AlertDialog
        icon="warning"
        title={
          pending.kind === 'open'
            ? `‘${pending.name}’${objectParticle(pending.name)} 열까요?`
            : '새 예배를 만들까요?'
        }
        meta={['모든 화면이 대기 화면으로 바뀝니다.']}
        initialFocus="cancel"
        onCancel={() => setPending(null)}
        actions={[
          {
            label: pending.kind === 'open' ? '열기' : '만들기',
            primary: true,
            onSelect: () => {
              setPending(null);
              pending.proceed();
            },
          },
        ]}
      />
    );
  return {request, dialog};
}
