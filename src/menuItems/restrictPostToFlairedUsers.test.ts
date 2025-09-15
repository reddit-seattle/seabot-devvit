import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context, MenuItemOnPressEvent, Post } from '@devvit/public-api';
import RestrictPostToFlairedUsers from './restrictPostToFlairedUsers.js';
import { RESTRICTED_FLAIR_TEXT } from '../settings.js';

const mockPost = {
  id: 'post123',
  permalink: '/r/test/comments/abc/test/',
  flair: null
} as unknown as Post;

const mockPostWithFlair = {
  id: 'post123',
  permalink: '/r/test/comments/abc/test/',
  flair: { text: RESTRICTED_FLAIR_TEXT }
} as unknown as Post;

const mockContext = {
  reddit: {
    getPostById: vi.fn(),
    setPostFlair: vi.fn()
  },
  ui: {
    showToast: vi.fn()
  },
  subredditName: 'testsubreddit'
} as unknown as Context;

const mockEvent = {
  targetId: 'post123',
  location: 'post'
} as MenuItemOnPressEvent;

describe('RestrictPostToFlairedUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct menu item properties', () => {
    expect(RestrictPostToFlairedUsers.label).toBe("Require Flair for Comments");
    expect(RestrictPostToFlairedUsers.description).toBe("Restrict this post to flaired users");
    expect(RestrictPostToFlairedUsers.location).toBe("post");
    expect(RestrictPostToFlairedUsers.forUserType).toBe("moderator");
  });

  it('should handle missing targetId', async () => {
    const eventWithoutTarget = { 
      targetId: undefined, 
      location: 'post' 
    } as unknown as MenuItemOnPressEvent;
    
    await RestrictPostToFlairedUsers.onPress(eventWithoutTarget, mockContext);
    
    expect(mockContext.reddit.getPostById).not.toHaveBeenCalled();
  });

  it('should restrict post when it does not have restricted flair', async () => {
    (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
    (mockContext.reddit.setPostFlair as any).mockResolvedValue(undefined);

    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.reddit.getPostById).toHaveBeenCalledWith('post123');
    expect(mockContext.reddit.setPostFlair).toHaveBeenCalledWith({
      postId: 'post123',
      text: RESTRICTED_FLAIR_TEXT,
      subredditName: 'testsubreddit',
    });
    expect(mockContext.ui.showToast).toHaveBeenCalledWith({
      text: `Post restricted to flaired users.`,
      appearance: "success",
    });
  });

  it('should not restrict post when it already has restricted flair', async () => {
    (mockContext.reddit.getPostById as any).mockResolvedValue(mockPostWithFlair);

    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.reddit.getPostById).toHaveBeenCalledWith('post123');
    expect(mockContext.reddit.setPostFlair).not.toHaveBeenCalled();
    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      `This post is already restricted to flaired users.`
    );
  });

  it('should handle post with different flair text', async () => {
    const postWithDifferentFlair = {
      ...mockPost,
      flair: { text: 'Different Flair' }
    };
    
    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithDifferentFlair);
    (mockContext.reddit.setPostFlair as any).mockResolvedValue(undefined);

    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.reddit.setPostFlair).toHaveBeenCalled();
    expect(mockContext.ui.showToast).toHaveBeenCalledWith({
      text: `Post restricted to flaired users.`,
      appearance: "success",
    });
  });

  it('should handle post with no flair object', async () => {
    const postWithNoFlair = {
      ...mockPost,
      flair: null
    };
    
    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithNoFlair);
    (mockContext.reddit.setPostFlair as any).mockResolvedValue(undefined);

    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.reddit.setPostFlair).toHaveBeenCalled();
  });

  it('should handle context without subredditName', async () => {
    const contextWithoutSubreddit = {
      ...mockContext,
      subredditName: undefined
    };
    
    (contextWithoutSubreddit.reddit.getPostById as any).mockResolvedValue(mockPost);
    (contextWithoutSubreddit.reddit.setPostFlair as any).mockResolvedValue(undefined);

    await RestrictPostToFlairedUsers.onPress(mockEvent, contextWithoutSubreddit);

    expect(contextWithoutSubreddit.reddit.setPostFlair).toHaveBeenCalledWith({
      postId: 'post123',
      text: RESTRICTED_FLAIR_TEXT,
      subredditName: "",
    });
  });

  it('should handle setPostFlair errors', async () => {
    const errorMessage = 'Flair setting failed';
    (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
    (mockContext.reddit.setPostFlair as any).mockRejectedValue(new Error(errorMessage));

    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to restrict post to flaired users: Error: " + errorMessage
    );
  });

  it('should handle getPostById errors', async () => {
    (mockContext.reddit.getPostById as any).mockRejectedValue(new Error('Post not found'));

    // Call the function directly and ensure it handles the error
    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to restrict post to flaired users: Error: Post not found"
    );
  });

  it('should handle unknown errors', async () => {
    (mockContext.reddit.getPostById as any).mockRejectedValue('Unknown error');

    // Call the function directly and ensure it handles the error
    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to restrict post to flaired users: Unknown error"
    );
  });

  it('should handle null errors', async () => {
    (mockContext.reddit.getPostById as any).mockRejectedValue(null);

    // Call the function directly and ensure it handles the error
    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to restrict post to flaired users: null"
    );
  });

  it('should handle empty string errors with fallback', async () => {
    (mockContext.reddit.getPostById as any).mockRejectedValue('');

    // Call the function directly and ensure it handles the error
    await RestrictPostToFlairedUsers.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to restrict post to flaired users: "
    );
  });
});
