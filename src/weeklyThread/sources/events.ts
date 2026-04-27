import type { CityEvent } from "../types.js";
import { safeFetchText } from "../api.js";
import {
  CITY_EVENTS_FORECAST_DAYS,
  ISO_DATE_FORMAT,
  WEEKLY_THREAD_TIME_ZONE,
} from "../constants.js";
import { formatDateWithPattern } from "../dateUtils.js";

const ITEM_REGEX = /<item>([\s\S]*?)<\/item>/g;
const TITLE_REGEX = /<title>([\s\S]*?)<\/title>/;
const LINK_REGEX = /<link>([\s\S]*?)<\/link>/;
const CATEGORY_REGEX = /<category>([\s\S]*?)<\/category>/;
const CATEGORY_DATE_REGEX = /^(\d{4})\/(\d{2})\/(\d{2})/;
const NUMERIC_ENTITY_REGEX = /&#(\d+);/g;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(NUMERIC_ENTITY_REGEX, (_, code) =>
      String.fromCharCode(parseInt(code, 10)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extract(item: string, regex: RegExp): string | undefined {
  const match = regex.exec(item);
  return match ? decodeXmlEntities(match[1]) : undefined;
}

export function parseCityEventsXml(xml: string): CityEvent[] {
  const events: CityEvent[] = [];
  const matches = xml.matchAll(ITEM_REGEX);
  for (const match of matches) {
    const item = match[1];
    const title = extract(item, TITLE_REGEX);
    const category = extract(item, CATEGORY_REGEX);
    const link = extract(item, LINK_REGEX);
    if (!title || !category) continue;

    const dateMatch = CATEGORY_DATE_REGEX.exec(category);
    if (!dateMatch) continue;
    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    events.push({ title, link, dateStr: date });
  }
  return events;
}

function dedupeByTitleAndDate(events: CityEvent[]): CityEvent[] {
  const seen = new Set<string>();
  const result: CityEvent[] = [];
  for (const event of events) {
    const key = `${event.dateStr}|${event.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }
  return result;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isNextDay(prev: string, next: string): boolean {
  const a = new Date(`${prev}T12:00:00Z`).getTime();
  const b = new Date(`${next}T12:00:00Z`).getTime();
  return b - a === ONE_DAY_MS;
}

/**
 * Collapses runs of the same title on consecutive dates into a single entry
 * marked with `endDate`. Non-consecutive recurrences (e.g. weekly) are kept
 * as separate entries.
 */
function collapseConsecutiveTitles(events: CityEvent[]): CityEvent[] {
  const datesByTitle = new Map<string, string[]>();
  for (const e of events) {
    const key = e.title.toLowerCase();
    const list = datesByTitle.get(key) ?? [];
    list.push(e.dateStr);
    datesByTitle.set(key, list);
  }

  const dropKeys = new Set<string>(); // `${titleLower}|${date}`
  const endByFirst = new Map<string, string>(); // `${titleLower}|${firstDate}` -> endDate

  for (const [title, dates] of datesByTitle) {
    const sorted = Array.from(new Set(dates)).sort();
    if (sorted.length < 2) continue;

    let runStart = sorted[0];
    let runEnd = sorted[0];
    const finalize = () => {
      if (runEnd !== runStart) {
        endByFirst.set(`${title}|${runStart}`, runEnd);
      }
    };
    for (let i = 1; i < sorted.length; i++) {
      if (isNextDay(runEnd, sorted[i])) {
        dropKeys.add(`${title}|${sorted[i]}`);
        runEnd = sorted[i];
      } else {
        finalize();
        runStart = sorted[i];
        runEnd = sorted[i];
      }
    }
    finalize();
  }

  const result: CityEvent[] = [];
  for (const e of events) {
    const titleKey = e.title.toLowerCase();
    if (dropKeys.has(`${titleKey}|${e.dateStr}`)) continue;
    const endDate = endByFirst.get(`${titleKey}|${e.dateStr}`);
    result.push(endDate ? { ...e, endDateStr: endDate } : e);
  }
  return result;
}

export function filterUpcomingCityEvents(
  events: CityEvent[],
  now: Date = new Date(),
): CityEvent[] {
  const today = formatDateWithPattern(now, ISO_DATE_FORMAT, WEEKLY_THREAD_TIME_ZONE);
  const end = new Date(now);
  end.setDate(end.getDate() + CITY_EVENTS_FORECAST_DAYS);
  const endKey = formatDateWithPattern(end, ISO_DATE_FORMAT, WEEKLY_THREAD_TIME_ZONE);

  const inWindow = events.filter(
    (event) => event.dateStr >= today && event.dateStr <= endKey,
  );
  return collapseConsecutiveTitles(dedupeByTitleAndDate(inWindow));
}

export async function fetchCityEvents(
  rssUrl: string | undefined,
  now: Date = new Date(),
): Promise<CityEvent[]> {
  if (!rssUrl) return [];
  const xml = await safeFetchText(rssUrl, "Seattle city events RSS");
  if (!xml) return [];
  return filterUpcomingCityEvents(parseCityEventsXml(xml), now);
}
