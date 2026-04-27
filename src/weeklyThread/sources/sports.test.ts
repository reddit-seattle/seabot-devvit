import { describe, expect, it } from "vitest";
import { SEATTLE_TEAMS } from "../constants.js";
import {
  extractFixturesFromPwhlScorebar,
  extractFixturesFromScoreboard,
} from "./sports.js";
import type { EspnScoreboardResponse, PwhlScorebarResponse } from "../types.js";

describe("weeklyThread/sources/sports", () => {
  it("extracts fixtures for configured Seattle teams", () => {
    const scoreboard: EspnScoreboardResponse = {
      events: [
        {
          date: "2026-05-02T02:10:00Z",
          competitions: [
            {
              date: "2026-05-02T02:10:00Z",
              venue: {
                fullName: "T-Mobile Park",
              },
              competitors: [
                {
                  homeAway: "home",
                  team: {
                    id: "12",
                    displayName: "Seattle Mariners",
                  },
                },
                {
                  homeAway: "away",
                  team: {
                    id: "13",
                    displayName: "Texas Rangers",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const mariners = SEATTLE_TEAMS.find(
      (team) => team.key === "mariners",
    );

    expect(mariners).toBeDefined();

    const fixtures = extractFixturesFromScoreboard(scoreboard, mariners!);

    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({
      teamLabel: "Mariners",
      opponent: "Texas Rangers",
      isHome: true,
      venue: "T-Mobile Park",
      emojiCode: "Mariners",
    });
  });

  it("extracts Seattle Torrent fixtures from the PWHL scorebar", () => {
    const scorebar: PwhlScorebarResponse = {
      SiteKit: {
        Scorebar: [
          {
            GameDateISO8601: "2026-04-26T02:00:00-04:00",
            HomeCode: "SEA",
            HomeLongName: "Seattle Torrent",
            VisitorCode: "MTL",
            VisitorLongName: "Montréal Victoire",
            venue_name: "Climate Pledge Arena | Seattle",
          },
        ],
      },
    };

    const torrent = SEATTLE_TEAMS.find(
      (team) => team.key === "torrent",
    );

    expect(torrent).toBeDefined();

    const fixtures = extractFixturesFromPwhlScorebar(scorebar, torrent!);

    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({
      teamLabel: "Torrent",
      opponent: "Montréal Victoire",
      isHome: true,
      venue: "Climate Pledge Arena",
      emojiCode: "Torrent",
    });
  });
});
