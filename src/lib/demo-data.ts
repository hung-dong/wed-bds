export const demoUsers = [
  {
    id: "demo-admin",
    email: "admin@anhhung.vn",
    name: "Duong Xuan Hung",
    role: "ADMIN",
  },
  {
    id: "demo-staff",
    email: "staff@anhhung.vn",
    name: "Nhan vien kinh doanh",
    role: "STAFF",
  },
];

export const demoProperties = [
  {
    id: "demo-property-1",
    title: "Lo dat tho cu",
    address: "Duong Bui Du, Pleiku, Gia Lai",
    status: "AVAILABLE",
    legalStatus: "So do",
    value: 1500000000,
  },
  {
    id: "demo-property-2",
    title: "Nha pho trung tam",
    address: "Phuong Pleiku, Gia Lai",
    status: "NEGOTIATING",
    legalStatus: "Hop dong mua ban",
    value: 2300000000,
  },
];

export const demoLeads = [
  { id: "demo-lead-1", name: "Nguyen Van A", phone: "0901234567", status: "NEW" },
  { id: "demo-lead-2", name: "Tran Thi B", phone: "0912345678", status: "FOLLOW_UP" },
];

export const demoTasks = [
  { id: "demo-task-1", title: "Kiem tra quy hoach khu dat Pleiku", urgency: 5, value: 4, isDone: false },
  { id: "demo-task-2", title: "Lam viec voi khach chot coc", urgency: 4, value: 5, isDone: false },
  { id: "demo-task-3", title: "Cap nhat cong no trong ngay", urgency: 3, value: 4, isDone: false },
];

export const demoTransactions = [
  { id: "demo-transaction-1", amount: 50000000, type: "INCOME", date: new Date("2026-05-20T00:00:00.000Z"), note: "Tien coc dat" },
  { id: "demo-transaction-2", amount: 12000000, type: "EXPENSE", date: new Date("2026-05-20T00:00:00.000Z"), note: "Chi phi marketing" },
];

