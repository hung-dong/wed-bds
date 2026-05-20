import * as React from 'react';
export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200">{children}</table></div>;
}
export function Th({ children, className }: { children: React.ReactNode, className?: string }) {
  return <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className ?? ""}`}>{children}</th>;
}
export function Td({ children, className }: { children: React.ReactNode, className?: string }) {
  return <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className ?? ""}`}>{children}</td>;
}
