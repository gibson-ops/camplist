/**
 * First-launch bootstrap: the one path every brand-new client runs exactly once, and therefore the
 * one nobody notices is broken.
 *
 * Separate file from `useSession.test.ts` because that one mocks `./db` down to a stub for pure
 * predicates, and a module gets one mock per file.
 *
 * The mock owns its own mutable state and hands it back through `__state`, rather than closing over
 * test-file variables. `jest.mock` is hoisted above the imports, so a `const` it captured would be
 * in its temporal dead zone and a `var` carrying a type annotation does not survive the transform.
 * Reading the state off the mocked module sidesteps both.
 */
jest.mock('./db', () => {
  // `db.tx.profiles[someId].update({...}).link({...})` — chainable and inert.
  const chain: Record<string, unknown> = {};
  chain.update = () => chain;
  chain.link = () => chain;

  const state = {
    query: { isLoading: true } as { data?: unknown; isLoading: boolean },
    transact: jest.fn(() => Promise.resolve()),
  };

  return {
    __state: state,
    db: {
      auth: {},
      useAuth: () => ({}),
      useQuery: () => state.query,
      transact: (...args: unknown[]) => state.transact(...(args as [])),
      tx: new Proxy({}, { get: () => new Proxy({}, { get: () => chain }) }),
    },
    id: () => 'generated-id',
  };
});

import { renderHook } from '@testing-library/react-native';
import { useHousehold } from './useSession';

const { __state: state } = jest.requireMock('./db') as {
  __state: { query: { data?: unknown; isLoading: boolean }; transact: jest.Mock };
};

/** A resolved query that found no profile — a client that has never written anything. */
const fresh = () => ({ data: { profiles: [] }, isLoading: false });

/** A resolved query that found a profile with a household — a returning client. */
const settled = () => ({
  data: { profiles: [{ id: 'p1', households: [{ id: 'h1' }], onboardedAt: null }] },
  isLoading: false,
});

/**
 * The guard is module state, so every test needs an identity of its own or the second one to run
 * finds the first one's key already set. Using a distinct id per test is what keeps them
 * order-independent — cheaper and less invasive than exporting a reset just for the suite.
 */
let nextUser = 0;
const someone = () => `user-${++nextUser}`;

describe('useHousehold', () => {
  beforeEach(() => {
    state.transact.mockClear();
    state.transact.mockImplementation(() => Promise.resolve());
  });

  it('waits for the query before writing anything', async () => {
    state.query = { isLoading: true };
    await renderHook(() => useHousehold(someone()));
    expect(state.transact).not.toHaveBeenCalled();
  });

  it('does nothing at all until there is a signed-in identity', async () => {
    state.query = fresh();
    await renderHook(() => useHousehold(undefined));
    expect(state.transact).not.toHaveBeenCalled();
  });

  it('creates the household for a client that has none', async () => {
    state.query = fresh();
    await renderHook(() => useHousehold(someone()));
    expect(state.transact).toHaveBeenCalledTimes(1);
  });

  /**
   * THE ONE THAT CAUGHT THE REAL BUG, and the reason the guard is module state rather than a ref.
   *
   * `useHousehold` has nine call sites and the first screen mounts two of them at once —
   * `useStrandedRecorder` at the app root and the screen itself. Each instance had its own ref, so
   * both saw no household, both wrote, and the second collided with the profile the first had just
   * created. Every genuinely new client met that error on first launch.
   */
  it('writes once even when two components ask at the same time', async () => {
    const shared = someone();
    state.query = fresh();

    await renderHook(() => {
      useHousehold(shared);
      useHousehold(shared);
      return null;
    });

    expect(state.transact).toHaveBeenCalledTimes(1);
  });

  it('still bootstraps a different identity', async () => {
    state.query = fresh();
    await renderHook(() => useHousehold(someone()));
    state.transact.mockClear();

    state.query = fresh();
    await renderHook(() => useHousehold(someone()));
    expect(state.transact).toHaveBeenCalledTimes(1);
  });

  /**
   * THE REGRESSION THIS FILE EXISTS FOR.
   *
   * The write lands before the query reflects it, so there is a window where the bootstrap has
   * already succeeded and `household` is still undefined. Releasing the guard in a `finally` meant
   * the next query update re-entered the effect inside that window, minted a second profile id and
   * collided with the profile just created — `$user` is unique on `profiles`. Measured on a freshly
   * cleared browser: one error on first launch, none on any reload after.
   */
  it('does not write a second time while the query catches up', async () => {
    const shared = someone();
    state.query = fresh();
    const { rerender } = await renderHook(() => useHousehold(shared));
    expect(state.transact).toHaveBeenCalledTimes(1);

    // A new result object still reporting no household: the state that used to re-trigger.
    state.query = fresh();
    await rerender(undefined);

    expect(state.transact).toHaveBeenCalledTimes(1);
  });

  /** A failure has to stay retryable, or one dropped connection leaves an account with no home. */
  it('tries again after a failed write', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    state.transact.mockImplementation(() => Promise.reject(new Error('offline')));
    const retried = someone();
    state.query = fresh();

    const { rerender } = await renderHook(() => useHousehold(retried));
    expect(state.transact).toHaveBeenCalledTimes(1);

    state.transact.mockImplementation(() => Promise.resolve());
    state.query = fresh();
    await rerender(undefined);

    expect(state.transact).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('leaves a returning client alone', async () => {
    state.query = settled();
    const { result } = await renderHook(() => useHousehold(someone()));
    expect(state.transact).not.toHaveBeenCalled();
    expect(result.current.householdId).toBe('h1');
  });
});
