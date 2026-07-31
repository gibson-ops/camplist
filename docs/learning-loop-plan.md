# The learning work

Track A closed the loop: describe a trip, get a list drawn from what this household actually
packed on trips like it, say what happened afterwards, and the next trip leads with what got
forgotten. This plan is about the half that comes after "it works" — making the signal sharp
enough to be worth trusting.

`ROADMAP.md` says where the code is. This says what order to sharpen it in and why.

---

## What "getting it right" means, stated as failure modes

Worth writing down first, because every decision below trades against one of these. Ordered by
how expensive the failure is.

| Failure                              | What it looks like                                                                 | Why it's the expensive one                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Suggesting too much**              | The review screen is forty guesses long                                            | A list that arrives pre-filled stops being read, and then nothing else here matters             |
| **Learning from a fluke**            | One odd trip makes the app confident about a habit that doesn't exist              | Wrong AND sticky — it takes several trips to wash out                                           |
| **Unlearning something true**        | A dismissal on one trip silences gear that was right for a different shape of trip | Silent. You only find out by forgetting the thing                                               |
| **Not being able to explain itself** | "Why is this here?" has no answer                                                  | An unexplainable suggestion can't be corrected, only ignored — which trains ignoring            |
| **Asking for the data**              | More questions after the trip to feed the model                                    | The reflection screen's whole discipline is asking two things; a model that needs five has lost |

The last one is the quiet trap. Almost every idea below could be solved by asking the user one
more question, and almost none of them should be.

---

## The binding constraint: there are very few trips

This is the thing that should decide the order, and it isn't effort.

The matcher is useful from the second trip. Co-occurrence — "I pack the power bank with Starlink"
— needs enough trips to tell a habit from a coincidence, which is not a small number. So a real
prioritization rule falls out:

> **While the history is short, prefer signals that get more out of ONE trip over signals that
> need many.**

That inverts the obvious ordering. Co-occurrence is the most exciting idea here and it is last,
not because it's hard but because the data isn't there yet and no amount of work brings it
forward. Meanwhile check reasons, the packing record, and the trip axes all extract more from
trips that already exist.

---

## Phase 0 — build the instrument

**Nothing below is tunable until the loop can be measured, and right now it can't.**

The method that has worked repeatedly on this project is measuring rather than reasoning — a
screen recording settled the sheet motion after reasoning had failed twice. The learning loop is
the least observable thing in the app and has had the least of it.

Three numbers, all derivable from data already stored, per finished trip:

| Number        | Question it answers                      | Where it comes from                                       |
| ------------- | ---------------------------------------- | --------------------------------------------------------- |
| **Cold adds** | What did you have to think of yourself?  | items on the list with no matching suggestion at creation |
| **Noise**     | What did it offer that never got packed? | suggested, added, ended the trip `unpacked`               |
| **Take rate** | What did it offer that you took?         | suggestion accepted vs dismissed vs ignored               |

**Cold adds is the primary metric.** The app's job is to stop you forgetting; anything you had to
remember unaided is the gap it exists to close. Noise is the counterweight — driving cold adds to
zero by suggesting everything is the first failure mode in the table above.

Shape: a read-only screen behind the trip, or a script over an export. Cheapest thing that puts
the three numbers on a page. This subsumes task #18 (check the loop against the real trip), which
is the same thing done by hand once.

---

## Phase 1 — get more out of each trip

Unblocked, cheap, and the phase that pays now.

### 1a. Carry the check reason through history (#20)

`itemsOf` votes on `consumable` but not `checkReason`, so a re-suggested lantern comes back
unspecified and the reason has to be re-entered every trip. Same weighted-majority shape as the
existing votes.

Small, and it is what makes the shipped feature survive a second trip.

### 1b. Learn `present` from the packing record

A `present` item is one that leaves the kit and has to be found again. Right now you tell the app
that. But an item repeatedly found missing at pack time **is** self-evidently a `present` item,
and the packing record already knows.

