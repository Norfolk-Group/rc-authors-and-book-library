CREATE TABLE `managed_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentKey` varchar(128) NOT NULL,
	`agentId` varchar(128) NOT NULL,
	`agentVersion` varchar(64),
	`environmentId` varchar(128),
	`model` varchar(128),
	`configHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_agents_agentKey_unique` UNIQUE(`agentKey`)
);
