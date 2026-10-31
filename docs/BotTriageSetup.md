# Bot network detection

SeaBot reports eligible r/Seattle comments to the moderator queue when the author's sampled history meets all three conditions in the preceding 30 days:

- At least six comments.
- Comments in at least two of PCOS, Testosterone, and Nashville.
- Comments across different subreddits within five minutes, on at least two Pacific calendar dates.

Age, username, and post text do not affect the decision. A match is a request for moderator review, not proof of automation. This feature submits reports; it does not remove content or ban users. Existing AutoModerator rules and SeaBot report notifications may react to those reports.

## Controls

Reporting starts enabled. Set `botTriageEnabled` to false to stop evaluation and reporting. `botTriageDailyReportCap` defaults to 25 attempts per UTC day and accepts integers from 0 to 500; zero suppresses reports. Each author is evaluated at most once per 15 minutes for the current cap and reported at most once per seven days. Definite skips refund daily reservations; ambiguous report failures retain their budget and cooldown to avoid duplicates.

## History and timing

The detector samples up to 100 combined comments/posts, includes the triggering comment once, and excludes later activity. Only comments contribute to the rule; posts still occupy sample slots. The 30-day and five-minute boundaries are inclusive. Qualifying windows consume their comments without reuse and count their starting date once in `America/Los_Angeles`, including DST.

Invalid, future, or out-of-order timestamps suppress reporting. The pinned SDK omits the requested newest-first sort on the wire; the adapter validates returned order but cannot prove that the endpoint selected the newest 100 items. Samples may be incomplete, and a non-match is not a clearance.

## Retention

Account history and detection aggregates stay in memory. Redis stores only expiring control markers under `seabot:triage:`: processed/deleted comment IDs for 14 days, author evaluation claims for 15 minutes (two minutes after a history failure), author report claims for seven days, and daily attempt counters for two days. Comment deletion writes a tombstone to prevent delayed processing; it cannot recall an already submitted report. Logs contain outcome labels only. Handle account-deletion requests by removing that author's remaining control keys; expiration is not an immediate deletion workflow.