This is the first place the loop notices something about an ITEM rather than about a trip, and
it's the template for 3b. Guard it the same way: offer the change, never apply it.

### 1c. Earn the third and fourth reflection questions

`leave_behind` and `restock` are both in the schema and neither is asked. They should stay
unasked until a real need names them — the reflection screen asks two things on purpose.

The return list is the need that would earn `leave_behind`. Breaking camp is the worst moment
this app will ever be used in, which is exactly why the return list must be **earned from
reflections and never a copy of the outbound list**.

---

## Phase 2 — make the matching sharper

Also unblocked. These change what "trips like this one" means, so they want to land before a lot
more history accumulates under the current weights.

### 2a. Raise `attendees`, then measure

Current weights:

```
tripTypes: 3   lodgings: 3   travelModes: 2
activities: 2  conditions: 2  attendees: 1  destination: 1  season: 1
```

`attendees` is tied with season, when who is along is probably the strongest predictor of gear a
household owns — camping with Brooke means the double sleeping bag. One line, one test, and with
Phase 0 in place it is the first change here that can be checked rather than argued about.

### 2b. The vehicle axis

Truck and commuter are both `Driving` today, so the tools and fluids the truck carries are
invisible to the matcher. A free-form axis on the trip, not a household entity — the entity
version is a bigger model that buys nothing until trips reference it.

Resist a generic "church youth" value inside `tripTypes`: a YM trip **is** camping, and
overloading the axis muddies what it means.

### 2c. Sleeping groups → shared-by-some

`sharing: 'one' | 'each'` can't say "Jared and Brooke share this, Walker doesn't". Modeling the
sleeping arrangement rather than the item means the double bag, the double mattress and the
two-person tent all fall out of one answer instead of three item-by-item corrections.

Camp List-native, knowable at trip time, and it decides a whole class of gear at once.

---

## Phase 3 — needs accumulated history

Blocked on data, not on effort. Listed so it isn't mistaken for work that could be pulled forward.

- **Co-occurrence.** "Given what's on this list, what's missing?" — the only signal that can react
  to what you just did. Needs a minimum support and must stay silent below it. Only worth
  surfacing for pairs not already expressible as a kit.
- **Optional kit members, promoted and demoted.** An optional member accepted on most trips wants
  promoting; a standard member removed most trips wants demoting. Same shape as 1b.
- **Lead-time learning and the departure nudge.** Catches the biggest real failure — distracted
  mid-pack — at a known moment. Needs a server to send.

---

## The rules that keep it honest

Cross-cutting, and each one is a thing already learned here rather than a principle imported.

1. **Every suggestion can name its source.** `from` is carried the whole way out for this reason.
   "You took this last time" and "trips like this usually need one" earn very different trust.
2. **Sink, don't silence.** One observation from one trip should be enough to lose an argument
   with better evidence and not enough to win one alone.
3. **Structural change is offered, never applied.** "You've packed the power bank with Starlink
   every time — put it in the kit?" turns an observation into a container the user owns. The app
   proposing structure is good; the app imposing it is the fluke failure with a UI.
4. **Silence below threshold.** A pattern that can't clear its minimum support says nothing. The
   temptation is to show it with a hedge, which is how the list gets to forty rows.
5. **Names converging is a learning input, not a UX nicety.** Suggestions match by slug, so
   "Head lamp" and "Headlamp" are two histories each knowing half of what the household does. The
   autocomplete that just shipped is load-bearing for everything above.
6. **Don't buy signal with questions.** If an idea's cheapest version is one more prompt, the idea
   isn't ready.

---

## Order

```
Phase 0   instrument the loop                    ← nothing is tunable before this
Phase 1   1a reasons · 1b learned present · 1c earned reflections
Phase 2   2a attendees weight · 2b vehicle · 2c sleeping groups
Phase 3   co-occurrence · kit promotion · lead time     (waiting on trips, not on us)
```

The one thing worth not deferring: **Phase 0 before Phase 2a.** Raising a weight without the
instrument is exactly the kind of change that feels right, ships, and is never checked.
