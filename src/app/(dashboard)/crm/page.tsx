import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { labelLeadStatus } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createLead } from "../actions";

export const dynamic = "force-dynamic";

export default async function CRM() {
  const leads = await prisma.lead.findMany({ orderBy: { name: "asc" } });
  const activeLeads = leads.filter((lead) => !["WON", "LOST"].includes(lead.status)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CRM khách hàng</h1>
        <p className="mt-1 text-sm text-gray-500">{activeLeads} khách đang theo · {leads.length} tổng hồ sơ</p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Thêm khách nhanh</h2>
        <form action={createLead} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input name="name" placeholder="Tên khách" required className="md:col-span-2" />
          <Input name="phone" placeholder="Số điện thoại" required />
          <select name="status" defaultValue="NEW" className="rounded border border-gray-300 px-3 py-2">
            <option value="NEW">Khách mới</option>
            <option value="FOLLOW_UP">Cần chăm sóc</option>
            <option value="HOT">Khách nóng</option>
            <option value="WON">Đã chốt</option>
            <option value="LOST">Dừng theo</option>
          </select>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            Lưu khách
          </button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Tên</Th>
              <Th>SĐT</Th>
              <Th>Trạng thái</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <Td className="font-medium">{lead.name}</Td>
                <Td>{lead.phone}</Td>
                <Td>
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium">
                    {labelLeadStatus(lead.status)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {leads.length === 0 ? <p className="p-4 text-sm text-gray-500">Chưa có khách hàng.</p> : null}
      </Card>
    </div>
  );
}
