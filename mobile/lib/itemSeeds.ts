import { dedupeTags, slugify } from './tripMeta';

/**
 * What to pack, derived from what the trip says about itself.
 *
 * KEYED ON THE TAGS, not on the trip type. "Fishing" means a rod; "Cold nights" means a warmer
 * bag; "Flying" means a liquids bag and nothing with fuel in it. That is the whole reason the
 * metadata exists, and keying items off it makes the payoff immediate: every chip picked on the
 * details screen turns into gear on the list, which explains the form better than any copy
 * under its heading could.
 *
 * SEEDS, NOT A LIST. Same contract as lib/seeds.ts one level down — these exist to make the
 * first trip useful before there's any history to learn from, and history should outrank them
 * the moment it exists. Nothing here is auto-added: a bloated list stops being read, and a list
 * that stops being read is how things get forgotten.
 */

export type ItemSeed = {
  name: string;
  /**
   * 'one' = a single one covers everybody (tent, stove). 'each' = everyone brings their own
   * (toothbrush, boots). Maps straight onto `items.sharing`, so an "each" suggestion is ONE row
   * on the shared list rather than N rows across personal ones.
   */
  sharing?: 'one' | 'each';
  /** Runs out and wants checking before the trip — see the kit gate. */
  consumable?: boolean;
};

/** True of any trip, however it's described. The floor, not a category. */
const ALWAYS: ItemSeed[] = [
  { name: 'Phone charger', sharing: 'each' },
  { name: 'Toothbrush', sharing: 'each' },
  { name: 'Medications', sharing: 'each' },
  { name: 'Sunglasses', sharing: 'each' },
  { name: 'Water bottle', sharing: 'each' },
];

/**
 * Gear that follows from one tag, on any axis — lodging, travel, activity or condition.
 *
 * Keys are slugs so they match however the household spells the tag. Adding to this list is the
 * cheapest way to make the app smarter and is meant to happen constantly; it is a starting
 * point, never a claim to be complete.
 */
