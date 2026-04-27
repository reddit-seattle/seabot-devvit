import type {
  NwsForecastResponse,
  NwsPointResponse,
  WeatherPeriod,
} from "../types.js";
import { WEATHER_FORECAST_DAYS } from "../constants.js";
import { fetchJson, NOAA_SEATTLE_POINT_URL } from "../api.js";

function maxPrecip(
  day: number | null | undefined,
  night: number | null | undefined,
): number | undefined {
  const values = [day, night].filter(
    (value): value is number => typeof value === "number",
  );
  return values.length ? Math.max(...values) : undefined;
}

export function extractWeatherPeriods(
  forecast: NwsForecastResponse,
  limit: number = WEATHER_FORECAST_DAYS,
): WeatherPeriod[] {
  const periods = forecast.properties.periods || [];

  return periods
    .reduce<WeatherPeriod[]>((result, period, index) => {
      if (!period.isDaytime) {
        return result;
      }

      const nextPeriod = periods[index + 1];
      const nightPeriod =
        nextPeriod && !nextPeriod.isDaytime ? nextPeriod : undefined;

      result.push({
        name: period.name,
        startTime: period.startTime,
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        lowTemperature: nightPeriod?.temperature,
        precipitationChance: maxPrecip(
          period.probabilityOfPrecipitation?.value,
          nightPeriod?.probabilityOfPrecipitation?.value,
        ),
        detailedForecast: period.detailedForecast,
      } satisfies WeatherPeriod);

      return result;
    }, [])
    .slice(0, limit);
}

export async function fetchWeeklyWeatherPeriods(): Promise<WeatherPeriod[]> {
  const pointData = await fetchJson<NwsPointResponse>(
    NOAA_SEATTLE_POINT_URL,
    "NOAA point forecast",
  );
  const forecastData = await fetchJson<NwsForecastResponse>(
    pointData.properties.forecast,
    "NOAA weekly forecast",
  );
  return extractWeatherPeriods(forecastData);
}
