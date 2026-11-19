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
  const [pending, setPending] = useState<(() => void) | null>(null);
  const request = (proceed: () => void): void => {
    if (serviceChangeNeedsConfirmation(useLive.getState().state)) {
      setPending(() => proceed);
    } else proceed();
  };
  const dialog =
    pending === null ? null : (
      <AlertDialog
        icon="warning"
        title={'\uc608\ubc30\ub97c \ubc14\uafc0\uae4c\uc694?'}
        meta={[
          '\uc9c0\uae08 \uc1a1\ucd9c \uc911\uc785\ub2c8\ub2e4. \uc608\ubc30\ub97c \ubc14\uafb8\uba74 \uccad\uc911, \ubb34\ub300, \ubc29\uc1a1 \ud654\uba74\uc774 \ubaa8\ub450 \ub300\uae30 \ud654\uba74\uc73c\ub85c \ubc14\ub00c\ub2c8\ub2e4.',
        ]}
        initialFocus="cancel"
        onCancel={() => setPending(null)}
        actions={[
          {
            label: '\ubc14\uafb8\uae30',
            primary: true,
            onSelect: () => {
              setPending(null);
              pending();
            },
          },
        ]}
      />
    );
  return {request, dialog};
}
