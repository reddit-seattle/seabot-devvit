# Bot campaign triage

SeaBot assesses eligible new r/Seattle comments using the author's sampled history. HIGH baseline scores are reported to the moderator queue by default. A report requests moderator review; the feature does not remove content or ban users. Existing AutoModerator rules and SeaBot report notifications may react to submitted reports.

Removed, spam, and approved comments are skipped, as are deleted authors, AutoModerator, the subreddit mod-team account, and the app itself. Account age and username shape are scoring signals, not eligibility gates.

## Reporting rubric

The baseline uses up to 100 combined comments and posts. It scores participation in each configured campaign and uses only the strongest campaign; equal-point ties use the first campaign. There is no age limit on history items in the baseline sample.

| Signal | Points |
| --- | ---: |
| One distinct campaign subreddit | 5 |
| Two distinct campaign subreddits | 7 |
| Three or more distinct campaign subreddits | 9 |
| Account younger than 30 days | 3 |
| Account age 30–180 days | 2 |
| Account age 181–365 days | 1 |
| Two words separated by a hyphen or underscore, followed by 2–5 digits with an optional separator | 1 |

Age uses completed elapsed days. Unknown age adds no points. The maximum is 13: HIGH is 11–13, MEDIUM is 7–10, and LOW is 0–6. Even with every reporting tier enabled, accounts with no campaign overlap or unavailable history are never reported. Age and name weights are heuristics, not calibrated probabilities.

The bundled campaign contains PCOS, Testosterone, Nashville, SideProjects, SideProject, Blooddonors, and Supplements. Each distinct matching community contributes equally to the overlap count. Report reasons include the baseline tier, score, campaign, matched communities, age, and name flag, truncated to Reddit's 100-character limit.

## Independent diagnostics

The behavioral assessment uses a fixed rule, separate from editable campaigns. Within the 30 days ending at the triggering comment, it requires at least six comments, participation in at least two of PCOS/Testosterone/Nashville, and comments across different subreddits within five minutes on at least two Pacific calendar dates. It merges the fetched trigger by ID, excludes later activity, and bounds the combined sample at 100 items. Posts occupy sample slots but do not count toward behavioral features.

The 30-day and session boundaries are inclusive. Qualifying sessions consume their comments without reuse; each session's start date counts once in `America/Los_Angeles`, including DST. Supporting-community matches and ten-minute sessions across three communities are recorded as additional diagnostics. A separate name assessment adds one point to the baseline for a matching two-word CamelCase name followed by 2–5 digits when the baseline name matcher did not already award it.

These assessments are stored as `behaviorShadow` and `nameShadow`. Neither authorizes reports or changes the baseline score, even when reporting is enabled.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| `botTriageReportsEnabled` | `true` | Submit eligible baseline reports; false retains evaluation and diagnostics in shadow mode. |
| `botTriageReportMedium` | `false` | Also report MEDIUM baseline assessments. |
| `botTriageReportLow` | `false` | Also report LOW baseline assessments with campaign overlap. |
| `botTriageDailyReportCap` | `25` | Maximum attempts per UTC day, an integer from 0 to 500; zero suppresses reports. |
| `botTriageCampaignsJson` | Empty | Use bundled campaigns, or supply the configuration below. |

```json
{"campaigns":[{"id":"example-campaign","enabled":true,"subreddits":["pcos","testosterone","nashville"]}]}
```

Custom configuration replaces the defaults. It accepts 1–12 campaigns, each with a unique lowercase ID starting with a letter (2–40 letters, digits, or hyphens) and 1–20 distinct subreddit names. Names are normalized to lowercase without an `r/` prefix. The local subreddit is excluded. `enabled` is optional and defaults to true; at least one campaign must be enabled. Unknown fields and invalid configuration suppress evaluation and reports.

## Limits and history

Authors are evaluated at most once per 15 minutes for the current configuration, with a two-minute retry interval for later comments after history failure. Configuration changes permit a new evaluation on a subsequent comment. Reports retain a seven-day per-author cooldown across configuration changes. Atomic claims enforce concurrent reporting limits. Definite skips refund daily reservations; ambiguous report failures retain their budget and cooldown to avoid duplicates.

History is fetched from Reddit through Devvit; there are no LLM or external archive calls. Invalid, future, or out-of-order timestamps suppress reporting. The pinned SDK omits the requested newest-first sort on the wire; validating returned order cannot prove that the endpoint selected the newest 100 items. Samples may be incomplete, and a non-match is not a clearance. Account-age lookup failures do not prevent evaluating otherwise valid history.

## Retention

Redis keys use the `seabot:triage:` prefix. `case:<commentId>` stores the comment ID, assessment time, baseline and diagnostic assessments, and report outcome for 14 days. Cases contain compact derived evidence, including matched communities and sample counts, but no username, permalink, copied text, or history item IDs. Logs contain scores, tiers, data-quality labels, diagnostic results, and outcomes without account identifiers or community lists.

`recent:<signature>:<lowercaseUsername>` retains evaluation claims for 15 minutes (two minutes after history failure), `report:<lowercaseUsername>` retains report claims for seven days, and `daily:<YYYY-MM-DD>` retains attempt counters for two days.

Comment deletion replaces its case with a 14-day tombstone to prevent delayed or in-flight processing from restoring evidence. Deletion storage failures propagate for retry. This cannot recall an already submitted report. Account-deletion and derived-evidence removal requests require removing affected cases and control keys; expiration alone is not an immediate deletion workflow.
