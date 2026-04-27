import { WEEKLY_THREAD_TIME_ZONE } from "./constants.js";
import { DateRange } from "./types.js";

const DEFAULT_DATE_PATTERN = "MMMM D, YYYY";
const TOKEN_REGEX = /YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd/g;

function zonedMidnight(date: Date, timeZone: string): Date {
  const result = new Date(date.toLocaleString("en-US", { timeZone }));
  result.setHours(0, 0, 0, 0);
  return result;
}

function tokenValues(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = lookup("year");
  const monthPadded = lookup("month");
  const dayPadded = lookup("day");
  const month = String(Number(monthPadded));
  const day = String(Number(dayPadded));

  const intl = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(date);

  return {
    YYYY: year,
    YY: year.slice(-2),
    MMMM: intl({ month: "long" }),
    MMM: intl({ month: "short" }),
    MM: monthPadded,
    M: month,
    DD: dayPadded,
    D: day,
    dddd: intl({ weekday: "long" }),
    ddd: intl({ weekday: "short" }),
  };
}

export function formatDateWithPattern(
  date: Date,
  pattern: string = DEFAULT_DATE_PATTERN,
  timeZone: string = WEEKLY_THREAD_TIME_ZONE,
): string {
  const values = tokenValues(date, timeZone);
  return pattern.replace(TOKEN_REGEX, (token) => values[token] ?? token);
}

export function getWeekWindow(
  date: Date,
  timeZone: string = WEEKLY_THREAD_TIME_ZONE,
): DateRange {
  const start = zonedMidnight(date, timeZone);

  const dayOfWeek = start.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { start, end };
}

export function getUpcomingWindow(
  date: Date,
  timeZone: string = WEEKLY_THREAD_TIME_ZONE,
): DateRange {
  const start = zonedMidnight(date, timeZone);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function formatTemplate(
  template: string,
  date: Date,
  timeZone: string = WEEKLY_THREAD_TIME_ZONE,
): string {
  const { start, end } = getWeekWindow(date, timeZone);

  return template.replace(
    /\{\{(date|weekStart|weekEnd)(?::([^}]+))?\}\}/g,
    (_, macro: string, pattern?: string) => {
      const targetDate =
        macro === "weekStart" ? start : macro === "weekEnd" ? end : date;

      return formatDateWithPattern(
        targetDate,
        pattern || DEFAULT_DATE_PATTERN,
        timeZone,
      );
    },
  );
}

function formatInZone(
  dateString: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(
    new Date(dateString),
  );
}

export function formatTrafficAlertDateString(
  dateString: string,
  timeZone: string = WEEKLY_THREAD_TIME_ZONE,
  includeTimeZone: boolean = true,
): string {
  return formatInZone(dateString, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(includeTimeZone ? { timeZoneName: "short" } : {}),
  });
}

export function formatSportDateTimeString(
  dateString: string,
  timeZone: string = WEEKLY_THREAD_TIME_ZONE,
): string {
  return formatInZone(dateString, timeZone, {
    hour: "numeric",
    minute: "2-digit",
  });
}
