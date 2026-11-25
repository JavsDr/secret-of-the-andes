CREATE TABLE `trip_sessions` (
	`session_key` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`first_visit_at` integer NOT NULL,
	`first_enquiry_at` integer
);
--> statement-breakpoint
CREATE INDEX `trip_sessions_first_visit` ON `trip_sessions` (`first_visit_at`);