CREATE TABLE `user_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
