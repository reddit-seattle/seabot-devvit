# Bot triage research and revised proposal — 2026-10-30

**Recommended network heuristic: at least six recent comments, participation in at least two of PCOS/Testosterone/Nashville, and cross-subreddit comments within five minutes on at least two separate dates, all within 30 days.** Evaluate it independently of username and account age. It matches 17 of 18 supplied accounts whose histories fit the identified network and one unresolved comparison contributor in the current archival snapshot. Start as a separate shadow assessment, then use independently reviewed results to decide report eligibility.

The target is the identified network. Six supplied examples with unrelated or insufficient histories are excluded from network calibration; they may be other spammers or networks. Their non-matches are not failures of this network-specific heuristic. The sparse member of the identified cluster remains in its denominator rather than being discarded to improve the result.

This document updates the proposal and findings for [PR #11](https://github.com/reddit-seattle/seabot-devvit/pull/11). It distinguishes **implemented behavior** at `26cae12` from **proposed follow-up work**. This research update changes documentation only; it does not change scores, settings, reporting, or deployed code. See [BotTriageSetup.md](BotTriageSetup.md) for the implemented behavior.

## Sources and method

The moderator supplied 17 suspected, previously banned accounts, followed by seven additional examples, and clarified that these may span different spammers or networks. These are moderator-provided suspect labels, not independently established network membership. The analytical cohort comprises the original coherent 15-account cluster plus InitialLess9326, Efficient_Prune_2799, and Pitiful-Machine-4284. The other six examples are excluded from this network's calibration. This grouping is based on the observed destination pattern; its overlap with the proposed features means cohort coverage is descriptive, not an unbiased recall estimate.

Public history was collected from [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md), with live Reddit profile and thread inspection using Chrome. The common archival cutoff is **2026-10-30 20:25:32 UTC**; the behavioral window is the preceding 30 days. Pacific-hour/day analysis uses PDT (UTC−7), valid throughout this window. Account ages use Chrome's displayed creation date, at calendar-day precision, rather than the first archived activity.

The initial collection contains 957 comments and 26 posts across 17 accounts. The added collection contains 2,611 comments and 734 posts across seven additional suspects and 26 comparison accounts, collected 20:52:30–20:54:21 UTC. The 66 added API responses have a request manifest and verified SHA-256 hashes. Live profile inspection covered all 33 added/comparison accounts; IndependentPaces displayed an account-ban message and no creation date.

For comparable scoring, merge comments and posts, remove items after the cutoff, sort by creation time, and take the latest **100 archived items total**. Behavioral features use comments within 30 days from that bounded sample. Fetching 100 comments and 100 posts separately is a collection convenience; the scorer still sees at most 100 combined items. All 50 current and expanded-name-only scores were checked by executing the PR's actual TypeScript scorer against these inputs.

This is an archival snapshot replay, not a live-trigger recall test. Deleted/removed items, archive gaps, delayed indexing, and the live endpoint's selection/order can change the sample. In particular, a Seattle comment from Sufficient-Bid4271 was visible in Chrome but absent from the archive. The original collection also missed a live Seattle comment from Adventurous_King3836. An exhausted archive query is not proof of complete Reddit history. Twenty-one of 26 comparison samples and one of seven added samples reach the combined 100-item limit; activity counts are observed lower bounds, not complete monthly totals.

The [aggregate and per-account metric matrix](research/bot-triage-2026-10-30-summary.json) accompanies this report. Comparison accounts are identified only as C01–C26 there; the local evidence manifest holds the review mapping. Raw comment text and copied cross-subreddit histories are not committed.

## Chrome-selected comparison group

To avoid choosing controls based on their histories, selection was locked before profile/archive inspection: the first four r/Seattle **Top This Week** threads with at least 100 displayed comments; up to ten first-seen unique names matching a two-word-plus-2-to-5-digit shape in rendered comments, deduplicated across threads. Default comment order was used, without exhaustive reply expansion.

| Thread | Displayed comments | Selected contributors |
| --- | ---: | ---: |
| [Seattle sweater](https://www.reddit.com/r/Seattle/comments/1xicqpi/i_made_a_sweater_with_all_my_favorite_seattle/) | 264 | 10 |
| [Auburn police](https://www.reddit.com/r/Seattle/comments/1xi6yv3/auburn_police_graphic_content_warning/) | 1.1K | 7 |
| [Día de los Muertos at the market](https://www.reddit.com/r/Seattle/comments/1xdzvj0/1st_ever_dia_de_los_muertos_at_the_market_was/) | 127 | 3 |
| [Weekend freeway closures](https://www.reddit.com/r/Seattle/comments/1xhs914/a_thriller_of_a_weekend_full_closures_of_nb_i5_in/) | 238 | 6 |

These **26 unlabeled comparison contributors are not verified humans or confirmed negatives**. A name's shape cannot establish that Reddit generated it. The broad CamelCase matcher also admits custom-looking names: excluding three such names in a sensitivity check leaves 23 contributors, with the same one full-rule match. The sample favors visible contributors to popular threads; one thread restricts commenting by flair. It is not random, age-matched, or representative of every new Seattle commenter.

## The identified network

The original 15-account cluster has a distinctive recent destination mix: 197/245 observed comments (80.4%) are in Seattle, PCOS, Testosterone, or Nashville, compared with 111/710 older comments (15.6%) in the original full archival collection. All 15 recently visited PCOS and Nashville; 13 recently visited Testosterone, and 14 did at some point in the collected history. Common supporting communities include Blooddonors, Supplements, and SideProject, but their recency and prevalence are less consistent. These are participation features only; they do not establish anyone's health, identity, location, or intent.

The typical activity is **low daily volume in brief sessions**, not flooding. The original cluster's median observed 30-day comment count is 18, and median maximum in any rolling 24 hours is three. Fourteen of 15 have cross-subreddit comments within five minutes on at least two Pacific dates. Their short inter-comment gaps often fall around one to three minutes. Posting spans 23 of 24 Pacific hours; no single hour accounts for more than 6.9% of the cluster's comments. A night-posting rule is unsupported.

Creation dates are clustered but not uniformly young: the original 15 are 225–466 days old (median 247). Seven were created March 14–19, 2026; four December 8–15, 2025. Three added examples were created March 18–19. A younger-than-180-day gate misses every original cluster account, while six comparison accounts are younger than 180 days. Date clusters merit observation, not hard-coded signup-date rules.

Across the expanded 18-account network-like cohort, there are 289 observed recent comments, a median of 16 per account, and a median rolling-24-hour peak of three. All 18 are 225–466 days old (median 230); ten were created March 14–19, 2026. Seventeen have repeated B5 activity. These account-level similarities support a narrow campaign heuristic; they do not prove shared control.

### Three additional accounts that fit the network

`N` = observed recent comments in the bounded sample. `K` = distinct recent comment communities among PCOS, Testosterone, and Nashville. `B5` = distinct Pacific dates with at least two comments across two subreddits within five minutes. `B10` = dates with at least three comments across three subreddits within ten minutes. Windows are inclusive, ordered by creation time, and greedily counted without reusing comments within each feature; dates use the window start.

| Added account | Age, days | N | K | B5 | B10 | Current score | Fixed candidate rule |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| InitialLess9326 | 225 | 13 | 3 | 3 | 1 | 10 | Match |
| Efficient_Prune_2799 | 226 | 15 | 3 | 4 | 0 | 11 | Match |
| Pitiful-Machine-4284 | 225 | 16 | 2 | 5 | 1 | 11 | Match |

InitialLess, Efficient_Prune, and Pitiful-Machine replicate the core overlap plus repeated bursts. The four other added names (Intelligent-Yak9953, IndependentPaces, Sufficient-Bid4271, and Puzzled-Database537) have different destination patterns or insufficient evidence and are set aside. Do not broaden the campaign list to absorb their communities. The raw inventory is retained for provenance, without treating those accounts as network misses or verified negatives.

### Frozen-rule comparison

The initial report proposed `N >= 6 AND K >= 2 AND B5 >= 2`. It was applied to all added accounts and the comparison sample **without retuning the thresholds**. All three added network-like accounts match it. The table below focuses on the identified network; the complete supplied-account inventory remains in the metric matrix. The stricter annotation also requires `B10 >= 2`.

| Signal or route | Original cluster (15) | Added network-like (3) | Comparison (26) |
| --- | ---: | ---: | ---: |
| Current name regex | 12 | 2 | 17 |
| Expanded name shape | 15 | 3 | 26 |
| B5 on at least two dates, alone | 14 | 3 | 12 |
| B10 on at least two dates, alone | 9 | 0 | 7 |
| At least two core communities | 15 | 3 | 1 |
| Current scorer HIGH (11+) | 11 | 2 | 0 |
| HIGH after name-only expansion | 14 | 3 | 1 |
| Fixed candidate: N ≥ 6, K ≥ 2, B5 ≥ 2 | 14 | 3 | 1 |
| Candidate plus B10 ≥ 2 | 9 | 0 | 1 |
| Current HIGH or fixed candidate | 15 | 3 | 1 |

The full-rule comparison match is retained as **C10, unresolved**. It has 18 recent comments, all three core communities, six B5 dates, two B10 dates, and current score 10 (11 with expanded name matching). Chrome independently confirmed a three-community sequence over about 135 seconds and a later Seattle/PCOS pair over 124 seconds. It could be a false positive or an unrecognized campaign participant; the rule itself cannot adjudicate that. Do not remove it from the denominator or call it a confirmed bot. Its private review identity is in the local evidence manifest.

The comparison group has median observed recent count 87 and median rolling-24-hour peak 14, versus 16/3 for the expanded network-like cohort. **High volume would preferentially flag comparison contributors in this sample.** Twelve of 26 also pass the repeated B5 timing condition, so that condition alone is not suitable for reports. The current scorer's zero HIGH matches in this small, older comparison sample does not establish safety; the age points and missing CamelCase recognition help explain that result.

The combined snapshot result is **17/18 network-like accounts**, compared with **13/18 HIGH** under the current scorer. Hot_Reaction_7754 is the remaining cluster member below the behavioral threshold: only four recent comments and one B5 date are observed. Keep that miss rather than weakening the repeated-session requirement for a single sparse member. Requiring B10 on multiple dates would lose all three new core matches; retain it as optional evidence, not a mandatory gate. None of these descriptive counts is population recall, and 1/26 remains an unresolved trigger count, not a false-positive rate.

### Trigger-time sensitivity

A separate replay evaluates the same rule at each network-like account's **last archived Seattle comment**, using only activity at or before that timestamp and its preceding 30 days. It matches **15/18** when the triggering comment is included, or **12/18** when that comment is omitted to simulate a missing overview-list entry. Snapshot coverage of 17/18 must therefore not be advertised as immediate detection on a Seattle comment. Archive gaps also affect which Seattle event is available: Chrome showed a later Seattle comment for Pitiful-Machine-4284 than the archive contained. These are availability sensitivities, not a live SDK benchmark.

This directly informs implementation: merge the currently fetched, eligible Seattle comment into the behavioral history by ID before enforcing the combined limit, and keep its validated creation time. Never double-count it or use later activity in an event-time replay. The three event-time non-matches with the current comment included are Mission-Employee933, Hot_Reaction_7754, and Fit-Eye-2693; retain them as timing/coverage limitations rather than inventing a broader campaign to catch them.

## Proposed Devvit implementation

1. **Make the network conjunction the experimental route.** Keep the current 13-point scorer and strongest-campaign selection as a versioned comparison baseline, with reports disabled. Add an independent `behaviorShadow` result for `N >= 6 AND K >= 2 AND B5 >= 2`. If independent review supports it, promote that explicit route to moderator reports; do not obtain equivalent volume by lowering HIGH or enabling MEDIUM globally. Do not union the old HIGH route with the new route merely to cover the one sparse cluster member.
2. **Carry timestamps and content type through the history adapter.** `HistoryItem` currently retains only ID and subreddit after validating timestamps. Add `createdAtMs` and `kind: comment | post`. Preserve validation of the returned sample before merging the already-fetched eligible comment from `getCommentById`; deduplicate by ID, validate finite/nonfuture timestamps, and bound the combined history at 100. Do not repair an invalid SDK sample by sorting it into apparent recency. Calculate behavioral features from comments within 30 days; posts may still contribute to the baseline. Preserve evaluation time, trigger time, oldest-sample time, sampled count, and truncation/availability reasons, without calling the window complete.
3. **Separate core and supporting overlap in the experimental assessment.** The current flat campaign list weights every distinct community equally. A versioned experimental configuration should identify the three core communities separately; Blooddonors, Supplements, and SideProject remain supporting observations. Validate the new schema explicitly. A visit to any one community, including a health-related community, must not by itself trigger the new route. Do not infer personal attributes from these memberships.
4. **Recognize CamelCase as a weak diagnostic.** Test an additional `/^[A-Z][a-z]+[A-Z][a-z]+\d{2,5}$/` shape alongside the existing separated-word regex, preserving the case-sensitive boundary. Record the alternate score in shadow mode first. Name-only expansion changes three discovery accounts, one added account, and C10 from MEDIUM to HIGH, so it is operationally consequential despite being a small regex change. Keep age and name out of the behavioral candidate gate; an older or custom-named account can qualify on behavior.
5. **Make uncertainty and reason codes visible.** Record compact aggregates needed to explain `N`, `K`, B5/B10 date counts, window coverage, `rubricVersion`, and decisions such as `insufficient_recent_comments`, `no_core_overlap`, `repeated_cross_sub_sessions`, and `history_unavailable`. Keep copied text, detailed user histories, and inferred attributes out of stored cases. Use the existing retention/deletion model and independently review any additional stored fields. A no-match with sparse/truncated history is not a clearance.
6. **Preserve orchestration safeguards.** Keep the evaluation throttle, atomic report claims, seven-day cooldown, UTC daily cap, definite-skip refunds, fail-closed paths, and deletion tombstones. If indexing delay warrants a recheck, permit at most one short, bounded retry for an otherwise eligible event, retaining cancellation and deduplication checks. Do not repeatedly poll users or reconstruct deleted history. Any later reporting route must honor the same safeguards and avoid auto-removal or bans.

This can be implemented in the existing pure scoring/assessment layer plus the history adapter; no LLM or external archive request is needed inside Devvit. Arctic Shift is an offline research source, not a new production dependency. Avoid text-style heuristics such as generic enthusiasm, first-person anecdotes, polished prose, or punctuation as automatic bot evidence. The original main cluster did not show a common external URL or exact long cross-account comment duplicate, so a promotional-domain detector should not dominate this proposal.

## Acceptance and rollout plan

- Add meaningful tests for time-window boundaries, midnight/date handling in `America/Los_Angeles` (including DST), current-comment merging without duplication, no future leakage in event replay, mixed posts/comments, overlapping windows, invalid/out-of-order/future timestamps, missing creation dates, sparse/truncated samples, and independent baseline/shadow outputs. The fixed UTC−7 offset used in this October study must not become production timezone logic.
- Verify privately that the installed Devvit SDK returns the intended most recent history and that trigger-time visibility behaves as expected. At the inspected SDK version, requested `sort: "new"` is omitted on the wire; descending returned timestamps do not prove that the endpoint selected the newest 100 items. Chrome profile inspection does not complete this SDK playtest.
- Run shadow mode first. Review all matches plus a random sample of no-matches, including sparse histories. Independently adjudicate C10 and the timing-limited members of the identified network using moderation evidence. The unrelated supplied accounts remain outside this detector's scope. Do not relabel a comparison account as a bot because it matches this detector.
- Obtain a fresh, temporally separated sample of independently confirmed members of this network, plus age-matched default-looking-name contributors, benign users who participate in at least two core communities, and frequent cross-subreddit commenters. Include appealed/reversed bans. More unrelated spam examples will not calibrate this network heuristic. Freeze thresholds and lists before evaluation, keep accounts disjoint, and do not tune on the new sample after seeing its results. The present comparison has only one multi-core participant, so it cannot show how much B5 improves precision beyond overlap alone.
- Measure precision, observed coverage, uncertain/unavailable cases, and moderator workload per route. Agree on acceptable report precision and volume before opting in. Assess report-driven AutoModerator/Discord effects before enabling any route; preserve the current default-off setting until those checks pass.

The existing PR records 361 passing tests across 22 files (127 triage tests) and a passing TypeScript check. Those are prior implementation checks, not new detector validation. This documentation update additionally replayed both scoring variants across all 50 accounts, performed the event-time sensitivity check, and checked the archive manifests. No new implementation tests, live Devvit playtest, deployment, or reporting activation were performed by this research update.
