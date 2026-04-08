CREATE TABLE `dropbox_folder_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folderKey` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`description` text,
	`dropboxPath` varchar(1024) NOT NULL,
	`dropboxWebUrl` varchar(2048),
	`category_dfc` enum('backup','inbox','source','design','other') NOT NULL DEFAULT 'other',
	`enabled` boolean NOT NULL DEFAULT true,
	`lastValidatedAt` timestamp,
	`validationStatus_dfc` enum('valid','invalid','unchecked') NOT NULL DEFAULT 'unchecked',
	`validationError` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt_dfc` timestamp NOT NULL DEFAULT (now()),
	`updatedAt_dfc` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dropbox_folder_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `dropbox_folder_configs_folderKey_unique` UNIQUE(`folderKey`)
);
