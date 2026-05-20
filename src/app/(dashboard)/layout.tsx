"use client";

import {
  Bot,
  Building2,
  CheckSquare,
  Files,
  LayoutDashboard,
  LogOut,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/crm", label: "Khách hàng", icon: Users },
  { href: "/assets", label: "Bất động sản", icon: Building2 },
  { href: "/tasks", label: "Công việc", icon: CheckSquare },
  { href: "/finance", label: "Tài chính", icon: Wallet },
  { href: "/docs", label: "Tài liệu", icon: Files },
  { href: "/copilot", label: "AI Copilot", icon: Bot },
  { href: "/settings/users", label: "Nhân sự", icon: Shield },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 md:flex">
      <aside className="border-b bg-white md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="border-b px-4 py-4">
          <p className="text-lg font-bold">Anh Hung ERP</p>
          <p className="text-xs text-gray-500">Nhà đất · tài chính · công việc</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto p-3 md:block md:space-y-1 md:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut aria-hidden="true" size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
