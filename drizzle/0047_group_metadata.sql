ALTER TABLE `author_profiles` ADD `conversationGroups` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `conversationGroups` text;--> statement-breakpoint
CREATE INDEX `content_items_enrichedAt_idx` ON `content_items` (`enrichedAt`);
