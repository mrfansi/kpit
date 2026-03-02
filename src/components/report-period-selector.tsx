"use client";

import { useRouter } from "next/navigation";

interface Month { value: string; label: string; }

interface ReportPeriodSelectorProps {
  months: Month[];
  selectedPeriod: string;
}

export function ReportPeriodSelector({ months, selectedPeriod }: ReportPeriodSelectorProps) {
  const router = useRouter();

  return (
    <select
      value={selectedPeriod}
      onChange={(e) => {
        const url = new URL(window.location.href);
        url.searchParams.set("period", e.target.value);
        router.push(url.toString());
      }}
      className="px-3 py-2 border text-sm rounded bg-white hover:bg-gray-50 transition-colors cursor-pointer"
    >
      {months.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}
