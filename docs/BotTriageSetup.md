# Commenter review

SeaBot reports an eligible new r/Seattle comment when its author's sampled posts and comments show participation in **at least two distinct communities** among r/PCOS, r/Testosterone, and r/Nashville. Any pair, or all three, qualifies. Repeated activity in one community counts once. Account age, username shape, activity frequency, and other communities do not affect the decision.

The report says, for example, `SeaBot review: prior activity in r/pcos, r/nashville`. It requests manual account review and makes no claim that the account is a bot. This feature submits reports only; existing AutoModerator rules and report notifications may react to them.

## Setting

`botTriageReportsEnabled` defaults to `true`; `false` disables evaluation and reporting. This is the only setting. The old tier, campaign JSON, and daily-cap settings are no longer used. There is no daily cap that silently drops otherwise eligible users.

## History and duplicate protection

- Read at most 100 combined posts/comments using Reddit's Devvit API. Count only valid timestamps at or before the triggering comment, with no lookback-age cutoff. No LLM or external archive is involved.
- The pinned SDK omits the requested `new` sort on the wire, so this is a bounded sample, not a guarantee of the newest 100 items or a complete account history. Listing order does not affect the participation check; absent or unavailable evidence cannot trigger a report.
- Skip removed, spam, and approved comments, deleted authors, AutoModerator, the Seattle mod-team account, and the app itself.
- Evaluate an author at most once per 15 minutes. After a history failure, a later comment can retry after two minutes. A non-match can be reconsidered on a later comment after the evaluation throttle expires.
- Report an author at most once per seven days using an atomic claim, including concurrent events. Existing report cooldowns survive this update. If a report request fails, retain its claim because Reddit may have accepted it before losing the response.

## Storage

Only expiring control markers are written to Redis: `seabot:triage:recent:two-of-three:<lowercaseUsername>` for 15 minutes (two minutes after history failure), `seabot:triage:report:<lowercaseUsername>` for seven days, and `seabot:triage:case:<commentId>` for 14 days after a successful report. New markers contain no history, scores, or diagnostic evidence. Old case records expire under their existing 14-day retention.

Comment deletion replaces the case with a 14-day tombstone. Delayed create events and deletions observed during history lookup cannot generate reports or restore stored evidence. Deletion storage failures propagate for retry. Deletion cannot recall a report already submitted to Reddit.
