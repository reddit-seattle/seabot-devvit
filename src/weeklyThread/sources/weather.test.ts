import { describe, expect, it } from "vitest";
import { extractWeatherPeriods } from "./weather.js";

describe("weeklyThread/sources/weather", () => {
  it("merges paired night precip into the daytime row and keeps the day's detailedForecast", () => {
    const periods = extractWeatherPeriods({
      properties: {
        periods: [
          {
            name: "Sunday",
            startTime: "2026-04-26T13:00:00-07:00",
            isDaytime: true,
            temperature: 61,
            temperatureUnit: "F",
            probabilityOfPrecipitation: { value: 20 },
            detailedForecast:
              "Partly sunny, with a high near 61. Southwest wind around 5 mph.",
          },
          {
            name: "Sunday Night",
            startTime: "2026-04-27T01:00:00-07:00",
            isDaytime: false,
            temperature: 48,
            temperatureUnit: "F",
            probabilityOfPrecipitation: { value: 70 },
            detailedForecast: "Showers likely after midnight.",
          },
        ],
      },
    });

    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      name: "Sunday",
      temperature: 61,
      lowTemperature: 48,
      precipitationChance: 70,
      detailedForecast:
        "Partly sunny, with a high near 61. Southwest wind around 5 mph.",
    });
  });
});
