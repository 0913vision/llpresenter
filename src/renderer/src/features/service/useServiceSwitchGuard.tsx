import {useState} from 'react';
import {isAnyOutputOn, hasAnyLayer, type LiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {AlertDialog} from '@renderer/ui/AlertDialog';

export function serviceChangeNeedsConfirmation(
  state: LiveState | null,
): boolean {
  return (
    state !== null &&
    isAnyOutputOn(state) &&
    (hasAnyLayer(state.layers) ||
      state.themeItem != null ||
      state.blackScreen === true ||
      (state.testPatterns?.length ?? 0) > 0 ||
      (state.stageMessage?.trim().length ?? 0) > 0)
  );
}

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
        title={'\uc608\ubc30\ub97c \ubc14\uafc0\uae4c\uc694?'}
        meta={[
          '\ubaa8\ub4e0 \ud654\uba74\uc774 \ub300\uae30 \ud654\uba74\uc73c\ub85c \ubc14\ub00c\ub2c8\ub2e4.',
        ]}
        initialFocus="cancel"
        onCancel={() => setPending(null)}
        actions={[
          {
            label: '\ubc14\uafb8\uae30',
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
