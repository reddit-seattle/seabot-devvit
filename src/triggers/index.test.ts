import { describe, it, expect } from 'vitest';
import { triggers } from './index.js';

describe('triggers index', () => {
  it('should export all triggers', () => {
    expect(triggers).toBeDefined();
    expect(Array.isArray(triggers)).toBe(true);
    expect(triggers).toHaveLength(4);
    
    // Verify each trigger has the required properties
    triggers.forEach(trigger => {
      expect(trigger).toHaveProperty('event');
      expect(trigger).toHaveProperty('onEvent');
      expect(typeof trigger.onEvent).toBe('function');
    });
  });

  it('should include all expected triggers', () => {
    const events = triggers.map(trigger => trigger.event);
    expect(events).toContain('CommentReport');
    expect(events).toContain('ModMail');
    expect(events).toContain('PostFlairUpdate');
    expect(events).toContain('PostReport');
  });
});