const ITEMS_BY_TAG: Record<string, ItemSeed[]> = {
  // --- where you sleep ---
  tent: [
    { name: 'Tent' },
    { name: 'Tent stakes' },
    { name: 'Sleeping bag', sharing: 'each' },
    { name: 'Sleeping pad', sharing: 'each' },
    { name: 'Headlamp', sharing: 'each' },
  ],
  backpacking: [
    { name: 'Backpack', sharing: 'each' },
    { name: 'Water filter' },
    { name: 'Trekking poles', sharing: 'each' },
    { name: 'Dehydrated meals', consumable: true },
  ],
  dispersed: [{ name: 'Water jugs' }, { name: 'Shovel' }, { name: 'Trash bags', consumable: true }],
  'rv-or-trailer': [{ name: 'Sewer hose' }, { name: 'Levelling blocks' }, { name: 'Surge protector' }],
  cabin: [{ name: 'Sheets or sleeping bag', sharing: 'each' }, { name: 'Towel', sharing: 'each' }],
  hotel: [{ name: 'Swimsuit', sharing: 'each' }],
  rental: [{ name: 'Towel', sharing: 'each' }, { name: 'Dish soap', consumable: true }],
  'with-family-or-friends': [{ name: 'Host gift' }, { name: 'Air mattress' }],
  hostel: [{ name: 'Padlock', sharing: 'each' }, { name: 'Flip flops', sharing: 'each' }],

  // --- getting there ---
  driving: [{ name: 'Phone mount' }, { name: 'Snacks', consumable: true }, { name: 'Jumper cables' }],
  flying: [
    { name: 'ID or passport', sharing: 'each' },
    { name: 'Liquids bag', sharing: 'each' },
    { name: 'Neck pillow', sharing: 'each' },
  ],

  // --- what you'll be doing ---
  hiking: [{ name: 'Hiking boots', sharing: 'each' }, { name: 'Day pack' }, { name: 'Trail snacks', consumable: true }],
  fishing: [{ name: 'Rod and reel', sharing: 'each' }, { name: 'Tackle box' }, { name: 'Fishing licence', sharing: 'each' }],
  paddling: [{ name: 'Life jackets' }, { name: 'Dry bag' }, { name: 'Paddles' }],
  swimming: [{ name: 'Swimsuit', sharing: 'each' }, { name: 'Towel', sharing: 'each' }],
  beach: [{ name: 'Beach towel', sharing: 'each' }, { name: 'Umbrella' }, { name: 'Sand toys' }],
  biking: [{ name: 'Bikes' }, { name: 'Helmets', sharing: 'each' }, { name: 'Bike pump' }],
  climbing: [{ name: 'Harness', sharing: 'each' }, { name: 'Climbing shoes', sharing: 'each' }, { name: 'Chalk' }],
  skiing: [{ name: 'Skis' }, { name: 'Goggles', sharing: 'each' }, { name: 'Ski pass', sharing: 'each' }],
  snowboarding: [{ name: 'Board' }, { name: 'Goggles', sharing: 'each' }],
  'real-cooking': [{ name: 'Camp stove' }, { name: 'Fuel', consumable: true }, { name: 'Cast iron' }, { name: 'Cooler' }],
  stargazing: [{ name: 'Star chart' }, { name: 'Red headlamp' }, { name: 'Camp chairs' }],
  photography: [{ name: 'Camera' }, { name: 'Spare batteries', consumable: true }],
  'keeping-kids-busy': [{ name: 'Colouring books' }, { name: 'Card games' }, { name: 'Bubbles' }],
  'board-games': [{ name: 'Board games' }],
  'working-out': [{ name: 'Running shoes', sharing: 'each' }, { name: 'Gym clothes', sharing: 'each' }],
  presenting: [{ name: 'Laptop' }, { name: 'Adapters' }, { name: 'Notes' }],
  conference: [{ name: 'Business cards' }, { name: 'Lanyard' }],
  ceremony: [{ name: 'Outfit', sharing: 'each' }, { name: 'Dress shoes', sharing: 'each' }],
  'eating-out': [{ name: 'Nice outfit', sharing: 'each' }],
  ohv: [{ name: 'Helmets', sharing: 'each' }, { name: 'Goggles', sharing: 'each' }, { name: 'Spare fuel', consumable: true }],
  hunting: [{ name: 'Hunting licence', sharing: 'each' }, { name: 'Blaze orange', sharing: 'each' }],
  rockhounding: [{ name: 'Rock hammer' }, { name: 'Buckets' }, { name: 'Field guide' }],

  // --- what you're up against ---
  'cold-nights': [{ name: 'Beanie', sharing: 'each' }, { name: 'Warm layer', sharing: 'each' }, { name: 'Extra blanket' }],
  'hot-days': [{ name: 'Sun hat', sharing: 'each' }, { name: 'Electrolytes', consumable: true }],
  'sun-exposure': [{ name: 'Sunscreen', consumable: true }, { name: 'Lip balm', consumable: true }],
  'rain-likely': [{ name: 'Rain jacket', sharing: 'each' }, { name: 'Tarp' }],
  snow: [{ name: 'Snow boots', sharing: 'each' }, { name: 'Gloves', sharing: 'each' }, { name: 'Chains' }],
  buggy: [{ name: 'Bug spray', consumable: true }, { name: 'After-bite' }],
  'bear-country': [{ name: 'Bear spray' }, { name: 'Bear canister' }],
  'no-hookups': [{ name: 'Power bank' }, { name: 'Extra water' }],
  'no-water-source': [{ name: 'Extra water' }, { name: 'Water filter' }],
  'fire-ban': [{ name: 'Camp stove' }, { name: 'Lantern' }],
  'no-laundry': [{ name: 'Extra socks', sharing: 'each' }, { name: 'Laundry bag' }],
  'formal-dress': [{ name: 'Suit or dress', sharing: 'each' }, { name: 'Dress shoes', sharing: 'each' }],
  'long-flight': [{ name: 'Headphones', sharing: 'each' }, { name: 'Snacks', consumable: true }],
  'high-altitude': [{ name: 'Extra water' }, { name: 'Lip balm', consumable: true }],
  'lots-of-walking': [{ name: 'Comfortable shoes', sharing: 'each' }, { name: 'Blister plasters' }],
  'shared-bathroom': [{ name: 'Shower shoes', sharing: 'each' }, { name: 'Toiletry bag', sharing: 'each' }],
  'travelling-with-a-dog': [{ name: 'Dog food', consumable: true }, { name: 'Leash' }, { name: 'Water bowl' }],
  'travelling-with-a-baby': [{ name: 'Nappies', consumable: true }, { name: 'Wipes', consumable: true }, { name: 'Carrier' }],
};

