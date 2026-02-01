import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  removeWithFetchedRemovalReason,
  type RemovalOptions,
} from "./removalHelper.js";

// Mock the context object and its methods
const createMockContext = () => ({
  reddit: {
    getPostById: vi.fn(),
    getCommentById: vi.fn(),
    getSubredditRemovalReasons: vi.fn(),
    remove: vi.fn(),
    addRemovalNote: vi.fn(),
    submitComment: vi.fn(),
    getCurrentUsername: vi.fn().mockResolvedValue("testmod"),
  },
  ui: {
    showToast: vi.fn(),
  },
  subredditName: "testsubreddit",
});

const createMockPost = (removed = false) => ({
  id: "post123",
  permalink: "/r/testsubreddit/comments/post123/test_post",
  removed,
  lock: vi.fn(),
});

const createMockComment = (removed = false) => ({
  id: "comment123",
  permalink: "/r/testsubreddit/comments/post123/test_post/comment123",
  removed,
  lock: vi.fn(),
  distinguish: vi.fn(),
});

const createMockRemovalReasons = () => [
  {
    id: "reason1",
    title: "Low Effort Content",
    message: "Your post has been removed for being low effort.",
  },
  {
    id: "reason2",
    title: "Rule 5: Use AskSeattle",
    message: "Your post should be in /r/AskSeattle instead.",
  },
  {
    id: "reason3",
    title: "Spam Content",
    message: "This post appears to be spam.",
  },
];

