import { describe, it, expect, vi } from 'vitest';
import { parseParticipantAuthor, getItemDateString, parseConversationType } from '../utils/parsers.js';
import type { Participant, Comment, Post } from '@devvit/public-api';

// Mock the reddithelpers module
vi.mock('../utils/reddithelpers.js', () => ({
    createUserLink: vi.fn((username: string) => `[${username}](https://reddit.com/u/${username.replace(/^u\//, '')})`)
}));

describe('parseParticipantAuthor', () => {
    it('should handle regular user', () => {
        const author: Participant = {
            name: 'testuser',
            isMod: false,
            isAdmin: false,
            isOp: false
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('[testuser](https://reddit.com/u/testuser)');
    });

    it('should handle moderator user', () => {
        const author: Participant = {
            name: 'moduser',
            isMod: true,
            isAdmin: false,
            isOp: false
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('[MOD] [moduser](https://reddit.com/u/moduser)');
    });

    it('should handle admin user', () => {
        const author: Participant = {
            name: 'adminuser',
            isMod: false,
            isAdmin: true,
            isOp: false
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('[ADMIN] [adminuser](https://reddit.com/u/adminuser)');
    });

    it('should handle OP (original poster)', () => {
        const author: Participant = {
            name: 'opuser',
            isMod: false,
            isAdmin: false,
            isOp: true
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('**[opuser](https://reddit.com/u/opuser)**');
    });

    it('should handle mod + OP combination', () => {
        const author: Participant = {
            name: 'modopuser',
            isMod: true,
            isAdmin: false,
            isOp: true
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('**[MOD] [modopuser](https://reddit.com/u/modopuser)**');
    });

    it('should handle admin + OP combination', () => {
        const author: Participant = {
            name: 'adminopuser',
            isMod: false,
            isAdmin: true,
            isOp: true
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('**[ADMIN] [adminopuser](https://reddit.com/u/adminopuser)**');
    });

    it('should handle undefined author', () => {
        const result = parseParticipantAuthor(undefined);
        expect(result).toBe('[unknown](https://reddit.com/u/unknown)');
    });

    it('should handle author with undefined name', () => {
        const author: Participant = {
            name: undefined as any,
            isMod: false,
            isAdmin: false,
            isOp: false
        };

        const result = parseParticipantAuthor(author);
        expect(result).toBe('[unknown](https://reddit.com/u/unknown)');
    });
});

describe('getItemDateString', () => {
    it('should format post creation date as Discord timestamp when given a Date object', () => {
        const mockPost = {
            createdAt: new Date('2023-01-15T10:30:00Z')
        } as Post;

        const result = getItemDateString(mockPost);
        expect(result).toBe('<t:1673778600:R>');
    });

    it('should format post creation date when given a timestamp string', () => {
        const mockPost = {
            createdAt: '2023-01-15T10:30:00Z'
        } as unknown as Post;

        const result = getItemDateString(mockPost);
        expect(result).toBe('<t:1673778600:R>');
    });

    it('should format post creation date when given a timestamp number', () => {
        const mockPost = {
            createdAt: 1673778600000 // 2023-01-15T10:30:00Z in milliseconds
        } as unknown as Post;

        const result = getItemDateString(mockPost);
        expect(result).toBe('<t:1673778600:R>');
    });

    it('should format comment creation date as Discord timestamp', () => {
        const mockComment = {
            createdAt: new Date('2023-12-25T15:45:30Z')
        } as Comment;

        const result = getItemDateString(mockComment);
        expect(result).toBe('<t:1703519130:R>');
    });

    it('should handle undefined item', () => {
        const result = getItemDateString(undefined as any);
        expect(result).toBeUndefined();
    });

    it('should handle item with undefined createdAt', () => {
        const mockItem = {
            createdAt: undefined
        } as any;

        const result = getItemDateString(mockItem);
        expect(result).toBeUndefined();
    });

    it('should handle invalid date string', () => {
        const mockItem = {
            createdAt: 'not a date'
        } as unknown as Post;

        const result = getItemDateString(mockItem);
        expect(result).toBeUndefined();
    });

    it('should handle invalid date', () => {
        const mockItem = {
            createdAt: new Date('invalid')
        } as any;

        const result = getItemDateString(mockItem);
        expect(result).toBe('<t:NaN:R>');
    });
});

describe('parseConversationType', () => {
    it('should parse internal modmail type', () => {
        const result = parseConversationType('internal');
        expect(result).toBe('Mod Discussion');
    });

    it('should parse user modmail type', () => {
        const result = parseConversationType('sr_user');
        expect(result).toBe('User Modmail');
    });

    it('should parse subreddit modmail type', () => {
        const result = parseConversationType('sr_sr');
        expect(result).toBe('Subreddit Modmail');
    });

    it('should handle unknown modmail type', () => {
        const result = parseConversationType('unknown_type');
        expect(result).toBe('Unknown');
    });

    it('should handle undefined type', () => {
        const result = parseConversationType(undefined);
        expect(result).toBe('Unknown');
    });

    it('should handle empty string type', () => {
        const result = parseConversationType('');
        expect(result).toBe('Unknown');
    });
});
