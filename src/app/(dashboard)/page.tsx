import { Card } from "@/components/ui/card";
import { formatMoney, labelLeadStatus, labelPropertyStatus } from "@/lib/format";
import { rankTasks } from "@/lib/copilot/heuristics";
import { prisma } from "@/lib/prisma";
import { demoLeads, demoProperties, demoTasks, demoTransactions } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [properties, leads, tasks, transactions] = await Promise.all([
    prisma.property.findMany({ orderBy: { value: "desc" } }).catch(() => demoProperties),
    prisma.lead.findMany({ orderBy: { name: "asc" } }).catch(() => demoLeads),
    prisma.task.findMany({ where: { isDone: false } }).catch(() => demoTasks),
    prisma.transaction.findMany().catch(() => demoTransactions),
  ]);

  const propertyValue = properties.reduce((sum, item) => sum + item.value, 0);
  const income = transactions
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + item.amount, 0);
  const cashBalance = income - expense;
  const priorityTasks = rankTasks(tasks).slice(0, 3);
  const hotLeads = leads.filter((lead) => ["HOT", "FOLLOW_UP", "NEW"].includes(lead.status)).slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Anh Hung Smart ERP
        </p>
        <h1 className="text-3xl font-bold">Tổng quan vận hành</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-gray-500">Tài sản BĐS</p>
          <p className="mt-2 text-2xl font-bold">{properties.length}</p>
          <p className="mt-1 text-sm text-gray-600">{formatMoney(propertyValue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Khách đang theo</p>
          <p className="mt-2 text-2xl font-bold">{leads.length}</p>
          <p className="mt-1 text-sm text-gray-600">CRM nội bộ</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Việc tồn</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{tasks.length}</p>
          <p className="mt-1 text-sm text-gray-600">Xếp theo độ khẩn</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Dòng tiền ròng</p>
          <p className={`mt-2 text-2xl font-bold ${cashBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {formatMoney(cashBalance)}
          </p>
          <p className="mt-1 text-sm text-gray-600">Thu - chi đã nhập</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <h2 className="text-lg font-semibold">Việc nên xử lý trước</h2>
          <div className="mt-4 space-y-3">
            {priorityTasks.map((task, index) => (
              <div key={task.id} className="border-l-4 border-blue-600 bg-blue-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{index + 1}. {task.title}</p>
                  <span className="text-sm font-semibold">{task.priority.toFixed(1)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">Khẩn {task.urgency}/5 · Giá trị {task.value}/5</p>
              </div>
            ))}
            {priorityTasks.length === 0 ? <p className="text-sm text-gray-500">Không còn việc tồn.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Khách cần chăm sóc</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {hotLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-sm text-gray-500">{lead.phone}</p>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium">
                  {labelLeadStatus(lead.status)}
                </span>
              </div>
            ))}
            {hotLeads.length === 0 ? <p className="text-sm text-gray-500">Chưa có khách cần theo.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Tài sản giá trị cao</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {properties.slice(0, 4).map((property) => (
              <div key={property.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{property.title}</p>
                  <span className="text-sm font-semibold">{formatMoney(property.value)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{labelPropertyStatus(property.status)} · {property.address}</p>
              </div>
            ))}
            {properties.length === 0 ? <p className="text-sm text-gray-500">Chưa có tài sản.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
