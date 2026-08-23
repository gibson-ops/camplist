// lib/db throws at import time without EXPO_PUBLIC_INSTANT_APP_ID, and would open a real socket
// if it didn't. Nothing here touches it — these are pure predicates from the same module.
jest.mock('./db', () => ({ db: { auth: {}, useAuth: () => ({}) }, id: () => 'id' }));

import { isGuestUser } from './useSession';

describe('isGuestUser', () => {
  /**
   * The reason this function exists rather than reading `user.isGuest` at the call site.
   *
   * Instant declares `isGuest: boolean` on its public User type and never assigns it — every
   * check inside the SDK is `type === 'guest'`. So the obvious field is always undefined, and
   * every guest alive reads as signed up. That's invisible until a screen quietly shows the
   * wrong thing to everyone who hasn't made an account.
   */
  it('reads the field Instant actually sets, not the one it documents', () => {
    expect(isGuestUser({ type: 'guest' })).toBe(true);
  });

  it('still works if Instant ever starts filling in isGuest', () => {
    expect(isGuestUser({ isGuest: true })).toBe(true);
  });

  it('is false for a real account', () => {
    expect(isGuestUser({ type: 'user' })).toBe(false);
    expect(isGuestUser({ type: 'user', isGuest: false })).toBe(false);
  });

  it('is false when there is no session at all', () => {
    expect(isGuestUser(undefined)).toBe(false);
    expect(isGuestUser(null)).toBe(false);
  });

  // A user object carrying neither field is not evidence of a guest. Guessing the other way
  // would offer "sign in to keep your trips" to someone who already had.
  it('does not assume guest from an unfamiliar shape', () => {
    expect(isGuestUser({})).toBe(false);
  });
});
