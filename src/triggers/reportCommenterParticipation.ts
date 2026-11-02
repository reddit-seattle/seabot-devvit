import type {
  Comment,
  CommentCreateDefinition,
  ModActionDefinition,
  TriggerContext,
} from "@devvit/public-api";

// Rule policy. Names are lowercase to make comparisons case-insensitive.
const MODERATED_SUBREDDIT = "seattle";
const PARTICIPATION_SUBREDDITS = ["pcos", "testosterone", "nashville"] as const;
const MINIMUM_MATCH_COUNT = 2;
const HISTORY_SAMPLE_SIZE = 100;
const HISTORY_SORT = "new";
const REPORT_COOLDOWN_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCLUDED_AUTHORS = new Set([
  "[deleted]",
  "automoderator",
  "seattle-modteam",
]);
const ENABLED_WHEN_UNCONFIGURED = true;
const REPORT_REASON_PREFIX = "SeaBot review: prior activity in ";

// Keep these identifiers stable so saved settings and review decisions remain valid.
const REPORTS_ENABLED_SETTING = "botTriageReportsEnabled";
const STATE_KEY_PREFIX = "seabot:review:";
const REPORTED_STATE = "reported";
const APPROVED_STATE = "approved";

type ReviewAuthor = { id: string; username: string };

const stateKey = (id: string) => `${STATE_KEY_PREFIX}${id}`;
const isReviewable = (comment: Comment) =>
  !comment.removed &&
  !comment.spam &&
  !comment.approved &&
  !comment.ignoringReports;

async function isReportingEnabled(settings: TriggerContext["settings"]) {
  const enabled = await settings.get(REPORTS_ENABLED_SETTING);
  return enabled === undefined ? ENABLED_WHEN_UNCONFIGURED : enabled === true;
}

function getEligibleAuthor(
  comment: Comment,
  appName: string,
): ReviewAuthor | undefined {
  const username = comment.authorName?.toLowerCase();
  const id = comment.authorId;
  if (
    !isReviewable(comment) ||
    comment.subredditName.toLowerCase() !== MODERATED_SUBREDDIT ||
    !username ||
    EXCLUDED_AUTHORS.has(username) ||
    username === appName.toLowerCase() ||
    !id
  )
    return;
  return { id, username };
}

async function findMatchingSubreddits(
  username: string,
  at: number,
  reddit: TriggerContext["reddit"],
) {
  if (!(at > 0 && at <= Date.now())) return [];
  const history = await reddit
    .getCommentsAndPostsByUser({
      username,
      sort: HISTORY_SORT,
      limit: HISTORY_SAMPLE_SIZE,
    })
    .get(HISTORY_SAMPLE_SIZE);

  // Count each community once, using only activity at or before this comment.
  // The SDK may return a mixed-order sample, so inspect the entire bounded result.
  return PARTICIPATION_SUBREDDITS.filter((sub) =>
    history.some(
      (item) =>
        item.subredditName.toLowerCase() === sub &&
        item.createdAt.getTime() > 0 &&
        item.createdAt.getTime() <= at,
    ),
  );
}

async function prepareReport(
  commentId: string,
  author: ReviewAuthor,
  { reddit, redis }: TriggerContext,
): Promise<Comment | undefined> {
  const key = stateKey(author.id);
  // NX prevents concurrent reports and cannot overwrite a moderator's exemption.
  const claimed = await redis.set(key, REPORTED_STATE, {
    nx: true,
    expiration: new Date(
      Date.now() + REPORT_COOLDOWN_DAYS * MILLISECONDS_PER_DAY,
    ),
  });
  if (claimed !== "OK") return;

  // Record before reporting so immediate or delayed approvals can find the author.
  // This link has no expiry: it also prevents replaying an old comment after cooldown.
  await redis.set(stateKey(commentId), author.id);
  const current = await reddit.getCommentById(commentId);
  // Moderation may have changed while history was being fetched. Approval is permanent.
  if (current.approved) await redis.set(key, APPROVED_STATE);
  if (
    !isReviewable(current) ||
    current.authorName.toLowerCase() !== author.username
  )
    return;
  if ((await redis.get(key)) === APPROVED_STATE) return;
  return current;
}

export const ApproveCommenterParticipation: ModActionDefinition = {
  event: "ModAction",
  onEvent: async (event, { redis, subredditName }) => {
    if (
      subredditName?.toLowerCase() !== MODERATED_SUBREDDIT ||
      event.action !== "approvecomment" ||
      !event.targetComment?.id
    )
      return;
    const authorId = await redis.get(stateKey(event.targetComment.id));
    // Only our flagged comments grant an exemption, which outlives the cooldown.
    if (authorId) await redis.set(stateKey(authorId), APPROVED_STATE);
  },
};

const ReportCommenterParticipation: CommentCreateDefinition = {
  event: "CommentCreate",
  onEvent: async (event, context) => {
    const { reddit, redis, settings, subredditName, appName } = context;
    if (
      subredditName?.toLowerCase() !== MODERATED_SUBREDDIT ||
      !event.comment?.id
    )
      return;
    try {
      if (!(await isReportingEnabled(settings))) return;
      const comment = await reddit.getCommentById(event.comment.id);
      const author = getEligibleAuthor(comment, appName);
      if (!author) return;

      // Skip authors in cooldown or exempted by a mod, and comments already flagged.
      if (await redis.get(stateKey(author.id))) return;
      if (await redis.get(stateKey(comment.id))) return;
      const matches = await findMatchingSubreddits(
        author.username,
        comment.createdAt.getTime(),
        reddit,
      );
      if (matches.length < MINIMUM_MATCH_COUNT) return;

      const current = await prepareReport(comment.id, author, context);
      if (!current) return;
      // Keep the claim on failure: Reddit may have accepted the report.
      await reddit.report(current, {
        reason:
          REPORT_REASON_PREFIX + matches.map((sub) => `r/${sub}`).join(", "),
      });
    } catch (error) {
      console.error("SeaBot commenter review failed", error);
    }
  },
};

export default ReportCommenterParticipation;
