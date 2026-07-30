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
  /**
   * `db.tx.profiles[someId].update({...}).link({...})` — chainable, and it RECORDS.
   *
   * A transaction that writes the wrong thing is as much a bug as one that does not run, and the
   * difference between repairing a profile and overwriting somebody's name is visible only in what
   * the chain was asked to do. So each subscript returns a fresh recorder rather than one shared
   * inert object.
   */
  const recorder = (entityId: string) => {
    const rec = {
      id: entityId,
      updates: [] as unknown[],
      links: [] as unknown[],
      update(value: unknown) {
        rec.updates.push(value);
        return rec;
      },
      link(value: unknown) {
        rec.links.push(value);
        return rec;
      },
    };
    return rec;
  };

  const state = {
    query: { isLoading: true } as { data?: unknown; isLoading: boolean },
    // 'authenticated' is the only status that means the server has answered; tests that care
    // override it.
    status: 'authenticated',
    transact: jest.fn(() => Promise.resolve()),
  };

  return {
    __state: state,
    db: {
      auth: {},
      useAuth: () => ({}),
      useQuery: () => state.query,
      useConnectionStatus: () => state.status,
      transact: (...args: unknown[]) => state.transact(...(args as [])),
      tx: new Proxy(
        {},
        { get: () => new Proxy({}, { get: (_entity, entityId: string) => recorder(entityId) }) },
      ),
    },
    id: () => 'generated-id',
  };
});

import { renderHook } from '@testing-library/react-native';
import { useHousehold } from './useSession';

const { __state: state } = jest.requireMock('./db') as {
  __state: {
    query: { data?: unknown; isLoading: boolean };
    status: string;
    transact: jest.Mock;
  };
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
    state.status = 'authenticated';
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

  /**
   * THE ONE THAT EXPLAINS THE ERROR ON JARED'S PHONE.
   *
   * Instant answers from its local store first and reconciles with the server after, so a cold page
   * load reports `isLoading: false` with an empty result — indistinguishable from "no household".
   * Writing then meant a device that had had a household for weeks tried to make another one on
   * every single load, which is why the error appeared on a phone with its lists right behind it.
   */
  it('does not write on a cache-only answer, before the server has spoken', async () => {
    state.status = 'connecting';
    state.query = fresh();
    await renderHook(() => useHousehold(someone()));
    expect(state.transact).not.toHaveBeenCalled();
  });

  it('writes once the connection reaches authenticated', async () => {
    const late = someone();
    state.status = 'opened';
    state.query = fresh();
    const { rerender } = await renderHook(() => useHousehold(late));
    expect(state.transact).not.toHaveBeenCalled();

    state.status = 'authenticated';
    state.query = fresh();
    await rerender(undefined);
    expect(state.transact).toHaveBeenCalledTimes(1);
  });

  /**
   * Repairing a missing household must not rewrite the person doing the repairing.
   *
   * A profile that exists gets the household link and nothing else: re-running
   * `update({ name: 'Me' })` would rename somebody who had set their real name, and re-linking
   * `$user` on a profile that already has it trips the unique attribute.
   */
  it('adds only the household link to a profile that already exists', async () => {
    state.query = {
      data: { profiles: [{ id: 'p-existing', households: [], onboardedAt: null }] },
      isLoading: false,
    };

    await renderHook(() => useHousehold(someone()));

    expect(state.transact).toHaveBeenCalledTimes(1);
    const [ops] = state.transact.mock.calls[0] as [
      { id: string; updates: unknown[]; links: unknown[] }[],
    ];

    expect(ops[0].id).toBe('p-existing');
    // No `update`, so no name is rewritten; no `$user`, so the unique attribute is left alone.
    expect(ops[0].updates).toEqual([]);
    expect(ops[0].links).toEqual([{ households: 'generated-id' }]);
  });

  it('gives a brand new profile its name and its $user link', async () => {
    state.query = fresh();
    const userId = someone();

    await renderHook(() => useHousehold(userId));

    const [ops] = state.transact.mock.calls[0] as [
      { id: string; updates: unknown[]; links: unknown[] }[],
    ];
    expect(ops[0].updates).toEqual([{ name: 'Me', createdAt: expect.any(Date) }]);
    expect(ops[0].links).toEqual([{ $user: userId }, { households: 'generated-id' }]);
  });
});
