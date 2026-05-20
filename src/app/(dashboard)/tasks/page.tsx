import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { rankTasks } from "@/lib/copilot/heuristics";
import { prisma } from "@/lib/prisma";
import { demoTasks } from "@/lib/demo-data";
import { createTask, toggleTask } from "../actions";

export const dynamic = "force-dynamic";

export default async function Tasks() {
  const tasks = await prisma.task.findMany({ orderBy: [{ isDone: "asc" }, { urgency: "desc" }] }).catch(() => demoTasks);
  const openTasks = tasks.filter((task) => !task.isDone);
  const rankedOpenTasks = rankTasks(openTasks);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Công việc</h1>
        <p className="mt-1 text-sm text-gray-500">{openTasks.length} việc chưa xử lý · {tasks.length} tổng việc</p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Thêm việc nhanh</h2>
        <form action={createTask} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
          <Input name="title" placeholder="Tên việc" required className="md:col-span-3" />
          <Input name="urgency" type="number" min="1" max="5" defaultValue="3" required />
          <Input name="value" type="number" min="1" max="5" defaultValue="3" required />
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            Lưu việc
          </button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Nhiệm vụ</Th>
              <Th>Độ khẩn</Th>
              <Th>Giá trị</Th>
              <Th>Điểm ưu tiên</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Xử lý</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rankedOpenTasks.map((task) => (
              <tr key={task.id}>
                <Td className="font-medium">{task.title}</Td>
                <Td>{task.urgency}/5</Td>
                <Td>{task.value}/5</Td>
                <Td>{task.priority.toFixed(2)}</Td>
                <Td>Chưa xử lý</Td>
                <Td className="text-right">
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium text-white">
                      Xong
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
            {tasks.filter((task) => task.isDone).map((task) => (
              <tr key={task.id} className="text-gray-500">
                <Td className="font-medium line-through">{task.title}</Td>
                <Td>{task.urgency}/5</Td>
                <Td>{task.value}/5</Td>
                <Td>-</Td>
                <Td>Hoàn thành</Td>
                <Td className="text-right">
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button type="submit" className="rounded border border-gray-300 px-3 py-1 text-sm font-medium">
                      Mở lại
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {tasks.length === 0 ? <p className="p-4 text-sm text-gray-500">Chưa có công việc.</p> : null}
      </Card>
    </div>
  );
}
