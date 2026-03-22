ALTER TABLE `author_profiles` ADD `podcastUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `blogUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `substackUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `newspaperArticlesJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `otherLinksJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `lastLinksEnrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `linksEnrichmentSource` varchar(50);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `publisherUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `lastSummaryEnrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `summaryEnrichmentSource` varchar(50);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `coverImageSource` varchar(50);