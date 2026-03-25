ALTER TABLE `author_profiles` ADD `earningsCallMentionsJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `earningsCallMentionsEnrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `professionalProfileJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `professionalProfileEnrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `documentArchiveJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `documentArchiveEnrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `technicalReferencesJson` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `technicalReferencesEnrichedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `readingNotesJson` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `readingNotesSyncedAt` timestamp;