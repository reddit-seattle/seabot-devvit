import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from '@devvit/public-api';
import RemoveAskSeattle from './removeAskSeattle.js';

// Mock dependencies
vi.mock('../utils/removalHelper.js', () => ({
    removeWithReason: vi.fn(),
}));

vi.mock('../utils/reddithelpers.js', () => ({
    createResubmissionLink: vi.fn((subreddit, title, url, body) =>
        `[Click here to resubmit your post to r/${subreddit}](https://old.reddit.com/r/${subreddit}/submit?title=${encodeURIComponent(title)})`
    ),
}));

import { removeWithReason } from '../utils/removalHelper.js';
import { createResubmissionLink } from '../utils/reddithelpers.js';

const createMockContext = () => {
    const context = {
        reddit: {
            getPostById: vi.fn(),
        },
        ui: {
            showToast: vi.fn(),
        },
        subredditName: 'testsubreddit',
    } as unknown as Context;
    return context;
};

const createMockPost = () => ({
    id: 'post123',
    title: 'Looking for restaurant recommendations',
    url: 'https://reddit.com/r/testsubreddit/comments/post123/',
    body: 'Can anyone recommend a good pizza place downtown?',
    permalink: '/r/testsubreddit/comments/post123/looking_for_restaurant_recommendations/',
});

const createMockEvent = (targetId: string = 'post123') => ({
    targetId,
    location: 'post' as const,
});

describe('RemoveAskSeattle Menu Item', () => {
    let mockContext: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        mockContext = createMockContext();
        vi.clearAllMocks();
    });

    describe('menu item configuration', () => {
        it('should have correct configuration', () => {
            expect(RemoveAskSeattle.label).toBe('Remove for r/AskSeattle');
            expect(RemoveAskSeattle.description).toBe('Remove post and apply Rule 5: Use r/AskSeattle for recommendations');
            expect(RemoveAskSeattle.location).toBe('post');
            expect(RemoveAskSeattle.forUserType).toBe('moderator');
            expect(typeof RemoveAskSeattle.onPress).toBe('function');
        });
    });

    describe('onPress functionality', () => {
        it('should successfully remove post with resubmission link', async () => {
            const mockPost = createMockPost();
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Click here to resubmit your post to r/AskSeattle](https://old.reddit.com/r/AskSeattle/submit?title=Looking%20for%20restaurant%20recommendations)');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(mockContext.reddit.getPostById).toHaveBeenCalledWith('post123');
            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                'Looking for restaurant recommendations',
                'https://reddit.com/r/testsubreddit/comments/post123/',
                'Can anyone recommend a good pizza place downtown?'
            );
            expect(removeWithReason).toHaveBeenCalledWith({
                targetId: 'post123',
                context: mockContext,
                ruleSearchTerms: ['askseattle', 'rule 5'],
                isPost: true,
                footer: '[Click here to resubmit your post to r/AskSeattle](https://old.reddit.com/r/AskSeattle/submit?title=Looking%20for%20restaurant%20recommendations)',
            });
        });

        it('should handle post with no body text', async () => {
            const mockPost = {
                ...createMockPost(),
                body: undefined,
            };
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                'Looking for restaurant recommendations',
                'https://reddit.com/r/testsubreddit/comments/post123/',
                undefined
            );
        });

        it('should handle post with no URL', async () => {
            const mockPost = {
                ...createMockPost(),
                url: undefined,
            };
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                'Looking for restaurant recommendations',
                undefined,
                'Can anyone recommend a good pizza place downtown?'
            );
        });

        it('should handle link post with external URL', async () => {
            const mockPost = {
                ...createMockPost(),
                url: 'https://example.com/article',
                body: undefined,
            };
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                'Looking for restaurant recommendations',
                'https://example.com/article',
                undefined
            );
        });
    });

    describe('error handling', () => {
        it('should handle missing targetId', async () => {
            const mockEvent = { targetId: undefined, location: 'post' } as any;
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Menu action has no target.');
            expect(mockContext.reddit.getPostById).not.toHaveBeenCalled();
            expect(removeWithReason).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle getPostById error', async () => {
            const mockEvent = createMockEvent();
            const mockError = new Error('Failed to fetch post');

            (mockContext.reddit.getPostById as any).mockRejectedValue(mockError);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Error processing r/AskSeattle removal:', mockError);
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process r/AskSeattle removal: Error: Failed to fetch post');
            expect(removeWithReason).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle removeWithReason error', async () => {
            const mockPost = createMockPost();
            const mockEvent = createMockEvent();
            const mockError = new Error('Removal failed');

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (removeWithReason as any).mockRejectedValue(mockError);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Error processing r/AskSeattle removal:', mockError);
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process r/AskSeattle removal: Error: Removal failed');

            consoleSpy.mockRestore();
        });

        it('should handle error with no message', async () => {
            const mockPost = createMockPost();
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (removeWithReason as any).mockRejectedValue(null);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process r/AskSeattle removal: Unknown error');

            consoleSpy.mockRestore();
        });

        it('should handle createResubmissionLink throwing error', async () => {
            const mockPost = createMockPost();
            const mockEvent = createMockEvent();
            const mockError = new Error('Link creation failed');

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockImplementation(() => {
                throw mockError;
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Error processing r/AskSeattle removal:', mockError);
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process r/AskSeattle removal: Error: Link creation failed');

            consoleSpy.mockRestore();
        });
    });

    describe('integration with utility functions', () => {
        it('should call utility functions with correct parameters', async () => {
            const mockPost = createMockPost();
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            // Verify createResubmissionLink is called with post data
            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                mockPost.title,
                mockPost.url,
                mockPost.body
            );

            // Verify removeWithReason is called with correct options
            expect(removeWithReason).toHaveBeenCalledWith({
                targetId: 'post123',
                context: mockContext,
                ruleSearchTerms: ['askseattle', 'rule 5'],
                isPost: true,
                footer: '[Mock resubmission link]',
            });
        });

        it('should pass the generated footer to removeWithReason', async () => {
            const mockPost = createMockPost();
            const mockEvent = createMockEvent();
            const expectedFooter = '[Resubmit here](https://old.reddit.com/r/AskSeattle/submit)';

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue(expectedFooter);
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(removeWithReason).toHaveBeenCalledWith(
                expect.objectContaining({
                    footer: expectedFooter,
                })
            );
        });
    });

    describe('edge cases', () => {
        it('should handle empty post title', async () => {
            const mockPost = {
                ...createMockPost(),
                title: '',
            };
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                '',
                mockPost.url,
                mockPost.body
            );
        });

        it('should handle special characters in post data', async () => {
            const mockPost = {
                ...createMockPost(),
                title: 'Post with "quotes" & special <characters>',
                body: 'Body with émojis 🎉 and newlines\\n\\nSecond paragraph',
            };
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                'Post with "quotes" & special <characters>',
                mockPost.url,
                'Body with émojis 🎉 and newlines\\n\\nSecond paragraph'
            );
        });

        it('should handle very long post title and body', async () => {
            const mockPost = {
                ...createMockPost(),
                title: 'A'.repeat(500), // Very long title
                body: 'B'.repeat(10000), // Very long body
            };
            const mockEvent = createMockEvent();

            (mockContext.reddit.getPostById as any).mockResolvedValue(mockPost);
            (createResubmissionLink as any).mockReturnValue('[Mock resubmission link]');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveAskSeattle.onPress(mockEvent, mockContext);

            expect(createResubmissionLink).toHaveBeenCalledWith(
                'AskSeattle',
                'A'.repeat(500),
                mockPost.url,
                'B'.repeat(10000)
            );
        });
    });
});
