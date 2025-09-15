import {
    formatUserInfo,
    formatScoreInfo,
    formatCommentContent,
    formatReportReasons,
    createDiscordField,
    createEmbedFooter,
    type UserInfo,
    type ScoreInfo,
    type PostInfo,
    type CommentInfo
} from './discordFormatters.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Comment, Post } from '@devvit/public-api';

// Mock the dependencies
vi.mock('./reddithelpers.js', () => ({
    createUserLink: (username: string) => `[u/${username}](https://reddit.com/user/${username})`
}));

vi.mock('./parsers.js', () => ({
    getItemDateString: (submission: Post | Comment) =>
        submission.createdAt ? `<t:${Math.floor(submission.createdAt.getTime() / 1000)}:R>` : undefined
}));

describe('discordFormatters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('formatUserInfo', () => {
        it('should format basic user info with username link', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser'
            };

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)'
            ]);
        });

        it('should include submission creation date when provided', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser'
            };
            const submission = {
                createdAt: new Date('2025-01-01T00:00:00Z')
            } as Comment;

            const result = formatUserInfo(userInfo, submission);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)',
                'Created: <t:1735689600:R>'
            ]);
        });

        it('should include user account creation date when no submission provided', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser',
                createdAt: new Date('2024-01-01T00:00:00Z')
            };

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)',
                'Account created: <t:1704067200:R>'
            ]);
        });

        it('should handle unknown username', () => {
            const userInfo: UserInfo = {};

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/unknown](https://reddit.com/user/unknown)'
            ]);
        });

        it('should handle user with no createdAt date and no submission', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser'
                // No createdAt property
            };

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)'
                // No date line because createdAt is undefined
            ]);
        });

        it('should include karma information when provided', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser',
                linkKarma: 1500,
                commentKarma: 850
            };

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)',
                'Karma: **1500** link, **850** comment'
            ]);
        });

        it('should handle missing karma gracefully', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser'
                // No karma provided
            };

            const result = formatUserInfo(userInfo);

            // Should not include karma line if no karma data available
            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)'
            ]);
        });

        it('should handle submission without createdAt date', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser'
            };
            const submission = {} as Comment; // No createdAt

            const result = formatUserInfo(userInfo, submission);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)'
            ]);
        });

        it('should include only link karma when comment karma is 0', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser',
                linkKarma: 100,
                commentKarma: 0
            };

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)',
                'Karma: **100** link, **0** comment'
            ]);
        });

        it('should include only comment karma when link karma is 0', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser',
                linkKarma: 0,
                commentKarma: 200
            };

            const result = formatUserInfo(userInfo);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)',
                'Karma: **0** link, **200** comment'
            ]);
        });

        it('should include both submission date and karma', () => {
            const userInfo: UserInfo = {
                authorName: 'testuser',
                linkKarma: 2500,
                commentKarma: 1200
            };
            const submission = {
                createdAt: new Date('2025-01-01T00:00:00Z')
            } as Comment;

            const result = formatUserInfo(userInfo, submission);

            expect(result).toEqual([
                '[u/testuser](https://reddit.com/user/testuser)',
                'Created: <t:1735689600:R>',
                'Karma: **2500** link, **1200** comment'
            ]);
        });
    });

    describe('formatScoreInfo', () => {
        it('should format basic score information', () => {
            const scoreInfo: ScoreInfo = {
                score: 42,
                upvotes: 50,
                downvotes: 8,
                numReports: 2
            };

            const result = formatScoreInfo(scoreInfo);

            expect(result).toEqual([
                '50 <:upvote:607100359328006166> 8 <:downvote:607100771028172820> [**42**]',
                'Total Reports: **2**'
            ]);
        });

        it('should include comments count when provided', () => {
            const scoreInfo: ScoreInfo = {
                score: 42,
                upvotes: 50,
                downvotes: 8,
                numReports: 2
            };

            const result = formatScoreInfo(scoreInfo, 15);

            expect(result).toEqual([
                '50 <:upvote:607100359328006166> 8 <:downvote:607100771028172820> [**42**]',
                'Comments: **15**',
                'Total Reports: **2**'
            ]);
        });

        it('should not include karma information (moved to formatUserInfo)', () => {
            const scoreInfo: ScoreInfo = {
                score: 42,
                upvotes: 50,
                downvotes: 8,
                numReports: 2
            };

            const result = formatScoreInfo(scoreInfo);

            expect(result).toEqual([
                '50 <:upvote:607100359328006166> 8 <:downvote:607100771028172820> [**42**]',
                'Total Reports: **2**'
            ]);
        });

        it('should include crowd control when present', () => {
            const scoreInfo: ScoreInfo = {
                score: -5,
                upvotes: 2,
                downvotes: 7,
                numReports: 1,
                collapsedBecauseCrowdControl: true
            };

            const result = formatScoreInfo(scoreInfo);

            expect(result).toEqual([
                '2 <:upvote:607100359328006166> 7 <:downvote:607100771028172820> [**-5**]',
                'Total Reports: **1**',
                'Crowd Control: **Yes**'
            ]);
        });

        it('should handle missing karma gracefully', () => {
            const scoreInfo: ScoreInfo = {
                score: 42,
                numReports: 2
            };

            const result = formatScoreInfo(scoreInfo);

            expect(result).toEqual([
                '0 <:upvote:607100359328006166> 0 <:downvote:607100771028172820> [**42**]',
                'Total Reports: **2**'
            ]);
        });

        it('should not include crowd control when false', () => {
            const scoreInfo: ScoreInfo = {
                score: 10,
                upvotes: 12,
                downvotes: 2,
                numReports: 0,
                collapsedBecauseCrowdControl: false
            };

            const result = formatScoreInfo(scoreInfo);

            expect(result).toEqual([
                '12 <:upvote:607100359328006166> 2 <:downvote:607100771028172820> [**10**]',
                'Total Reports: **0**'
            ]);
        });

        it('should handle missing numReports', () => {
            const scoreInfo: ScoreInfo = {
                score: 25,
                upvotes: 30,
                downvotes: 5
            };

            const result = formatScoreInfo(scoreInfo);

            expect(result).toEqual([
                '30 <:upvote:607100359328006166> 5 <:downvote:607100771028172820> [**25**]',
                'Total Reports: **0**'
            ]);
        });
    });

    describe('formatCommentContent', () => {
        it('should wrap comment in code blocks', () => {
            const commentInfo: CommentInfo = {
                body: 'This is a test comment'
            };

            const result = formatCommentContent(commentInfo);

            expect(result).toBe('```\nThis is a test comment\n```');
        });

        it('should truncate long comments', () => {
            const longComment = 'a'.repeat(600);
            const commentInfo: CommentInfo = {
                body: longComment,
                maxLength: 100
            };

            const result = formatCommentContent(commentInfo);

            expect(result).toBe('```\n' + 'a'.repeat(97) + '...\n```');
        });

        it('should handle empty comment body', () => {
            const commentInfo: CommentInfo = {};

            const result = formatCommentContent(commentInfo);

            expect(result).toBe('');
        });

        it('should use default max length when not specified', () => {
            const longComment = 'a'.repeat(600);
            const commentInfo: CommentInfo = {
                body: longComment
            };

            const result = formatCommentContent(commentInfo);

            expect(result).toBe('```\n' + 'a'.repeat(497) + '...\n```');
        });

        it('should handle null body', () => {
            const commentInfo: CommentInfo = {
                body: null as any
            };

            const result = formatCommentContent(commentInfo);

            expect(result).toBe('');
        });

        it('should not truncate comment when exactly at max length', () => {
            const commentInfo: CommentInfo = {
                body: 'a'.repeat(100),
                maxLength: 100
            };

            const result = formatCommentContent(commentInfo);

            expect(result).toBe('```\n' + 'a'.repeat(100) + '\n```');
        });
    });

    describe('formatReportReasons', () => {
        it('should format report reasons with emoji', () => {
            const reasons = ['Spam', 'Self-promotion', 'Harassment'];
            const emoji = '🔹';

            const result = formatReportReasons(reasons, emoji);

            expect(result).toBe('🔹 Spam\n🔹 Self-promotion\n🔹 Harassment');
        });

        it('should handle empty reasons array', () => {
            const reasons: string[] = [];
            const emoji = '🔹';

            const result = formatReportReasons(reasons, emoji);

            expect(result).toBe('');
        });

        it('should handle single reason', () => {
            const reasons = ['Spam'];
            const emoji = '🔸';

            const result = formatReportReasons(reasons, emoji);

            expect(result).toBe('🔸 Spam');
        });
    });

    describe('createDiscordField', () => {
        it('should create field object with string value', () => {
            const result = createDiscordField('Test Field', 'Test Value');

            expect(result).toEqual({
                name: 'Test Field',
                value: 'Test Value'
            });
        });

        it('should join array values with newlines', () => {
            const result = createDiscordField('Test Field', ['Line 1', 'Line 2', 'Line 3']);

            expect(result).toEqual({
                name: 'Test Field',
                value: 'Line 1\nLine 2\nLine 3'
            });
        });
    });

    describe('createEmbedFooter', () => {
        beforeEach(() => {
            // Mock Date to ensure consistent testing
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2025-09-15T12:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should create footer with formatted date and ISO timestamp', () => {
            const result = createEmbedFooter();

            // Check that the structure is correct and timestamp is ISO format
            expect(result).toHaveProperty('footer');
            expect(result).toHaveProperty('timestamp');
            expect(result.footer).toHaveProperty('text');
            expect(result.timestamp).toBe('2025-09-15T12:00:00.000Z');

            // Check that the footer text contains expected elements
            expect(result.footer.text).toContain('September 15, 2025');
            expect(result.footer.text).toMatch(/\d{1,2}:\d{2} [AP]M/); // Contains time in AM/PM format
        });
    });

    describe('Integration tests for Discord embed structure', () => {
        it('should create consistent comment report embed structure', () => {
            const userInfo: UserInfo = {
                authorName: 'spammer123',
                linkKarma: 45,
                commentKarma: -23
            };

            const scoreInfo: ScoreInfo = {
                score: -12,
                upvotes: 1,
                downvotes: 13,
                numReports: 3,
                collapsedBecauseCrowdControl: true
            };

            const commentInfo: CommentInfo = {
                body: 'This is spam content'
            };

            // Test that all required fields can be generated
            const userField = createDiscordField('User', formatUserInfo(userInfo));
            const statsField = createDiscordField('📊 Statistics', formatScoreInfo(scoreInfo));
            const commentContent = formatCommentContent(commentInfo);
            const userReports = formatReportReasons(['Spam', 'Self-promotion'], '🔹');
            const modReports = formatReportReasons(['Potential bot account'], '🔸');

            expect(userField.name).toBe('User');
            expect(userField.value).toContain('[u/spammer123]');
            expect(userField.value).toContain('Karma: **45** link, **-23** comment');

            expect(statsField.name).toBe('📊 Statistics');
            expect(statsField.value).toContain('[**-12**]');
            expect(statsField.value).toContain('Crowd Control: **Yes**');
            expect(statsField.value).not.toContain('Karma:'); // Karma moved to user field

            expect(commentContent).toBe('```\nThis is spam content\n```');
            expect(userReports).toBe('🔹 Spam\n🔹 Self-promotion');
            expect(modReports).toBe('🔸 Potential bot account');
        });

        it('should create consistent post report embed structure', () => {
            const userInfo: UserInfo = {
                authorName: 'scammer456',
                linkKarma: 156,
                commentKarma: 892
            };

            const scoreInfo: ScoreInfo = {
                score: 5,
                upvotes: 13,
                downvotes: 18,
                numReports: 7
            };

            const postInfo: PostInfo = {
                title: 'Looking for roommate - $500/month amazing deal downtown!',
                permalink: 'https://old.reddit.com/r/Seattle/comments/abc123'
            };

            // Test that all required fields can be generated
            const userField = createDiscordField('User', formatUserInfo(userInfo));
            const statsField = createDiscordField('📊 Statistics', formatScoreInfo(scoreInfo, 12));
            const postLink = postInfo.permalink;
            const userReports = formatReportReasons(['Housing scam', 'Too good to be true'], '🔹');
            const modReports = formatReportReasons(['Known scammer pattern'], '🔸');

            expect(userField.name).toBe('User');
            expect(userField.value).toContain('[u/scammer456]');
            expect(userField.value).toContain('Karma: **156** link, **892** comment');

            expect(statsField.name).toBe('📊 Statistics');
            expect(statsField.value).toContain('[**5**]');
            expect(statsField.value).toContain('Comments: **12**');
            expect(statsField.value).not.toContain('Karma:'); // Karma moved to user field

            expect(postLink).toBe('https://old.reddit.com/r/Seattle/comments/abc123');
            expect(userReports).toBe('🔹 Housing scam\n🔹 Too good to be true');
            expect(modReports).toBe('🔸 Known scammer pattern');
        });
    });
});
