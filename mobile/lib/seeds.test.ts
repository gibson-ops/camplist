import {
  ACTIVITY_POOL,
  CONDITION_POOL,
  LODGING,
  SEED_BUDGET,
  TRAVEL,
  TRIP_TYPES,
  seedsFor,
  suggestedTags,
} from './seeds';
import { slugify } from './tripMeta';

describe('seeds', () => {
  /**
   * These lists are SEEDS, not definitions. They exist to make the first trip useful before
   * there's any history, and to keep a household's spellings converging — not to enumerate
   * every way a person can travel or sleep somewhere. No such list finishes.
   */
  it('are stored and offered as labels, never as ids', () => {
    for (const seeds of [TRIP_TYPES, TRAVEL, LODGING]) {
      for (const value of seeds) expect(value).toMatch(/^[A-Z]/);
    }
  });

  it('hold no duplicate spellings within an axis', () => {
    for (const seeds of [TRIP_TYPES, TRAVEL, LODGING]) {
      expect(new Set(seeds.map(slugify)).size).toBe(seeds.length);
    }
  });

  it('narrow lodging to what suits the trip type', () => {
    expect(seedsFor('lodgings', 'Camping')).toContain('Tent');
    expect(seedsFor('lodgings', 'Camping')).not.toContain('Hotel');
    expect(seedsFor('lodgings', 'Work')).toContain('Hotel');
    expect(seedsFor('lodgings', 'Work')).not.toContain('Tent');
  });

  // Keyed on the slug, so the household's own capitalisation still finds its seeds.
  it('find their seeds however the trip type is spelled', () => {
    expect(seedsFor('activities', 'visiting people')).toEqual(
      seedsFor('activities', 'Visiting people'),
    );
    expect(seedsFor('activities', 'CAMPING')).toEqual(seedsFor('activities', 'Camping'));
  });

  /**
   * THE FALLBACK IS WHAT LETS THE TYPE AXIS BE OPEN AT ALL. A trip type nobody wrote a list
   * for — a festival, a tournament, a funeral — has to come back with something usable rather
   * than an empty row, and the household's own history takes over from the second trip.
   */
  it('fall back rather than coming back empty for a type nobody seeded', () => {
    for (const kind of ['lodgings', 'activities', 'conditions'] as const) {
      expect(seedsFor(kind, 'Festival').length).toBeGreaterThan(0);
      expect(seedsFor(kind, undefined).length).toBeGreaterThan(0);
    }
  });

  it('offer every seeded trip type somewhere to sleep', () => {
    for (const type of TRIP_TYPES) {
      expect(seedsFor('lodgings', type).length).toBeGreaterThan(0);
    }
  });

  // A wall of chips is what this replaced. Six-ish per axis is the budget.
  it('keep every default row short', () => {
    for (const type of [...TRIP_TYPES, 'Festival', undefined]) {
      for (const kind of ['lodgings', 'activities', 'conditions'] as const) {
        expect(seedsFor(kind, type).length).toBeLessThanOrEqual(7);
      }
    }
  });
});

describe('suggestedTags', () => {
  it('offers what suits the trip type', () => {
    expect(suggestedTags('activities', 'Work', [])).toContain('Presenting');
    expect(suggestedTags('activities', 'Camping', [])).toContain('Fishing');
  });

  /**
   * Changing the trip type may change what ELSE is on offer, but it can never hide something
   * already picked — that would silently drop an answer the moment a type got corrected.
   */
  it('always shows what is already selected, however off-type it is', () => {
    const shown = suggestedTags('activities', 'Work', ['Rockhounding']);
    expect(shown[0]).toBe('Rockhounding');
  });

  it('does not show a selected tag twice when it is also a default', () => {
    const shown = suggestedTags('activities', 'Camping', ['Fishing']);
    expect(shown.filter((tag) => tag === 'Fishing')).toHaveLength(1);
  });

  // Camping is the center of gravity, so an undescribed trip gets camping's list rather than
  // an empty one. See PRODUCT.md.
  it('falls back to a generic list rather than an empty one', () => {
    expect(suggestedTags('activities', undefined, []).length).toBeGreaterThan(0);
    expect(suggestedTags('activities', 'Festival', []).length).toBeGreaterThan(0);
  });

  // A wall of chips is what this replaced. Six-ish per type is the budget.
  it('keeps the default row short', () => {
    for (const type of TRIP_TYPES) {
      expect(suggestedTags('activities', type, []).length).toBeLessThanOrEqual(7);
      expect(suggestedTags('conditions', type, []).length).toBeLessThanOrEqual(7);
    }
  });
});

