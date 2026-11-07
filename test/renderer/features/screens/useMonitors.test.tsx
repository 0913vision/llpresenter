import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {MonitorList} from '@core/schema/monitors';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useMonitors} from '@renderer/features/screens/useMonitors';
import {
  LoadReadiness,
  LoadReadinessContext,
  usePaintedReadiness,
} from '@renderer/ui/loadReadiness';

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  cleanup();
  delete window.llp;
  if (originalFonts === undefined) Reflect.deleteProperty(document, 'fonts');
  else Object.defineProperty(document, 'fonts', originalFonts);
});

describe('monitor readiness in the prepared screen editor', () => {
  it.each(['loaded', 'failed'] as const)(
    'waits for a deferred monitor read (%s) and font layout',
    async outcome => {
      let release: (value: MonitorList) => void = () => undefined;
      let fail: (error: Error) => void = () => undefined;
      let finishFonts: () => void = () => undefined;
      const fonts = new Promise<void>(resolve => {
        finishFonts = resolve;
      });
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: {ready: fonts},
      });
      const monitors = new Promise<MonitorList>((resolve, reject) => {
        release = resolve;
        fail = reject;
      });
      window.llp = mockLlpApi({monitors: {get: () => monitors}});
      const readiness = new LoadReadiness();
      const onReady = vi.fn();
      renderHook(
        () => {
          useMonitors();
          usePaintedReadiness(readiness, onReady);
        },
        {
          wrapper: ({children}) => (
            <LoadReadinessContext value={readiness}>
              {children}
            </LoadReadinessContext>
          ),
        },
      );
      expect(readiness.getSnapshot()).toBe(1);
      expect(onReady).not.toHaveBeenCalled();
      await act(async () => {
        if (outcome === 'loaded') release([]);
        else fail(new Error('Monitor read failed'));
      });
      expect(readiness.getSnapshot()).toBe(0);
      expect(onReady).not.toHaveBeenCalled();
      await act(async () => finishFonts());
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    },
  );
});
