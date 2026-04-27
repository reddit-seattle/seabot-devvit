import type { TrafficAlert, WsdotHighwayAlert } from "../types.js";
import { getWsdotHighwayAlertsUrl, safeFetchJson } from "../api.js";
import { MAX_TRAFFIC_ALERTS } from "../constants.js";

const SEATTLE_REGION = "Northwest";
const SKIP_PRIORITIES = new Set(["Low", "Lowest"]);
// Real-time incidents are stale by the time anyone reads a weekly post.
const SKIP_CATEGORIES = new Set(["Incident"]);
// Drop alerts that haven't been touched in over a month — almost always stale
// (e.g. seasonal pass closures left in the feed long after they apply).
const STALE_ALERT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const WSDOT_DATE_PATTERN = /^\/Date\((-?\d+)([+-]\d{4})?\)\/$/;

function parseWsdotDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const match = WSDOT_DATE_PATTERN.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isFinite(fallback.getTime()) ? fallback : undefined;
  }
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms);
}

export function filterSeattleAlerts(
  alerts: WsdotHighwayAlert[],
  now: Date = new Date(),
): TrafficAlert[] {
  return alerts
    .filter((alert) => alert.Region === SEATTLE_REGION)
    .filter((alert) => !SKIP_PRIORITIES.has(alert.Priority ?? ""))
    .filter((alert) => !SKIP_CATEGORIES.has(alert.EventCategory ?? ""))
    .filter((alert) => !isExpired(alert, now))
    .filter((alert) => !isStale(alert, now))
    .sort(byPriorityThenUpdated)
    .slice(0, MAX_TRAFFIC_ALERTS)
    .map(toTrafficAlert);
}

function isExpired(alert: WsdotHighwayAlert, now: Date): boolean {
  const end = parseWsdotDate(alert.EndTime);
  return end !== undefined && end < now;
}

function isStale(alert: WsdotHighwayAlert, now: Date): boolean {
  const updated = parseWsdotDate(alert.LastUpdatedTime);
  if (!updated) return false;
  return now.getTime() - updated.getTime() > STALE_ALERT_AGE_MS;
}

const PRIORITY_ORDER = ["Highest", "High", "Medium", "Low", "Lowest"];
function byPriorityThenUpdated(
  a: WsdotHighwayAlert,
  b: WsdotHighwayAlert,
): number {
  const rank = (p: string | null | undefined) => {
    const idx = PRIORITY_ORDER.indexOf(p ?? "");
    return idx === -1 ? PRIORITY_ORDER.length : idx;
  };
  const diff = rank(a.Priority) - rank(b.Priority);
  if (diff !== 0) return diff;
  const aTime = parseWsdotDate(a.LastUpdatedTime)?.getTime() ?? 0;
  const bTime = parseWsdotDate(b.LastUpdatedTime)?.getTime() ?? 0;
  return bTime - aTime;
}

function toTrafficAlert(alert: WsdotHighwayAlert): TrafficAlert {
  const updatedAt = parseWsdotDate(alert.LastUpdatedTime);
  return {
    title: alert.HeadlineDescription?.trim() || "WSDOT alert",
    impact: alert.EventCategory ?? undefined,
    link: `https://wsdot.wa.gov/traffic/trafficalerts/default.aspx?refnum=${alert.AlertID}&action=2`,
    updatedAt: updatedAt?.toISOString(),
  };
}

export async function fetchTrafficAlerts(
  apiKey: string | undefined,
  now: Date = new Date(),
): Promise<TrafficAlert[]> {
  const trimmed = apiKey?.trim();
  if (!trimmed) return [];

  const response = await safeFetchJson<WsdotHighwayAlert[]>(
    getWsdotHighwayAlertsUrl(trimmed),
    "WSDOT highway alerts",
  );
  if (!response) return [];

  return filterSeattleAlerts(response, now);
}
