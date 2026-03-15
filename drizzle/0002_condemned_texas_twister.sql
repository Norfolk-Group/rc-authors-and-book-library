CREATE TABLE `book_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookTitle` varchar(512) NOT NULL,
	`authorName` varchar(256),
	`summary` text,
	`keyThemes` text,
	`rating` varchar(8),
	`ratingCount` varchar(32),
	`amazonUrl` varchar(512),
	`goodreadsUrl` varchar(512),
	`resourceUrl` varchar(512),
	`resourceLabel` varchar(128),
	`enrichedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `book_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `book_profiles_bookTitle_unique` UNIQUE(`bookTitle`)
);
