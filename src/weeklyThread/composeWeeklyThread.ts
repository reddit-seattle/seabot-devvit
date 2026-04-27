import {
  formatDateWithPattern,
  formatTrafficAlertDateString,
  formatSportDateTimeString,
  formatTemplate,
} from "./dateUtils.js";
import { ISO_DATE_FORMAT } from "./constants.js";
import {
  CityEvent,
  TrafficAlert,
  WeatherPeriod,
  WeeklyThreadConfig,
  WeeklyThreadSections,
} from "./types.js";

function renderTeamLabel(label: string, emojiCode?: string): string {
  return emojiCode ? `:${emojiCode}: ${label}` : label;
}

const WEATHER_ICONS: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ["thunder"], icon: "⛈️" },
  { keywords: ["snow"], icon: "❄️" },
  { keywords: ["rain", "showers"], icon: "🌧️" },
  { keywords: ["cloud"], icon: "☁️" },
  { keywords: ["partly"], icon: "⛅" },
  { keywords: ["sun", "clear"], icon: "☀️" },
];

function weatherIcon(forecast: string): string {
  const lower = forecast.toLowerCase();
  return (
    WEATHER_ICONS.find(({ keywords }) =>
      keywords.some((kw) => lower.includes(kw)),
    )?.icon ?? "🌤️"
  );
}

function formatTemp(value: number | undefined, unit: string): string {
  return value !== undefined ? `${value}\u00b0${unit}` : "??";
}

function formatVenue(venue: string | undefined, isHome: boolean): string {
  if (!venue) return "—";
  return isHome ? `**${venue}**` : venue;
}

function formatCityEventEndDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}/${day}`;
}

function buildDayBlocks(
  weather: WeatherPeriod[],
  sports: WeeklyThreadSections["sports"],
  cityEvents: CityEvent[],
): string[] {
  const sportsByDay = new Map<string, WeeklyThreadSections["sports"]>();
  [...sports]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .forEach((fixture) => {
      const key = formatDateWithPattern(new Date(fixture.startDate), ISO_DATE_FORMAT);
      const list = sportsByDay.get(key) || [];
      list.push(fixture);
      sportsByDay.set(key, list);
    });

  const eventsByDay = new Map<string, CityEvent[]>();
  cityEvents.forEach((event) => {
    const list = eventsByDay.get(event.dateStr) || [];
    list.push(event);
    eventsByDay.set(event.dateStr, list);
  });

  const orderedDays: Array<{
    key: string;
    weather?: WeatherPeriod;
    date: Date;
  }> = [];
  const seen = new Set<string>();

  weather.forEach((period) => {
    if (!period.startTime) return;
    const date = new Date(period.startTime);
    const key = formatDateWithPattern(date, ISO_DATE_FORMAT);
    seen.add(key);
    orderedDays.push({ key, weather: period, date });
  });

  // Pull in any sports/event days the weather window missed (defensive — usually weather covers more).
  const extraKeys = new Set<string>([
    ...sportsByDay.keys(),
    ...eventsByDay.keys(),
  ]);
  Array.from(extraKeys)
    .filter((key) => !seen.has(key))
    .sort()
    .forEach((key) => {
      const [year, month, day] = key.split("-").map(Number);
      orderedDays.push({ key, date: new Date(year, month - 1, day) });
    });

  if (orderedDays.length === 0) return [];

  const lines = ["## This week"];
  orderedDays.forEach(({ key, weather: period, date }, index) => {
    if (index > 0) lines.push("---");
    lines.push(
      ...renderDayBlock(
        date,
        period,
        sportsByDay.get(key) || [],
        eventsByDay.get(key) || [],
      ),
    );
  });
  return lines;
}

function renderDayBlock(
  date: Date,
  period: WeatherPeriod | undefined,
  fixtures: WeeklyThreadSections["sports"],
  events: CityEvent[],
): string[] {
  const heading = `${formatDateWithPattern(date, "dddd")}, ${formatDateWithPattern(date, "M/D")}`;
  const lines = [`### ${heading}`];

  if (period) {
    const icon = weatherIcon(period.detailedForecast);
    const highLow = `${period.temperature}\u00b0 / ${formatTemp(period.lowTemperature, period.temperatureUnit)}`;
    lines.push(`> ${icon} **${highLow}** - ${period.detailedForecast}`);
  }

  if (fixtures.length > 0) {
    lines.push("**Sports**");
    const table = ["| Matchup | Time | Venue |", "| --- | --- | --- |"];
    fixtures.forEach((fixture) => {
      const { teamLabel, emojiCode, opponent, isHome, venue, startDate } =
        fixture;
      const team = renderTeamLabel(`**${teamLabel}**`, emojiCode);
      const matchup = `${team} ${isHome ? "vs" : "@"} ${opponent}`;
      table.push(
        `| ${matchup} | ${formatSportDateTimeString(startDate)} | ${formatVenue(venue, isHome)} |`,
      );
    });
    lines.push(table.join("\n"));
  }

  if (events.length > 0) {
    lines.push("**City events**");
    events.forEach((event) => {
      const title = event.link ? `[${event.title}](${event.link})` : event.title;
      const through = event.endDateStr
        ? ` _(through ${formatCityEventEndDate(event.endDateStr)})_`
        : "";
      lines.push(`- ${title}${through}`);
    });
  }

  return lines;
}

function buildTrafficSection(traffic: TrafficAlert[]): string[] {
  if (traffic.length === 0) return [];

  const lines = ["## Traffic alerts"];
  traffic.forEach((alert) => {
    const { impact, updatedAt, link, title } = alert;
    const prefix = impact ? `**${impact}:** ` : "";
    const suffix = updatedAt
      ? ` _(updated ${formatTrafficAlertDateString(updatedAt)})_`
      : "";
    const titleText = link ? `[${title}](${link})` : title;

    lines.push(`- ${prefix}${titleText}${suffix}`);
  });
  return lines;
}

const SUBSCRIBER_FORMAT = new Intl.NumberFormat("en-US");

function buildSubscriberStats(
  stats: WeeklyThreadSections["subredditStats"],
): string[] {
  if (!stats) return [];
  return [
    `**${stats.name}** has ${SUBSCRIBER_FORMAT.format(stats.subscribersCount)} subscribers`,
  ];
}

export function composeWeeklyThreadBody(
  config: WeeklyThreadConfig,
  sections: WeeklyThreadSections,
  now: Date = new Date(),
): string {
  const { weather, traffic, sports, cityEvents, subredditStats } = sections;
  const renderTemplate = (template: string): string[] =>
    template.trim() ? [formatTemplate(template, now).trim()] : [];

  const blocks: string[][] = [
    renderTemplate(config.header),
    buildDayBlocks(weather, sports, cityEvents),
    buildTrafficSection(traffic),
    buildSubscriberStats(subredditStats),
    renderTemplate(config.footer),
  ];

  const lines: string[] = [];
  for (const block of blocks) {
    if (block.length === 0) continue;
    if (lines.length > 0) lines.push("---");
    lines.push(...block);
  }

  return lines.join("\n\n");
}
