CREATE TABLE `sync_status` (
	`id` varchar(36) NOT NULL,
	`jobType` varchar(64) NOT NULL DEFAULT 'drive-scan',
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`progress` int NOT NULL DEFAULT 0,
	`totalItems` int,
	`processedItems` int NOT NULL DEFAULT 0,
	`message` text,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `sync_status_id` PRIMARY KEY(`id`)
);
