import { SEATTLE_LATITUDE, SEATTLE_LONGITUDE } from "./constants.js";

export const NOAA_API_DOMAIN = "https://api.weather.gov";
export const WSDOT_API_DOMAIN = "https://www.wsdot.wa.gov";
export const ESPN_API_DOMAIN = "https://site.api.espn.com";
export const PWHL_API_DOMAIN = "https://lscluster.hockeytech.com";
export const TRUMBA_API_DOMAIN = "https://www.trumba.com";

const HTTP_USER_AGENT = "seabot weekly thread bot";

export const EXTERNAL_HTTP_DOMAINS = [
  NOAA_API_DOMAIN,
  WSDOT_API_DOMAIN,
  ESPN_API_DOMAIN,
  PWHL_API_DOMAIN,
  TRUMBA_API_DOMAIN,
];

export const NOAA_SEATTLE_POINT_URL = `${NOAA_API_DOMAIN}/points/${SEATTLE_LATITUDE},${SEATTLE_LONGITUDE}`;
// Pre-filtered server-side via Trumba's filter2/filterfield2/mixout params (Event Types + Calendar
// Categories selected on trumba.com). Mods can override per-installation via the
// "city events RSS url" setting. Kept here as a sensible default and as the documented example.
const SEATTLE_CITY_EVENTS_RSS_QUERY =
  "?filter2=_17447_23777_2156538_2156539_17449_17450_17451_17452_17453_17454_40258_33653_17455_540680_17456_17457_17458_40991_2076615_17460_79177_100359_17461_17462_17463_17464_567297_17465_17466_" +
  "&filterfield2=11444" +
  "&mixout=387961%2c1098024%2c336128%2c989228%2c967718%2c878224%2c544706";
export const DEFAULT_SEATTLE_CITY_EVENTS_RSS_URL =
  `${TRUMBA_API_DOMAIN}/calendars/seattlegov-city-wide.rss${SEATTLE_CITY_EVENTS_RSS_QUERY}`;

const PWHL_CLIENT_CODE = "pwhl";

export function getEspnScoreboardUrl(path: string, dates: string): string {
  return `${ESPN_API_DOMAIN}/apis/site/v2/sports/${path}/scoreboard?dates=${dates}`;
}

export function getPwhlScorebarUrl(
  apiKey: string,
  daysBack: number = 0,
  daysAhead: number = 14,
): string {
  return (
    `${PWHL_API_DOMAIN}/feed/index.php?feed=modulekit&view=scorebar` +
    `&numberofdaysback=${daysBack}&numberofdaysahead=${daysAhead}` +
    `&key=${apiKey}&client_code=${PWHL_CLIENT_CODE}`
  );
}

export function getWsdotHighwayAlertsUrl(apiKey: string): string {
  return `${WSDOT_API_DOMAIN}/traffic/api/HighwayAlerts/HighwayAlertsRest.svc/GetAlertsAsJson?AccessCode=${apiKey}`;
}

async function fetchWithUserAgent(
  url: string,
  label: string,
): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": HTTP_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status}`);
  }
  return response;
}

export async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetchWithUserAgent(url, label);
  return (await response.json()) as T;
}

export async function fetchText(url: string, label: string): Promise<string> {
  const response = await fetchWithUserAgent(url, label);
  return response.text();
}

export async function safeFetchText(
  url: string,
  label: string,
): Promise<string | undefined> {
  try {
    return await fetchText(url, label);
  } catch (error) {
    console.error(`Failed to fetch ${label}:`, error);
    return undefined;
  }
}

export async function safeFetchJson<T>(
  url: string,
  label: string,
): Promise<T | undefined> {
  try {
    return await fetchJson<T>(url, label);
  } catch (error) {
    console.error(`Failed to fetch ${label}:`, error);
    return undefined;
  }
}
