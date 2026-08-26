-- Make file_id nullable so folder shares (which only set folder_id) don't violate NOT NULL
ALTER TABLE shares ALTER COLUMN file_id DROP NOT NULL;
