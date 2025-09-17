import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeWithReason, type RemovalOptions } from './removalHelper.js';

// Mock the context object and its methods
const createMockContext = () => ({
    reddit: {
        getPostById: vi.fn(),
        getCommentById: vi.fn(),
        getSubredditRemovalReasons: vi.fn(),
        remove: vi.fn(),
        addRemovalNote: vi.fn(),
        submitComment: vi.fn(),
    },
    ui: {
        showToast: vi.fn(),
    },
    subredditName: 'testsubreddit',
});

const createMockPost = (removed = false) => ({
    id: 'post123',
    permalink: '/r/testsubreddit/comments/post123/test_post',
    removed,
    lock: vi.fn(),
});

const createMockComment = (removed = false) => ({
    id: 'comment123',
    permalink: '/r/testsubreddit/comments/post123/test_post/comment123',
    removed,
    lock: vi.fn(),
    distinguish: vi.fn(),
});

const createMockRemovalReasons = () => [
    {
        id: 'reason1',
        title: 'Low Effort Content',
        message: 'Your post has been removed for being low effort.',
    },
    {
        id: 'reason2',
        title: 'Rule 5: Use AskSeattle',
        message: 'Your post should be in /r/AskSeattle instead.',
    },
    {
        id: 'reason3',
        title: 'Spam Content',
        message: 'This post appears to be spam.',
    },
];

