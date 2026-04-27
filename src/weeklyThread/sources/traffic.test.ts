import { describe, expect, it } from "vitest";
import { filterSeattleAlerts } from "./traffic.js";
import type { WsdotHighwayAlert } from "../types.js";

function alert(overrides: Partial<WsdotHighwayAlert>): WsdotHighwayAlert {
  return {
    AlertID: 1,
    County: null,
    EndTime: null,
    EventCategory: "Construction",
    EventStatus: "Open",
    ExtendedDescription: "",
    HeadlineDescription: "headline",
    LastUpdatedTime: "/Date(1777234104000-0700)/",
    Priority: "Medium",
    Region: "Northwest",
    StartTime: null,
    ...overrides,
  };
}

describe("weeklyThread/sources/traffic", () => {
  it("keeps Northwest medium+ alerts and drops out-of-region, low priority, expired, and stale ones", () => {
    const now = new Date("2026-04-26T12:00:00-07:00");
    const alerts: WsdotHighwayAlert[] = [
      alert({
        AlertID: 1,
        Priority: "High",
        HeadlineDescription: "I-5 closure",
      }),
      alert({
        AlertID: 2,
        Region: "Eastern",
        HeadlineDescription: "Spokane work",
      }),
      alert({
        AlertID: 3,
        Priority: "Low",
        HeadlineDescription: "minor SR 9 lane",
      }),
      alert({
        AlertID: 4,
        EndTime: "/Date(1745539200000-0700)/",
        HeadlineDescription: "expired alert",
      }),
      alert({
        AlertID: 5,
        Priority: "Highest",
        HeadlineDescription: "SR 520 emergency",
      }),
      alert({
        AlertID: 6,
        Priority: "High",
        // Six months old — stale, drop it.
        LastUpdatedTime: "/Date(1761338400000-0700)/",
        HeadlineDescription: "Cayuse Pass seasonal closure",
      }),
    ];

    const filtered = filterSeattleAlerts(alerts, now);

    expect(filtered.map((a) => a.title)).toEqual([
      "SR 520 emergency",
      "I-5 closure",
    ]);
    expect(filtered[0]).toMatchObject({
      impact: "Construction",
      link: "https://wsdot.wa.gov/traffic/trafficalerts/default.aspx?refnum=5&action=2",
    });
  });
});
