import { describe, expect, it } from "vitest";
import {
  filterUpcomingCityEvents,
  parseCityEventsXml,
} from "./events.js";
import type { CityEvent } from "../types.js";

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Sawubona Festival</title>
      <link>https://example.test/sawubona</link>
      <description>&lt;b&gt;Event Types&lt;/b&gt;:&amp;nbsp;Festivals/Fairs, Dance &lt;br/&gt;&lt;b&gt;Audience&lt;/b&gt;</description>
      <category>2026/04/27 (Mon)</category>
    </item>
    <item>
      <title>Seattle Film Commission</title>
      <link>https://example.test/film</link>
      <description>&lt;b&gt;Event Types&lt;/b&gt;:&amp;nbsp;Boards &amp;amp; Commissions &lt;br/&gt;</description>
      <category>2026/04/27 (Mon)</category>
    </item>
    <item>
      <title>Council Briefing</title>
      <link>https://example.test/council</link>
      <description>&lt;b&gt;Event Types&lt;/b&gt;:&amp;nbsp;City Council Meeting &lt;br/&gt;</description>
      <category>2026/04/28 (Tue)</category>
    </item>
    <item>
      <title>Old Event</title>
      <link>https://example.test/old</link>
      <description>&lt;b&gt;Event Types&lt;/b&gt;:&amp;nbsp;Special Events &lt;br/&gt;</description>
      <category>2026/04/01 (Wed)</category>
    </item>
    <item>
      <title>No Type Event</title>
      <link>https://example.test/notype</link>
      <description>some description without event types</description>
      <category>2026/04/28 (Tue)</category>
    </item>
  </channel>
</rss>`;

describe("weeklyThread/sources/events", () => {
  it("parses items into title/link/date", () => {
    const events = parseCityEventsXml(SAMPLE_XML);
    const titles = events.map((e) => e.title);
    expect(titles).toContain("Sawubona Festival");
    expect(titles).toContain("Old Event");
    expect(titles).toContain("No Type Event");
    // No client-side type filtering anymore — feed is filtered server-side.
    expect(titles).toContain("Seattle Film Commission");
    expect(titles).toContain("Council Briefing");
  });

  it("decodes XML entities in titles and links", () => {
    const events = parseCityEventsXml(SAMPLE_XML);
    const sawubona = events.find((e) => e.title === "Sawubona Festival");
    expect(sawubona?.link).toBe("https://example.test/sawubona");
    expect(sawubona?.dateStr).toBe("2026-04-27");
  });

  it("decodes numeric HTML entities", () => {
    const xml = `<rss><channel><item>
      <title>NW Nature &#38; Health Symposium</title>
      <link>https://example.test/x</link>
      <category>2026/04/29 (Wed)</category>
    </item></channel></rss>`;
    const events = parseCityEventsXml(xml);
    expect(events[0].title).toBe("NW Nature & Health Symposium");
  });

  it("dedupes events with the same title and date", () => {
    const events: CityEvent[] = [
      { title: "Symposium", link: "https://a", dateStr: "2026-04-29" },
      { title: "Symposium", link: "https://b", dateStr: "2026-04-29" },
      // Different date, non-consecutive — kept separate.
      { title: "Symposium", link: "https://c", dateStr: "2026-05-02" },
    ];
    const now = new Date("2026-04-28T12:00:00-07:00");
    const upcoming = filterUpcomingCityEvents(events, now);
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].link).toBe("https://a");
    expect(upcoming[0].endDateStr).toBeUndefined();
    expect(upcoming[1].dateStr).toBe("2026-05-02");
  });

  it("filters to upcoming 7-day window", () => {
    const events = parseCityEventsXml(SAMPLE_XML);
    const now = new Date("2026-04-26T12:00:00-07:00");
    const upcoming = filterUpcomingCityEvents(events, now);
    const titles = upcoming.map((e) => e.title);
    expect(titles).toContain("Sawubona Festival");
    expect(titles).not.toContain("Old Event");
  });

  it("returns all events per day (no cap)", () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      title: `Event ${i}`,
      dateStr: "2026-04-27",
    }));
    const now = new Date("2026-04-26T12:00:00-07:00");
    const upcoming = filterUpcomingCityEvents(events, now);
    expect(upcoming).toHaveLength(10);
  });

  it("collapses same-titled events on consecutive days into a single entry with endDate", () => {
    const events: CityEvent[] = [
      { title: "Plant Sale", link: "https://a", dateStr: "2026-04-27" },
      { title: "Plant Sale", link: "https://a", dateStr: "2026-04-28" },
      { title: "Plant Sale", link: "https://a", dateStr: "2026-04-29" },
      // Non-consecutive recurrence — kept separately.
      { title: "Plant Sale", link: "https://a", dateStr: "2026-05-02" },
      // Different title on same days — unaffected.
      { title: "Other Event", dateStr: "2026-04-28" },
    ];
    const now = new Date("2026-04-26T12:00:00-07:00");
    const upcoming = filterUpcomingCityEvents(events, now);

    const plantSales = upcoming.filter((e) => e.title === "Plant Sale");
    expect(plantSales).toHaveLength(2);
    expect(plantSales[0]).toMatchObject({
      dateStr: "2026-04-27",
      endDateStr: "2026-04-29",
    });
    expect(plantSales[1]).toMatchObject({ dateStr: "2026-05-02" });
    expect(plantSales[1].endDateStr).toBeUndefined();

    expect(upcoming.find((e) => e.title === "Other Event")).toBeDefined();
  });
});
