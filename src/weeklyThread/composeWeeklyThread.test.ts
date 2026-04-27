import { describe, expect, it } from "vitest";
import { composeWeeklyThreadBody } from "./composeWeeklyThread.js";
import { WeeklyThreadConfig, WeeklyThreadSections } from "./types.js";

describe("weeklyThread/composeWeeklyThread", () => {
  it("renders configured header, generated sections, and configured footer", () => {
    const config: WeeklyThreadConfig = {
      enabled: true,
      titleTemplate:
        "Weekly What's Happening Thread: {{weekStart:MMMM D, YYYY}}",
      header: "Hello Seattle - week of {{weekStart:MMMM D}}",
      footer: "Footer note for {{weekEnd:MMMM D}}",
    };

    const sections: WeeklyThreadSections = {
      weather: [
        {
          name: "Monday",
          startTime: "2026-04-27T19:00:00Z",
          temperature: 58,
          temperatureUnit: "F",
          lowTemperature: 49,
          precipitationChance: 30,
          detailedForecast:
            "Partly sunny, with a high near 58. Showers likely after midnight.",
        },
      ],
      traffic: [
        {
          title: "Westbound I-90 overnight closure",
          impact: "High Impact",
          link: "https://example.test/traffic",
          updatedAt: "2026-04-24T09:43:27-07:00",
        },
      ],
      sports: [
        {
          teamKey: "reign",
          teamLabel: "Reign",
          emojiCode: "Reign",
          opponent: "Portland Thorns",
          startDate: "2026-05-03T02:30:00Z",
          venue: "Lumen Field",
          isHome: false,
        },
        {
          teamKey: "reign",
          teamLabel: "Reign",
          emojiCode: "Reign",
          opponent: "Angel City FC",
          startDate: "2026-05-05T02:00:00Z",
          venue: "Lumen Field",
          isHome: true,
        },
      ],
      cityEvents: [
        {
          title: "Sawubona Festival",
          link: "https://example.test/sawubona",
          dateStr: "2026-04-27",
        },
      ],
      subredditStats: {
        subscribersCount: 523456,
        name: "r/Seattle",
      },
    };

    const result = composeWeeklyThreadBody(
      config,
      sections,
      new Date("2026-04-25T12:00:00-07:00"),
    );

    expect(result).toContain("Hello Seattle - week of April 20");
    expect(result).toContain("## This week");
    expect(result).toContain("### Monday, 4/27");
    expect(result).toContain(
      "> 🌧️ **58° / 49°F** - Partly sunny, with a high near 58. Showers likely after midnight.",
    );
    expect(result).toContain("### Saturday, 5/2");
    expect(result).toContain("### Monday, 5/4");
    expect(result).toContain("| Matchup | Time | Venue |");
    expect(result).toContain(
      "| :Reign: **Reign** @ Portland Thorns | 7:30 PM | Lumen Field |",
    );
    expect(result).toContain(
      "| :Reign: **Reign** vs Angel City FC | 7:00 PM | **Lumen Field** |",
    );
    expect(result).toContain("## Traffic alerts");
    expect(result).toContain("**City events**");
    expect(result).toContain("- [Sawubona Festival](https://example.test/sawubona)");
    expect(result).toContain("**r/Seattle** has 523,456 subscribers");
    expect(result).toContain("Footer note for April 26");
  });

  it("omits traffic and events sections when they have no useful items", () => {
    const config: WeeklyThreadConfig = {
      enabled: true,
      titleTemplate: "Weekly What's Happening Thread: {{date:MMMM D, YYYY}}",
      header: "",
      footer: "",
    };

    const sections: WeeklyThreadSections = {
      weather: [
        {
          name: "Sunday",
          startTime: "2026-04-26T19:00:00Z",
          temperature: 67,
          temperatureUnit: "F",
          lowTemperature: 52,
          precipitationChance: 0,
          detailedForecast: "Sunny.",
        },
      ],
      traffic: [],
      sports: [],
      cityEvents: [],
    };

    const result = composeWeeklyThreadBody(config, sections);

    expect(result).toContain("## This week");
    expect(result).toContain("### Sunday, 4/26");
    expect(result).toContain("> ☀️ **67° / 52°F** - Sunny.");
    expect(result).not.toContain("## Traffic alerts");
    expect(result).not.toContain("**Sports**");
    expect(result).not.toContain("---\n\n---");
  });
});
