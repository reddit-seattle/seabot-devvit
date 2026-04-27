export const WEEKLY_THREAD_JOB_NAME = "createWeeklyThread";
export const WEEKLY_THREAD_CRON = "0 16 * * 1";
export const WEEKLY_THREAD_FLAIR_TEXT = "Weekly Thread";
export const WEEKLY_THREAD_TIME_ZONE = "America/Los_Angeles";
export const WEEKLY_THREAD_DEDUPE_KEY_PREFIX = "weekly-thread";
// Reddit allows two sticky slots (1 = top, 2 = below). Weekly thread takes the top slot.
export const WEEKLY_THREAD_STICKY_SLOT = 1;

export const MAX_TRAFFIC_ALERTS = 6;
export const WEATHER_FORECAST_DAYS = 7;
export const CITY_EVENTS_FORECAST_DAYS = 7;

export const ISO_DATE_FORMAT = "YYYY-MM-DD";

export const SEATTLE_LATITUDE = 47.6062;
export const SEATTLE_LONGITUDE = -122.3321;

export const WEEKLY_POST_ENABLED = "weeklyPostEnabled";
export const WEEKLY_POST_TITLE_TEMPLATE = "weeklyPostTitleTemplate";
export const WEEKLY_POST_HEADER = "weeklyPostHeader";
export const WEEKLY_POST_FOOTER = "weeklyPostFooter";

export const DEFAULT_WEEKLY_POST_TITLE_TEMPLATE =
  "Weekly What's Happening Thread: {{date:MMMM D, YYYY}}";

export const DEFAULT_WEEKLY_POST_HEADER = `Welcome to the weekly /r/Seattle **What's Happening** thread.

This thread is continuously updated to contain a myriad of info for locals and visitors.

For more conversation, join our [Discord](https://discord.gg/reddit-seattle).

[Browse previous weekly threads](https://www.reddit.com/search?q=subreddit%3Aseattle%20flair%3A%22Weekly%2BThread%22&sort=new&restrict_sr=&t=all) or [check the wiki](https://www.reddit.com/r/Seattle/wiki/index) for more info / FAQs.`;


export const DEFAULT_WEEKLY_POST_FOOTER = "Have suggestions or feedback? Notice something broken in the sidebar? Want to host an AMA? [Send a message to the mod team](https://www.reddit.com/message/compose?to=%2Fr%2FSeattle)";

export type SportsAPISource = "espn" | "pwhl";

export interface TeamObject {
  key: string;
  label: string;
  emojiCode?: string;
  source: SportsAPISource;
  path: string;
  teamId?: string;
}

export const SEATTLE_TEAMS: TeamObject[] = [
  {
    key: "mariners",
    label: "Mariners",
    emojiCode: "Mariners",
    source: "espn",
    path: "baseball/mlb",
    teamId: "12",
  },
  {
    key: "kraken",
    label: "Kraken",
    source: "espn",
    path: "hockey/nhl",
    teamId: "124292",
  },
  {
    key: "seahawks",
    label: "Seahawks",
    emojiCode: "Seahawks",
    source: "espn",
    path: "football/nfl",
    teamId: "26",
  },
  {
    key: "sounders",
    label: "Sounders",
    emojiCode: "Sounders",
    source: "espn",
    path: "soccer/usa.1",
    teamId: "9726",
  },
  {
    key: "reign",
    label: "Reign",
    emojiCode: "Reign",
    source: "espn",
    path: "soccer/usa.nwsl",
    teamId: "15363",
  },
  {
    key: "storm",
    label: "Storm",
    emojiCode: "Storm",
    source: "espn",
    path: "basketball/wnba",
    teamId: "14",
  },
  {
    key: "torrent",
    label: "Torrent",
    emojiCode: "Torrent",
    source: "pwhl",
    path: "pwhl",
    teamId: "SEA",
  },
  {
    key: "huskies",
    label: "Huskies",
    emojiCode: "Huskies",
    source: "espn",
    path: "football/college-football",
    teamId: "264",
  },
];
