import {describe, expect, it} from 'vitest';
import {installMockClock} from '../../../test/mock-clock';
import {CRASH_LIMIT, CRASH_PERIOD_MS, RestartBudget} from './restartBudget';

function crashTimes(budget: RestartBudget, count: number): boolean[] {
  return Array.from({length: count}, () => budget.recordCrash());
}

describe('RestartBudget', () => {
  it('stops restarting at the crash that reaches the limit within the period', () => {
    installMockClock();
    const budget = new RestartBudget();
    expect(crashTimes(budget, CRASH_LIMIT)).toEqual([true, true, false]);
  });

  it('forgets crashes older than the period', async () => {
    const clock = installMockClock();
    const budget = new RestartBudget();
    crashTimes(budget, CRASH_LIMIT - 1);
    await clock.advance(CRASH_PERIOD_MS);
    expect(budget.recordCrash()).toBe(true);
  });

  it('starts over after a reset', () => {
    installMockClock();
    const budget = new RestartBudget();
    crashTimes(budget, CRASH_LIMIT);
    budget.reset();
    expect(budget.recordCrash()).toBe(true);
  });
});
