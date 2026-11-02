import { describe, expect, it } from "vitest";
import {
  AddCommentToRestrictedFlairPost,
  LogCommentReports,
  LogModmailMessage,
  LogPostReport,
  ReportCommenterParticipation,
} from "./index.js";

const triggers = [
  LogCommentReports,
  LogModmailMessage,
  AddCommentToRestrictedFlairPost,
  LogPostReport,
  ReportCommenterParticipation,
];

describe("triggers index", () => {
  it("should export all triggers", () => {
    expect(triggers).toBeDefined();
    expect(Array.isArray(triggers)).toBe(true);
    expect(triggers).toHaveLength(5);

    // Verify each trigger has the required properties
    triggers.forEach((trigger) => {
      expect(trigger).toHaveProperty("event");
      expect(trigger).toHaveProperty("onEvent");
      expect(typeof trigger.onEvent).toBe("function");
    });
  });

  it("should include all expected triggers", () => {
    const events = triggers.map((trigger) => trigger.event);
    expect(events).toContain("CommentReport");
    expect(events).toContain("ModMail");
    expect(events).toContain("PostFlairUpdate");
    expect(events).toContain("PostReport");
    expect(events).toContain("CommentCreate");
  });
});
