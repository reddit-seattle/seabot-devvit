import {
  SEATTLE_TEAMS,
  TeamObject,
} from "../constants.js";
import {
  getEspnScoreboardUrl,
  getPwhlScorebarUrl,
  safeFetchJson,
} from "../api.js";
import type {
  EspnScoreboardResponse,
  PwhlScorebarResponse,
} from "../types.js";
import {
  formatDateWithPattern,
  getUpcomingWindow,
} from "../dateUtils.js";
import { DateRange, SportsGame } from "../types.js";

export function extractFixturesFromScoreboard(
  scoreboard: EspnScoreboardResponse,
  teamDefinition: TeamObject,
): SportsGame[] {
  const { key, label, emojiCode } = teamDefinition;
  const fixtures: SportsGame[] = [];

  for (const event of scoreboard.events || []) {
    for (const competition of event.competitions || []) {
      const competitors = competition.competitors || [];
      const matchedTeam = competitors.find((competitor) =>
        Boolean(competitor.team?.id === teamDefinition.teamId),
      );

      if (!matchedTeam) {
        continue;
      }

      const opponent = competitors.find(
        (competitor) => competitor !== matchedTeam,
      );

      fixtures.push({
        teamKey: key,
        teamLabel: label,
        emojiCode,
        opponent: opponent?.team?.displayName || "TBD",
        startDate: competition.date || event.date || "",
        venue: competition.venue?.fullName,
        isHome: matchedTeam.homeAway === "home",
      });
    }
  }

  return fixtures;
}

async function fetchLeagueScoreboard(
  path: string,
  now: Date,
): Promise<EspnScoreboardResponse | undefined> {
  const { start, end } = getUpcomingWindow(now);
  const compact = (d: Date) => formatDateWithPattern(d, "YYYYMMDD");
  const url = getEspnScoreboardUrl(path, `${compact(start)}-${compact(end)}`);
  return safeFetchJson<EspnScoreboardResponse>(
    url,
    `ESPN scoreboard for ${path}`,
  );
}

function pickName(longName?: string, nickname?: string): string {
  return longName || nickname || "TBD";
}

export function extractFixturesFromPwhlScorebar(
  scoreboard: PwhlScorebarResponse,
  teamDefinition: TeamObject,
): SportsGame[] {
  const { key, label, emojiCode, teamId } = teamDefinition;
  const teamCode = teamId?.toUpperCase();
  if (!teamCode) {
    return [];
  }

  return (scoreboard.SiteKit?.Scorebar || [])
    .filter(
      (game) => game.HomeCode === teamCode || game.VisitorCode === teamCode,
    )
    .map((game) => {
      const isHome = game.HomeCode === teamCode;

      return {
        teamKey: key,
        teamLabel: label,
        emojiCode,
        opponent: isHome
          ? pickName(game.VisitorLongName, game.VisitorNickname)
          : pickName(game.HomeLongName, game.HomeNickname),
        startDate: game.GameDateISO8601 || "",
        venue: game.venue_name?.split("|")[0]?.trim(),
        isHome,
      };
    });
}

async function fetchPwhlScorebar(
  apiKey: string,
): Promise<PwhlScorebarResponse | undefined> {
  return safeFetchJson<PwhlScorebarResponse>(
    getPwhlScorebarUrl(apiKey, 0, 14),
    "PWHL scorebar",
  );
}

export async function fetchUpcomingSeattleSports(
  now: Date = new Date(),
  options: { pwhlApiKey?: string } = {},
): Promise<SportsGame[]> {
  const [espnFixtures, pwhlFixtures] = await Promise.all([
    fetchEspnFixtures(now),
    fetchPwhlFixtures(options.pwhlApiKey),
  ]);

  const window = getUpcomingWindow(now);
  return [...espnFixtures, ...pwhlFixtures]
    .filter((fixture) => fixture.startDate && inRange(fixture.startDate, window))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function inRange(dateString: string, { start, end }: DateRange): boolean {
  const candidate = new Date(dateString);
  return candidate >= start && candidate <= end;
}

async function fetchEspnFixtures(now: Date): Promise<SportsGame[]> {
  const espnTeams = SEATTLE_TEAMS.filter((team) => team.source === "espn");
  const uniquePaths = [...new Set(espnTeams.map((team) => team.path))];

  const responses = new Map<string, EspnScoreboardResponse | undefined>(
    await Promise.all(
      uniquePaths.map(
        async (path) =>
          [path, await fetchLeagueScoreboard(path, now)] as const,
      ),
    ),
  );

  return espnTeams.flatMap((team) => {
    const scoreboard = responses.get(team.path);
    return scoreboard ? extractFixturesFromScoreboard(scoreboard, team) : [];
  });
}

async function fetchPwhlFixtures(
  apiKey: string | undefined,
): Promise<SportsGame[]> {
  const pwhlTeams = SEATTLE_TEAMS.filter((team) => team.source === "pwhl");
  const normalizedKey = apiKey?.trim();
  if (!pwhlTeams.length || !normalizedKey) return [];

  const scorebar = await fetchPwhlScorebar(normalizedKey);
  if (!scorebar) return [];

  return pwhlTeams.flatMap((team) =>
    extractFixturesFromPwhlScorebar(scorebar, team),
  );
}