describe("removeWithReason", () => {
  let mockContext: ReturnType<typeof createMockContext>;
  let baseOptions: RemovalOptions;

  beforeEach(() => {
    mockContext = createMockContext();
    baseOptions = {
      targetId: "post123",
      context: mockContext as any,
      rulePattern: "low effort",
      isPost: true,
    };
    vi.clearAllMocks();
  });

  describe("successful post removal", () => {
    it("should remove a post with matching removal reason", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      await removeWithFetchedRemovalReason(baseOptions);

      expect(mockContext.reddit.getPostById).toHaveBeenCalledWith("post123");
      expect(mockContext.reddit.remove).toHaveBeenCalledWith("post123", false);
      expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
        itemIds: ["post123"],
        reasonId: "reason1",
        modNote: "Removed by testmod via seabot",
      });
      expect(mockContext.reddit.submitComment).toHaveBeenCalledWith({
        id: "post123",
        text: "Your post has been removed for being low effort.",
        runAs: "APP",
      });
      expect(mockComment.distinguish).toHaveBeenCalledWith(true);
      expect(mockComment.lock).toHaveBeenCalled();
      expect(mockPost.lock).not.toHaveBeenCalled();
      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Post removed for Low Effort Content",
      );
    });

    it("should handle custom mod note", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      const optionsWithNote = {
        ...baseOptions,
      };

      await removeWithFetchedRemovalReason(optionsWithNote);

      expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
        itemIds: ["post123"],
        reasonId: "reason1",
        modNote: "Removed by testmod via seabot",
      });
    });

    it("should append footer to removal comment", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      const optionsWithFooter = {
        ...baseOptions,
        footer: "Please resubmit to the correct subreddit.",
      };

      await removeWithFetchedRemovalReason(optionsWithFooter);

      expect(mockContext.reddit.submitComment).toHaveBeenCalledWith({
        id: "post123",
        text: "Your post has been removed for being low effort.\n\n---\n\nPlease resubmit to the correct subreddit.",
        runAs: "APP",
      });
    });
  });

  describe("successful comment removal", () => {
    it("should remove a comment with matching removal reason", async () => {
      const mockComment = createMockComment();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockReplyComment = createMockComment();

      mockContext.reddit.getCommentById.mockResolvedValue(mockComment);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockReplyComment);

      const commentOptions = {
        ...baseOptions,
        targetId: "comment123",
        isPost: false,
      };

      await removeWithFetchedRemovalReason(commentOptions);

      expect(mockContext.reddit.getCommentById).toHaveBeenCalledWith(
        "comment123",
      );
      expect(mockContext.reddit.remove).toHaveBeenCalledWith(
        "comment123",
        false,
      );
      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Comment removed for Low Effort Content",
      );
    });
  });

  describe("removal reason matching", () => {
    it("should find removal reason with case-insensitive search", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      const optionsWithCaseSearch = {
        ...baseOptions,
        rulePattern: "LOW EFFORT", // uppercase
      };

      await removeWithFetchedRemovalReason(optionsWithCaseSearch);

      expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
        itemIds: ["post123"],
        reasonId: "reason1",
        modNote: "Removed by testmod via seabot",
      });
    });

    it("should find removal reason with multiple search terms", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      const optionsWithMultipleTerms = {
        ...baseOptions,
        rulePattern: "askseattle|rule 5", // regex alternation - should match second removal reason
      };

      await removeWithFetchedRemovalReason(optionsWithMultipleTerms);

      expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
        itemIds: ["post123"],
        reasonId: "reason2",
        modNote: "Removed by testmod via seabot",
      });
    });

    it("should use first matching removal reason when multiple match", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = [
        { id: "reason1", title: "Rule 1: Test Rule", message: "First match" },
        {
          id: "reason2",
          title: "Rule 2: Another Test",
          message: "Second match",
        },
      ];
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      const optionsWithAmbiguousSearch = {
        ...baseOptions,
        rulePattern: "rule", // matches both, should use first
      };

      await removeWithFetchedRemovalReason(optionsWithAmbiguousSearch);

      expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
        itemIds: ["post123"],
        reasonId: "reason1",
        modNote: "Removed by testmod via seabot",
      });
    });
  });

  describe("error handling", () => {
    it("should handle already removed post", async () => {
      const mockPost = createMockPost(true); // already removed

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);

      await removeWithFetchedRemovalReason(baseOptions);

      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "This post has already been removed.",
      );
      expect(mockContext.reddit.remove).not.toHaveBeenCalled();
      expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
    });

    it("should handle no matching removal reason found", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );

      const optionsWithNoMatch = {
        ...baseOptions,
        rulePattern: "nonexistent rule",
      };

      await removeWithFetchedRemovalReason(optionsWithNoMatch);

      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Error: Could not find removal reason matching: nonexistent rule",
      );
      expect(mockContext.reddit.remove).not.toHaveBeenCalled();
      expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
    });

    it("should handle removal note error gracefully", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.addRemovalNote.mockRejectedValue(
        new Error("Note failed"),
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      // Should not throw, just log warning
      await expect(
        removeWithFetchedRemovalReason(baseOptions),
      ).resolves.not.toThrow();

      expect(mockContext.reddit.remove).toHaveBeenCalled();
      expect(mockContext.reddit.submitComment).toHaveBeenCalled();
      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Post removed for Low Effort Content",
      );
    });

    it("should handle undefined removal reason title", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = [
        { id: "reason1", title: undefined, message: "Test message" },
        { id: "reason2", title: "Low Effort Content", message: "Valid reason" },
      ];
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      await removeWithFetchedRemovalReason(baseOptions);

      // Should skip the undefined title and find the valid one
      expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
        itemIds: ["post123"],
        reasonId: "reason2",
        modNote: "Removed by testmod via seabot",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty removal reasons array", async () => {
      const mockPost = createMockPost();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue([]);

      await removeWithFetchedRemovalReason(baseOptions);

      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Error: Could not find removal reason matching: low effort",
      );
      expect(mockContext.reddit.remove).not.toHaveBeenCalled();
    });

    it("should handle null comment response from submitComment", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(null);

      // Should not throw when comment is null
      await expect(
        removeWithFetchedRemovalReason(baseOptions),
      ).resolves.not.toThrow();

      expect(mockContext.reddit.remove).toHaveBeenCalled();
      expect(mockPost.lock).not.toHaveBeenCalled();
      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Post removed for Low Effort Content",
      );
    });

    it("should handle empty rulePattern (matches first reason)", async () => {
      const mockPost = createMockPost();
      const mockRemovalReasons = createMockRemovalReasons();
      const mockComment = createMockComment();

      mockContext.reddit.getPostById.mockResolvedValue(mockPost);
      mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(
        mockRemovalReasons,
      );
      mockContext.reddit.submitComment.mockResolvedValue(mockComment);

      const optionsWithEmptyTerms = {
        ...baseOptions,
        rulePattern: "", // Empty pattern matches everything, will match first reason
      };

      await removeWithFetchedRemovalReason(optionsWithEmptyTerms);

      // Empty regex matches any string, so it should match the first removal reason
      expect(mockContext.reddit.remove).toHaveBeenCalled();
      expect(mockContext.ui.showToast).toHaveBeenCalledWith(
        "Post removed for Low Effort Content",
      );
    });
  });
});
