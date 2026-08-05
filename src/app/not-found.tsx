import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <SearchX className="w-10 h-10 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">Halaman Tidak Ditemukan</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Halaman yang dicari tidak ada atau sudah dihapus.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/">Kembali ke Overview</Link>
      </Button>
    </div>
  );
}