describe('tag pools', () => {
  it('contain every default plus the browse-only extras', () => {
    for (const type of TRIP_TYPES) {
      for (const tag of suggestedTags('activities', type, [])) {
        expect(ACTIVITY_POOL).toContain(tag);
      }
      for (const tag of suggestedTags('conditions', type, [])) {
        expect(CONDITION_POOL).toContain(tag);
      }
    }
  });

  it('hold no duplicate spellings', () => {
    for (const pool of [ACTIVITY_POOL, CONDITION_POOL]) {
      expect(new Set(pool.map(slugify)).size).toBe(pool.length);
    }
  });
});

describe('the six-chip budget', () => {
  /**
   * The funnel exists to keep a row short. A fallback that dumps the whole pool would break
   * exactly the rule it's backstopping — which is how the lodging fallback was caught.
   */
  it('holds for every axis, seeded type or not', () => {
    for (const type of [...TRIP_TYPES, 'Festival', 'Funeral', '', undefined]) {
      for (const kind of ['lodgings', 'activities', 'conditions'] as const) {
        const seeds = seedsFor(kind, type);
        expect(seeds.length).toBeGreaterThan(0);
        expect(seeds.length).toBeLessThanOrEqual(6);
      }
    }
  });

  // Selected tags are additive on top of the budget: they can never be hidden, so a trip with
  // ten activities shows ten. The budget governs SEEDS, not what the user has answered.
  it('does not cap what the user has already picked', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    expect(suggestedTags('activities', 'Camping', many).slice(0, many.length)).toEqual(many);
  });
});

