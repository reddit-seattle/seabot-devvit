import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context, MenuItemOnPressEvent } from '@devvit/public-api';
import RemoveBeGood from './removeBeGood.js';

// Mock the removeWithReason utility
vi.mock('../utils/removalHelper.js', () => ({
  removeWithReason: vi.fn()
}));

const { removeWithReason } = await import('../utils/removalHelper.js');

const mockContext = {
  ui: {
    showToast: vi.fn()
  }
} as unknown as Context;

const mockEvent = {
  targetId: 'comment123',
  location: 'comment'
} as MenuItemOnPressEvent;

describe('RemoveBeGood', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct menu item properties', () => {
    expect(RemoveBeGood.label).toBe("Remove for Be Good");
    expect(RemoveBeGood.description).toBe("Remove comment and apply Rule 1: Be Good");
    expect(RemoveBeGood.location).toBe("comment");
    expect(RemoveBeGood.forUserType).toBe("moderator");
  });

  it('should handle missing targetId', async () => {
    const eventWithoutTarget = { 
      targetId: undefined, 
      location: 'comment' 
    } as unknown as MenuItemOnPressEvent;
    
    await RemoveBeGood.onPress(eventWithoutTarget, mockContext);
    
    expect(removeWithReason).not.toHaveBeenCalled();
  });

  it('should call removeWithReason with correct parameters', async () => {
    (removeWithReason as any).mockResolvedValue(undefined);

    await RemoveBeGood.onPress(mockEvent, mockContext);

    expect(removeWithReason).toHaveBeenCalledWith({
      targetId: 'comment123',
      context: mockContext,
      ruleSearchTerms: ["be good", "rule 1"],
      isPost: false
    });
  });

  it('should handle removeWithReason success', async () => {
    (removeWithReason as any).mockResolvedValue(undefined);

    await RemoveBeGood.onPress(mockEvent, mockContext);

    expect(removeWithReason).toHaveBeenCalled();
    expect(mockContext.ui.showToast).not.toHaveBeenCalled();
  });

  it('should handle removeWithReason errors', async () => {
    const errorMessage = 'Removal failed';
    (removeWithReason as any).mockRejectedValue(new Error(errorMessage));

    await RemoveBeGood.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to process Be Good removal: Error: " + errorMessage
    );
  });

  it('should handle unknown errors', async () => {
    (removeWithReason as any).mockRejectedValue('Unknown error string');

    await RemoveBeGood.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to process Be Good removal: Unknown error string"
    );
  });

  it('should handle null/undefined errors', async () => {
    (removeWithReason as any).mockRejectedValue(null);

    await RemoveBeGood.onPress(mockEvent, mockContext);

    expect(mockContext.ui.showToast).toHaveBeenCalledWith(
      "Failed to process Be Good removal: Unknown error"
    );
  });

  it('should pass correct rule search terms', async () => {
    (removeWithReason as any).mockResolvedValue(undefined);

    await RemoveBeGood.onPress(mockEvent, mockContext);

    const callArgs = (removeWithReason as any).mock.calls[0][0];
    expect(callArgs.ruleSearchTerms).toEqual(["be good", "rule 1"]);
    expect(callArgs.isPost).toBe(false);
  });
});
