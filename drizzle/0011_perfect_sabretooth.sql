ALTER TABLE `author_profiles` MODIFY COLUMN `avatarSource` enum('wikipedia','tavily','apify','ai','google-imagen','drive');--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `authorDescriptionJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `authorDescriptionCachedAt` timestamp;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `lastAvatarPrompt` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `lastAvatarPromptBuiltAt` timestamp;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `driveAvatarFileId` varchar(255);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `avatarGenVendor` varchar(50);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `avatarGenModel` varchar(100);