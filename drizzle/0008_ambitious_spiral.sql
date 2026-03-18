CREATE TABLE `admin_action_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionKey` varchar(128) NOT NULL,
	`label` varchar(256),
	`lastRunAt` timestamp,
	`lastRunDurationMs` int,
	`lastRunResult` text,
	`lastRunItemCount` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_action_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_action_log_actionKey_unique` UNIQUE(`actionKey`)
);