describe('seed rules', () => {
  const winter = new Date(2027, 0, 15, 12);
  const summer = new Date(2027, 6, 15, 12);

  /**
   * THE REASON RULES EXIST. A per-type lookup can't see any of this: flying has nothing to do
   * with where you sleep and everything to do with what you're allowed to pack.
   */
  it('reads what flying costs you', () => {
    const conditions = seedsFor('conditions', { tripTypes: ['Vacation'], travelModes: ['Flying'] });
    expect(conditions).toContain('Long flight');
    expect(conditions).not.toContain('No hookups');

    const activities = seedsFor('activities', { tripTypes: ['Camping'], travelModes: ['Flying'] });
    expect(activities).not.toContain('Real cooking');
  });

  it('reads what you can carry when it is all on your back', () => {
    const activities = seedsFor('activities', { tripTypes: ['Camping'], lodgings: ['Backpacking'] });
    expect(activities).not.toContain('Real cooking');

    const conditions = seedsFor('conditions', { tripTypes: ['Camping'], lodgings: ['Backpacking'] });
    expect(conditions).toContain('No water source');
  });

  it('retires the campsite worries once there is a front desk', () => {
    const conditions = seedsFor('conditions', { tripTypes: ['Vacation'], lodgings: ['Hotel'] });
    expect(conditions).not.toContain('Bear country');
    expect(conditions).not.toContain('Fire ban');
    expect(conditions).toContain('Laundry available');
  });

  // Season is derived from the departure date, so this fires the moment dates get picked.
  it('turns the dates into weather', () => {
    const cold = seedsFor('conditions', { tripTypes: ['Camping'], departAt: winter });
    expect(cold).toContain('Snow');
    expect(cold).not.toContain('Buggy');

    const hot = seedsFor('conditions', { tripTypes: ['Camping'], departAt: summer });
    expect(hot).toContain('Hot days');
    expect(hot).not.toContain('Snow');
  });

  it('turns the dates into plausible activities', () => {
    expect(seedsFor('activities', { tripTypes: ['Vacation'], departAt: winter })).toContain('Skiing');
    expect(seedsFor('activities', { tripTypes: ['Vacation'], departAt: summer })).not.toContain(
      'Skiing',
    );
  });

  it('notices a trip long enough to run out of clean clothes', () => {
    const long = seedsFor('conditions', {
      tripTypes: ['Vacation'],
      departAt: new Date(2027, 6, 1, 12),
      returnAt: new Date(2027, 6, 12, 12),
    });
    expect(long).toContain('No laundry');

    const short = seedsFor('conditions', {
      tripTypes: ['Vacation'],
      departAt: new Date(2027, 6, 1, 12),
      returnAt: new Date(2027, 6, 3, 12),
    });
    expect(short).not.toContain('No laundry');
  });

  /**
   * A DROP IS DE-PRIORITIZATION, NOT A BAN. Everything a rule demotes stays in the pool and
   * stays one tap away behind the `+`. A rule that's slightly wrong should cost an extra tap,
   * never make something unreachable — that's the wall this whole design removed.
   */
  it('never makes a dropped value unreachable', () => {
    const flying = { tripTypes: ['Camping'], travelModes: ['Flying'], lodgings: ['Hotel'] };
    for (const dropped of ['No hookups', 'Fire ban', 'Bear country']) {
      expect(seedsFor('conditions', flying)).not.toContain(dropped);
      expect(CONDITION_POOL).toContain(dropped);
    }
    expect(seedsFor('activities', flying)).not.toContain('Real cooking');
    expect(ACTIVITY_POOL).toContain('Real cooking');
  });

  // Rules disagree all the time — a winter hotel is both "cold nights" and "not a campsite".
  // An explicit add outranks a drop, because the rule that added it fired on a real signal.
  it('lets an explicit add win over another rule’s drop', () => {
    const conditions = seedsFor('conditions', {
      tripTypes: ['Vacation'],
      lodgings: ['Hotel'],
      departAt: winter,
    });
    expect(conditions).toContain('Cold nights');
  });

  // Every rule is independent and any of them may fail to fire. That's what makes an
  // under-described trip degrade quietly instead of breaking.
  it('still produces a usable row when nothing is known', () => {
    for (const kind of ['activities', 'conditions'] as const) {
      const seeds = seedsFor(kind, {});
      expect(seeds.length).toBeGreaterThan(0);
      expect(seeds.length).toBeLessThanOrEqual(SEED_BUDGET);
    }
  });

  it('holds the budget no matter how many rules fire at once', () => {
    const loaded = {
      tripTypes: ['Camping'],
      travelModes: ['Flying'],
      lodgings: ['Backpacking'],
      departAt: winter,
      returnAt: new Date(2027, 0, 30, 12),
    };
    for (const kind of ['activities', 'conditions'] as const) {
      expect(seedsFor(kind, loaded).length).toBeLessThanOrEqual(SEED_BUDGET);
    }
  });

  it('only ever seeds values the pools contain', () => {
    const contexts = [
      { tripTypes: ['Camping'], travelModes: ['Flying'] },
      { tripTypes: ['Vacation'], lodgings: ['Hotel'], departAt: winter },
      { tripTypes: ['Festival'], lodgings: ['Backpacking'], departAt: summer },
      {},
    ];
    for (const ctx of contexts) {
      for (const tag of seedsFor('activities', ctx)) expect(ACTIVITY_POOL).toContain(tag);
      for (const tag of seedsFor('conditions', ctx)) expect(CONDITION_POOL).toContain(tag);
    }
  });
});

describe('chip order', () => {
  /**
   * Tapping a chip must not yank it out from under the finger that just hit it. On a
   * single-value axis every option is on screen anyway, so pulling the selection to the front
   * buys nothing and costs a jump.
   */
  it('leaves a selected seed where it already sat', () => {
    const seeds = seedsFor('travelModes', {});
    const selectedSecond = seeds[1];

    expect(suggestedTags('travelModes', {}, [selectedSecond])).toEqual(seeds);
  });

  // The guarantee that made it selected-first in the first place: an answer the seeds don't
  // cover has to stay visible, and the front is where it goes.
  it('pulls an unseeded selection to the front', () => {
    const shown = suggestedTags('lodgings', { tripTypes: ['Camping'] }, ['Yurt']);
    expect(shown[0]).toBe('Yurt');
  });

  it('shows every selection somewhere, seeded or not', () => {
    const shown = suggestedTags('activities', { tripTypes: ['Work'] }, ['Rockhounding', 'Presenting']);
    expect(shown).toContain('Rockhounding');
    expect(shown).toContain('Presenting');
  });

  it('never repeats a tag that is both selected and seeded', () => {
    const shown = suggestedTags('activities', { tripTypes: ['Camping'] }, ['Fishing']);
    expect(shown.filter((tag) => tag === 'Fishing')).toHaveLength(1);
  });
});

