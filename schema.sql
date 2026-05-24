-- Chisel Portfolio — database schema
-- Run once against your MySQL / MariaDB database before starting the app.
-- The application will also create this table automatically on first start
-- (CREATE TABLE IF NOT EXISTS), so this file is provided for reference /
-- manual setup only.

CREATE TABLE IF NOT EXISTS `schematics` (
  `id`              VARCHAR(36)   NOT NULL,
  `name`            TEXT          NOT NULL,
  `display_name`    TEXT          DEFAULT NULL,
  `description`     TEXT          DEFAULT NULL,
  `filename`        VARCHAR(255)  NOT NULL,
  `blockcodes`      MEDIUMTEXT    NOT NULL  COMMENT 'JSON-encoded array of VS block codes',
  `cuboid_count`    INT           NOT NULL  DEFAULT 0,
  `uploaded_at`     INT           NOT NULL  COMMENT 'Unix timestamp (seconds)',
  `uploader_token`  VARCHAR(36)   DEFAULT NULL COMMENT 'Cookie-based ownership token set at upload time',
  `download_count`  INT           NOT NULL  DEFAULT 0,
  `collection_id`   VARCHAR(36)   DEFAULT NULL COMMENT 'FK to collections.id',
  `collection_order` INT          NOT NULL  DEFAULT 0 COMMENT 'Display order within a collection',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- For existing databases: add columns if upgrading from an older schema
-- ALTER TABLE `schematics` ADD COLUMN IF NOT EXISTS `download_count`  INT NOT NULL DEFAULT 0;
-- ALTER TABLE `schematics` ADD COLUMN IF NOT EXISTS `collection_id`   VARCHAR(36) DEFAULT NULL;
-- ALTER TABLE `schematics` ADD COLUMN IF NOT EXISTS `collection_order` INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `collections` (
  `id`              VARCHAR(36)   NOT NULL,
  `name`            TEXT          NOT NULL,
  `description`     TEXT          DEFAULT NULL,
  `uploader_token`  VARCHAR(36)   DEFAULT NULL COMMENT 'Cookie-based ownership token',
  `created_at`      INT           NOT NULL COMMENT 'Unix timestamp (seconds)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `likes` (
  `schematic_id`  VARCHAR(36)  NOT NULL,
  `voter_token`   VARCHAR(36)  NOT NULL,
  `liked_at`      INT          NOT NULL COMMENT 'Unix timestamp (seconds)',
  PRIMARY KEY (`schematic_id`, `voter_token`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `collection_likes` (
  `collection_id`  VARCHAR(36)  NOT NULL,
  `voter_token`    VARCHAR(36)  NOT NULL,
  `liked_at`       INT          NOT NULL COMMENT 'Unix timestamp (seconds)',
  PRIMARY KEY (`collection_id`, `voter_token`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