describe('removeWithReason', () => {
    let mockContext: ReturnType<typeof createMockContext>;
    let baseOptions: RemovalOptions;

    beforeEach(() => {
        mockContext = createMockContext();
        baseOptions = {
            targetId: 'post123',
            context: mockContext,
            ruleSearchTerms: ['low effort'],
            isPost: true,
        };
        vi.clearAllMocks();
    });

    describe('successful post removal', () => {
        it('should remove a post with matching removal reason', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            await removeWithReason(baseOptions);

            expect(mockContext.reddit.getPostById).toHaveBeenCalledWith('post123');
            expect(mockContext.reddit.remove).toHaveBeenCalledWith('post123', false);
            expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
                itemIds: ['post123'],
                reasonId: 'reason1',
                modNote: 'Removed via macro - Low Effort Content',
            });
            expect(mockContext.reddit.submitComment).toHaveBeenCalledWith({
                id: 'post123',
                text: 'Your post has been removed for being low effort.',
                runAs: 'APP',
            });
            expect(mockComment.distinguish).toHaveBeenCalledWith(true);
            expect(mockComment.lock).toHaveBeenCalled();
            expect(mockPost.lock).not.toHaveBeenCalled();
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Post removed for Low Effort Content');
        });

        it('should handle custom mod note', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            const optionsWithNote = {
                ...baseOptions,
                modNote: 'Custom mod note for testing',
            };

            await removeWithReason(optionsWithNote);

            expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
                itemIds: ['post123'],
                reasonId: 'reason1',
                modNote: 'Custom mod note for testing',
            });
        });

        it('should append footer to removal comment', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            const optionsWithFooter = {
                ...baseOptions,
                footer: 'Please resubmit to the correct subreddit.',
            };

            await removeWithReason(optionsWithFooter);

            expect(mockContext.reddit.submitComment).toHaveBeenCalledWith({
                id: 'post123',
                text: 'Your post has been removed for being low effort.\n\n---\n\nPlease resubmit to the correct subreddit.',
                runAs: 'APP',
            });
        });
    });

    describe('successful comment removal', () => {
        it('should remove a comment with matching removal reason', async () => {
            const mockComment = createMockComment();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockReplyComment = createMockComment();

            mockContext.reddit.getCommentById.mockResolvedValue(mockComment);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockReplyComment);

            const commentOptions = {
                ...baseOptions,
                targetId: 'comment123',
                isPost: false,
            };

            await removeWithReason(commentOptions);

            expect(mockContext.reddit.getCommentById).toHaveBeenCalledWith('comment123');
            expect(mockContext.reddit.remove).toHaveBeenCalledWith('comment123', false);
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Comment removed for Low Effort Content');
        });
    });

    describe('removal reason matching', () => {
        it('should find removal reason with case-insensitive search', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            const optionsWithCaseSearch = {
                ...baseOptions,
                ruleSearchTerms: ['LOW EFFORT'], // uppercase
            };

            await removeWithReason(optionsWithCaseSearch);

            expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
                itemIds: ['post123'],
                reasonId: 'reason1',
                modNote: 'Removed via macro - Low Effort Content',
            });
        });

        it('should find removal reason with multiple search terms', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            const optionsWithMultipleTerms = {
                ...baseOptions,
                ruleSearchTerms: ['askseattle', 'rule 5'], // should match second removal reason
            };

            await removeWithReason(optionsWithMultipleTerms);

            expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
                itemIds: ['post123'],
                reasonId: 'reason2',
                modNote: 'Removed via macro - Rule 5: Use AskSeattle',
            });
        });

        it('should use first matching removal reason when multiple match', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = [
                { id: 'reason1', title: 'Rule 1: Test Rule', message: 'First match' },
                { id: 'reason2', title: 'Rule 2: Another Test', message: 'Second match' },
            ];
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            const optionsWithAmbiguousSearch = {
                ...baseOptions,
                ruleSearchTerms: ['rule'], // matches both
            };

            await removeWithReason(optionsWithAmbiguousSearch);

            expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
                itemIds: ['post123'],
                reasonId: 'reason1',
                modNote: 'Removed via macro - Rule 1: Test Rule',
            });
        });
    });

    describe('error handling', () => {
        it('should handle already removed post', async () => {
            const mockPost = createMockPost(true); // already removed

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);

            await removeWithReason(baseOptions);

            expect(mockContext.ui.showToast).toHaveBeenCalledWith('This post has already been removed.');
            expect(mockContext.reddit.remove).not.toHaveBeenCalled();
            expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
        });

        it('should handle no matching removal reason found', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);

            const optionsWithNoMatch = {
                ...baseOptions,
                ruleSearchTerms: ['nonexistent rule'],
            };

            await removeWithReason(optionsWithNoMatch);

            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Error: Could not find removal reason for: nonexistent rule');
            expect(mockContext.reddit.remove).not.toHaveBeenCalled();
            expect(mockContext.reddit.submitComment).not.toHaveBeenCalled();
        });

        it('should handle removal note error gracefully', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.addRemovalNote.mockRejectedValue(new Error('Note failed'));
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            // Should not throw, just log warning
            await expect(removeWithReason(baseOptions)).resolves.not.toThrow();

            expect(mockContext.reddit.remove).toHaveBeenCalled();
            expect(mockContext.reddit.submitComment).toHaveBeenCalled();
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Post removed for Low Effort Content');
        });

        it('should handle undefined removal reason title', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = [
                { id: 'reason1', title: undefined, message: 'Test message' },
                { id: 'reason2', title: 'Low Effort Content', message: 'Valid reason' },
            ];
            const mockComment = createMockComment();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(mockComment);

            await removeWithReason(baseOptions);

            // Should skip the undefined title and find the valid one
            expect(mockContext.reddit.addRemovalNote).toHaveBeenCalledWith({
                itemIds: ['post123'],
                reasonId: 'reason2',
                modNote: 'Removed via macro - Low Effort Content',
            });
        });
    });

    describe('edge cases', () => {
        it('should handle empty removal reasons array', async () => {
            const mockPost = createMockPost();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue([]);

            await removeWithReason(baseOptions);

            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Error: Could not find removal reason for: low effort');
            expect(mockContext.reddit.remove).not.toHaveBeenCalled();
        });

        it('should handle null comment response from submitComment', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);
            mockContext.reddit.submitComment.mockResolvedValue(null);

            // Should not throw when comment is null
            await expect(removeWithReason(baseOptions)).resolves.not.toThrow();

            expect(mockContext.reddit.remove).toHaveBeenCalled();
            expect(mockPost.lock).not.toHaveBeenCalled();
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Post removed for Low Effort Content');
        });

        it('should handle empty ruleSearchTerms array', async () => {
            const mockPost = createMockPost();
            const mockRemovalReasons = createMockRemovalReasons();

            mockContext.reddit.getPostById.mockResolvedValue(mockPost);
            mockContext.reddit.getSubredditRemovalReasons.mockResolvedValue(mockRemovalReasons);

            const optionsWithEmptyTerms = {
                ...baseOptions,
                ruleSearchTerms: [],
            };

            await removeWithReason(optionsWithEmptyTerms);

            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Error: Could not find removal reason for: ');
        });
    });
});