describe('seed rules with more than one value on an axis', () => {
  /**
   * A TRIP HAS LEGS. Drive out and fly back; a tent one night and a spare room the next. The
   * rules have to weaken rather than compound when an axis says more than one thing.
   */
  it('unions the adds — every leg contributes what it needs', () => {
    const conditions = seedsFor('conditions', {
      tripTypes: ['Camping'],
      travelModes: ['Driving', 'Flying'],
      departAt: new Date(2027, 6, 1, 12),
      returnAt: new Date(2027, 6, 4, 12),
    });

    expect(conditions).toContain('Long flight');
    expect(conditions).toContain('Long drive');
  });

  /**
   * THE RULE MULTI-SELECT EXISTS FOR. Flying drops the stove — but not when you're also
   * driving, because the driving leg still wants it. A drop only fires when its axis has
   * nothing else to say.
   */
  it('withholds a drop when the axis says something else too', () => {
    const flyingOnly = { tripTypes: ['Camping'], travelModes: ['Flying'] };
    const bothLegs = { tripTypes: ['Camping'], travelModes: ['Driving', 'Flying'] };

    expect(seedsFor('activities', flyingOnly)).not.toContain('Real cooking');
    expect(seedsFor('activities', bothLegs)).toContain('Real cooking');
  });

  /**
   * Asserted as "how many of the dropped set survive" rather than naming one, because the
   * six-chip budget also cuts the tail — a named survivor can fall off for a reason that has
   * nothing to do with the rule under test.
   */
  it('withholds a lodging drop the same way', () => {
    const campsiteOnly = ['No hookups', 'Fire ban', 'Bear country', 'No water source', 'Cold nights'];
    const survivors = (ctx: Parameters<typeof seedsFor>[1]) =>
      seedsFor('conditions', ctx).filter((tag) => campsiteOnly.includes(tag)).length;

    const hotelOnly = survivors({ tripTypes: ['Camping'], lodgings: ['Hotel'] });
    const hotelAndTent = survivors({ tripTypes: ['Camping'], lodgings: ['Hotel', 'Tent'] });

    expect(hotelOnly).toBe(0);
    expect(hotelAndTent).toBeGreaterThan(0);
  });

  // Season comes from a single departure date, so its drops never need unanimity.
  it('still drops on axes that can only hold one thing', () => {
    const winter = { tripTypes: ['Camping'], departAt: new Date(2027, 0, 15, 12) };
    expect(seedsFor('conditions', winter)).not.toContain('Buggy');
  });

  /**
   * Interleaved, not concatenated. Taking the first six from the first type alone would be a
   * trip type the user picked and the app ignored.
   */
  it('gives every chosen trip type a share of the seeds', () => {
    const seeds = seedsFor('activities', { tripTypes: ['Camping', 'Work'] });
    const camping = seedsFor('activities', { tripTypes: ['Camping'] });
    const work = seedsFor('activities', { tripTypes: ['Work'] });

    expect(seeds.some((tag) => camping.includes(tag))).toBe(true);
    expect(seeds.some((tag) => work.includes(tag))).toBe(true);
  });

  it('holds the six-chip budget however many types are chosen', () => {
    for (const kind of ['lodgings', 'activities', 'conditions'] as const) {
      const seeds = seedsFor(kind, { tripTypes: ['Camping', 'Work', 'Vacation', 'Event'] });
      expect(seeds.length).toBeGreaterThan(0);
      expect(seeds.length).toBeLessThanOrEqual(SEED_BUDGET);
    }
  });

  it('falls back when none of the chosen types were seeded', () => {
    const seeds = seedsFor('activities', { tripTypes: ['Festival', 'Pilgrimage'] });
    expect(seeds.length).toBeGreaterThan(0);
  });
});
