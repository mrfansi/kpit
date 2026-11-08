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
      aria-label="Periode laporan"
      value={selectedPeriod}
      onChange={(e) => {
        const url = new URL(window.location.href);
        url.searchParams.set("period", e.target.value);
        router.push(url.toString());
      }}
      // Tinggi sama dengan tombol sm di sebelahnya; fokus = outline inset seperti field lain.
      className="h-8 cursor-pointer rounded-md border border-input bg-card px-2.5 text-sm transition-colors duration-[var(--dur-micro)] outline-2 outline-offset-[-3px] outline-transparent hover:bg-accent focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55"
    >
      {months.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}
