import { onboardingStep, shouldHoldForOnboarding } from './onboarding';

const step = (over: Partial<Parameters<typeof onboardingStep>[0]> = {}) =>
  onboardingStep({ needsOnboarding: true, tripsLoaded: true, tripCount: 0, ...over });

describe('onboardingStep', () => {
  it('shows onboarding to someone with no record and nothing packed', () => {
    expect(step()).toBe('show');
  });

  it('skips it once the flag is set', () => {
    expect(step({ needsOnboarding: false })).toBe('skip');
  });

  /**
   * The bug this was extracted for. `onboardedAt` was added after people were already using the
   * app, so "no flag" caught every account that predated the field — and the rule meant to protect
   * returning users was the thing that ambushed them.
   */
  it('does not ask someone who already has trips', () => {
    expect(step({ needsOnboarding: true, tripCount: 3 })).toBe('backfill');
  });

  /**
   * Waiting is generous on purpose: every other answer causes a navigation, and a navigation made
   * on incomplete information is the whole bug. An unloaded trip list and an empty one look
   * identical from a count and mean opposite things.
   */
  it('waits while the profile is still loading', () => {
    expect(step({ needsOnboarding: undefined })).toBe('wait');
    expect(step({ needsOnboarding: undefined, tripCount: 5 })).toBe('wait');
  });

  it('waits while the trips are still loading, rather than assuming there are none', () => {
    expect(step({ tripsLoaded: false })).toBe('wait');
  });

  // Cheap, and it means the answer stops depending on evidence that could change.
  it('never asks a second time once backfilled', () => {
    expect(step({ needsOnboarding: false, tripCount: 0, tripsLoaded: false })).toBe('skip');
  });
});

/**
 * Which steps are safe to paint. `show` redirects from an effect, one frame after render, so
 * painting it puts an empty "no trips yet" screen on screen and takes it away again — which is what
 * flashed past on a cold open and reads as the app having lost everything.
 */
describe('shouldHoldForOnboarding', () => {
  it('holds while the answer is unknown', () => {
    expect(shouldHoldForOnboarding('wait')).toBe(true);
  });

  it('holds on a first run, which is on its way to the welcome flow', () => {
    expect(shouldHoldForOnboarding('show')).toBe(true);
  });

  it('paints a returning household being backfilled', () => {
    expect(shouldHoldForOnboarding('backfill')).toBe(false);
  });

  it('paints the normal case', () => {
    expect(shouldHoldForOnboarding('skip')).toBe(false);
  });
});
