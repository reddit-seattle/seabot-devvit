import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context, Post, Comment } from '@devvit/public-api';
import AddCommentToRestrictedFlairPost from './postFlair.js';
import { RESTRICTED_FLAIR_TEXT, RESTRICTED_FLAIR_COMMENT_TEXT } from '../settings.js';

const mockPost = {
  id: 'post123',
  linkFlair: { text: RESTRICTED_FLAIR_TEXT }
};

const mockComment = {
  id: 'comment123',
  permalink: '/r/test/comments/abc/test/comment123',
  distinguish: vi.fn(),
  lock: vi.fn(),
  isRemoved: vi.fn(() => false),
  isDistinguished: vi.fn(() => true),
  isStickied: vi.fn(() => true),
  body: RESTRICTED_FLAIR_COMMENT_TEXT
};

const mockExistingComment = {
  isRemoved: vi.fn(() => false),
  isDistinguished: vi.fn(() => true),
  isStickied: vi.fn(() => true),
  body: RESTRICTED_FLAIR_COMMENT_TEXT
};

const mockContext = {
  reddit: {
    getComments: vi.fn(),
    submitComment: vi.fn()
  }
} as unknown as Context;

const mockEvent = {
  post: mockPost
} as any;

describe('AddCommentToRestrictedFlairPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.reddit.submitComment as any).mockResolvedValue(mockComment);
    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve([]))
    });
  });

  it('should have correct event type', () => {
    expect(AddCommentToRestrictedFlairPost.event).toBe('PostFlairUpdate');
  });

  it('should add comment when post has restricted flair and no existing comment', async () => {
    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.getComments).toHaveBeenCalledWith({
      postId: 'post123',
      depth: 1,
    });

    expect(mockContext.reddit.submitComment).toHaveBeenCalledWith({
      id: 'post123',
      text: RESTRICTED_FLAIR_COMMENT_TEXT,
      runAs: "APP",
    });

    expect(mockComment.distinguish).toHaveBeenCalledWith(true);
    expect(mockComment.lock).toHaveBeenCalled();
  });

  it('should not add comment when post does not have restricted flair', async () => {
    const eventWithDifferentFlair = {
      post: {
        id: 'post123',
        linkFlair: { text: 'Different Flair' }
      }
    };

    await AddCommentToRestrictedFlairPost.onEvent(eventWithDifferentFlair as any, mockContext);

    expect(mockContext.reddit.getComments).not.toHaveBeenCalled();
    expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
  });

  it('should not add comment when post has no flair', async () => {
    const eventWithNoFlair = {
      post: {
        id: 'post123',
        linkFlair: null
      }
    };

    await AddCommentToRestrictedFlairPost.onEvent(eventWithNoFlair as any, mockContext);

    expect(mockContext.reddit.getComments).not.toHaveBeenCalled();
    expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
  });

  it('should not add comment when appropriate comment already exists', async () => {
    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve([mockExistingComment]))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.getComments).toHaveBeenCalled();
    expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
  });

  it('should add comment when existing comments do not match criteria', async () => {
    const inappropriateComment = {
      isRemoved: vi.fn(() => false),
      isDistinguished: vi.fn(() => false), // Not distinguished
      isStickied: vi.fn(() => true),
      body: RESTRICTED_FLAIR_COMMENT_TEXT
    };

    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve([inappropriateComment]))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.submitComment).toHaveBeenCalled();
  });

  it('should add comment when existing comment is removed', async () => {
    const removedComment = {
      isRemoved: vi.fn(() => true), // Removed
      isDistinguished: vi.fn(() => true),
      isStickied: vi.fn(() => true),
      body: RESTRICTED_FLAIR_COMMENT_TEXT
    };

    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve([removedComment]))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.submitComment).toHaveBeenCalled();
  });

  it('should add comment when existing comment is not stickied', async () => {
    const unstickiedComment = {
      isRemoved: vi.fn(() => false),
      isDistinguished: vi.fn(() => true),
      isStickied: vi.fn(() => false), // Not stickied
      body: RESTRICTED_FLAIR_COMMENT_TEXT
    };

    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve([unstickiedComment]))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.submitComment).toHaveBeenCalled();
  });

  it('should add comment when existing comment has different body', async () => {
    const differentBodyComment = {
      isRemoved: vi.fn(() => false),
      isDistinguished: vi.fn(() => true),
      isStickied: vi.fn(() => true),
      body: 'Different comment body'
    };

    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve([differentBodyComment]))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.submitComment).toHaveBeenCalled();
  });

  it('should handle multiple existing comments', async () => {
    const comments = [
      {
        isRemoved: vi.fn(() => false),
        isDistinguished: vi.fn(() => false),
        isStickied: vi.fn(() => true),
        body: 'Wrong comment 1'
      },
      mockExistingComment, // This one should match
      {
        isRemoved: vi.fn(() => false),
        isDistinguished: vi.fn(() => true),
        isStickied: vi.fn(() => false),
        body: 'Wrong comment 3'
      }
    ];

    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.resolve(comments))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
  });

  it('should handle errors in getComments', async () => {
    (mockContext.reddit.getComments as any).mockReturnValue({
      all: vi.fn(() => Promise.reject(new Error('Comments API error')))
    });

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    // Should not throw, should handle error gracefully
    expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
  });

  it('should handle errors in submitComment', async () => {
    (mockContext.reddit.submitComment as any).mockRejectedValue(new Error('Submit error'));

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    // Should not throw, should handle error gracefully
    expect(mockContext.reddit.submitComment).toHaveBeenCalled();
  });

  it('should handle errors in comment operations', async () => {
    const faultyComment = {
      ...mockComment,
      distinguish: vi.fn(() => Promise.reject(new Error('Distinguish error'))),
      lock: vi.fn(() => Promise.reject(new Error('Lock error')))
    };

    (mockContext.reddit.submitComment as any).mockResolvedValue(faultyComment);

    await AddCommentToRestrictedFlairPost.onEvent(mockEvent, mockContext);

    // Should not throw, should handle errors gracefully
    expect(faultyComment.distinguish).toHaveBeenCalled();
  });

  it('should handle post without ID', async () => {
    const eventWithoutId = {
      post: {
        linkFlair: { text: RESTRICTED_FLAIR_TEXT }
      }
    };

    await AddCommentToRestrictedFlairPost.onEvent(eventWithoutId as any, mockContext);

    // Should handle gracefully
    expect(mockContext.reddit.getComments).toHaveBeenCalled();
  });
});
