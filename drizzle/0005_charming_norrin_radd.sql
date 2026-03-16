ALTER TABLE `author_profiles` ADD `s3PhotoUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `s3PhotoKey` varchar(512);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `s3CoverUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `s3CoverKey` varchar(512);