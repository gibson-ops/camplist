import { SUGGESTION_BUDGET, dismissedNames, suggestItems } from './itemSeeds';

const ctx = (over: Partial<Parameters<typeof suggestItems>[0]> = {}) => ({
  tags: [],
  onList: [],
  dismissed: [],
  ...over,
});

const names = (tags: string[], over = {}) => suggestItems(ctx({ tags, ...over })).map((s) => s.name);

describe('suggestItems', () => {
  /**
   * THE POINT OF THE METADATA. Every chip picked on the details screen has to turn into gear,
   * or the form was busywork.
   */
  it('turns a tag into the gear it implies', () => {
    expect(names(['Fishing'])).toContain('Rod and reel');
    expect(names(['Tent'])).toContain('Sleeping bag');
    expect(names(['Cold nights'])).toContain('Warm layer');
    expect(names(['Flying'])).toContain('Liquids bag');
  });

  it('reads tags however the household spells them', () => {
    expect(names(['cold nights'])).toEqual(names(['Cold nights']));
    expect(names(['REAL COOKING'])).toContain('Camp stove');
  });

  // A tag nobody wrote gear for costs nothing — the baseline still comes back.
  it('falls back to the baseline for a tag it has never heard of', () => {
    const suggestions = names(['Rocket surgery']);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain('Phone charger');
  });

  it('suggests something for a trip that says nothing at all', () => {
    expect(names([]).length).toBeGreaterThan(0);
  });

  /**
   * An item three tags agree on is a better bet than one a single tag mentioned. The baseline
   * scores zero on purpose: "phone charger" is true of every trip and so says nothing about
   * this one.
   */
  it('ranks by how many tags asked for it', () => {
    const suggestions = names(['Fire ban', 'Real cooking']);
    // Both ask for a camp stove; nothing else is asked for twice.
    expect(suggestions[0]).toBe('Camp stove');
  });

  it('puts the baseline below anything a tag actually asked for', () => {
    const suggestions = names(['Fishing']);
    expect(suggestions.indexOf('Rod and reel')).toBeLessThan(suggestions.indexOf('Phone charger'));
  });

  // Suggesting something already written down is noise, and noise is what stops a list working.
  it('never suggests what is already on the list', () => {
    expect(names(['Fishing'], { onList: ['Rod and reel'] })).not.toContain('Rod and reel');
  });

  it('matches what is on the list by meaning, not by exact spelling', () => {
    expect(names(['Fishing'], { onList: ['ROD AND REEL'] })).not.toContain('Rod and reel');
  });

  it('never suggests what has been turned down', () => {
    expect(names(['Fishing'], { dismissed: ['Tackle box'] })).not.toContain('Tackle box');
  });

  it('offers each thing once however many tags asked for it', () => {
    const suggestions = names(['Fire ban', 'Real cooking', 'Stargazing']);
    expect(suggestions.filter((n) => n === 'Camp stove')).toHaveLength(1);
  });

  /**
   * A wall of things you HAVEN'T done is worse on the packing screen than anywhere else. The
   * row refills as items are taken or turned down, so this is a handful, not a cap on what the
   * app knows.
   */
  /**
   * A sheet opened mid-task can't be a wall; the review screen, whose whole job is to be looked
   * at, can afford to be generous. Same suggester, two budgets.
   */
  it('holds whichever budget it was given', () => {
    const everything = ['Tent', 'Fishing', 'Hiking', 'Cold nights', 'Flying', 'Real cooking'];
    expect(names(everything).length).toBeLessThanOrEqual(SUGGESTION_BUDGET.inline);

    const reviewed = suggestItems(ctx({ tags: everything }), SUGGESTION_BUDGET.review);
    expect(reviewed.length).toBeGreaterThan(SUGGESTION_BUDGET.inline);
    expect(reviewed.length).toBeLessThanOrEqual(SUGGESTION_BUDGET.review);
  });

  /**
   * WHERE THE "WHO IS THIS FOR" QUESTION GOES TO DIE. Opening "Add item" under a person's list
   * already says whatever comes next is theirs, so the sheet asks for `each` things only — one
   * cooler does not belong on Brooke's list, and nobody should have to say so.
   */
  it('narrows to what everyone needs their own of', () => {
    const seeds = suggestItems(ctx({ tags: ['Tent', 'Real cooking'], sharing: 'each' }));
    expect(seeds.map((s) => s.name)).toContain('Sleeping bag');
    expect(seeds.map((s) => s.name)).not.toContain('Camp stove');
  });

  it('narrows to what one of covers everybody', () => {
    const seeds = suggestItems(ctx({ tags: ['Tent', 'Real cooking'], sharing: 'one' }));
    expect(seeds.map((s) => s.name)).toContain('Camp stove');
    expect(seeds.map((s) => s.name)).not.toContain('Sleeping bag');
  });

  it('offers both kinds when nothing narrows it', () => {
    const names = suggestItems(ctx({ tags: ['Tent'] })).map((s) => s.name);
    expect(names).toContain('Tent');
    expect(names).toContain('Sleeping bag');
  });

  it('refills as items are taken', () => {
    const first = names(['Tent', 'Fishing', 'Hiking', 'Cold nights', 'Real cooking']);
    const after = names(['Tent', 'Fishing', 'Hiking', 'Cold nights', 'Real cooking'], {
      onList: first,
    });

    expect(after.length).toBeGreaterThan(0);
    for (const name of after) expect(first).not.toContain(name);
  });

  // 'each' means one row saying everyone brings their own, not a copy per person.
  it('marks what everyone needs their own of', () => {
    const seeds = suggestItems(ctx({ tags: ['Tent'] }));
    expect(seeds.find((s) => s.name === 'Sleeping bag')?.sharing).toBe('each');
    expect(seeds.find((s) => s.name === 'Tent')?.sharing).toBeUndefined();
  });

  it('marks what runs out', () => {
    const seeds = suggestItems(ctx({ tags: ['Real cooking'] }));
    expect(seeds.find((s) => s.name === 'Fuel')?.consumable).toBe(true);
  });
});

