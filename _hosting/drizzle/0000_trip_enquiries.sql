CREATE TABLE `enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`journey` text NOT NULL,
	`month` text NOT NULL,
	`travelers` text NOT NULL,
	`question` text NOT NULL,
	`source` text NOT NULL,
	`received_at` text NOT NULL,
	`is_test` integer DEFAULT 0 NOT NULL,
	`acknowledged_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enquiries_request_key_unique` ON `enquiries` (`request_key`);--> statement-breakpoint
CREATE INDEX `pending_enquiries` ON `enquiries` (`acknowledged_at`,`received_at`);--> statement-breakpoint
CREATE TABLE `submission_windows` (
	`key` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL,
	`count` integer NOT NULL
);
