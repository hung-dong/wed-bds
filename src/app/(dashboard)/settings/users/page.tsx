import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Users() {
  const users = await prisma.user.findMany({
    orderBy: { role: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nhân sự</h1>
        <p className="mt-1 text-sm text-gray-500">{users.length} tài khoản có quyền vào hệ thống.</p>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Tên</Th>
              <Th>Email</Th>
              <Th>Vai trò</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id}>
                <Td className="font-medium">{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>
                  <span className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                    {user.role}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
