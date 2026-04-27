import { Context, ScheduledJobType } from "@devvit/public-api";
import {
  ISO_DATE_FORMAT,
  WEEKLY_THREAD_DEDUPE_KEY_PREFIX,
  WEEKLY_THREAD_FLAIR_TEXT,
  WEEKLY_THREAD_JOB_NAME,
  WEEKLY_THREAD_STICKY_SLOT,
} from "./constants.js";
import { getWeeklyThreadConfig } from "./config.js";
import { composeWeeklyThreadBody } from "./composeWeeklyThread.js";
import {
  formatTemplate,
  formatDateWithPattern,
  getWeekWindow,
} from "./dateUtils.js";
import { fetchUpcomingSeattleSports } from "./sources/sports.js";
import { fetchTrafficAlerts } from "./sources/traffic.js";
import { fetchWeeklyWeatherPeriods } from "./sources/weather.js";
import { fetchCityEvents } from "./sources/events.js";
import { WeeklyThreadSections } from "./types.js";
import { PWHL_API_KEY, WSDOT_API_KEY, CITY_EVENTS_RSS_URL } from "../settings.js";
import { DEFAULT_SEATTLE_CITY_EVENTS_RSS_URL } from "./api.js";

type WeeklyThreadContext = Pick<Context, "settings" | "reddit" | "redis">;

async function getWeeklyThreadFlairId(
  subredditName: string,
  reddit: {
    getPostFlairTemplates: (
      subredditName: string,
    ) => Promise<Array<{ id: string; text: string }>>;
  },
): Promise<string | undefined> {
  const templates = await reddit.getPostFlairTemplates(subredditName);
  return templates.find(
    (template) => template.text === WEEKLY_THREAD_FLAIR_TEXT,
  )?.id;
}

export function getWeeklyThreadDedupeKey(
  subredditName: string,
  now: Date = new Date(),
): string {
  const weekKey = formatDateWithPattern(getWeekWindow(now).start, ISO_DATE_FORMAT);
  return `${WEEKLY_THREAD_DEDUPE_KEY_PREFIX}:${subredditName.toLowerCase()}:${weekKey}`;
}

function unwrapSection<T>(
  label: string,
  result: PromiseSettledResult<T[]>,
): T[] {
  if (result.status === "fulfilled") {
    return result.value;
  }
  console.error(`Failed to load ${label}:`, result.reason);
  return [];
}

async function postThread(
  reddit: WeeklyThreadContext["reddit"],
  subredditName: string,
  title: string,
  body: string,
  distinguish: boolean = true,
  sticky: boolean = true,
): Promise<string> {
  const flairId = await getWeeklyThreadFlairId(subredditName, reddit);
  const post = await reddit.submitPost({
    subredditName,
    title,
    text: body,
    flairId,
  });
  if (distinguish) {
    await post.distinguish();
  }
  if (sticky) {
    await post.sticky(WEEKLY_THREAD_STICKY_SLOT);
  }
  return post.id;
}

export async function createWeeklyThread(
  context: WeeklyThreadContext,
  options: { ignoreDedupe?: boolean } = {},
): Promise<string | undefined> {
  const { reddit, settings, redis } = context;
  const config = await getWeeklyThreadConfig(settings);
  if (!config.enabled) {
    return undefined;
  }

  const now = new Date();
  const { name: subredditName, numberOfSubscribers } =
    await reddit.getCurrentSubreddit();
  const pwhlApiKey = await settings.get<string>(PWHL_API_KEY);
  const wsdotApiKey = await settings.get<string>(WSDOT_API_KEY);
  const cityEventsRssUrl =
    (await settings.get<string>(CITY_EVENTS_RSS_URL)) ||
    DEFAULT_SEATTLE_CITY_EVENTS_RSS_URL;
  const dedupeKey = getWeeklyThreadDedupeKey(subredditName, now);
  const dedupeExpiration = new Date(now);
  dedupeExpiration.setDate(dedupeExpiration.getDate() + 8);

  if (!options.ignoreDedupe) {
    const claim = await redis.set(dedupeKey, "posting", {
      nx: true,
      expiration: dedupeExpiration,
    });

    if (claim !== "OK") {
      console.info(
        `Weekly thread already claimed for ${subredditName}: ${dedupeKey}`,
      );
      return undefined;
    }
  }

  const sections: WeeklyThreadSections = {
    weather: [],
    traffic: [],
    sports: [],
    cityEvents: [],
    subredditStats: {
      subscribersCount: numberOfSubscribers,
      name: `r/${subredditName}`,
    },
  };

  const [weatherResult, trafficResult, sportsResult, eventsResult] =
    await Promise.allSettled([
      fetchWeeklyWeatherPeriods(),
      fetchTrafficAlerts(wsdotApiKey, now),
      fetchUpcomingSeattleSports(now, { pwhlApiKey }),
      fetchCityEvents(cityEventsRssUrl, now),
    ]);

  sections.weather = unwrapSection("weekly weather", weatherResult);
  sections.traffic = unwrapSection("traffic alerts", trafficResult);
  sections.sports = unwrapSection("Seattle sports schedules", sportsResult);
  sections.cityEvents = unwrapSection("Seattle city events", eventsResult);

  try {
    const title = formatTemplate(config.titleTemplate, now);
    const body = composeWeeklyThreadBody(config, sections, now);
    const postId = await postThread(reddit, subredditName, title, body);

    if (!options.ignoreDedupe) {
      await redis.set(dedupeKey, postId, { expiration: dedupeExpiration });
    }

    return postId;
  } catch (error) {
    if (!options.ignoreDedupe) {
      await redis.del(dedupeKey);
    }
    throw error;
  }
}

export const CreateWeeklyThreadJob: ScheduledJobType<undefined> = {
  name: WEEKLY_THREAD_JOB_NAME,
  onRun: async (_, context) => {
    await createWeeklyThread(context);
  },
};
