-- Batas alami metrik, terpisah dari target.
--
-- Target adalah tujuan; batas adalah kenyataan fisik metriknya. PageSpeed
-- mentok di 100, rating di 5, jumlah insiden tidak bisa negatif. Tanpa ini
-- forecast regresi linear memproyeksikan skor 108 pada skala yang maksimumnya
-- 100, dan salah ketik 1000 pada skala 0-100 lolos tanpa perlawanan.
--
-- Nullable: banyak metrik memang tidak berbatas (pendapatan, jumlah transaksi),
-- dan menebak batas yang tidak ada lebih buruk daripada tidak punya batas.

ALTER TABLE `kpis` ADD `min_value` real;--> statement-breakpoint
ALTER TABLE `kpis` ADD `max_value` real;
