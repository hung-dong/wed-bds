import { describe, it, expect } from 'vitest';
import { calculatePriority, rankTasks } from '../src/lib/copilot/heuristics';

describe('Copilot Heuristics Engine', () => {
  it('calculates priority correctly', () => {
    const task = { id: '1', title: 'Test', urgency: 5, value: 4 };
    const priority = calculatePriority(task);
    expect(priority).toBe((5 * 0.7) + (4 * 0.3)); // 3.5 + 1.2 = 4.7
  });

  it('ranks tasks properly', () => {
    const tasks = [
      { id: '1', title: 'Low', urgency: 1, value: 1 },
      { id: '2', title: 'High', urgency: 5, value: 5 }
    ];
    const ranked = rankTasks(tasks);
    expect(ranked[0].id).toBe('2');
    expect(ranked[1].id).toBe('1');
  });
});
