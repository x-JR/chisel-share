-- Chisel Portfolio — database schema
-- Run once against your MySQL / MariaDB database before starting the app.
-- The application will also create this table automatically on first start
-- (CREATE TABLE IF NOT EXISTS), so this file is provided for reference /
-- manual setup only.

CREATE TABLE IF NOT EXISTS `schematics` (
  `id`           VARCHAR(36)   NOT NULL,
  `name`         TEXT          NOT NULL,
  `display_name` TEXT          DEFAULT NULL,
  `description`  TEXT          DEFAULT NULL,
  `filename`     VARCHAR(255)  NOT NULL,
  `blockcodes`   MEDIUMTEXT    NOT NULL  COMMENT 'JSON-encoded array of VS block codes',
  `cuboid_count`    INT           NOT NULL  DEFAULT 0,
  `uploaded_at`     INT           NOT NULL  COMMENT 'Unix timestamp (seconds)',
  `uploader_token`  VARCHAR(36)   DEFAULT NULL COMMENT 'Cookie-based ownership token set at upload time',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
