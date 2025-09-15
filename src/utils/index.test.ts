import { describe, it, expect } from 'vitest';

describe('utils index', () => {
  it('should re-export all parser utilities', async () => {
    const parsers = await import('./index.js');
    
    // Check that parser functions are exported
    expect(parsers.parseParticipantAuthor).toBeDefined();
    expect(parsers.parseConversationType).toBeDefined();
    expect(parsers.getItemDateString).toBeDefined();
    expect(typeof parsers.parseParticipantAuthor).toBe('function');
    expect(typeof parsers.parseConversationType).toBe('function');
    expect(typeof parsers.getItemDateString).toBe('function');
  });

  it('should re-export all webhook utilities', async () => {
    const webhooks = await import('./index.js');
    
    // Check that webhook functions are exported
    expect(webhooks.SendContentToWebhook).toBeDefined();
    expect(typeof webhooks.SendContentToWebhook).toBe('function');
  });

  it('should re-export all removal helper utilities', async () => {
    const helpers = await import('./index.js');
    
    // Check that removal helper functions are exported
    expect(helpers.removeWithReason).toBeDefined();
    expect(typeof helpers.removeWithReason).toBe('function');
  });

  it('should re-export all reddit helper utilities', async () => {
    const redditHelpers = await import('./index.js');
    
    // Check that reddit helper functions are exported
    expect(redditHelpers.createPermalinkLink).toBeDefined();
    expect(redditHelpers.createMarkdownLink).toBeDefined();
    expect(redditHelpers.createUserLink).toBeDefined();
    expect(redditHelpers.createResubmissionUrl).toBeDefined();
    expect(redditHelpers.createResubmissionLink).toBeDefined();
    expect(typeof redditHelpers.createPermalinkLink).toBe('function');
    expect(typeof redditHelpers.createMarkdownLink).toBe('function');
    expect(typeof redditHelpers.createUserLink).toBe('function');
    expect(typeof redditHelpers.createResubmissionUrl).toBe('function');
    expect(typeof redditHelpers.createResubmissionLink).toBe('function');
  });

  it('should re-export all discord formatter utilities', async () => {
    const formatters = await import('./index.js');
    
    // Check that discord formatter functions are exported
    expect(formatters.formatUserInfo).toBeDefined();
    expect(formatters.formatScoreInfo).toBeDefined();
    expect(formatters.formatReportReasons).toBeDefined();
    expect(formatters.createDiscordField).toBeDefined();
    expect(formatters.createEmbedFooter).toBeDefined();
    expect(typeof formatters.formatUserInfo).toBe('function');
    expect(typeof formatters.formatScoreInfo).toBe('function');
    expect(typeof formatters.formatReportReasons).toBe('function');
    expect(typeof formatters.createDiscordField).toBe('function');
    expect(typeof formatters.createEmbedFooter).toBe('function');
  });
});
