ALTER TABLE `content_items` ADD `qualityScore` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `relevanceScore` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `authorityScore` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `freshnessScore` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `depthScore` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `isAlive` int;--> statement-breakpoint
ALTER TABLE `content_items` ADD `contentTypeDetected` varchar(64);--> statement-breakpoint
ALTER TABLE `content_items` ADD `qualityScoredAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_items` ADD `aiExtractedTitle` varchar(512);--> statement-breakpoint
ALTER TABLE `content_items` ADD `aiExtractedSummary` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `aiKeyTopics` text;--> statement-breakpoint
ALTER TABLE `content_items` ADD `aiScoringRationale` text;--> statement-breakpoint
CREATE INDEX `content_items_qualityScore_idx` ON `content_items` (`qualityScore`);--> statement-breakpoint
CREATE INDEX `content_items_isAlive_idx` ON `content_items` (`isAlive`);