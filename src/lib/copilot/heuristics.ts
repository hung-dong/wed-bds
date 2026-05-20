import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  urgency: z.number().min(1).max(5),
  value: z.number().min(1).max(5),
});

export type TaskType = z.infer<typeof TaskSchema>;

export function calculatePriority(task: TaskType): number {
  return (task.urgency * 0.7) + (task.value * 0.3);
}

export function rankTasks(tasks: TaskType[]): (TaskType & { priority: number })[] {
  return tasks
    .map(t => ({ ...t, priority: calculatePriority(t) }))
    .sort((a, b) => b.priority - a.priority);
}
