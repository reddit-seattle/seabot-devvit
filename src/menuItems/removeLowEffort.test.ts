import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from '@devvit/public-api';
import RemoveLowEffort from './removeLowEffort.js';

// Mock dependencies
vi.mock('../utils/removalHelper.js', () => ({
    removeWithReason: vi.fn(),
}));

import { removeWithReason } from '../utils/removalHelper.js';

const createMockContext = () => {
    const context = {
        ui: {
            showToast: vi.fn(),
        },
        subredditName: 'testsubreddit',
    } as unknown as Context;
    return context;
};

const createMockEvent = (targetId: string = 'post123') => ({
    targetId,
    location: 'post' as const,
});

describe('RemoveLowEffort Menu Item', () => {
    let mockContext: Context;

    beforeEach(() => {
        mockContext = createMockContext();
        vi.clearAllMocks();
    });

    describe('menu item configuration', () => {
        it('should have correct configuration', () => {
            expect(RemoveLowEffort.label).toBe('Remove for Low-Effort Content');
            expect(RemoveLowEffort.description).toBe('Remove post and apply Rule 4: No low-effort content');
            expect(RemoveLowEffort.location).toBe('post');
            expect(RemoveLowEffort.forUserType).toBe('moderator');
            expect(typeof RemoveLowEffort.onPress).toBe('function');
        });
    });

    describe('onPress functionality', () => {
        it('should successfully remove post for low-effort content', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(removeWithReason).toHaveBeenCalledWith({
                targetId: 'post123',
                context: mockContext,
                ruleSearchTerms: ['low-effort', 'low effort', 'rule 4'],
                isPost: true,
            });
        });

        it('should call removeWithReason with correct parameters', async () => {
            const mockEvent = createMockEvent('custom-post-id');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(removeWithReason).toHaveBeenCalledWith({
                targetId: 'custom-post-id',
                context: mockContext,
                ruleSearchTerms: ['low-effort', 'low effort', 'rule 4'],
                isPost: true,
            });
            expect(removeWithReason).toHaveBeenCalledTimes(1);
        });

        it('should not include footer parameter', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            const callArgs = (removeWithReason as any).mock.calls[0][0];
            expect(callArgs).not.toHaveProperty('footer');
        });
    });

    describe('error handling', () => {
        it('should handle missing targetId', async () => {
            const mockEvent = { targetId: undefined, location: 'post' } as any;
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Menu action has no target.');
            expect(removeWithReason).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should handle removeWithReason error', async () => {
            const mockEvent = createMockEvent();
            const mockError = new Error('Removal failed');

            (removeWithReason as any).mockRejectedValue(mockError);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Error processing low-effort content removal:', mockError);
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process low-effort content removal: Error: Removal failed');

            consoleSpy.mockRestore();
        });

        it('should handle error with no message', async () => {
            const mockEvent = createMockEvent();

            (removeWithReason as any).mockRejectedValue(null);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process low-effort content removal: Unknown error');

            consoleSpy.mockRestore();
        });

        it('should handle error with custom message', async () => {
            const mockEvent = createMockEvent();
            const customError = 'Network timeout';

            (removeWithReason as any).mockRejectedValue(customError);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(consoleSpy).toHaveBeenCalledWith('Error processing low-effort content removal:', customError);
            expect(mockContext.ui.showToast).toHaveBeenCalledWith('Failed to process low-effort content removal: Network timeout');

            consoleSpy.mockRestore();
        });
    });

    describe('rule search terms validation', () => {
        it('should include all expected rule search terms', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            const callArgs = (removeWithReason as any).mock.calls[0][0];
            expect(callArgs.ruleSearchTerms).toEqual(['low-effort', 'low effort', 'rule 4']);
        });

        it('should have rule search terms in correct order', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            const callArgs = (removeWithReason as any).mock.calls[0][0];
            const ruleTerms = callArgs.ruleSearchTerms;

            expect(ruleTerms[0]).toBe('low-effort');
            expect(ruleTerms[1]).toBe('low effort');
            expect(ruleTerms[2]).toBe('rule 4');
        });
    });

    describe('mod note validation', () => {
        it('should use correct mod note', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);
        });
    });

    describe('post type validation', () => {
        it('should set isPost to true', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            const callArgs = (removeWithReason as any).mock.calls[0][0];
            expect(callArgs.isPost).toBe(true);
        });
    });

    describe('integration scenarios', () => {
        it('should work with different target IDs', async () => {
            const testIds = ['abc123', 'xyz789', '12345', 'post_with_underscores'];
            (removeWithReason as any).mockResolvedValue(undefined);

            for (const targetId of testIds) {
                const mockEvent = createMockEvent(targetId);
                await RemoveLowEffort.onPress(mockEvent, mockContext);

                expect(removeWithReason).toHaveBeenCalledWith(
                    expect.objectContaining({
                        targetId,
                    })
                );
            }

            expect(removeWithReason).toHaveBeenCalledTimes(testIds.length);
        });

        it('should maintain consistent behavior across multiple calls', async () => {
            const mockEvent = createMockEvent();
            (removeWithReason as any).mockResolvedValue(undefined);

            // Call the function multiple times
            await RemoveLowEffort.onPress(mockEvent, mockContext);
            await RemoveLowEffort.onPress(mockEvent, mockContext);
            await RemoveLowEffort.onPress(mockEvent, mockContext);

            // Verify consistent behavior
            expect(removeWithReason).toHaveBeenCalledTimes(3);
            const calls = (removeWithReason as any).mock.calls;

            // All calls should have identical parameters
            expect(calls[0][0]).toEqual(calls[1][0]);
            expect(calls[1][0]).toEqual(calls[2][0]);
        });

        it('should not modify context object', async () => {
            const mockEvent = createMockEvent();
            const originalContext = { ...mockContext };
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            // Context should not be modified (excluding mock function calls)
            expect(mockContext.subredditName).toBe(originalContext.subredditName);
        });
    });

    describe('performance and edge cases', () => {
        it('should handle empty string targetId gracefully', async () => {
            const mockEvent = createMockEvent('');
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            // Should NOT call removeWithReason when targetId is empty
            expect(removeWithReason).not.toHaveBeenCalled();
        });

        it('should handle very long targetId', async () => {
            const longTargetId = 'a'.repeat(1000);
            const mockEvent = createMockEvent(longTargetId);
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(removeWithReason).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetId: longTargetId,
                })
            );
        });

        it('should handle special characters in targetId', async () => {
            const specialTargetId = 'post-123_with.special@chars';
            const mockEvent = createMockEvent(specialTargetId);
            (removeWithReason as any).mockResolvedValue(undefined);

            await RemoveLowEffort.onPress(mockEvent, mockContext);

            expect(removeWithReason).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetId: specialTargetId,
                })
            );
        });
    });
});
