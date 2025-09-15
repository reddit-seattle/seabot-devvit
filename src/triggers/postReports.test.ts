import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context, Post } from '@devvit/public-api';
import LogPostReport from './postReports.js';

// Mock dependencies
vi.mock('../utils/webhooks.js', () => ({
  SendContentToWebhook: vi.fn()
}));

vi.mock('../utils/reddithelpers.js', () => ({
  createPermalinkLink: vi.fn((permalink, text) => `[${text}](https://reddit.com${permalink})`)
}));

vi.mock('../utils/discordFormatters.js', () => ({
  formatUserInfo: vi.fn(() => 'Formatted user info'),
  formatScoreInfo: vi.fn(() => 'Formatted score info'),
  formatReportReasons: vi.fn(() => 'Formatted report reasons'),
  createDiscordField: vi.fn((name, value) => ({ name, value })),
  createEmbedFooter: vi.fn(() => ({ footer: { text: 'Footer' } }))
}));

const { SendContentToWebhook } = await import('../utils/webhooks.js');

const mockPost = {
  id: 'post123',
  title: 'Test Post Title',
  ignoringReports: false,
  modReportReasons: [],
  userReportReasons: [],
  score: 10,
  authorName: 'testuser',
  authorId: 'user123',
  permalink: '/r/test/comments/abc/test/',
  numReports: 1,
  upvotes: 12,
  downvotes: 2,
  numberOfComments: 5
} as unknown as Post;

const mockUser = {
  id: 'user123',
  linkKarma: 500,
  commentKarma: 300,
  createdAt: new Date('2023-01-01')
};

const mockContext = {
  settings: {
    get: vi.fn()
  },
  reddit: {
    getPostById: vi.fn(),
    getUserById: vi.fn()
  }
} as unknown as Context;

const mockEvent = {
  reason: 'Test report reason',
  post: mockPost
} as any;

describe('LogPostReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockContext.settings.get as any).mockResolvedValue('https://discord.com/webhook');
    (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
    (mockContext.reddit.getUserById as any).mockResolvedValue(mockUser);
  });

  it('should have correct event type', () => {
    expect(LogPostReport.event).toBe('PostReport');
  });

  it('should skip processing when no webhook URL is configured', async () => {
    (mockContext.settings.get as any).mockResolvedValue(null);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it('should process post report with all data', async () => {
    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(mockContext.reddit.getPostById).toHaveBeenCalledWith('post123');
    expect(mockContext.reddit.getUserById).toHaveBeenCalledWith('user123');
    expect(SendContentToWebhook).toHaveBeenCalledWith(
      'https://discord.com/webhook',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('New post reported'),
            description: expect.stringContaining('Test report reason'),
            fields: expect.any(Array)
          })
        ])
      })
    );
  });

  it('should skip ignored reports', async () => {
    const ignoredPost = {
      ...mockPost,
      ignoringReports: true
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(ignoredPost);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it('should handle posts with long titles when ignoring reports', async () => {
    const longTitlePost = {
      ...mockPost,
      title: 'a'.repeat(150), // Longer than 100 chars
      ignoringReports: true
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(longTitlePost);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });

  it('should handle posts with mod reports', async () => {
    const postWithModReports = {
      ...mockPost,
      modReportReasons: ['Mod report 1', 'Mod report 2']
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithModReports);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle posts with user reports', async () => {
    const postWithUserReports = {
      ...mockPost,
      userReportReasons: ['User report 1', 'User report 2']
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithUserReports);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle posts with both mod and user reports', async () => {
    const postWithBothReports = {
      ...mockPost,
      modReportReasons: ['Mod report'],
      userReportReasons: ['User report']
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithBothReports);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle posts with no categorized reports but direct reason', async () => {
    const postWithNoReports = {
      ...mockPost,
      modReportReasons: [],
      userReportReasons: []
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithNoReports);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle missing post ID', async () => {
    const eventWithoutPostId = {
      reason: 'Test report reason',
      post: { ...mockPost, id: undefined }
    };

    await LogPostReport.onEvent(eventWithoutPostId as any, mockContext);

    expect(mockContext.reddit.getPostById).toHaveBeenCalledWith('');
  });

  it('should handle missing author information', async () => {
    const postWithoutAuthor = {
      ...mockPost,
      authorId: undefined,
      authorName: undefined
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(postWithoutAuthor);
    (mockContext.reddit.getUserById as any).mockResolvedValue(null);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle posts with zero or negative scores', async () => {
    const lowScorePost = {
      ...mockPost,
      score: -5,
      upvotes: 2,
      downvotes: 7
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(lowScorePost);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle posts with many comments', async () => {
    const popularPost = {
      ...mockPost,
      numberOfComments: 1000
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(popularPost);

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    (mockContext.reddit.getPostById as any).mockRejectedValue(new Error('API Error'));

    // Call the function directly and ensure it handles the error
    await LogPostReport.onEvent(mockEvent, mockContext);
    expect(mockContext.reddit.getPostById).toHaveBeenCalled();
  });

  it('should handle webhook sending errors', async () => {
    (SendContentToWebhook as any).mockRejectedValue(new Error('Webhook Error'));

    // Call the function directly and ensure it handles the error
    await LogPostReport.onEvent(mockEvent, mockContext);
    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle getUserById errors', async () => {
    (mockContext.reddit.getUserById as any).mockRejectedValue(new Error('User API Error'));

    // Call the function directly and ensure it handles the error
    await LogPostReport.onEvent(mockEvent, mockContext);
    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should format post titles correctly for permalink', async () => {
    // Reset the webhook mock to resolve successfully
    (SendContentToWebhook as any).mockResolvedValue(undefined);
    
    const specialTitlePost = {
      ...mockPost,
      title: 'Post with "quotes" and [brackets] & symbols!'
    };

    (mockContext.reddit.getPostById as any).mockResolvedValue(specialTitlePost);

    // Call the function directly 
    await LogPostReport.onEvent(mockEvent, mockContext);
    expect(SendContentToWebhook).toHaveBeenCalled();
  });

  it('should handle empty webhook URL string', async () => {
    (mockContext.settings.get as any).mockResolvedValue('');

    await LogPostReport.onEvent(mockEvent, mockContext);

    expect(SendContentToWebhook).not.toHaveBeenCalled();
  });
});
