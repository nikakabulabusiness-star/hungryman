UPDATE `team_members`
SET `role` = NULL,
    `status` = 'suspended',
    `approved_by` = NULL,
    `updated` = unixepoch() * 1000
WHERE `role` = 'Owner'
  AND lower(`email`) <> 'nikolozkabulashvili0@gmail.com';
--> statement-breakpoint
DELETE FROM `admin_users`
WHERE lower(`email`) = 'nikolozkabulashvili0@gmail.com'
   OR `role` = 'Owner';
--> statement-breakpoint
UPDATE `team_members`
SET `role` = 'Owner',
    `status` = 'approved',
    `approved_by` = 'owner-assigned-via-source',
    `updated` = unixepoch() * 1000
WHERE lower(`email`) = 'nikolozkabulashvili0@gmail.com'
  AND `password_hash` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `team_members_single_owner`
ON `team_members` (`role`)
WHERE `role` = 'Owner';
