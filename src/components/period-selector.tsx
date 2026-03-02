"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listLastNMonths } from "@/lib/period";

interface PeriodSelectorProps {
  defaultValue?: string;
}

export function PeriodSelector({ defaultValue }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const months = listLastNMonths(12);
  const current = defaultValue ?? searchParams.get("period") ?? months[0]?.value;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Pilih periode" />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