describe('dismissedNames', () => {
  const r = (name: string, tripId: string) => ({ name, trip: { id: tripId } });

  it('silences a suggestion on the trip it was turned down on', () => {
    expect(dismissedNames([r('Bear spray', 'trip-1')], 'trip-1')).toEqual(['Bear spray']);
  });

  /**
   * A DISMISSAL IS AN OBSERVATION, NOT A SETTING. Turning something down once is about this
   * trip. Doing it again on another trip is the household saying it isn't for them, and the app
   * should hear that without anyone maintaining a blocklist.
   */
  it('leaves it alone on other trips until it happens twice', () => {
    expect(dismissedNames([r('Bear spray', 'trip-1')], 'trip-2')).toEqual([]);
    expect(dismissedNames([r('Bear spray', 'trip-1'), r('Bear spray', 'trip-2')], 'trip-3')).toEqual(
      ['Bear spray'],
    );
  });

  // Twice on ONE trip is one opinion stated twice, not two trips' worth of evidence.
  it('counts trips, not dismissals', () => {
    expect(dismissedNames([r('Bear spray', 'trip-1'), r('Bear spray', 'trip-1')], 'trip-9')).toEqual(
      [],
    );
  });

  it('counts spellings of the same thing together', () => {
    const rows = [r('Bear spray', 'trip-1'), r('BEAR SPRAY', 'trip-2')];
    expect(dismissedNames(rows, 'trip-9')).toEqual(['Bear spray']);
  });

  it('survives reflections with nothing to name', () => {
    expect(dismissedNames([{ name: undefined, trip: { id: 't' } }, { name: '  ' }], 't')).toEqual([]);
  });
});
