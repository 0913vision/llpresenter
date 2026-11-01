import {expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseMacroId} from '@core/schema/ids';
import {initialHistory} from '@main/live/history';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

it('drops the last 매크로 of an earlier session', () => {
  const lastMacroId = expectSuccess(
    parseMacroId('00000000-0000-4000-8000-000000000020'),
  );

  const {state} = initialHistory({...emptyLiveState(), lastMacroId});

  expect(state).not.toHaveProperty('lastMacroId');
  expect(state).toEqual(emptyLiveState());
});
