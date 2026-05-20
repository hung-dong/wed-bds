import { Card } from "@/components/ui/card";
import { rankTasks } from "@/lib/copilot/heuristics";
import { prisma } from "@/lib/prisma";
import { demoTasks } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default async function Copilot() {
  const tasks = await prisma.task.findMany({ where: { isDone: false } }).catch(() => demoTasks);
  const prioritized = rankTasks(tasks);
  const topTask = prioritized[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Copilot offline</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chấm điểm theo công thức: độ khẩn 70% + giá trị 30%.
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Việc số 1 hôm nay</p>
        <h2 className="mt-2 text-2xl font-bold">{topTask ? topTask.title : "Không còn việc tồn"}</h2>
        {topTask ? (
          <p className="mt-2 text-sm text-gray-700">
            Điểm {topTask.priority.toFixed(2)} · Khẩn {topTask.urgency}/5 · Giá trị {topTask.value}/5
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Thứ tự ưu tiên</h2>
        <div className="mt-4 space-y-3">
          {prioritized.map((task, index) => (
            <div key={task.id} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">#{index + 1} {task.title}</p>
                <p className="text-sm text-gray-500">Khẩn {task.urgency}/5 · Giá trị {task.value}/5</p>
              </div>
              <span className="rounded bg-gray-100 px-2 py-1 text-sm font-semibold">
                {task.priority.toFixed(2)}
              </span>
            </div>
          ))}
          {prioritized.length === 0 ? <p className="text-sm text-gray-500">Không còn việc tồn.</p> : null}
        </div>
      </Card>
    </div>
  );
}
