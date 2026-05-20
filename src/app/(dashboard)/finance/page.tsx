import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate, formatMoney, labelTransactionType } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "../actions";

export const dynamic = "force-dynamic";

export default async function Finance() {
  const transactions = await prisma.transaction.findMany({ orderBy: { date: "desc" } });
  const income = transactions
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = transactions
    .filter((item) => item.type === "EXPENSE")
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expense;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tài chính</h1>
        <p className="mt-1 text-sm text-gray-500">Theo dõi thu chi vận hành và cọc nhà đất.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Tổng thu</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatMoney(income)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Tổng chi</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{formatMoney(expense)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Còn lại</p>
          <p className={`mt-2 text-2xl font-bold ${balance >= 0 ? "text-gray-900" : "text-red-600"}`}>
            {formatMoney(balance)}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Nhập giao dịch nhanh</h2>
        <form action={createTransaction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input name="note" placeholder="Nội dung" required className="md:col-span-2" />
          <Input name="amount" type="number" min="1" step="100000" placeholder="Số tiền" required />
          <select name="type" defaultValue="INCOME" className="rounded border border-gray-300 px-3 py-2">
            <option value="INCOME">Thu</option>
            <option value="EXPENSE">Chi</option>
          </select>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            Lưu giao dịch
          </button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Ngày</Th>
              <Th>Loại</Th>
              <Th>Ghi chú</Th>
              <Th className="text-right">Số tiền</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <Td>{formatDate(transaction.date)}</Td>
                <Td>{labelTransactionType(transaction.type)}</Td>
                <Td>{transaction.note}</Td>
                <Td className={`text-right font-semibold ${transaction.type === "INCOME" ? "text-emerald-700" : "text-red-600"}`}>
                  {formatMoney(transaction.amount)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {transactions.length === 0 ? <p className="p-4 text-sm text-gray-500">Chưa có giao dịch.</p> : null}
      </Card>
    </div>
  );
}
