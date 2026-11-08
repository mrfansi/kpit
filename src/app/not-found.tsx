import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Halaman yang dicari tidak ada atau sudah dihapus.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Kembali ke Overview</Link>
      </Button>
    </div>
  );
}
