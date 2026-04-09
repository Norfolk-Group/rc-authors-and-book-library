CREATE TABLE `author_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rawName` varchar(512) NOT NULL,
	`canonical` varchar(256) NOT NULL,
	`note` varchar(512),
	`createdAt_aa` timestamp NOT NULL DEFAULT (now()),
	`updatedAt_aa` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `author_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `author_aliases_rawName_unique` UNIQUE(`rawName`)
);
--> statement-breakpoint
CREATE INDEX `rawName_idx` ON `author_aliases` (`rawName`);--> statement-breakpoint
CREATE INDEX `canonical_idx` ON `author_aliases` (`canonical`);