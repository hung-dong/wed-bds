export function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

const propertyStatus: Record<string, string> = {
  AVAILABLE: "Đang bán",
  NEGOTIATING: "Đang thương lượng",
  SOLD: "Đã bán",
  HOLD: "Tạm giữ",
};

const leadStatus: Record<string, string> = {
  NEW: "Khách mới",
  FOLLOW_UP: "Cần chăm sóc",
  HOT: "Khách nóng",
  WON: "Đã chốt",
  LOST: "Dừng theo",
};

const transactionType: Record<string, string> = {
  INCOME: "Thu",
  EXPENSE: "Chi",
};

export function labelPropertyStatus(status: string) {
  return propertyStatus[status] ?? status;
}

export function labelLeadStatus(status: string) {
  return leadStatus[status] ?? status;
}

export function labelTransactionType(type: string) {
  return transactionType[type] ?? type;
}
