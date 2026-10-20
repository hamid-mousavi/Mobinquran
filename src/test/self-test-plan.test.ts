import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SELF_TEST_OPTIONS,
  tallySelfTest,
  turnFor,
  userTurnCount,
} from '../services/memorization/selfTestPlan';

describe('selfTestPlan', () => {
  it('assigns turns for every turn mode', () => {
    expect([0, 1, 2, 3].map((i) => turnFor(i, 'all_me'))).toEqual(['user', 'user', 'user', 'user']);
    expect([0, 1, 2, 3].map((i) => turnFor(i, 'system_first'))).toEqual(['system', 'user', 'system', 'user']);
    expect([0, 1, 2, 3].map((i) => turnFor(i, 'me_first'))).toEqual(['user', 'system', 'user', 'system']);
  });

  it('counts the ayahs that are really the user\'s turn', () => {
    expect(userTurnCount(7, 'all_me')).toBe(7);
    expect(userTurnCount(7, 'system_first')).toBe(3);
    expect(userTurnCount(7, 'me_first')).toBe(4);
    expect(userTurnCount(0, 'me_first')).toBe(0);
  });

  it('tallies verdicts', () => {
    expect(tallySelfTest([])).toEqual({ tested: 0, memorized: 0, review: 0, percent: 0 });
    expect(
      tallySelfTest([
        { verseNumber: 1, verdict: 'memorized' },
        { verseNumber: 2, verdict: 'review' },
        { verseNumber: 3, verdict: 'memorized' },
      ])
    ).toEqual({ tested: 3, memorized: 2, review: 1, percent: 67 });
  });

  it('defaults keep the safe self-assessment path and hide the user text', () => {
    expect(DEFAULT_SELF_TEST_OPTIONS.answerMethod).toBe('self');
    expect(DEFAULT_SELF_TEST_OPTIONS.hideUserText).toBe(true);
  });
});
