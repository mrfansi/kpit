CREATE TABLE `presentation_brand_styles` (
	`revision` integer PRIMARY KEY NOT NULL,
	`style` text NOT NULL,
	`description` text NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
