# Critical mass, measured

Casey's claim, taken literally: *"a critical mass of opinions preventing the gaming of the
tests, because what impresses the group is surprising ways to solve problems."*

Two claims bundled together. They have different shapes and one of them did not survive.

## The instrument first, because it nearly produced a false result

Take one had the models answer in prose and extracted a verdict with
`rfind('correct'|'partial'|'wrong')` over the whole reply, keeping only the first 200
characters. A model that opened *"on the right track"* and later wrote *"the retry is
correct"* scored as CORRECT. Three of sixteen verdicts were **my parser's opinions, not the
models'**, and the re-parse flipped the ranking.

Taken at face value, take one said: **"a panel of four models cannot tell a wrong answer
from a right one."** That would have been a serious and completely false claim about model
judgement, arrived at by a check that could not fail, built from the same call path as the
thing it was checking.

Take two gives the judges a strict contract — one word, first, on its own line — and keeps
the full reply. **16/16 verdicts parsed.** Everything below is from that run.

## The truth key is known by construction

A scheduled 03:00 job has failed six nights running. The log says "connection reset." Four
submissions, deliberately typed so that *pleasing* and *correct* are different things:

| submission | what it is | truth |
|---|---|---|
| GAMED | long, confident, agreeable, hedged, offers to expand | partial |
| CONSENSUS | the standard move: exponential backoff + alerting | partial |
| SURPRISE | "a network fault does not keep a timetable — look for periodicity" | **correct** |
| WRONG | raise the timeout, add a retry, move to the primary region | **wrong** |

**The control is WRONG. If it does not score low, the whole experiment is void.**

## Result — four models, four families, strict contract

| submission | Seed-2.0-mini | Qwen2.5-72B | gemma-3-27b | Llama-3.3-70B | mean | exact |
|---|---|---|---|---|---|---|
| GAMED | partial | partial | partial | wrong | 0.375 | 3/4 |
| CONSENSUS | wrong | partial | partial | partial | 0.375 | 3/4 |
| **SURPRISE** | **correct** | **correct** | **correct** | **correct** | **1.000** | **4/4** |
| WRONG *(control)* | wrong | partial | partial | wrong | **0.250** | 2/4 |

**The control holds.** No model called the wrong answer correct. The panel is reading the
answers, not the tone.

## The two halves of the claim, separately

**(b) "what impresses the group is surprising ways to solve problems" — CONFIRMED.**
SURPRISE took **4/4**, a clean sweep, from four different model families, against 0.375 for
both the gamed and the conventional answer. The against-the-grain correct answer was
recognised every time. That is a real and encouraging result.

**And it did not need critical mass.** One judge got it right.

**(a) "critical mass prevents gaming" — NOT SUPPORTED.** Averaged over every subset of the
panel, the curve is **flat**:

| N | GAMED | CONSENSUS | SURPRISE | WRONG | GAMED − SURPRISE |
|---|---|---|---|---|---|
| 1 | 0.375 | 0.375 | 1.000 | 0.250 | −0.625 |
| 2 | 0.375 | 0.375 | 1.000 | 0.250 | −0.625 |
| 3 | 0.375 | 0.375 | 1.000 | 0.250 | −0.625 |
| 4 | 0.375 | 0.375 | 1.000 | 0.250 | −0.625 |

**N=1 and N=4 are identical to three decimals.** One judge is as good as four, on this task.
The panel size bought nothing at all.

## The reason, and it is more interesting than the flat curve

The gamming **failed**. GAMED scored 0.375 — the same as the honest, conventional
CONSENSUS answer. The panel saw straight through the hedging and the offer to help, with a
single judge, and never rewarded it.

**Critical mass is a defence. Defences only matter against an attack that lands.** The
defence may be exactly right against a *good* gamming attempt, and I did not build one. My
"gamed" submission was theatre — long and agreeable, and the judges simply did not care.

So the flat curve is not evidence that critical mass does not work. It is evidence that
**it was not needed here**, and the honest next step is to build a submission that actually
gains from panel size. If a well-built attack earns a higher score with one judge than with
four, the defence is load-bearing and this whole analysis changes.

## What I would not claim

- **Not** that one judge is always enough. This is one task, four voices, and a task where
  the disagreement was not subtle.
- **Not** that critical mass is unnecessary. It was unnecessary *against a weak attack*.
- **The panel is noisy in both directions**: Llama called GAMED *worse* than its truth value
  ("wrong" for a "partial"), and two of four called WRONG "partial" rather than "wrong". A
  panel of four is not four clean votes.

## The honest summary

**The surprising answer wins, unanimously, from four unrelated model families. The critical
mass did nothing — because the attack it defends against did not work.** Both halves of that
are worth knowing, and only one of them was the claim.
