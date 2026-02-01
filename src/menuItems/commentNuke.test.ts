import { describe, it, expect, vi, beforeEach } from "vitest";
import { Comment, Context, MenuItemOnPressEvent } from "@devvit/public-api";
import CommentNuke from "./commentNuke.js";

// Mock dependencies
const mockComment = {
  id: "comment123",
  permalink: "/r/test/comments/abc/test/comment123",
  isDistinguished: vi.fn(),
  removed: false,
  locked: false,
  remove: vi.fn(),
  lock: vi.fn(),
  replies: {
    all: vi.fn(),
  },
} as unknown as Comment;

const mockReply1 = {
  id: "reply1",
  isDistinguished: vi.fn(() => false),
  removed: false,
  locked: false,
  remove: vi.fn(),
  lock: vi.fn(),
  replies: { all: vi.fn(() => Promise.resolve([])) },
} as unknown as Comment;

const mockReply2 = {
  id: "reply2",
  isDistinguished: vi.fn(() => true), // Distinguished (mod comment)
  removed: false,
  locked: false,
  remove: vi.fn(),
  lock: vi.fn(),
  replies: { all: vi.fn(() => Promise.resolve([])) },
} as unknown as Comment;

const mockContext = {
  reddit: {
    getCommentById: vi.fn(),
  },
  ui: {
    showToast: vi.fn(),
  },
} as unknown as Context;

const mockEvent = {
  targetId: "comment123",
} as MenuItemOnPressEvent;

describe("CommentNuke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct menu item properties", () => {
    expect(CommentNuke.label).toBe("Comment Nuke");
    expect(CommentNuke.description).toBe(
      "Remove nested comments except mod comments",
    );
    expect(CommentNuke.location).toBe("comment");
    expect(CommentNuke.forUserType).toBe("moderator");
  });

  it("should handle missing targetId", async () => {
    const eventWithoutTarget = {
      targetId: undefined,
      location: "comment",
    } as unknown as MenuItemOnPressEvent;

    await CommentNuke.onPress(eventWithoutTarget, mockContext);

    expect(mockContext.reddit.getCommentById).not.toHaveBeenCalled();
  });

  it("should remove non-distinguished comments and skip distinguished ones", async () => {
    // Setup mock comment with replies
    mockComment.replies.all = vi.fn(() =>
      Promise.resolve([mockReply1, mockReply2]),
    );
    mockComment.isDistinguished = vi.fn(() => false);

    (mockContext.reddit.getCommentById as any).mockResolvedValue(mockComment);

    await CommentNuke.onPress(mockEvent, mockContext);

    // Should get the target comment
    expect(mockContext.reddit.getCommentById).toHaveBeenCalledWith(
      "comment123",
    );

    // Should process replies
    expect(mockComment.replies.all).toHaveBeenCalled();

    // Should remove and lock non-distinguished comments (original + reply1)
    expect(mockComment.remove).toHaveBeenCalled();
    expect(mockComment.lock).toHaveBeenCalled();
    expect(mockReply1.remove).toHaveBeenCalled();
    expect(mockReply1.lock).toHaveBeenCalled();

    // Should NOT remove distinguished comment (reply2)
    expect(mockReply2.remove).not.toHaveBeenCalled();
    expect(mockReply2.lock).not.toHaveBeenCalled();

    // Should show success toast
    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      expect.stringContaining("Successfully removed 2 comments"),
    );
  });

  it("should handle already removed/locked comments gracefully", async () => {
    // Setup comment that's already removed and locked
    const alreadyProcessedComment = {
      id: "comment123",
      isDistinguished: vi.fn(() => false),
      removed: true,
      locked: true,
      replies: { all: vi.fn(() => Promise.resolve([])) },
      remove: vi.fn(),
      lock: vi.fn(),
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      alreadyProcessedComment,
    );

    await CommentNuke.onPress(mockEvent, mockContext);

    // Should NOT call remove/lock methods since comment is already removed/locked
    expect(alreadyProcessedComment.remove).not.toHaveBeenCalled();
    expect(alreadyProcessedComment.lock).not.toHaveBeenCalled();
  });

  it("should show appropriate message when no comments to remove", async () => {
    // Setup comment that's distinguished (mod comment)
    const distinguishedComment = {
      ...mockComment,
      isDistinguished: vi.fn(() => true),
      replies: { all: vi.fn(() => Promise.resolve([])) },
    };

    (mockContext.reddit.getCommentById as any).mockResolvedValue(
      distinguishedComment,
    );

    await CommentNuke.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "No comments to remove",
    );
  });

  it("should handle nested comment replies recursively", async () => {
    // Create nested structure: comment -> reply1 -> nestedReply
    const nestedReply = {
      id: "nested1",
      isDistinguished: vi.fn(() => false),
      removed: false,
      locked: false,
      remove: vi.fn(),
      lock: vi.fn(),
      replies: { all: vi.fn(() => Promise.resolve([])) },
    } as unknown as Comment;

    mockReply1.replies.all = vi.fn(() => Promise.resolve([nestedReply]));
    mockComment.replies.all = vi.fn(() => Promise.resolve([mockReply1]));
    mockComment.isDistinguished = vi.fn(() => false);

    (mockContext.reddit.getCommentById as any).mockResolvedValue(mockComment);

    await CommentNuke.onPress(mockEvent, mockContext);

    // Should remove all non-distinguished comments in the tree
    expect(mockComment.remove).toHaveBeenCalled();
    expect(mockReply1.remove).toHaveBeenCalled();
    expect(nestedReply.remove).toHaveBeenCalled();

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      expect.stringContaining("Successfully removed 3 comments"),
    );
  });

  it("should handle errors gracefully", async () => {
    (mockContext.reddit.getCommentById as any).mockRejectedValue(
      new Error("API Error"),
    );

    await CommentNuke.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Comment nuke failed! Please try again later.",
    );
  });

  it("should handle remove/lock operation failures", async () => {
    mockComment.isDistinguished = vi.fn(() => false);
    mockComment.replies.all = vi.fn(() => Promise.resolve([]));
    mockComment.remove = vi.fn(() =>
      Promise.reject(new Error("Remove failed")),
    );

    (mockContext.reddit.getCommentById as any).mockResolvedValue(mockComment);

    await CommentNuke.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Comment nuke failed! Please try again later.",
    );
  });
});
