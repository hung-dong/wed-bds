import { Card } from "@/components/ui/card";

const templates = [
  {
    title: "Phiếu giữ chỗ nhà đất",
    note: "Dùng khi khách mới đặt thiện chí, chưa đủ điều kiện lập cọc.",
  },
  {
    title: "Hợp đồng đặt cọc",
    note: "Dùng khi đã chốt giá, pháp lý và thời hạn công chứng.",
  },
  {
    title: "Biên bản giao nhận tiền",
    note: "Dùng cho thu chi tiền mặt, tiền cọc, phí dịch vụ.",
  },
  {
    title: "Checklist kiểm tra pháp lý",
    note: "Sổ đỏ, quy hoạch, tranh chấp, hiện trạng, lối đi, nghĩa vụ thuế.",
  },
];

export default function Docs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tài liệu và hợp đồng</h1>
        <p className="mt-1 text-sm text-gray-500">Khu lưu mẫu giấy tờ cho giao dịch nhà đất.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.title}>
            <h2 className="text-lg font-semibold">{template.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{template.note}</p>
            <span className="mt-4 inline-flex rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
              Đang chuẩn bị mẫu
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