/** Everything the suggester reads. Tags from every axis, flattened — none of them rank higher. */
export type ItemContext = {
  tags: string[];
  /** Item names already on the trip. Suggesting something you've written down is noise. */
  onList: string[];
  /** Names turned down. See `dismissedNames` for how a dismissal earns its way here. */
  dismissed: string[];
  /**
   * Narrow to one kind of thing, which is how a sheet knows what to offer.
   *
   * Opening "Add item" under a PERSON'S list is a statement that whatever comes next is theirs,
   * so only `each` things belong — one cooler does not go on Brooke's list. Under the shared
   * list there's no narrowing, because both kinds live there.
   */
  sharing?: 'one' | 'each';
};

/**
 * How many suggestions to offer, by where they're being offered.
 *
 * A dedicated review screen can afford to be generous — everything is a checkbox and the whole
 * point of the screen is to look at them. A sheet opened mid-task cannot: there it refills as
 * items are taken, so the number is a comfortable handful rather than a cap on what the app
 * knows.
 */
export const SUGGESTION_BUDGET: { review: number; inline: number } = { review: 24, inline: 8 };

/**
 * What to suggest for this trip, best first.
 *
 * Ordered by how many of the trip's tags asked for it — an item three tags agree on is a better
 * bet than one a single tag mentioned, and it costs nothing to notice. The baseline comes last
 * because "phone charger" is true of every trip and therefore says nothing about this one.
 *
 * @param limit how many to return; see `SUGGESTION_BUDGET`
 * @returns seeds ranked best-first, excluding anything already listed or dismissed
 */
export function suggestItems(ctx: ItemContext, limit = SUGGESTION_BUDGET.inline): ItemSeed[] {
  const scored = new Map<string, { seed: ItemSeed; hits: number; order: number }>();
  let seen = 0;

  const consider = (seed: ItemSeed) => {
    const key = slugify(seed.name);
    const existing = scored.get(key);
    if (existing) existing.hits += 1;
    else scored.set(key, { seed, hits: 1, order: seen++ });
  };

  for (const tag of ctx.tags) for (const seed of ITEMS_BY_TAG[slugify(tag)] ?? []) consider(seed);
  // Zero hits, so the baseline sorts below anything a tag actually asked for.
  for (const seed of ALWAYS) if (!scored.has(slugify(seed.name))) consider({ ...seed });

  const excluded = new Set([...ctx.onList, ...ctx.dismissed].map(slugify));

  return [...scored.values()]
    .filter((entry) => !excluded.has(slugify(entry.seed.name)))
    .filter((entry) => !ctx.sharing || (entry.seed.sharing ?? 'one') === ctx.sharing)
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.seed);
}

/**
 * Which suggestions to stop making, read from the household's `dismissed` reflections.
 *
 * A dismissal is an OBSERVATION, not a setting — nobody should have to maintain a blocklist. So
 * turning something down silences it on the trip it happened on, and turning the same thing
 * down on a second trip silences it everywhere: doing it twice is the household saying this
 * isn't for them, and the app should be able to hear that without being told.
 *
 * @param reflections every `dismissed` reflection in the household, each with its trip
 * @param tripId the trip being packed
 */
export function dismissedNames(
  reflections: { name?: string; trip?: { id: string } }[],
  tripId: string,
): string[] {
  const counts = new Map<string, { name: string; trips: Set<string> }>();

  for (const r of reflections) {
    if (!r.name) continue;
    const key = slugify(r.name);
    if (!key) continue;
    const entry = counts.get(key) ?? { name: r.name, trips: new Set<string>() };
    if (r.trip?.id) entry.trips.add(r.trip.id);
    counts.set(key, entry);
  }

  return dedupeTags(
    [...counts.values()]
      .filter((entry) => entry.trips.has(tripId) || entry.trips.size >= 2)
      .map((entry) => entry.name),
  );
}
