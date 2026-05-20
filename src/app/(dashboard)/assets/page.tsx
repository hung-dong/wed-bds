import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney, labelPropertyStatus } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { demoProperties } from "@/lib/demo-data";
import { createProperty } from "../actions";

export const dynamic = "force-dynamic";

export default async function Assets() {
  const assets = await prisma.property.findMany({ orderBy: { value: "desc" } }).catch(() => demoProperties);
  const totalValue = assets.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quản lý bất động sản</h1>
        <p className="mt-1 text-sm text-gray-500">
          {assets.length} tài sản · Tổng giá trị {formatMoney(totalValue)}
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Thêm tài sản nhanh</h2>
        <form action={createProperty} className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
          <Input name="title" placeholder="Tên tài sản" required className="lg:col-span-2" />
          <Input name="address" placeholder="Địa chỉ" required className="lg:col-span-2" />
          <Input name="legalStatus" placeholder="Pháp lý" required />
          <Input name="value" type="number" min="0" step="1000000" placeholder="Giá trị" required />
          <select name="status" defaultValue="AVAILABLE" className="rounded border border-gray-300 px-3 py-2 lg:col-span-2">
            <option value="AVAILABLE">Đang bán</option>
            <option value="NEGOTIATING">Đang thương lượng</option>
            <option value="HOLD">Tạm giữ</option>
            <option value="SOLD">Đã bán</option>
          </select>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 lg:col-span-2">
            Lưu tài sản
          </button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Tiêu đề</Th>
              <Th>Địa chỉ</Th>
              <Th>Trạng thái</Th>
              <Th>Pháp lý</Th>
              <Th className="text-right">Giá</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.map((asset) => (
              <tr key={asset.id}>
                <Td className="font-medium">{asset.title}</Td>
                <Td>{asset.address}</Td>
                <Td>{labelPropertyStatus(asset.status)}</Td>
                <Td>{asset.legalStatus}</Td>
                <Td className="text-right font-semibold">{formatMoney(asset.value)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {assets.length === 0 ? <p className="p-4 text-sm text-gray-500">Chưa có tài sản.</p> : null}
      </Card>
    </div>
  );
}
