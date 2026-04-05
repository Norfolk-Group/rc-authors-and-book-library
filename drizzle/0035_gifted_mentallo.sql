CREATE TABLE `api_registry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiKey` varchar(128) NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`category` enum('books','news','social','finance','travel','utilities','ai','other') NOT NULL DEFAULT 'other',
	`source` varchar(128) NOT NULL,
	`sourceUrl` varchar(512),
	`rapidApiHost` varchar(256),
	`healthCheckUrl` varchar(512),
	`enabled` int NOT NULL DEFAULT 1,
	`statusColor` enum('green','yellow','red') NOT NULL DEFAULT 'yellow',
	`lastStatusCode` int,
	`lastStatusMessage` varchar(512),
	`lastCheckedAt` timestamp,
	`notes` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_registry_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_registry_apiKey_unique` UNIQUE(`apiKey`)
);
--> statement-breakpoint
CREATE INDEX `api_registry_category_idx` ON `api_registry` (`category`);--> statement-breakpoint
CREATE INDEX `api_registry_enabled_idx` ON `api_registry` (`enabled`);