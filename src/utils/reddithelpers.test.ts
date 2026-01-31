import { describe, expect, it } from "vitest";
import {
  createMarkdownLink,
  createPermalinkLink,
  createResubmissionLink,
  createResubmissionUrl,
  createUserLink,
} from "../utils/reddithelpers.js";

describe("createMarkdownLink", () => {
  it("should create a basic markdown link", () => {
    const result = createMarkdownLink("Example", "https://example.com");
    expect(result).toBe("[Example](https://example.com)");
  });

  it("should handle special characters in text", () => {
    const result = createMarkdownLink(
      "Text with [brackets]",
      "https://example.com",
    );
    expect(result).toBe("[Text with [brackets]](https://example.com)");
  });

  it("should handle empty text", () => {
    const result = createMarkdownLink("", "https://example.com");
    expect(result).toBe("[](https://example.com)");
  });

  it("should handle special characters in URL", () => {
    const result = createMarkdownLink(
      "Example",
      "https://example.com/path?param=value&other=test",
    );
    expect(result).toBe(
      "[Example](https://example.com/path?param=value&other=test)",
    );
  });
});

describe("createUserLink", () => {
  it("should create a user link with plain username", () => {
    const result = createUserLink("testuser");
    expect(result).toBe("[testuser](https://reddit.com/u/testuser)");
  });

  it("should handle username with u/ prefix", () => {
    const result = createUserLink("u/testuser");
    expect(result).toBe("[u/testuser](https://reddit.com/u/testuser)");
  });

  it("should handle empty username", () => {
    const result = createUserLink("");
    expect(result).toBe("[](https://reddit.com/u/)");
  });

  it("should handle username with special characters", () => {
    const result = createUserLink("test_user-123");
    expect(result).toBe("[test_user-123](https://reddit.com/u/test_user-123)");
  });
});

describe("createPermalinkLink", () => {
  it("should create a permalink link", () => {
    const result = createPermalinkLink("/r/test/comments/abc123/", "View Post");
    expect(result).toBe(
      "[View Post](https://reddit.com/r/test/comments/abc123/)",
    );
  });

  it("should handle permalink without leading slash", () => {
    const result = createPermalinkLink("r/test/comments/abc123/", "View Post");
    expect(result).toBe(
      "[View Post](https://reddit.com/r/test/comments/abc123/)",
    );
  });

  it("should handle empty permalink", () => {
    const result = createPermalinkLink("", "Empty Link");
    expect(result).toBe("[Empty Link](https://reddit.com/)");
  });

  it("should handle special characters in link text", () => {
    const result = createPermalinkLink(
      "/r/test/comments/abc123/",
      "Post: [HELP] Need advice",
    );
    expect(result).toBe(
      "[Post: [HELP] Need advice](https://reddit.com/r/test/comments/abc123/)",
    );
  });
});

describe("createResubmissionUrl", () => {
  const title = "Test Post Title";
  const url = "https://example.com/article";
  const text = "This is the post body text.";

  describe("subreddit name normalization", () => {
    it("should handle plain subreddit name", () => {
      const result = createResubmissionUrl(
        "AskSeattle",
        title,
        undefined,
        text,
      );
      expect(result).toContain("/r/AskSeattle/submit");
    });

    it("should strip r/ prefix", () => {
      const result = createResubmissionUrl(
        "r/AskSeattle",
        title,
        undefined,
        text,
      );
      expect(result).toContain("/r/AskSeattle/submit");
    });

    it("should strip /r/ prefix", () => {
      const result = createResubmissionUrl(
        "/r/AskSeattle",
        title,
        undefined,
        text,
      );
      expect(result).toContain("/r/AskSeattle/submit");
    });
  });

  describe("URL parameter handling", () => {
    it("should include title parameter", () => {
      const result = createResubmissionUrl("test", title);
      expect(result).toContain("title=Test+Post+Title");
    });

    it("should handle text posts with body parameter", () => {
      const result = createResubmissionUrl("test", title, undefined, text);
      expect(result).toContain("text=This+is+the+post+body+text.");
    });

    it("should handle link posts with URL parameter", () => {
      const result = createResubmissionUrl("test", title, url);
      expect(result).toContain("url=https%3A%2F%2Fexample.com%2Farticle");
    });

    it("should avoid self-referential Reddit links", () => {
      const redditUrl = "https://reddit.com/r/test/comments/abc123/";
      const result = createResubmissionUrl("test", title, redditUrl, text);
      expect(result).not.toContain("url=");
      expect(result).toContain("text=This+is+the+post+body+text.");
    });

    it("should prefer URL over text when both are provided", () => {
      const result = createResubmissionUrl("test", title, url, text);
      expect(result).toContain("url=https%3A%2F%2Fexample.com%2Farticle");
      expect(result).not.toContain("text=");
    });

    it("should use old.reddit.com domain", () => {
      const result = createResubmissionUrl("test", title);
      expect(result).toMatch(/^https:\/\/old\.reddit\.com\//);
    });
  });

  describe("edge cases", () => {
    it("should handle empty title", () => {
      const result = createResubmissionUrl("test", "");
      expect(result).toBe("https://old.reddit.com/r/test/submit?");
    });

    it("should handle URL same as title", () => {
      const result = createResubmissionUrl("test", title, title, text);
      expect(result).toContain("text=This+is+the+post+body+text.");
      expect(result).not.toContain("url=");
    });

    it("should handle special characters in subreddit name", () => {
      const result = createResubmissionUrl("Test_Sub-123", title);
      expect(result).toContain("/r/Test_Sub-123/submit");
    });
  });
});

describe("createResubmissionLink", () => {
  const title = "Test Post Title";
  const url = "https://example.com/article";
  const text = "This is the post body text.";

  it("should create a markdown link with default text", () => {
    const result = createResubmissionLink("AskSeattle", title, undefined, text);
    expect(result).toMatch(
      /^\[Click here to resubmit your post to r\/AskSeattle\]\(https:\/\/old\.reddit\.com\/r\/AskSeattle\/submit\?.*\)$/,
    );
  });

  it("should create a markdown link with custom text", () => {
    const customText = "Repost to AskSeattle";
    const result = createResubmissionLink(
      "AskSeattle",
      title,
      undefined,
      text,
      customText,
    );
    expect(result).toMatch(
      /^\[Repost to AskSeattle\]\(https:\/\/old\.reddit\.com\/r\/AskSeattle\/submit\?.*\)$/,
    );
  });

  it("should handle subreddit name normalization in link text", () => {
    const result = createResubmissionLink(
      "/r/AskSeattle",
      title,
      undefined,
      text,
    );
    expect(result).toContain(
      "Click here to resubmit your post to r//r/AskSeattle",
    );
  });

  it("should create valid URL with proper encoding", () => {
    const result = createResubmissionLink(
      "test",
      "Title with spaces",
      undefined,
      "Text with & symbols",
    );
    expect(result).toContain("title=Title+with+spaces");
    expect(result).toContain("text=Text+with+%26+symbols");
  });
});
