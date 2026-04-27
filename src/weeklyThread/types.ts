export interface DateRange {
  start: Date;
  end: Date;
}

export interface WeeklyThreadConfig {
  enabled: boolean;
  titleTemplate: string;
  header: string;
  footer: string;
}

export interface WeatherPeriod {
  name: string;
  startTime?: string;
  temperature: number;
  temperatureUnit: string;
  lowTemperature?: number;
  precipitationChance?: number;
  detailedForecast: string;
}

export interface TrafficAlert {
  title: string;
  impact?: string;
  link?: string;
  updatedAt?: string;
}

export interface SportsGame {
  teamKey: string;
  teamLabel: string;
  emojiCode?: string;
  opponent: string;
  startDate: string;
  venue?: string;
  isHome: boolean;
}

export interface CityEvent {
  title: string;
  link?: string;
  dateStr: string;
  endDateStr?: string;
}

export interface SubredditStats {
  subscribersCount: number;
  name: string;
}

export interface WeeklyThreadSections {
  weather: WeatherPeriod[];
  traffic: TrafficAlert[];
  sports: SportsGame[];
  cityEvents: CityEvent[];
  subredditStats?: SubredditStats;
}

export interface WsdotRoadwayLocation {
  Description: string | null;
  Direction: string | null;
  Latitude: number | null;
  Longitude: number | null;
  MilePost: number | null;
  RoadName: string | null;
}

export interface WsdotHighwayAlert {
  AlertID: number;
  County: string | null;
  EndTime: string | null;
  EventCategory: string | null;
  EventStatus: string | null;
  ExtendedDescription: string | null;
  HeadlineDescription: string | null;
  LastUpdatedTime: string | null;
  Priority: "Highest" | "High" | "Medium" | "Low" | "Lowest" | string | null;
  Region: string | null;
  StartTime: string | null;
  StartRoadwayLocation?: WsdotRoadwayLocation;
  EndRoadwayLocation?: WsdotRoadwayLocation;
}

export interface NwsPointResponse {
  properties: {
    forecast: string;
  };
}

export interface NwsForecastResponse {
  properties: {
    periods: Array<{
      name: string;
      startTime: string;
      isDaytime: boolean;
      temperature: number;
      temperatureUnit: string;
      probabilityOfPrecipitation?: {
        value?: number | null;
      };
      detailedForecast: string;
    }>;
  };
}

export interface EspnScoreboardResponse {
  events?: Array<{
    date?: string;
    competitions?: Array<{
      date?: string;
      venue?: {
        fullName?: string;
      };
      competitors?: Array<{
        homeAway?: "home" | "away";
        team?: {
          id?: string;
          displayName?: string;
        };
      }>;
    }>;
  }>;
}

export interface PwhlScorebarResponse {
  SiteKit?: {
    Scorebar?: Array<{
      GameDateISO8601?: string;
      HomeCode?: string;
      HomeLongName?: string;
      HomeNickname?: string;
      VisitorCode?: string;
      VisitorLongName?: string;
      VisitorNickname?: string;
      venue_name?: string;
    }>;
  };
}
