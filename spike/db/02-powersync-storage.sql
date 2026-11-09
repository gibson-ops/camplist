-- Bucket storage for the PowerSync service, in its own database and role.
-- https://docs.powersync.com/configuration/powersync-service/self-hosted-instances#postgres-storage
CREATE ROLE powersync_storage_user LOGIN PASSWORD 'spike';
CREATE DATABASE powersync_storage OWNER powersync_storage_user;
