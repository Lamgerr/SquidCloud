-- SquidCloud production schema baseline (public + squidveil, key objects)
-- Generated: 2026-11-10 via Supabase Management API query endpoint
-- Project: aouqcwbdoyrccjcrhzzi (inflatestore). Source of truth: live production at generation time.
-- Includes: extensions, schemas, enums, tables (columns+constraints+indexes), views, functions, triggers, RLS, policies.
-- Excludes managed Supabase internals (auth/storage/realtime system objects) except where present in public/squidveil.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";

CREATE SCHEMA IF NOT EXISTS "squidveil";

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='workspace_role') THEN CREATE TYPE "public"."workspace_role" AS ENUM ('viewer', 'editor', 'admin', 'owner'); END IF; END $$;

CREATE TABLE IF NOT EXISTS "public"."8djcvk3222" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "manifest_data" bytea NOT NULL,
  "manifest_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "8djcvk3222_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "8djcvk3222_pkey" PRIMARY KEY (id),
  CONSTRAINT "8djcvk3222_file_id_key" UNIQUE (file_id)
);

CREATE TABLE IF NOT EXISTS "public"."access_policies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "applies_to" text DEFAULT 'all'::text,
  "target_users" text[],
  "target_groups" text[],
  "priority" integer DEFAULT 1,
  "active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "access_policies_applies_to_check" CHECK ((applies_to = ANY (ARRAY['all'::text, 'specific_users'::text, 'user_groups'::text]))),
  CONSTRAINT "access_policies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "access_policies_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."account_changes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "change_type" text NOT NULL,
  "old_values" jsonb,
  "new_values" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "account_changes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "account_changes_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."account_health_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid,
  "check_timestamp" timestamp with time zone DEFAULT now(),
  "health_score" integer,
  "response_time_ms" integer,
  "rate_limit_remaining" integer,
  "rate_limit_reset" timestamp with time zone,
  "errors_encountered" jsonb DEFAULT '[]'::jsonb,
  "warnings_encountered" jsonb DEFAULT '[]'::jsonb,
  "additional_metrics" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT "account_health_logs_health_score_check" CHECK (((health_score >= 0) AND (health_score <= 100))),
  CONSTRAINT "account_health_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."admin_access_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "access_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "access_purpose" text NOT NULL,
  "step_completed" integer DEFAULT 4 NOT NULL,
  "session_id" text,
  CONSTRAINT "admin_access_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "admin_access_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "event_type" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "timestamp" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "session_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."api_admin_config" (
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_admin_config_pkey" PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS "public"."api_credit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "api_key_id" uuid,
  "operation" text NOT NULL,
  "credits_deducted" integer NOT NULL,
  "file_size" bigint,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_credit_log_api_key_id_fkey" FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL,
  CONSTRAINT "api_credit_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "api_credit_log_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."api_credits" (
  "user_id" uuid NOT NULL,
  "credits_remaining" integer DEFAULT 1000 NOT NULL,
  "credits_used_today" integer DEFAULT 0 NOT NULL,
  "daily_limit" integer DEFAULT 1000 NOT NULL,
  "last_reset_date" date DEFAULT CURRENT_DATE NOT NULL,
  "custom_daily_limit" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "uploads_used_today" integer DEFAULT 0 NOT NULL,
  "uploads_reset_date" date DEFAULT CURRENT_DATE NOT NULL,
  CONSTRAINT "api_credits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "api_credits_pkey" PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."api_key_limits" (
  "api_key_id" uuid NOT NULL,
  "custom_daily_limit" integer,
  "custom_rate_limit_rps" integer,
  "is_disabled" boolean DEFAULT false,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_key_limits_api_key_id_fkey" FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  CONSTRAINT "api_key_limits_pkey" PRIMARY KEY (api_key_id)
);

CREATE TABLE IF NOT EXISTS "public"."api_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" text NOT NULL,
  "scopes" text[] DEFAULT ARRAY['read'::text, 'write'::text, 'delete'::text],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "key_salt" text,
  "request_timestamp_max_age" integer DEFAULT 300,
  "allow_hmac" boolean DEFAULT false,
  CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "api_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "api_keys_key_hash_key" UNIQUE (key_hash)
);

CREATE TABLE IF NOT EXISTS "public"."api_operation_costs" (
  "operation" text NOT NULL,
  "base_cost" integer DEFAULT 1 NOT NULL,
  "per_byte_cost" numeric(12,8) DEFAULT 0,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_operation_costs_pkey" PRIMARY KEY (operation)
);

CREATE TABLE IF NOT EXISTS "public"."api_request_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "api_key_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "method" text NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "status_code" integer NOT NULL,
  "response_time_ms" integer,
  "file_name" text,
  "file_size" bigint,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_request_logs_api_key_id_fkey" FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  CONSTRAINT "api_request_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "api_request_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."archive_extractions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_file_id" uuid NOT NULL,
  "source_file_name" text NOT NULL,
  "destination_folder" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "progress" integer DEFAULT 0,
  "total_files" integer DEFAULT 0,
  "extracted_files" integer DEFAULT 0,
  "extracted_file_ids" uuid[],
  "error_message" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "archive_extractions_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
  CONSTRAINT "archive_extractions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'extracting'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "archive_extractions_source_file_id_fkey" FOREIGN KEY (source_file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "archive_extractions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "archive_extractions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "resource" text NOT NULL,
  "timestamp" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "ip_address" text,
  "details" jsonb DEFAULT '{}'::jsonb,
  "compliance_tags" text[] DEFAULT '{}'::text[],
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."beta_enrollments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "email" text NOT NULL,
  "feature" text DEFAULT 'substrate-agnostic'::text NOT NULL,
  "enrolled_at" timestamp with time zone DEFAULT now(),
  "notified" boolean DEFAULT false,
  CONSTRAINT "beta_enrollments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "beta_enrollments_pkey" PRIMARY KEY (id),
  CONSTRAINT "beta_enrollments_user_id_feature_key" UNIQUE (user_id, feature)
);

CREATE TABLE IF NOT EXISTS "public"."book_metadata" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "cover_storage_path" text,
  "extracted_title" text,
  "extracted_author" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "book_metadata_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "book_metadata_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "book_metadata_pkey" PRIMARY KEY (id),
  CONSTRAINT "book_metadata_user_id_file_id_key" UNIQUE (user_id, file_id)
);

CREATE TABLE IF NOT EXISTS "public"."cli_authorizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code" text,
  "device_code" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "access_token_hash" text,
  "token_prefix" text,
  "scopes" text[] DEFAULT ARRAY['read'::text, 'write'::text, 'delete'::text],
  "expires_at" timestamp with time zone DEFAULT now() NOT NULL,
  "authorized_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "code_hash" text,
  "token_hash" text,
  "used" boolean DEFAULT false,
  "client_id" text DEFAULT 'squidcloud-cli'::text,
  "redirect_uri" text,
  "scope" text DEFAULT 'read write'::text,
  CONSTRAINT "cli_authorizations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'authorized'::text, 'expired'::text, 'revoked'::text]))),
  CONSTRAINT "cli_authorizations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "cli_authorizations_pkey" PRIMARY KEY (id),
  CONSTRAINT "cli_authorizations_code_key" UNIQUE (code),
  CONSTRAINT "cli_authorizations_device_code_key" UNIQUE (device_code)
);

CREATE TABLE IF NOT EXISTS "public"."cli_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "auth_id" uuid,
  "device_name" text,
  "machine_id" text NOT NULL,
  "machine_fingerprint" text,
  "ip_address" text,
  "user_agent" text,
  "platform" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "device_code" text,
  "client_id" text DEFAULT 'squidcloud-cli'::text,
  "scope" text DEFAULT 'read write'::text,
  "token_hash" text,
  "is_banned" boolean DEFAULT false,
  "banned_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "authorized_at" timestamp with time zone,
  "aal2_verified_at" timestamp with time zone,
  CONSTRAINT "cli_devices_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'authorized'::text, 'active'::text, 'revoked'::text, 'banned'::text, 'expired'::text]))),
  CONSTRAINT "cli_devices_auth_id_fkey" FOREIGN KEY (auth_id) REFERENCES cli_authorizations(id) ON DELETE SET NULL,
  CONSTRAINT "cli_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "cli_devices_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."discount_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "discount_percent" integer NOT NULL,
  "plan_type" text NOT NULL,
  "billing_period" text,
  "max_uses" integer DEFAULT 1,
  "used_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  CONSTRAINT "discount_codes_billing_period_check" CHECK ((billing_period = ANY (ARRAY['weekly'::text, 'monthly'::text, 'annual'::text]))),
  CONSTRAINT "discount_codes_discount_percent_check" CHECK (((discount_percent > 0) AND (discount_percent <= 100))),
  CONSTRAINT "discount_codes_plan_type_check" CHECK ((plan_type = ANY (ARRAY['supporter'::text, 'supporter-plus'::text]))),
  CONSTRAINT "discount_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT "discount_codes_pkey" PRIMARY KEY (id),
  CONSTRAINT "discount_codes_code_key" UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS "public"."downloads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "progress" numeric(5,2) DEFAULT 0.00 NOT NULL,
  "download_speed" bigint DEFAULT 0,
  "bytes_downloaded" bigint DEFAULT 0,
  "total_bytes" bigint NOT NULL,
  "estimated_time" integer DEFAULT 0,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "downloads_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."embed_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "view_count" bigint DEFAULT 0 NOT NULL,
  "embed_config" jsonb DEFAULT '{"theme": "dark", "width": "100%", "height": "400", "layout": "grid", "showBranding": true}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "embed_tokens_entity_type_check" CHECK ((entity_type = ANY (ARRAY['file'::text, 'folder'::text]))),
  CONSTRAINT "embed_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "embed_tokens_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."encrypted_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "wrapped_key" text NOT NULL,
  "key_iv" text NOT NULL,
  "key_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "encrypted_keys_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "encrypted_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "encrypted_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "encrypted_keys_file_id_user_id_key" UNIQUE (file_id, user_id)
);

CREATE TABLE IF NOT EXISTS "public"."entity_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "content" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entity_notes_entity_type_check" CHECK ((entity_type = ANY (ARRAY['file'::text, 'folder'::text]))),
  CONSTRAINT "entity_notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "entity_notes_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."extension_analytics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "extension_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "event_data" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "extension_analytics_extension_id_fkey" FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE,
  CONSTRAINT "extension_analytics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "extension_analytics_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."extension_approval_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "extension_id" uuid NOT NULL,
  "admin_id" uuid NOT NULL,
  "previous_status" text,
  "new_status" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "extension_approval_history_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES auth.users(id),
  CONSTRAINT "extension_approval_history_extension_id_fkey" FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE,
  CONSTRAINT "extension_approval_history_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."extension_ratings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "extension_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "rating" integer NOT NULL,
  "review" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "extension_ratings_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT "extension_ratings_extension_id_fkey" FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE,
  CONSTRAINT "extension_ratings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "extension_ratings_pkey" PRIMARY KEY (id),
  CONSTRAINT "extension_ratings_extension_id_user_id_key" UNIQUE (extension_id, user_id)
);

CREATE TABLE IF NOT EXISTS "public"."extensions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "version" text DEFAULT '1.0.0'::text NOT NULL,
  "author" text NOT NULL,
  "author_id" uuid NOT NULL,
  "icon_url" text,
  "category" text DEFAULT 'utility'::text NOT NULL,
  "downloads" integer DEFAULT 0,
  "rating" numeric(3,2) DEFAULT 0,
  "total_ratings" integer DEFAULT 0,
  "is_verified" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "manifest_url" text NOT NULL,
  "repository_url" text,
  "permissions" text[] DEFAULT '{}'::text[],
  "screenshots" text[] DEFAULT '{}'::text[],
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "approval" text DEFAULT 'pending'::text NOT NULL,
  "approval_notes" text,
  "approved_at" timestamp with time zone,
  "approved_by" uuid,
  CONSTRAINT "extensions_approval_check" CHECK ((approval = ANY (ARRAY['pending'::text, 'on_review'::text, 'approved'::text]))),
  CONSTRAINT "extensions_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id),
  CONSTRAINT "extensions_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "extensions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."file_key_vault" (
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "wrapped_key" text NOT NULL,
  "iv" text NOT NULL,
  "key_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "file_key_vault_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "file_key_vault_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "file_key_vault_pkey" PRIMARY KEY (file_id)
);

CREATE TABLE IF NOT EXISTS "public"."file_request_submissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_request_id" uuid NOT NULL,
  "uploader_name" text DEFAULT ''::text,
  "uploader_email" text DEFAULT ''::text,
  "file_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "file_size" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "file_request_submissions_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "file_request_submissions_file_request_id_fkey" FOREIGN KEY (file_request_id) REFERENCES file_requests(id) ON DELETE CASCADE,
  CONSTRAINT "file_request_submissions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."file_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "folder_path" text DEFAULT ''::text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT ''::text,
  "slug" text NOT NULL,
  "max_files" integer DEFAULT 0,
  "max_size_per_file" bigint DEFAULT 0,
  "allowed_types" text[],
  "expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "file_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "file_requests_pkey" PRIMARY KEY (id),
  CONSTRAINT "file_requests_slug_key" UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS "public"."files" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "size" bigint NOT NULL,
  "encrypted" boolean DEFAULT true,
  "storage_path" text NOT NULL,
  "encryption_key" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "shared" boolean DEFAULT false,
  "tags" text[],
  "parent_folder" text,
  "is_public" boolean DEFAULT false,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "original_parent_folder" text,
  "in_vault" boolean DEFAULT false,
  "vault_previous_folder" text,
  "encryption_key_salt" text,
  "workspace_id" uuid,
  "storage_provider_id" uuid,
  "external_object_key" text,
  "encrypted_key" text,
  "encrypted_key_nonce" text,
  "encryption_key_version" integer DEFAULT 1,
  "last_accessed_at" timestamp with time zone DEFAULT now(),
  "archived" boolean DEFAULT false,
  "archived_at" timestamp with time zone,
  "processor" text,
  "folder_id" uuid,
  "swk_manifest_hash" text,
  "swk_manifest" jsonb,
  "swk_decision" text,
  "swk_scanned_at" timestamp with time zone,
  CONSTRAINT "files_storage_provider_id_fkey" FOREIGN KEY (storage_provider_id) REFERENCES storage_providers(id) ON DELETE SET NULL,
  CONSTRAINT "files_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "files_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT "files_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."folders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "path" text NOT NULL,
  "parent_folder" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_public" boolean DEFAULT false,
  "workspace_id" uuid,
  "storage_provider_id" uuid,
  CONSTRAINT "folders_storage_provider_id_fkey" FOREIGN KEY (storage_provider_id) REFERENCES storage_providers(id) ON DELETE SET NULL,
  CONSTRAINT "folders_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT "folders_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."github_connections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "github_user_id" text NOT NULL,
  "github_username" text NOT NULL,
  "access_token" text NOT NULL,
  "token_type" text DEFAULT 'bearer'::text,
  "scope" text DEFAULT ''::text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "github_connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "github_connections_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."installed_extensions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "extension_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "is_enabled" boolean DEFAULT true,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "installed_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "installed_extensions_extension_id_fkey" FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE,
  CONSTRAINT "installed_extensions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "installed_extensions_pkey" PRIMARY KEY (id),
  CONSTRAINT "installed_extensions_extension_id_user_id_key" UNIQUE (extension_id, user_id)
);

CREATE TABLE IF NOT EXISTS "public"."key_access_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "key_type" text NOT NULL,
  "key_id" text NOT NULL,
  "action" text NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "success" boolean DEFAULT true NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "key_access_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "key_access_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_admin_incidents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "threat_event_id" uuid,
  "incident_title" text,
  "threat_tier" text,
  "attacker_profile" jsonb,
  "attack_timeline" jsonb,
  "what_was_targeted" text,
  "potential_harm" text,
  "techniques_used" text[],
  "actions_taken" text[],
  "linked_accounts" jsonb,
  "network_intel" jsonb,
  "status" text DEFAULT 'PENDING'::text,
  "resolved_by" text,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "kza_admin_incidents_status_check" CHECK ((status = ANY (ARRAY['PENDING'::text, 'ACKNOWLEDGED'::text, 'RESOLVED'::text, 'FALSE_POSITIVE'::text]))),
  CONSTRAINT "kza_admin_incidents_threat_event_id_fkey" FOREIGN KEY (threat_event_id) REFERENCES kza_threat_events(id) ON DELETE SET NULL,
  CONSTRAINT "kza_admin_incidents_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_banned_entities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "ip_address" text,
  "ban_type" text,
  "ban_reason" text,
  "ban_tier" text,
  "attack_summary" text,
  "banned_until" timestamp with time zone,
  "banned_by" text DEFAULT 'KZA_AUTO'::text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "recheck_at" timestamp with time zone,
  "ban_source" text DEFAULT 'MANUAL'::text,
  "shadow" boolean DEFAULT false NOT NULL,
  "entity_type" text,
  "entity_value" text,
  CONSTRAINT "kza_banned_entities_ban_source_check" CHECK ((ban_source = ANY (ARRAY['MANUAL'::text, 'GEO_FENCE'::text, 'IP_REPUTATION'::text, 'KZA_SENTINEL'::text, 'S_HAWK'::text]))),
  CONSTRAINT "kza_banned_entities_type_check" CHECK (((ban_type IS NULL) OR (ban_type = ANY (ARRAY['TEMP'::text, 'PERMANENT'::text])))),
  CONSTRAINT "kza_banned_entities_entity_type_check" CHECK (((entity_type IS NULL) OR (entity_type = ANY (ARRAY['USER'::text, 'IP'::text, 'DEVICE'::text, 'MACHINE'::text])))),
  CONSTRAINT "kza_banned_entities_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_cip_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "version" text NOT NULL,
  "is_current" boolean DEFAULT false NOT NULL,
  "released_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deprecated_at" timestamp with time zone,
  "min_score" integer DEFAULT 40 NOT NULL,
  "entropy_required" integer DEFAULT 64 NOT NULL,
  "timing_min_ms" integer DEFAULT 80 NOT NULL,
  "timing_max_ms" integer DEFAULT 500 NOT NULL,
  "pow_required" boolean DEFAULT false NOT NULL,
  "pow_bits" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "kza_cip_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "kza_cip_versions_version_key" UNIQUE (version)
);

CREATE TABLE IF NOT EXISTS "public"."kza_geo_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "session_id" text,
  "ip_address" text NOT NULL,
  "country_code" text,
  "city" text,
  "latitude" double precision,
  "longitude" double precision,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verdict" text,
  CONSTRAINT "kza_geo_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "kza_geo_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_geo_fence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "country_code" text NOT NULL,
  "action" text NOT NULL,
  "reason" text,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "severity" text DEFAULT 'block'::text NOT NULL,
  CONSTRAINT "kza_geo_fence_action_check" CHECK ((action = ANY (ARRAY['allow'::text, 'block'::text]))),
  CONSTRAINT "kza_geo_fence_severity_check" CHECK ((severity = ANY (ARRAY['block'::text, 'shadow'::text]))),
  CONSTRAINT "kza_geo_fence_pkey" PRIMARY KEY (id),
  CONSTRAINT "kza_geo_fence_country_code_key" UNIQUE (country_code)
);

CREATE TABLE IF NOT EXISTS "public"."kza_health_checks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "check_name" text NOT NULL,
  "status" text NOT NULL,
  "details" jsonb,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_health_checks_status_check" CHECK ((status = ANY (ARRAY['PASS'::text, 'WARN'::text, 'FAIL'::text]))),
  CONSTRAINT "kza_health_checks_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_honeypot_hits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "trap_name" text,
  "trap_type" text,
  "user_id" uuid,
  "ip_address" text,
  "request_details" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "kza_honeypot_hits_type_check" CHECK (((trap_type IS NULL) OR (trap_type = ANY (ARRAY['GHOST_ENDPOINT'::text, 'CANARY_TOKEN'::text, 'HONEYPOT_FILE'::text, 'FAKE_CREDENTIALS'::text, 'INVISIBLE_FIELD'::text])))),
  CONSTRAINT "kza_honeypot_hits_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_ip_rate_buckets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ip_hash" text NOT NULL,
  "function_id" text NOT NULL,
  "window_start" timestamp with time zone DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "tokens_remaining" integer DEFAULT 60 NOT NULL,
  "tokens_refilled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_ip_rate_buckets_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_ip_reputation" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ip_address" text NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "is_vpn" boolean DEFAULT false NOT NULL,
  "is_datacenter" boolean DEFAULT false NOT NULL,
  "is_proxy" boolean DEFAULT false NOT NULL,
  "is_tor" boolean DEFAULT false NOT NULL,
  "is_trusted" boolean DEFAULT false NOT NULL,
  "org" text,
  "isp" text,
  "asn" text,
  "country_code" text,
  "city" text,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_hash" text,
  CONSTRAINT "kza_ip_reputation_pkey" PRIMARY KEY (id),
  CONSTRAINT "kza_ip_reputation_ip_address_key" UNIQUE (ip_address)
);

CREATE TABLE IF NOT EXISTS "public"."kza_linked_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "primary_user_id" uuid,
  "linked_user_id" uuid,
  "link_reason" text,
  "confidence_score" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "kza_linked_accounts_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_phantom_assets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "asset_name" text,
  "asset_type" text,
  "asset_value" text,
  "is_active" boolean DEFAULT true,
  "hit_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "kza_phantom_assets_type_check" CHECK (((asset_type IS NULL) OR (asset_type = ANY (ARRAY['GHOST_ENDPOINT'::text, 'CANARY_TOKEN'::text, 'HONEYPOT_FILE'::text, 'FAKE_CREDENTIALS'::text, 'INVISIBLE_FIELD'::text])))),
  CONSTRAINT "kza_phantom_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "kza_phantom_assets_asset_name_asset_type_key" UNIQUE (asset_name, asset_type)
);

CREATE TABLE IF NOT EXISTS "public"."kza_prel_f2fa_seeds" (
  "seed_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "function_id" text NOT NULL,
  "day_seed" text NOT NULL,
  "session_nonce" text NOT NULL,
  "seed_derived" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "rotated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "issued_by" text DEFAULT 'kza-prel'::text,
  CONSTRAINT "kza_prel_f2fa_seeds_function_id_fkey" FOREIGN KEY (function_id) REFERENCES kza_prel_registry(function_id),
  CONSTRAINT "kza_prel_f2fa_seeds_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "kza_prel_f2fa_seeds_pkey" PRIMARY KEY (seed_id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_prel_hmac_keys" (
  "function_id" text NOT NULL,
  "key_name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone,
  CONSTRAINT "kza_prel_hmac_keys_function_id_fkey" FOREIGN KEY (function_id) REFERENCES kza_prel_registry(function_id) ON DELETE CASCADE,
  CONSTRAINT "kza_prel_hmac_keys_pkey" PRIMARY KEY (function_id),
  CONSTRAINT "kza_prel_hmac_keys_key_name_key" UNIQUE (key_name)
);

CREATE TABLE IF NOT EXISTS "public"."kza_prel_registry" (
  "function_id" text NOT NULL,
  "function_name" text NOT NULL,
  "description" text,
  "required_auth_level" text DEFAULT 'jwt'::text NOT NULL,
  "cip_required" boolean DEFAULT false NOT NULL,
  "f2fa_required" boolean DEFAULT false NOT NULL,
  "chain_depth_limit" integer DEFAULT 3 NOT NULL,
  "allowed_callers" text[] DEFAULT '{}'::text[],
  "ttl_seconds" integer DEFAULT 300 NOT NULL,
  "long_op_ttl_seconds" integer DEFAULT 3600 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "required_min_role" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rate_limit_rps" integer DEFAULT 10 NOT NULL,
  "rate_limit_burst" integer DEFAULT 30 NOT NULL,
  "geo_velocity_check" boolean DEFAULT false NOT NULL,
  "geo_max_speed_kmh" double precision DEFAULT 900 NOT NULL,
  "veil_no_log" boolean DEFAULT false NOT NULL,
  "geo_fence_check" boolean DEFAULT false NOT NULL,
  "allowed_operations" text[] DEFAULT '{}'::text[],
  CONSTRAINT "kza_prel_registry_auth_check" CHECK ((required_auth_level = ANY (ARRAY['jwt'::text, 'api_key'::text, 'hmac'::text, 'hmac_gateway'::text, 'hmac_jwt'::text, 'prel_only'::text, 'none'::text, 'any'::text]))),
  CONSTRAINT "kza_prel_registry_role_check" CHECK (((required_min_role IS NULL) OR (required_min_role = ANY (ARRAY['viewer'::text, 'editor'::text, 'admin'::text, 'owner'::text])))),
  CONSTRAINT "kza_prel_registry_pkey" PRIMARY KEY (function_id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_prel_sessions" (
  "token_hash" text NOT NULL,
  "user_id" uuid,
  "session_id" text NOT NULL,
  "parent_token_hash" text,
  "function_id" text NOT NULL,
  "operation_scope" text[] DEFAULT '{}'::text[],
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "chain_depth" integer DEFAULT 0,
  "cip_score" integer,
  "f2fa_window" integer,
  "is_long_op" boolean DEFAULT false,
  "long_op_expires_at" timestamp with time zone,
  "metadata" jsonb,
  "geo_score" integer,
  "binding_hash" text,
  CONSTRAINT "kza_prel_sessions_function_id_fkey" FOREIGN KEY (function_id) REFERENCES kza_prel_registry(function_id),
  CONSTRAINT "kza_prel_sessions_parent_token_hash_fkey" FOREIGN KEY (parent_token_hash) REFERENCES kza_prel_sessions(token_hash) ON DELETE SET NULL,
  CONSTRAINT "kza_prel_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "kza_prel_sessions_pkey" PRIMARY KEY (token_hash)
);

CREATE TABLE IF NOT EXISTS "public"."kza_rate_buckets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "function_id" text NOT NULL,
  "window_start" timestamp with time zone DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "tokens_remaining" integer DEFAULT 60 NOT NULL,
  "tokens_refilled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_rate_buckets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "kza_rate_buckets_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_swk_cases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "manifest_hash" text NOT NULL,
  "filename" text DEFAULT ''::text NOT NULL,
  "size_bytes" bigint DEFAULT 0 NOT NULL,
  "decision" text NOT NULL,
  "risk_score" integer DEFAULT 0 NOT NULL,
  "repeat_count" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "threat_event_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_swk_cases_decision_check" CHECK ((decision = ANY (ARRAY['allow'::text, 'review'::text, 'reject'::text]))),
  CONSTRAINT "kza_swk_cases_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'forwarded'::text, 'adjudicated'::text, 'closed'::text, 'appealed'::text]))),
  CONSTRAINT "kza_swk_cases_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_swk_denylist" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "source" text DEFAULT 'manual'::text NOT NULL,
  "note" text DEFAULT ''::text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_swk_denylist_kind_check" CHECK ((kind = ANY (ARRAY['sha256'::text, 'phash'::text, 'filename_pattern'::text, 'keyword'::text, 'mime_tool'::text]))),
  CONSTRAINT "kza_swk_denylist_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'verdict'::text, 'shawk'::text]))),
  CONSTRAINT "kza_swk_denylist_pkey" PRIMARY KEY (id),
  CONSTRAINT "kza_swk_denylist_kind_value_key" UNIQUE (kind, value)
);

CREATE TABLE IF NOT EXISTS "public"."kza_swk_findings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "scanner" text NOT NULL,
  "scanner_version" text DEFAULT 'v1'::text NOT NULL,
  "signal" text NOT NULL,
  "weight" integer DEFAULT 0 NOT NULL,
  "critical" boolean DEFAULT false NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_swk_findings_case_id_fkey" FOREIGN KEY (case_id) REFERENCES kza_swk_cases(id) ON DELETE CASCADE,
  CONSTRAINT "kza_swk_findings_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_swk_notices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "case_id" uuid,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_swk_notices_case_id_fkey" FOREIGN KEY (case_id) REFERENCES kza_swk_cases(id) ON DELETE SET NULL,
  CONSTRAINT "kza_swk_notices_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_swk_policy" (
  "id" integer DEFAULT 1 NOT NULL,
  "reject_at" integer DEFAULT 70 NOT NULL,
  "review_at" integer DEFAULT 40 NOT NULL,
  "warn_repeat_within_days" integer DEFAULT 30 NOT NULL,
  "escalate_repeat_count" integer DEFAULT 3 NOT NULL,
  "susp_70_89_days" integer DEFAULT 7 NOT NULL,
  "susp_90_plus_days" integer DEFAULT 30 NOT NULL,
  "token_ttl_seconds" integer DEFAULT 900 NOT NULL,
  "token_max_uses" integer DEFAULT 5 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_swk_policy_single_row" CHECK ((id = 1)),
  CONSTRAINT "kza_swk_policy_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_swk_verdict_tokens" (
  "token_hash" text NOT NULL,
  "user_id" uuid NOT NULL,
  "manifest_hash" text NOT NULL,
  "size_bytes" bigint DEFAULT 0 NOT NULL,
  "decision" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "max_uses" integer DEFAULT 5 NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kza_swk_verdict_tokens_decision_check" CHECK ((decision = ANY (ARRAY['allow'::text, 'review'::text]))),
  CONSTRAINT "kza_swk_verdict_tokens_pkey" PRIMARY KEY (token_hash)
);

CREATE TABLE IF NOT EXISTS "public"."kza_threat_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "session_id" text,
  "ip_address" text,
  "threat_tier" text,
  "threat_type" text,
  "description" text,
  "payload_snapshot" jsonb,
  "endpoint_hit" text,
  "method" text,
  "automated_action_taken" text,
  "acknowledged" boolean DEFAULT false,
  "acknowledged_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "geo_score" integer,
  "rate_limit_exceeded" boolean DEFAULT false NOT NULL,
  "cip_version" text,
  "payload_snapshot_enc" text,
  "payload_snapshot_nonce" text,
  "ip_hash" text,
  "country" text,
  CONSTRAINT "kza_threat_events_tier_check" CHECK (((threat_tier IS NULL) OR (threat_tier = ANY (ARRAY['YELLOW'::text, 'ORANGE'::text, 'RED'::text, 'BLACK'::text])))),
  CONSTRAINT "kza_threat_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."kza_user_profiles" (
  "user_id" uuid NOT NULL,
  "typical_endpoints" text[] DEFAULT '{}'::text[],
  "typical_countries" text[] DEFAULT '{}'::text[],
  "typical_devices" jsonb DEFAULT '[]'::jsonb,
  "avg_request_interval_ms" integer,
  "typical_active_hours" integer[] DEFAULT '{}'::integer[],
  "total_requests" bigint DEFAULT 0,
  "last_seen_at" timestamp with time zone,
  "threat_score" integer DEFAULT 0,
  "is_watchlisted" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "typical_devices_enc" text,
  "typical_devices_nonce" text,
  "threat_score_decayed_at" timestamp with time zone,
  CONSTRAINT "kza_user_profiles_pkey" PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."login_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "device_name" text,
  "remember_device" boolean DEFAULT false,
  "last_active" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "login_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "login_sessions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."maintenance_mode" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "is_enabled" boolean DEFAULT false,
  "maintenance_type" text DEFAULT 'general'::text,
  "message" text DEFAULT 'System is under maintenance'::text,
  "estimated_duration" integer,
  "services_status" jsonb DEFAULT '{}'::jsonb,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "maintenance_mode_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."maintenance_schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "is_active" boolean DEFAULT false,
  "maintenance_type" text NOT NULL,
  "affected_services" text[] DEFAULT '{}'::text[],
  "reason" text NOT NULL,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "scheduled_for" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "maintenance_schedules_maintenance_type_check" CHECK ((maintenance_type = ANY (ARRAY['full'::text, 'partial'::text]))),
  CONSTRAINT "maintenance_schedules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."master_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "encrypted_master_key" text NOT NULL,
  "kdf_salt" text NOT NULL,
  "kdf_iterations" integer DEFAULT 100000 NOT NULL,
  "key_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_rotated" timestamp with time zone,
  CONSTRAINT "master_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "master_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "master_keys_user_id_key_version_key" UNIQUE (user_id, key_version)
);

CREATE TABLE IF NOT EXISTS "public"."media_playback_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "event_type" character varying(50) NOT NULL,
  "position" numeric(10,3),
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "media_playback_logs_event_type_check" CHECK (((event_type)::text = ANY ((ARRAY['play'::character varying, 'pause'::character varying, 'seek'::character varying, 'quality_change'::character varying, 'speed_change'::character varying, 'buffer_start'::character varying, 'buffer_end'::character varying, 'complete'::character varying, 'error'::character varying])::text[]))),
  CONSTRAINT "media_playback_logs_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "media_playback_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "media_playback_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."migration_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_platform" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "total_files" integer DEFAULT 0,
  "processed_files" integer DEFAULT 0,
  "failed_files" integer DEFAULT 0,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "migration_jobs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'authenticated'::text, 'scheduled'::text, 'extracting'::text, 'uploading'::text]))),
  CONSTRAINT "migration_jobs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."migration_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "migration_job_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "level" text DEFAULT 'info'::text NOT NULL,
  "message" text NOT NULL,
  "file_name" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "migration_logs_level_check" CHECK ((level = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'success'::text]))),
  CONSTRAINT "migration_logs_migration_job_id_fkey" FOREIGN KEY (migration_job_id) REFERENCES migration_jobs(id) ON DELETE CASCADE,
  CONSTRAINT "migration_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."partner_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "duration_months" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid,
  "is_used" boolean DEFAULT false,
  "used_by" uuid,
  "used_at" timestamp with time zone,
  CONSTRAINT "partner_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT "partner_codes_used_by_fkey" FOREIGN KEY (used_by) REFERENCES auth.users(id),
  CONSTRAINT "partner_codes_pkey" PRIMARY KEY (id),
  CONSTRAINT "partner_codes_code_key" UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS "public"."passkey_challenges" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "challenge" text NOT NULL,
  "type" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "passkey_challenges_type_check" CHECK ((type = ANY (ARRAY['registration'::text, 'authentication'::text]))),
  CONSTRAINT "passkey_challenges_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."payment_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "plan" text,
  "plan_type" text,
  "billing_period" text,
  "amount_usd" numeric(10,2),
  "currency" text DEFAULT 'USD'::text,
  "tx_hash" text,
  "network" text,
  "token" text,
  "session_id" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "description" text,
  "discount_percent" numeric(5,2) DEFAULT 0,
  "discount_code" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "paid_at" timestamp with time zone,
  "timezone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_logs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'expired'::text, 'refunded'::text, 'cancelled'::text]))),
  CONSTRAINT "payment_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "payment_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."pdf_annotations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "document_id" text NOT NULL,
  "page_number" integer NOT NULL,
  "annotation_type" text NOT NULL,
  "color" text DEFAULT '#FFEB3B'::text,
  "opacity" real DEFAULT 0.4,
  "content" jsonb DEFAULT '{}'::jsonb,
  "position_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "pdf_annotations_annotation_type_check" CHECK ((annotation_type = ANY (ARRAY['highlight'::text, 'underline'::text, 'strikethrough'::text, 'freehand'::text, 'sticky_note'::text, 'text_box'::text, 'signature'::text, 'drawing'::text]))),
  CONSTRAINT "pdf_annotations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pdf_annotations_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."pdf_bookmarks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "document_id" text NOT NULL,
  "page_number" integer NOT NULL,
  "label" text DEFAULT ''::text,
  "color" text DEFAULT '#3B82F6'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "pdf_bookmarks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pdf_bookmarks_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."pdf_reading_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "document_id" text NOT NULL,
  "document_name" text DEFAULT ''::text,
  "last_page" integer DEFAULT 1,
  "total_pages" integer DEFAULT 0,
  "scroll_position" real DEFAULT 0,
  "zoom" real DEFAULT 1.35,
  "theme" text DEFAULT 'normal'::text,
  "layout" text DEFAULT 'single'::text,
  "reading_time_seconds" integer DEFAULT 0,
  "last_read_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "pdf_reading_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pdf_reading_progress_pkey" PRIMARY KEY (id),
  CONSTRAINT "pdf_reading_progress_user_id_document_id_key" UNIQUE (user_id, document_id)
);

CREATE TABLE IF NOT EXISTS "public"."pdf_secure_urls" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "secure_url" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "pdf_secure_urls_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "pdf_secure_urls_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pdf_secure_urls_pkey" PRIMARY KEY (id),
  CONSTRAINT "pdf_secure_urls_file_id_user_id_key" UNIQUE (file_id, user_id)
);

CREATE TABLE IF NOT EXISTS "public"."pdf_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "document_ids" text[] DEFAULT '{}'::text[],
  "active_document" text DEFAULT ''::text,
  "state_data" jsonb DEFAULT '{}'::jsonb,
  "last_active" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "pdf_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pdf_sessions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."pin_attempt_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "attempt_type" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "location" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "pin_attempt_logs_attempt_type_check" CHECK ((attempt_type = ANY (ARRAY['success'::text, 'failed'::text, 'locked'::text]))),
  CONSTRAINT "pin_attempt_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pin_attempt_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."pin_operation_authorizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "operation_type" text NOT NULL,
  "authorized_until" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pin_operation_authorizations_operation_type_check" CHECK ((operation_type = ANY (ARRAY['create_share'::text, 'revoke_share'::text, 'delete_files'::text, 'open_vault'::text, 'view_security_settings'::text, 'export_data'::text, 'app_startup'::text]))),
  CONSTRAINT "pin_operation_authorizations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "pin_operation_authorizations_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."plan_limits" (
  "tier" text NOT NULL,
  "concurrent_uploads" integer NOT NULL,
  "concurrent_downloads" integer NOT NULL,
  "max_file_size_bytes" bigint NOT NULL,
  "api_tokens_per_day" integer NOT NULL,
  "queue_priority" text DEFAULT 'standard'::text NOT NULL,
  "early_feature_access" boolean DEFAULT false NOT NULL,
  "sites_always_active" boolean DEFAULT false NOT NULL,
  "custom_domains" boolean DEFAULT false NOT NULL,
  "auto_archive_days" integer,
  "file_requests" integer DEFAULT 1 NOT NULL,
  "static_sites" boolean DEFAULT false NOT NULL,
  "analytics" boolean DEFAULT false NOT NULL,
  "react_picks" boolean DEFAULT false NOT NULL,
  "webhooks" integer DEFAULT 0 NOT NULL,
  "daily_upload_limit" integer DEFAULT 20 NOT NULL,
  CONSTRAINT "plan_limits_pkey" PRIMARY KEY (tier)
);

CREATE TABLE IF NOT EXISTS "public"."playback_resume" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "position" numeric(10,3) DEFAULT 0 NOT NULL,
  "duration" numeric(10,3),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "playback_resume_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "playback_resume_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "playback_resume_pkey" PRIMARY KEY (id),
  CONSTRAINT "playback_resume_user_id_file_id_key" UNIQUE (user_id, file_id)
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
  "id" uuid NOT NULL,
  "full_name" text,
  "avatar_url" text,
  "storage_used" bigint DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "onboarding_complete" boolean DEFAULT false NOT NULL,
  "repo_count" smallint DEFAULT '0'::smallint NOT NULL,
  "is_premium" boolean DEFAULT false,
  "is_admin" boolean DEFAULT false,
  "mfa_enabled" boolean DEFAULT false,
  "mfa_secret" text,
  "username" text,
  "display_name" text,
  "encrypted_mfa_secret" text,
  "mfa_secret_iv" text,
  "pin_hash" text,
  "pin_enabled" boolean DEFAULT false,
  "pin_salt" text,
  "email" text,
  "workspace_name" text,
  "storage_provider" text DEFAULT 'squidcloud'::text,
  "tier" text DEFAULT 'free'::text,
  "subscription_starts_at" timestamp with time zone,
  "subscription_expires_at" timestamp with time zone,
  "enable_game_suggestions" boolean DEFAULT true NOT NULL,
  "notification_prefs" jsonb DEFAULT '{"reminder_days": [7, 3, 1], "upsell_offers": true, "winback_enabled": true, "email_notifications": true}'::jsonb,
  "api_disabled" boolean DEFAULT false,
  "is_test" boolean DEFAULT false NOT NULL,
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_username_key" UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS "public"."reading_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "progress" integer DEFAULT 0,
  "current_page" integer DEFAULT 0,
  "total_pages" integer DEFAULT 0,
  "last_read_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "reading_progress_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
  CONSTRAINT "reading_progress_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "reading_progress_pkey" PRIMARY KEY (id),
  CONSTRAINT "reading_progress_user_id_file_id_key" UNIQUE (user_id, file_id)
);

CREATE TABLE IF NOT EXISTS "public"."redeem_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" character varying(18) NOT NULL,
  "plan_type" character varying(20) NOT NULL,
  "billing_period" character varying(10) NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "currency" character varying(3) DEFAULT 'USD'::character varying,
  "max_uses" integer DEFAULT 1,
  "used_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  "for_user_id" uuid,
  "user_code_id" uuid,
  CONSTRAINT "redeem_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT "redeem_codes_for_user_id_fkey" FOREIGN KEY (for_user_id) REFERENCES auth.users(id),
  CONSTRAINT "redeem_codes_pkey" PRIMARY KEY (id),
  CONSTRAINT "redeem_codes_code_key" UNIQUE (code),
  CONSTRAINT "redeem_codes_user_code_id_key" UNIQUE (user_code_id)
);

CREATE TABLE IF NOT EXISTS "public"."remote_reading_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "book_key" text NOT NULL,
  "title" text,
  "author" text,
  "cover_url" text,
  "subjects" jsonb DEFAULT '[]'::jsonb,
  "progress" integer DEFAULT 0,
  "current_page" integer DEFAULT 0,
  "total_pages" integer DEFAULT 0,
  "last_read_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "remote_reading_progress_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
  CONSTRAINT "remote_reading_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "remote_reading_progress_pkey" PRIMARY KEY (id),
  CONSTRAINT "remote_reading_progress_user_id_book_key_key" UNIQUE (user_id, book_key)
);

CREATE TABLE IF NOT EXISTS "public"."repositories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "repo_name" text NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" jsonb,
  "account_id" uuid,
  "last_health_check" timestamp with time zone,
  "health_status" text DEFAULT 'unknown'::text,
  "repository_size" bigint DEFAULT 0,
  "file_count" integer DEFAULT 0,
  "last_used" timestamp with time zone DEFAULT now(),
  CONSTRAINT "repositories_health_status_check" CHECK ((health_status = ANY (ARRAY['healthy'::text, 'warning'::text, 'error'::text, 'unknown'::text]))),
  CONSTRAINT "repositories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "repositories_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."reviewers" (
  "id" uuid NOT NULL,
  "display_name" text DEFAULT ''::text NOT NULL,
  "email" text DEFAULT ''::text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reviewers_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "reviewers_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."sde_chunk_locators" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "chunk_index" integer NOT NULL,
  "substrate" text NOT NULL,
  "locator" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sde_chunk_locators_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "sde_chunk_locators_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."sde_identity" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "dms" bytea NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "sde_identity_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "sde_identity_pkey" PRIMARY KEY (id),
  CONSTRAINT "sde_identity_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."sde_recall_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "recall_token" text NOT NULL,
  "file_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sde_recall_tokens_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "sde_recall_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "sde_recall_tokens_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."security_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "event_type" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "risk_level" text DEFAULT 'low'::text,
  "status" text DEFAULT 'success'::text,
  "timestamp" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "security_events_risk_level_check" CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
  CONSTRAINT "security_events_status_check" CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'blocked'::text]))),
  CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "security_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."security_keyring" (
  "name" text NOT NULL,
  "key_id" uuid NOT NULL,
  CONSTRAINT "security_keyring_pkey" PRIMARY KEY (name)
);

CREATE TABLE IF NOT EXISTS "public"."share_audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "share_id" text,
  "event_type" text NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "geo_country" text,
  "geo_city" text,
  "referrer" text,
  "success" boolean DEFAULT true,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "share_audit_logs_share_id_fkey" FOREIGN KEY (share_id) REFERENCES shares(share_id) ON DELETE CASCADE,
  CONSTRAINT "share_audit_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."share_collection_files" (
  "collection_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "added_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "share_collection_files_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES share_collections(id) ON DELETE CASCADE,
  CONSTRAINT "share_collection_files_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "share_collection_files_pkey" PRIMARY KEY (collection_id, file_id)
);

CREATE TABLE IF NOT EXISTS "public"."share_collections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "share_id" text NOT NULL,
  "user_id" uuid,
  "collection_name" text NOT NULL,
  "description" text,
  "access_code" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "share_collections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "share_collections_pkey" PRIMARY KEY (id),
  CONSTRAINT "share_collections_share_id_key" UNIQUE (share_id)
);

CREATE TABLE IF NOT EXISTS "public"."share_decrypt_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "share_id" text NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "success" boolean DEFAULT false NOT NULL,
  "failure_reason" text,
  "geo_city" text,
  "geo_country" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "share_decrypt_logs_share_id_fkey" FOREIGN KEY (share_id) REFERENCES shares(share_id) ON DELETE CASCADE,
  CONSTRAINT "share_decrypt_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."shares" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid,
  "user_id" uuid NOT NULL,
  "access_code" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "share_views" integer DEFAULT 0,
  "download_count" integer DEFAULT 0,
  "download_limit" integer,
  "view_only" boolean DEFAULT false,
  "require_email" boolean DEFAULT false,
  "allowed_ips" text[],
  "custom_message" text,
  "is_active" boolean DEFAULT true,
  "share_id" text,
  "allowed_users" text[],
  "share_type" text DEFAULT 'public'::text,
  "shared_encryption_key" text,
  "share_secret_hash" text,
  "folder_id" uuid,
  "decrypt_attempts" integer DEFAULT 0,
  "last_decrypt_attempt_at" timestamp with time zone,
  "max_views" integer,
  "burn_after_reading" boolean DEFAULT false,
  "allowed_countries" text[],
  "blocked_countries" text[],
  "device_fingerprint" text,
  "first_device_fingerprint" text,
  "watermark_email" boolean DEFAULT false,
  "is_file_request" boolean DEFAULT false,
  "file_request_upload_path" text,
  "max_downloads" integer,
  "owner_id" uuid,
  CONSTRAINT "shares_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "shares_folder_id_fkey" FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT "shares_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "shares_pkey" PRIMARY KEY (id),
  CONSTRAINT "shares_share_id_unique" UNIQUE (share_id)
);

CREATE TABLE IF NOT EXISTS "public"."signals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "service_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "severity" text DEFAULT 'info'::text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "link" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "idempotency_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "signals_body_check" CHECK (((body IS NULL) OR (char_length(body) <= 1000))),
  CONSTRAINT "signals_title_check" CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200))),
  CONSTRAINT "signals_link_check" CHECK (((link IS NULL) OR (char_length(link) <= 500))),
  CONSTRAINT "signals_service_id_check" CHECK ((service_id = ANY (ARRAY['cloudbliss'::text, 'squidveil'::text, 'signals'::text]))),
  CONSTRAINT "signals_severity_check" CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'urgent'::text]))),
  CONSTRAINT "signals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "signals_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."site_publications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "resource_id" text NOT NULL,
  "resource_type" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "site_slug" text NOT NULL,
  "site_url" text NOT NULL,
  "visibility" text DEFAULT 'public'::text NOT NULL,
  "status" text DEFAULT 'live'::text NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "file_count" integer DEFAULT 0 NOT NULL,
  "total_size_bytes" bigint DEFAULT 0 NOT NULL,
  "last_accessed_at" timestamp with time zone DEFAULT now(),
  "archived" boolean DEFAULT false,
  "archived_at" timestamp with time zone,
  CONSTRAINT "site_publications_resource_type_check" CHECK ((resource_type = ANY (ARRAY['file'::text, 'folder'::text]))),
  CONSTRAINT "site_publications_status_check" CHECK ((status = ANY (ARRAY['live'::text, 'unpublished'::text, 'error'::text]))),
  CONSTRAINT "site_publications_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text]))),
  CONSTRAINT "site_publications_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "site_publications_pkey" PRIMARY KEY (id),
  CONSTRAINT "site_publications_site_slug_key" UNIQUE (site_slug)
);

CREATE TABLE IF NOT EXISTS "public"."squid_run_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "job_name" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "error_message" text,
  "step_index" integer DEFAULT 0,
  CONSTRAINT "squid_run_jobs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'failed'::text, 'skipped'::text, 'cancelled'::text]))),
  CONSTRAINT "squid_run_jobs_run_id_fkey" FOREIGN KEY (run_id) REFERENCES squid_script_runs(id) ON DELETE CASCADE,
  CONSTRAINT "squid_run_jobs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squid_run_steps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "step_name" text NOT NULL,
  "action_use" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "exit_code" integer,
  "output" text DEFAULT ''::text,
  "error_message" text,
  "input" jsonb DEFAULT '{}'::jsonb,
  "action" text,
  "step_index" integer DEFAULT 0,
  CONSTRAINT "squid_run_steps_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'failed'::text, 'skipped'::text, 'cancelled'::text]))),
  CONSTRAINT "squid_run_steps_job_id_fkey" FOREIGN KEY (job_id) REFERENCES squid_run_jobs(id) ON DELETE CASCADE,
  CONSTRAINT "squid_run_steps_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squid_script_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "script_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "trigger_type" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "error_message" text,
  "execution_plan" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "squid_script_runs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'failed'::text, 'cancelled'::text]))),
  CONSTRAINT "squid_script_runs_script_id_fkey" FOREIGN KEY (script_id) REFERENCES squid_scripts(id) ON DELETE CASCADE,
  CONSTRAINT "squid_script_runs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squid_script_runs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squid_script_triggers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "script_id" uuid NOT NULL,
  "trigger_type" text NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "squid_script_triggers_trigger_type_check" CHECK ((trigger_type = ANY (ARRAY['manual'::text, 'schedule'::text, 'file_change'::text, 'webhook'::text, 'pipeline_complete'::text]))),
  CONSTRAINT "squid_script_triggers_script_id_fkey" FOREIGN KEY (script_id) REFERENCES squid_scripts(id) ON DELETE CASCADE,
  CONSTRAINT "squid_script_triggers_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squid_scripts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text,
  "yaml_content" text NOT NULL,
  "parsed_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true,
  "source_path" text,
  "last_run_at" timestamp with time zone,
  "last_run_status" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "total_runs" integer DEFAULT 0,
  CONSTRAINT "squid_scripts_last_run_status_check" CHECK ((last_run_status = ANY (ARRAY['success'::text, 'failed'::text, 'running'::text, 'cancelled'::text]))),
  CONSTRAINT "squid_scripts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squid_scripts_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squid_vault_secrets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "encrypted_value" text NOT NULL,
  "iv" text NOT NULL,
  "scope" jsonb DEFAULT '{"scripts": []}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "storage_type" text DEFAULT 'database'::text,
  "storage_path" text,
  "storage_repo" text,
  CONSTRAINT "squid_vault_secrets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squid_vault_secrets_pkey" PRIMARY KEY (id),
  CONSTRAINT "squid_vault_secrets_user_id_name_key" UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS "public"."squid_vaults" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "vault_name" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "squid_vaults_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squid_vaults_pkey" PRIMARY KEY (id),
  CONSTRAINT "squid_vaults_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."squidcdn_files" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "workspace_id" uuid,
  "cdn_path" text NOT NULL,
  "content_type" text DEFAULT 'application/octet-stream'::text NOT NULL,
  "file_size" bigint DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "views_count" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "squidcdn_files_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "squidcdn_files_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "squidcdn_files_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  CONSTRAINT "squidcdn_files_pkey" PRIMARY KEY (id),
  CONSTRAINT "squidcdn_files_cdn_path_key" UNIQUE (cdn_path)
);

CREATE TABLE IF NOT EXISTS "public"."squidcloud_b2_buckets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bucket_name" text NOT NULL,
  "bucket_region" text NOT NULL,
  "bucket_endpoint" text NOT NULL,
  "access_key_id" text NOT NULL,
  "secret_access_key" text NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "storage_used_bytes" bigint DEFAULT 0,
  "storage_limit_bytes" bigint DEFAULT '10737418240'::bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "squidcloud_b2_buckets_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squidveil_audit_log" (
  "id" bigint NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now(),
  "action" text NOT NULL,
  "project_id" text DEFAULT ''::text NOT NULL,
  "user_id" uuid NOT NULL,
  "secret_name" text DEFAULT ''::text NOT NULL,
  "ref_id" text,
  "success" boolean DEFAULT true NOT NULL,
  "detail" text,
  CONSTRAINT "squidveil_audit_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squidveil_audit_log_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."squidveil_refs" (
  "id" bigint NOT NULL,
  "ref_id" text NOT NULL,
  "session_id" uuid NOT NULL,
  "secret_name" text NOT NULL,
  "user_id" uuid NOT NULL,
  "veil_ref_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  CONSTRAINT "squidveil_refs_session_id_fkey" FOREIGN KEY (session_id) REFERENCES squidveil_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT "squidveil_refs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squidveil_refs_pkey" PRIMARY KEY (id),
  CONSTRAINT "squidveil_refs_ref_id_key" UNIQUE (ref_id)
);

CREATE TABLE IF NOT EXISTS "public"."squidveil_sessions" (
  "id" bigint NOT NULL,
  "session_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "device_fingerprint" text DEFAULT ''::text NOT NULL,
  "session_nonce" text NOT NULL,
  "server_nonce" text NOT NULL,
  "session_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "squidveil_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "squidveil_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "squidveil_sessions_session_id_key" UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS "public"."storage_cleanup_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "run_at" timestamp with time zone DEFAULT now(),
  "files_archived" integer DEFAULT 0,
  "sites_archived" integer DEFAULT 0,
  "storage_freed_bytes" bigint DEFAULT 0,
  "status" text DEFAULT 'completed'::text,
  "error_message" text,
  "details" jsonb,
  CONSTRAINT "storage_cleanup_log_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."storage_provider_vault" (
  "provider_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "wrapped_credentials" text NOT NULL,
  "iv" text NOT NULL,
  "key_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "storage_provider_vault_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES storage_providers(id) ON DELETE CASCADE,
  CONSTRAINT "storage_provider_vault_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "storage_provider_vault_pkey" PRIMARY KEY (provider_id)
);

CREATE TABLE IF NOT EXISTS "public"."storage_providers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider_type" text NOT NULL,
  "encrypted_credentials" text,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "label" text,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "bucket_region" text,
  "bucket_endpoint" text,
  "storage_used_bytes" bigint DEFAULT 0,
  "storage_limit_bytes" bigint,
  "last_health_check" timestamp with time zone,
  "health_status" text DEFAULT 'unknown'::text,
  "last_error" text,
  "bucket_name" text,
  "read_enabled" boolean DEFAULT true NOT NULL,
  "write_enabled" boolean DEFAULT true NOT NULL,
  CONSTRAINT "storage_providers_provider_type_check" CHECK ((provider_type = ANY (ARRAY['squidcloud'::text, 'r2'::text, 'tebi'::text, 's3'::text, 'gcp'::text, 'b2'::text, 'azure'::text, 'wasabi'::text, 'backblaze'::text, 'custom'::text]))),
  CONSTRAINT "storage_providers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "storage_providers_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."storage_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "setting_key" text NOT NULL,
  "setting_value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "storage_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "storage_settings_setting_key_key" UNIQUE (setting_key)
);

CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "plan_type" text NOT NULL,
  "billing_period" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscription_events_event_type_check" CHECK ((event_type = ANY (ARRAY['purchased'::text, 'redeemed'::text, 'expired'::text, 'cancelled'::text, 'payment_failed'::text, 'payment_expired'::text, 'renewed'::text, 'downgraded'::text, 'email_sent'::text, 'winback_sent'::text, 'upsell_accepted'::text, 'upsell_declined'::text, 'notification_sent'::text, 'notification_clicked'::text, 'notification_dismissed'::text, 'admin_granted'::text]))),
  CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "subscription_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."subscription_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "plan_type" text NOT NULL,
  "billing_period" text NOT NULL,
  "stage" integer NOT NULL,
  "notification_type" text NOT NULL,
  "triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered" boolean DEFAULT false,
  "opened" boolean DEFAULT false,
  "clicked" boolean DEFAULT false,
  "dismissed" boolean DEFAULT false,
  "snoozed_until" timestamp with time zone,
  "upsell_offer_shown" boolean DEFAULT false,
  "upsell_offer_accepted" boolean DEFAULT false,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT "subscription_notifications_notification_type_check" CHECK ((notification_type = ANY (ARRAY['email'::text, 'popup'::text, 'banner'::text]))),
  CONSTRAINT "subscription_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "subscription_notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "unique_user_stage_type" UNIQUE (user_id, stage, notification_type)
);

CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "original_price" integer NOT NULL,
  "discounted_price" integer,
  "discount_active" boolean DEFAULT false,
  "features" text[] DEFAULT '{}'::text[],
  "storage_limit" bigint,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."support_activity_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "actor_id" uuid,
  "actor_name" text DEFAULT 'system'::text NOT NULL,
  "action" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_activity_log_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT "support_activity_log_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."support_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "message" text NOT NULL,
  "sender_id" uuid NOT NULL,
  "sender_type" text NOT NULL,
  "attachments" text[],
  "is_internal" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "support_messages_sender_type_check" CHECK ((sender_type = ANY (ARRAY['user'::text, 'admin'::text]))),
  CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."support_refunds" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "destination_address" text NOT NULL,
  "payment_txn_id" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reviewed_by" uuid,
  "maxelpay_refund_id" text,
  "notes" text DEFAULT ''::text NOT NULL,
  "receipt_html" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_refunds_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'paid'::text, 'rejected'::text, 'failed'::text]))),
  CONSTRAINT "support_refunds_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "support_refunds_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT "support_refunds_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "support_refunds_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "category" text NOT NULL,
  "priority" text DEFAULT 'medium'::text,
  "status" text DEFAULT 'open'::text,
  "user_id" uuid NOT NULL,
  "assigned_to" uuid,
  "rating" integer,
  "attachments" text[],
  "tags" text[],
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "assigned_reviewer_id" uuid,
  CONSTRAINT "support_tickets_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
  CONSTRAINT "support_tickets_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT "support_tickets_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]))),
  CONSTRAINT "support_tickets_assigned_reviewer_id_fkey" FOREIGN KEY (assigned_reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."system_config" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "system_config_pkey" PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS "public"."system_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "setting_key" text NOT NULL,
  "setting_value" jsonb NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT "system_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "system_settings_setting_key_key" UNIQUE (setting_key)
);

CREATE TABLE IF NOT EXISTS "public"."threat_alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "type" text NOT NULL,
  "severity" text DEFAULT 'medium'::text,
  "title" text NOT NULL,
  "description" text,
  "timestamp" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "status" text DEFAULT 'active'::text,
  "actions_taken" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "threat_alerts_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
  CONSTRAINT "threat_alerts_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'investigating'::text, 'resolved'::text, 'false_positive'::text]))),
  CONSTRAINT "threat_alerts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "threat_alerts_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."transcode_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" character varying(20) DEFAULT 'queued'::character varying NOT NULL,
  "output_qualities" text[] DEFAULT '{}'::text[] NOT NULL,
  "priority" character varying(10) DEFAULT 'normal'::character varying NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "error" text,
  "output_files" jsonb,
  "estimated_time" integer,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "transcode_jobs_priority_check" CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying])::text[]))),
  CONSTRAINT "transcode_jobs_progress_check" CHECK (((progress >= 0) AND (progress <= 100))),
  CONSTRAINT "transcode_jobs_status_check" CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
  CONSTRAINT "transcode_jobs_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "transcode_jobs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "transcode_jobs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."upload_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "upload_id" text NOT NULL,
  "encryption_key" text,
  "user_id" uuid,
  "file_name" text,
  "file_size" bigint,
  "total_chunks" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
  "folder_id" uuid,
  "file_type" text,
  "chunk_buckets" jsonb,
  "swk_manifest_hash" text,
  "swk_manifest" jsonb,
  CONSTRAINT "upload_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "upload_sessions_upload_id_key" UNIQUE (upload_id)
);

CREATE TABLE IF NOT EXISTS "public"."upload_stats" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid,
  "repository_id" uuid,
  "user_id" uuid,
  "upload_timestamp" timestamp with time zone DEFAULT now(),
  "file_size" bigint,
  "upload_duration_ms" integer,
  "chunks_uploaded" integer DEFAULT 1,
  "success" boolean DEFAULT true,
  "error_message" text,
  "upload_metadata" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT "upload_stats_repository_id_fkey" FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  CONSTRAINT "upload_stats_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "upload_stats_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."user_encryption_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT "user_encryption_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_encryption_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_encryption_settings_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."user_notification_prefs" (
  "user_id" uuid NOT NULL,
  "email_enabled" boolean DEFAULT true,
  "popup_enabled" boolean DEFAULT true,
  "warning_lead_days" integer DEFAULT 7,
  "do_not_contact" boolean DEFAULT false,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_notification_prefs_warning_lead_days_check" CHECK ((warning_lead_days = ANY (ARRAY[1, 3, 7]))),
  CONSTRAINT "user_notification_prefs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_notification_prefs_pkey" PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."user_passkeys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email" text NOT NULL,
  "credential_id" text NOT NULL,
  "public_key" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "user_passkeys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_passkeys_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_passkeys_email_key" UNIQUE (email),
  CONSTRAINT "user_passkeys_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "code_editor" text DEFAULT 'vscode'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_preferences_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."user_redeem_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code_id" uuid,
  "code" character varying(18) NOT NULL,
  "plan_type" character varying(20) NOT NULL,
  "billing_period" character varying(10) NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "currency" character varying(3) DEFAULT 'USD'::character varying,
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "expires_at" timestamp with time zone NOT NULL,
  "activated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_redeem_codes_code_id_fkey" FOREIGN KEY (code_id) REFERENCES redeem_codes(id) ON DELETE SET NULL,
  CONSTRAINT "user_redeem_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_redeem_codes_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_redeem_codes_user_id_code_key" UNIQUE (user_id, code)
);

CREATE TABLE IF NOT EXISTS "public"."user_security_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "pin_hash" text NOT NULL,
  "pin_enabled" boolean DEFAULT true,
  "pin_attempts" integer DEFAULT 0,
  "pin_locked_until" timestamp with time zone,
  "biometric_enabled" boolean DEFAULT false,
  "require_pin_on_startup" boolean DEFAULT false,
  "require_pin_for_shares" boolean DEFAULT true,
  "require_pin_for_settings" boolean DEFAULT true,
  "require_pin_for_vault" boolean DEFAULT true,
  "pin_timeout" integer DEFAULT 5,
  "last_pin_auth" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_security_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_security_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_security_settings_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."user_storage_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "fallback_mode" text DEFAULT 'squidcloud_then_mine'::text NOT NULL,
  "upload_distribution" text DEFAULT 'round_robin'::text NOT NULL,
  "allow_public_sharing" boolean DEFAULT false NOT NULL,
  "max_buckets" integer DEFAULT 20 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_storage_preferences_fallback_mode_check" CHECK ((fallback_mode = ANY (ARRAY['squidcloud_only'::text, 'mine_only'::text, 'squidcloud_then_mine'::text, 'mine_then_squidcloud'::text]))),
  CONSTRAINT "user_storage_preferences_upload_distribution_check" CHECK ((upload_distribution = ANY (ARRAY['round_robin'::text, 'least_used_first'::text, 'primary_only'::text]))),
  CONSTRAINT "user_storage_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_storage_preferences_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_storage_preferences_user_id_key" UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "subscription_id" uuid NOT NULL,
  "start_date" timestamp with time zone DEFAULT now(),
  "end_date" timestamp with time zone,
  "payment_status" text DEFAULT 'pending'::text,
  "payment_id" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_subscriptions_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."user_terms_acceptance" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "terms_version" text NOT NULL,
  "privacy_version" text NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" inet,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_terms_acceptance_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "user_terms_acceptance_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."vault_files" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "vault_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "original_parent_folder" text,
  "added_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "vault_files_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "vault_files_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "vault_files_vault_id_fkey" FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
  CONSTRAINT "vault_files_pkey" PRIMARY KEY (id),
  CONSTRAINT "vault_files_vault_id_file_id_key" UNIQUE (vault_id, file_id)
);

CREATE TABLE IF NOT EXISTS "public"."vaults" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_fingerprint_enabled" boolean DEFAULT false,
  "passkey_credential_id" text,
  CONSTRAINT "vaults_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "vaults_pkey" PRIMARY KEY (id),
  CONSTRAINT "vaults_user_id_name_key" UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS "public"."video_processing_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_type" character varying(50) NOT NULL,
  "file_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "priority" integer DEFAULT 5 NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
  "worker_id" character varying(100),
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "error_message" text,
  "scheduled_for" timestamp with time zone DEFAULT now(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "video_processing_queue_job_type_check" CHECK (((job_type)::text = ANY ((ARRAY['transcode'::character varying, 'thumbnail'::character varying, 'metadata'::character varying, 'analyze'::character varying])::text[]))),
  CONSTRAINT "video_processing_queue_priority_check" CHECK (((priority >= 1) AND (priority <= 10))),
  CONSTRAINT "video_processing_queue_status_check" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))),
  CONSTRAINT "video_processing_queue_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "video_processing_queue_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "video_processing_queue_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."video_quality_metrics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "quality" character varying(20) NOT NULL,
  "bandwidth" integer,
  "buffer_level" numeric(5,2),
  "dropped_frames" integer DEFAULT 0,
  "rebuffer_count" integer DEFAULT 0,
  "startup_time" numeric(6,3),
  CONSTRAINT "video_quality_metrics_session_id_fkey" FOREIGN KEY (session_id) REFERENCES video_stream_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT "video_quality_metrics_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."video_stream_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "quality" character varying(20),
  "bandwidth_used" bigint DEFAULT 0,
  "stream_duration" numeric(10,3) DEFAULT 0,
  "errors_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_activity" timestamp with time zone DEFAULT now() NOT NULL,
  "completed" boolean DEFAULT false,
  CONSTRAINT "video_stream_sessions_file_id_fkey" FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT "video_stream_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "video_stream_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "video_stream_sessions_session_id_key" UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS "public"."webhook_events_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "webhook_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "event_name" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "response_status" integer,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivery_id" uuid,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "next_attempt_at" timestamp with time zone,
  "duration_ms" integer,
  "response_body" text,
  "event_payload" jsonb,
  CONSTRAINT "webhook_events_log_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]))),
  CONSTRAINT "webhook_events_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "webhook_events_log_webhook_id_fkey" FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  CONSTRAINT "webhook_events_log_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."webhooks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "url" text NOT NULL,
  "secret_key" text DEFAULT ''::text NOT NULL,
  "events" text[] DEFAULT '{}'::text[] NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_triggered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "total_deliveries" integer DEFAULT 0 NOT NULL,
  "failed_deliveries" integer DEFAULT 0 NOT NULL,
  "last_status" text,
  "last_duration_ms" integer,
  CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "webhooks_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."workspace_invites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "invitee_email" text NOT NULL,
  "invitee_user_id" uuid,
  "invited_by" uuid NOT NULL,
  "role" workspace_role DEFAULT 'viewer'::workspace_role NOT NULL,
  "token_hash" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "expires_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "accepted_by" uuid,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_invites_email_not_blank" CHECK ((char_length(TRIM(BOTH FROM invitee_email)) > 0)),
  CONSTRAINT "workspace_invites_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text]))),
  CONSTRAINT "workspace_invites_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "workspace_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_invites_invitee_user_id_fkey" FOREIGN KEY (invitee_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "workspace_invites_revoked_by_fkey" FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_invites_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" workspace_role DEFAULT 'viewer'::workspace_role NOT NULL,
  "invited_by" uuid,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS "public"."workspace_presence" (
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "current_file_id" uuid,
  "socket_id" text,
  "last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_presence_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_presence_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_presence_pkey" PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS "public"."workspaces" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "storage_backend" text DEFAULT 'managed'::text NOT NULL,
  "member_limit" integer,
  CONSTRAINT "workspaces_name_not_blank" CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT "workspaces_member_limit_check" CHECK (((member_limit IS NULL) OR (member_limit > 0))),
  CONSTRAINT "workspaces_storage_backend_check" CHECK ((storage_backend = ANY (ARRAY['managed'::text, 'custom'::text]))),
  CONSTRAINT "workspaces_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY (id),
  CONSTRAINT "workspaces_user_name_unique" UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS "squidveil"."access_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "token_prefix" text NOT NULL,
  "name" text NOT NULL,
  "policies" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  CONSTRAINT "access_tokens_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "squidveil"."audit_log" (
  "seq" bigint DEFAULT nextval('squidveil.audit_seq'::regclass) NOT NULL,
  "prev_hash" text DEFAULT ''::text NOT NULL,
  "entry_hash" text DEFAULT ''::text NOT NULL,
  "signature" text DEFAULT ''::text NOT NULL,
  "action" text NOT NULL,
  "actor_type" text DEFAULT 'token'::text NOT NULL,
  "actor_id" text DEFAULT ''::text NOT NULL,
  "path" text DEFAULT ''::text NOT NULL,
  "version_number" integer,
  "ip" text,
  "user_agent" text,
  "success" boolean DEFAULT true NOT NULL,
  "detail" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_log_actor_type_check" CHECK ((actor_type = ANY (ARRAY['token'::text, 'user'::text, 'system'::text]))),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (seq)
);

CREATE TABLE IF NOT EXISTS "squidveil"."policies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "policies_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "policies_pkey" PRIMARY KEY (id),
  CONSTRAINT "policies_owner_id_name_key" UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS "squidveil"."rotation_config" (
  "secret_id" uuid NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "interval_days" integer DEFAULT 30 NOT NULL,
  "next_rotation_at" timestamp with time zone,
  "last_rotated_at" timestamp with time zone,
  "source" text DEFAULT 'auto_generated'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rotation_config_source_check" CHECK ((source = ANY (ARRAY['auto_generated'::text, 'user_provided'::text]))),
  CONSTRAINT "rotation_config_secret_id_fkey" FOREIGN KEY (secret_id) REFERENCES squidveil.secrets(id) ON DELETE CASCADE,
  CONSTRAINT "rotation_config_pkey" PRIMARY KEY (secret_id)
);

CREATE TABLE IF NOT EXISTS "squidveil"."secret_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "key_id" text NOT NULL,
  "wrapped_dek" text NOT NULL,
  "iv" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "secret_keys_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "secret_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "secret_keys_owner_id_key_id_key" UNIQUE (owner_id, key_id)
);

CREATE TABLE IF NOT EXISTS "squidveil"."secret_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "secret_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "encrypted_value" text DEFAULT ''::text NOT NULL,
  "iv" text DEFAULT ''::text NOT NULL,
  "key_id" text DEFAULT 'default'::text NOT NULL,
  "state" text DEFAULT 'ENABLED'::text NOT NULL,
  "created_by_token_id" uuid,
  "created_by" text DEFAULT 'system'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "destroyed_at" timestamp with time zone,
  CONSTRAINT "secret_versions_state_check" CHECK ((state = ANY (ARRAY['ENABLED'::text, 'DISABLED'::text, 'DESTROYED'::text]))),
  CONSTRAINT "secret_versions_created_by_token_id_fkey" FOREIGN KEY (created_by_token_id) REFERENCES squidveil.access_tokens(id) ON DELETE SET NULL,
  CONSTRAINT "secret_versions_secret_id_fkey" FOREIGN KEY (secret_id) REFERENCES squidveil.secrets(id) ON DELETE CASCADE,
  CONSTRAINT "secret_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "secret_versions_secret_id_version_number_key" UNIQUE (secret_id, version_number)
);

CREATE TABLE IF NOT EXISTS "squidveil"."secrets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "secret_type" text DEFAULT 'opaque'::text NOT NULL,
  "recovery_window_days" integer DEFAULT 7 NOT NULL,
  "deleted_at" timestamp with time zone,
  "delete_after" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "secrets_secret_type_check" CHECK ((secret_type = ANY (ARRAY['opaque'::text, 'aes_gcm'::text, 'http_auth'::text, 'hmac_sign'::text, 'connection_string'::text]))),
  CONSTRAINT "secrets_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "secrets_pkey" PRIMARY KEY (id),
  CONSTRAINT "secrets_owner_id_name_key" UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS "squidveil"."system_config" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "system_config_pkey" PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS "squidveil"."veilrefs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ref_id" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "secret_id" uuid NOT NULL,
  "secret_name" text NOT NULL,
  "version_number" integer,
  "device_bound" text DEFAULT ''::text NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "use_count_max" integer DEFAULT 1 NOT NULL,
  "use_count_used" integer DEFAULT 0 NOT NULL,
  "ops_allowed" jsonb DEFAULT '["resolve"]'::jsonb NOT NULL,
  "hmac" text DEFAULT ''::text NOT NULL,
  "consumed_at" timestamp with time zone,
  CONSTRAINT "veilrefs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "veilrefs_secret_id_fkey" FOREIGN KEY (secret_id) REFERENCES squidveil.secrets(id) ON DELETE CASCADE,
  CONSTRAINT "veilrefs_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_8djcvk3222_file_id ON public."8djcvk3222" USING btree (file_id);
CREATE INDEX IF NOT EXISTS access_policies_active_idx ON public.access_policies USING btree (active);
CREATE INDEX IF NOT EXISTS access_policies_user_id_idx ON public.access_policies USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_account_health_logs_account_id ON public.account_health_logs USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_account_health_logs_timestamp ON public.account_health_logs USING btree (check_timestamp);
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON public.analytics_events USING btree (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_timestamp_idx ON public.analytics_events USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON public.analytics_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_api_credit_log_created ON public.api_credit_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_api_credit_log_user_created ON public.api_credit_log USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys USING btree (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON public.api_keys USING btree (user_id, is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_key_id ON public.api_request_logs USING btree (api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at ON public.api_request_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_archive_extractions_created_at ON public.archive_extractions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_extractions_status ON public.archive_extractions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_archive_extractions_user_id ON public.archive_extractions USING btree (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs USING btree (action);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON public.audit_logs USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_beta_enrollments_email ON public.beta_enrollments USING btree (email);
CREATE INDEX IF NOT EXISTS idx_beta_enrollments_feature ON public.beta_enrollments USING btree (feature);
CREATE INDEX IF NOT EXISTS idx_cli_auth_code ON public.cli_authorizations USING btree (code);
CREATE INDEX IF NOT EXISTS idx_cli_auth_code_hash ON public.cli_authorizations USING btree (code_hash);
CREATE INDEX IF NOT EXISTS idx_cli_auth_device_code ON public.cli_authorizations USING btree (device_code);
CREATE INDEX IF NOT EXISTS idx_cli_auth_token_hash ON public.cli_authorizations USING btree (access_token_hash);
CREATE INDEX IF NOT EXISTS idx_cli_auth_token_hash_used ON public.cli_authorizations USING btree (token_hash, used);
CREATE INDEX IF NOT EXISTS idx_cli_auth_user ON public.cli_authorizations USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cli_devices_device_code ON public.cli_devices USING btree (device_code) WHERE (device_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cli_devices_machine ON public.cli_devices USING btree (machine_id);
CREATE INDEX IF NOT EXISTS idx_cli_devices_status ON public.cli_devices USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cli_devices_user ON public.cli_devices USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_embed_tokens_entity ON public.embed_tokens USING btree (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_embed_tokens_user ON public.embed_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_keys_file ON public.encrypted_keys USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_keys_user ON public.encrypted_keys USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_entity_notes_entity ON public.entity_notes USING btree (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_notes_user ON public.entity_notes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_entity_notes_user_entity ON public.entity_notes USING btree (user_id, entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_extension_analytics_created_at ON public.extension_analytics USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_extension_analytics_extension_id ON public.extension_analytics USING btree (extension_id);
CREATE INDEX IF NOT EXISTS idx_extension_analytics_user_id ON public.extension_analytics USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_extension_approval_history_created ON public.extension_approval_history USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extension_approval_history_extension ON public.extension_approval_history USING btree (extension_id);
CREATE INDEX IF NOT EXISTS idx_extension_ratings_extension_id ON public.extension_ratings USING btree (extension_id);
CREATE INDEX IF NOT EXISTS idx_extensions_approval ON public.extensions USING btree (approval);
CREATE INDEX IF NOT EXISTS idx_extensions_author_id ON public.extensions USING btree (author_id);
CREATE INDEX IF NOT EXISTS idx_extensions_category ON public.extensions USING btree (category);
CREATE INDEX IF NOT EXISTS idx_extensions_downloads ON public.extensions USING btree (downloads DESC);
CREATE INDEX IF NOT EXISTS idx_extensions_is_active ON public.extensions USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_extensions_rating ON public.extensions USING btree (rating DESC);
CREATE INDEX IF NOT EXISTS idx_file_request_submissions_request ON public.file_request_submissions USING btree (file_request_id);
CREATE INDEX IF NOT EXISTS idx_file_requests_slug ON public.file_requests USING btree (slug);
CREATE INDEX IF NOT EXISTS files_parent_folder_idx ON public.files USING btree (parent_folder);
CREATE INDEX IF NOT EXISTS files_workspace_provider_parent_idx ON public.files USING btree (workspace_id, storage_provider_id, parent_folder);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_in_vault ON public.files USING btree (user_id, in_vault) WHERE (in_vault = true);
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON public.files USING btree (is_deleted) WHERE (is_deleted = false);
CREATE INDEX IF NOT EXISTS idx_files_parent_folder ON public.files USING btree (parent_folder);
CREATE INDEX IF NOT EXISTS idx_files_swk_hash ON public.files USING btree (swk_manifest_hash) WHERE (swk_manifest_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_files_user_workspace ON public.files USING btree (user_id, workspace_id);
CREATE INDEX IF NOT EXISTS folders_parent_folder_idx ON public.folders USING btree (parent_folder);
CREATE INDEX IF NOT EXISTS folders_path_idx ON public.folders USING btree (path);
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON public.folders USING btree (user_id);
CREATE INDEX IF NOT EXISTS folders_workspace_provider_parent_idx ON public.folders USING btree (workspace_id, storage_provider_id, parent_folder);
CREATE INDEX IF NOT EXISTS idx_folders_user_workspace ON public.folders USING btree (user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_workspace_provider ON public.folders USING btree (user_id, workspace_id, storage_provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_connections_user_gh_id ON public.github_connections USING btree (user_id, github_user_id);
CREATE INDEX IF NOT EXISTS idx_github_connections_user_id ON public.github_connections USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_installed_extensions_extension_id ON public.installed_extensions USING btree (extension_id);
CREATE INDEX IF NOT EXISTS idx_installed_extensions_user_id ON public.installed_extensions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_key_access_logs_user_created ON public.key_access_logs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kza_banned_entities_entity ON public.kza_banned_entities USING btree (entity_type, entity_value) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_kza_banned_entities_ip ON public.kza_banned_entities USING btree (ip_address);
CREATE INDEX IF NOT EXISTS idx_kza_banned_entities_user_id ON public.kza_banned_entities USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_cip_versions_current ON public.kza_cip_versions USING btree (is_current) WHERE (is_current = true);
CREATE INDEX IF NOT EXISTS idx_geo_events_user_time ON public.kza_geo_events USING btree (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_kza_geo_fence_action ON public.kza_geo_fence USING btree (action);
CREATE INDEX IF NOT EXISTS idx_kza_geo_fence_country ON public.kza_geo_fence USING btree (country_code);
CREATE INDEX IF NOT EXISTS idx_kza_health_checks_time ON public.kza_health_checks USING btree (checked_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_rate_buckets_lookup ON public.kza_ip_rate_buckets USING btree (ip_hash, function_id, window_start);
CREATE INDEX IF NOT EXISTS idx_kza_ip_reputation_ip ON public.kza_ip_reputation USING btree (ip_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kza_ip_reputation_ip_hash ON public.kza_ip_reputation USING btree (ip_hash) WHERE (ip_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_kza_ip_reputation_score ON public.kza_ip_reputation USING btree (score);
CREATE INDEX IF NOT EXISTS idx_kza_prel_f2fa_seeds_lookup ON public.kza_prel_f2fa_seeds USING btree (user_id, function_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kza_prel_f2fa_seeds_session ON public.kza_prel_f2fa_seeds USING btree (session_nonce);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_binding ON public.kza_prel_sessions USING btree (binding_hash) WHERE (consumed_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_expires ON public.kza_prel_sessions USING btree (expires_at) WHERE (consumed_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_parent ON public.kza_prel_sessions USING btree (parent_token_hash) WHERE (consumed_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_session_id ON public.kza_prel_sessions USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_user_id ON public.kza_prel_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_rate_buckets_lookup ON public.kza_rate_buckets USING btree (user_id, function_id, window_start);
CREATE INDEX IF NOT EXISTS idx_swk_cases_manifest ON public.kza_swk_cases USING btree (manifest_hash);
CREATE INDEX IF NOT EXISTS idx_swk_cases_status ON public.kza_swk_cases USING btree (status);
CREATE INDEX IF NOT EXISTS idx_swk_cases_user ON public.kza_swk_cases USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swk_denylist_active ON public.kza_swk_denylist USING btree (kind) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_swk_findings_case ON public.kza_swk_findings USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_swk_findings_signal ON public.kza_swk_findings USING btree (signal);
CREATE INDEX IF NOT EXISTS idx_swk_notices_user ON public.kza_swk_notices USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swk_tokens_user ON public.kza_swk_verdict_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_kza_threat_events_created_at ON public.kza_threat_events USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_kza_threat_events_ip ON public.kza_threat_events USING btree (ip_address);
CREATE INDEX IF NOT EXISTS idx_kza_threat_events_ip_hash ON public.kza_threat_events USING btree (ip_hash);
CREATE INDEX IF NOT EXISTS idx_kza_threat_events_user_id ON public.kza_threat_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_active ON public.maintenance_schedules USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_created_by ON public.maintenance_schedules USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_scheduled ON public.maintenance_schedules USING btree (scheduled_for) WHERE (scheduled_for IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_master_keys_user_version ON public.master_keys USING btree (user_id, key_version DESC);
CREATE INDEX IF NOT EXISTS idx_media_playback_logs_event_type ON public.media_playback_logs USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_media_playback_logs_session ON public.media_playback_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_media_playback_logs_timestamp ON public.media_playback_logs USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS idx_media_playback_logs_user_file ON public.media_playback_logs USING btree (user_id, file_id);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_challenge ON public.passkey_challenges USING btree (challenge);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_user ON public.passkey_challenges USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON public.payment_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_payment_logs_session_id ON public.payment_logs USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON public.payment_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON public.payment_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_annotations_doc_page ON public.pdf_annotations USING btree (document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_pdf_annotations_user ON public.pdf_annotations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_bookmarks_user_doc ON public.pdf_bookmarks USING btree (user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_secure_urls_expires ON public.pdf_secure_urls USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_pdf_secure_urls_file_user ON public.pdf_secure_urls USING btree (file_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_sessions_user ON public.pdf_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_created_at ON public.pin_attempt_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_user_id ON public.pin_attempt_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_pin_operation_auth_user_operation ON public.pin_operation_authorizations USING btree (user_id, operation_type, authorized_until DESC);
CREATE INDEX IF NOT EXISTS idx_playback_resume_updated_at ON public.playback_resume USING btree (updated_at);
CREATE INDEX IF NOT EXISTS idx_playback_resume_user_file ON public.playback_resume USING btree (user_id, file_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_test ON public.profiles USING btree (is_test) WHERE is_test;
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles USING btree (tier);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_active ON public.redeem_codes USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_code ON public.redeem_codes USING btree (code);
CREATE INDEX IF NOT EXISTS idx_repositories_account_id ON public.repositories USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_repositories_health ON public.repositories USING btree (health_status, last_health_check);
CREATE INDEX IF NOT EXISTS idx_repositories_usage ON public.repositories USING btree (last_used);
CREATE INDEX IF NOT EXISTS idx_sde_locators_file ON public.sde_chunk_locators USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_sde_recall_tokens_file_id ON public.sde_recall_tokens USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_sde_recall_tokens_user_id ON public.sde_recall_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS security_events_risk_level_idx ON public.security_events USING btree (risk_level);
CREATE INDEX IF NOT EXISTS security_events_timestamp_idx ON public.security_events USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS security_events_user_id_idx ON public.security_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_share_audit_created_at ON public.share_audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_audit_logs_event ON public.share_audit_logs USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_share_audit_logs_share ON public.share_audit_logs USING btree (share_id);
CREATE INDEX IF NOT EXISTS idx_share_audit_share_id ON public.share_audit_logs USING btree (share_id);
CREATE INDEX IF NOT EXISTS idx_decrypt_logs_created_at ON public.share_decrypt_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decrypt_logs_share_id ON public.share_decrypt_logs USING btree (share_id);
CREATE INDEX IF NOT EXISTS idx_shares_burn_after_reading ON public.shares USING btree (burn_after_reading) WHERE (burn_after_reading = true);
CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON public.shares USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_shares_file_id ON public.shares USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_shares_is_active ON public.shares USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares USING btree (user_id);
CREATE INDEX IF NOT EXISTS shares_decrypt_attempts_idx ON public.shares USING btree (decrypt_attempts) WHERE (decrypt_attempts > 0);
CREATE INDEX IF NOT EXISTS shares_folder_id_idx ON public.shares USING btree (folder_id);
CREATE INDEX IF NOT EXISTS shares_share_id_idx ON public.shares USING btree (share_id);
CREATE INDEX IF NOT EXISTS idx_signals_user_created ON public.signals USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_user_unread ON public.signals USING btree (user_id) WHERE (read_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS signals_idempotency_key_unique ON public.signals USING btree (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_squid_run_jobs_run ON public.squid_run_jobs USING btree (run_id);
CREATE INDEX IF NOT EXISTS idx_squid_run_steps_job ON public.squid_run_steps USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_squid_script_runs_script ON public.squid_script_runs USING btree (script_id);
CREATE INDEX IF NOT EXISTS idx_squid_script_runs_status ON public.squid_script_runs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_squid_script_triggers_script ON public.squid_script_triggers USING btree (script_id);
CREATE INDEX IF NOT EXISTS idx_squid_script_triggers_type ON public.squid_script_triggers USING btree (trigger_type);
CREATE INDEX IF NOT EXISTS idx_squid_scripts_user_id ON public.squid_scripts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_squid_vault_secrets_user ON public.squid_vault_secrets USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_squidcdn_cdn_path ON public.squidcdn_files USING btree (cdn_path);
CREATE INDEX IF NOT EXISTS idx_squidcdn_file ON public.squidcdn_files USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_squidcdn_user ON public.squidcdn_files USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_squidveil_audit_action ON public.squidveil_audit_log USING btree (action);
CREATE INDEX IF NOT EXISTS idx_squidveil_audit_time ON public.squidveil_audit_log USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_squidveil_audit_user ON public.squidveil_audit_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_squidveil_refs_ref ON public.squidveil_refs USING btree (ref_id);
CREATE INDEX IF NOT EXISTS idx_squidveil_refs_user ON public.squidveil_refs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_squidveil_sessions_session ON public.squidveil_sessions USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_squidveil_sessions_user ON public.squidveil_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS storage_providers_enabled_idx ON public.storage_providers USING btree (user_id, is_enabled);
CREATE INDEX IF NOT EXISTS storage_providers_read_enabled_idx ON public.storage_providers USING btree (user_id, read_enabled);
CREATE INDEX IF NOT EXISTS storage_providers_user_id_idx ON public.storage_providers USING btree (user_id);
CREATE INDEX IF NOT EXISTS storage_providers_user_id_type_idx ON public.storage_providers USING btree (user_id, provider_type);
CREATE INDEX IF NOT EXISTS storage_providers_write_enabled_idx ON public.storage_providers USING btree (user_id, write_enabled);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON public.subscription_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_notifications_stage ON public.subscription_notifications USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_sub_notifications_triggered_at ON public.subscription_notifications USING btree (triggered_at);
CREATE INDEX IF NOT EXISTS idx_sub_notifications_user_id ON public.subscription_notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_support_activity_ticket ON public.support_activity_log USING btree (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages USING btree (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_refunds_status ON public.support_refunds USING btree (status);
CREATE INDEX IF NOT EXISTS idx_support_refunds_ticket ON public.support_refunds USING btree (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_refunds_user ON public.support_refunds USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets USING btree (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);
CREATE INDEX IF NOT EXISTS threat_alerts_severity_idx ON public.threat_alerts USING btree (severity);
CREATE INDEX IF NOT EXISTS threat_alerts_status_idx ON public.threat_alerts USING btree (status);
CREATE INDEX IF NOT EXISTS threat_alerts_user_id_idx ON public.threat_alerts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_created_at ON public.transcode_jobs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_file_id ON public.transcode_jobs USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_priority ON public.transcode_jobs USING btree (priority);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_status ON public.transcode_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_user_id ON public.transcode_jobs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON public.upload_sessions USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_upload_id ON public.upload_sessions USING btree (upload_id);
CREATE INDEX IF NOT EXISTS idx_upload_stats_account_id ON public.upload_stats USING btree (account_id);
CREATE INDEX IF NOT EXISTS idx_upload_stats_success ON public.upload_stats USING btree (success);
CREATE INDEX IF NOT EXISTS idx_upload_stats_timestamp ON public.upload_stats USING btree (upload_timestamp);
CREATE INDEX IF NOT EXISTS idx_upload_stats_user_id ON public.upload_stats USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_email ON public.user_passkeys USING btree (email);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON public.user_passkeys USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_redeem_codes_code ON public.user_redeem_codes USING btree (code);
CREATE INDEX IF NOT EXISTS idx_user_redeem_codes_user_id ON public.user_redeem_codes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_security_settings_user_id ON public.user_security_settings USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_terms_acceptance_user_versions ON public.user_terms_acceptance USING btree (user_id, terms_version, privacy_version);
CREATE INDEX IF NOT EXISTS idx_vault_files_file_id ON public.vault_files USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_user_id ON public.vault_files USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_vault_id ON public.vault_files USING btree (vault_id);
CREATE INDEX IF NOT EXISTS idx_vaults_user_id ON public.vaults USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_video_processing_queue_job_type ON public.video_processing_queue USING btree (job_type);
CREATE INDEX IF NOT EXISTS idx_video_processing_queue_priority ON public.video_processing_queue USING btree (priority);
CREATE INDEX IF NOT EXISTS idx_video_processing_queue_scheduled_for ON public.video_processing_queue USING btree (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_video_processing_queue_status ON public.video_processing_queue USING btree (status);
CREATE INDEX IF NOT EXISTS idx_video_quality_metrics_session ON public.video_quality_metrics USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_video_quality_metrics_timestamp ON public.video_quality_metrics USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS idx_video_stream_sessions_created_at ON public.video_stream_sessions USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_video_stream_sessions_file ON public.video_stream_sessions USING btree (file_id);
CREATE INDEX IF NOT EXISTS idx_video_stream_sessions_last_activity ON public.video_stream_sessions USING btree (last_activity);
CREATE INDEX IF NOT EXISTS idx_video_stream_sessions_user ON public.video_stream_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_created ON public.webhook_events_log USING btree (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_log_delivery ON public.webhook_events_log USING btree (delivery_id) WHERE (delivery_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_pending ON public.webhook_events_log USING btree (status, next_attempt_at) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_webhook_events_log_webhook ON public.webhook_events_log USING btree (webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON public.webhooks USING btree (user_id);
CREATE INDEX IF NOT EXISTS workspace_invites_invitee_idx ON public.workspace_invites USING btree (invitee_email);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_pending_idx ON public.workspace_invites USING btree (workspace_id, invitee_email) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_hash_idx ON public.workspace_invites USING btree (token_hash);
CREATE INDEX IF NOT EXISTS workspace_invites_workspace_idx ON public.workspace_invites USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON public.workspace_members USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_workspace_role_idx ON public.workspace_members USING btree (workspace_id, role);
CREATE INDEX IF NOT EXISTS workspace_presence_heartbeat_idx ON public.workspace_presence USING btree (workspace_id, last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS workspace_presence_workspace_idx ON public.workspace_presence USING btree (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_single_default_idx ON public.workspaces USING btree (user_id) WHERE (is_default = true);
CREATE INDEX IF NOT EXISTS workspaces_user_id_idx ON public.workspaces USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sv_tokens_hash_unique ON squidveil.access_tokens USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_sv_tokens_owner ON squidveil.access_tokens USING btree (owner_id);
CREATE INDEX IF NOT EXISTS squidveil_access_tokens_owner_idx ON squidveil.access_tokens USING btree (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_audit_action ON squidveil.audit_log USING btree (action);
CREATE INDEX IF NOT EXISTS idx_sv_audit_created ON squidveil.audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_audit_path ON squidveil.audit_log USING btree (path);
CREATE INDEX IF NOT EXISTS squidveil_audit_owner_action_idx ON squidveil.audit_log USING btree (actor_id, action);
CREATE INDEX IF NOT EXISTS squidveil_audit_owner_time_idx ON squidveil.audit_log USING btree (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sv_policies_owner ON squidveil.policies USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_sv_versions_secret ON squidveil.secret_versions USING btree (secret_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_sv_versions_state ON squidveil.secret_versions USING btree (state);
CREATE INDEX IF NOT EXISTS idx_sv_secrets_deleted ON squidveil.secrets USING btree (deleted_at);
CREATE INDEX IF NOT EXISTS idx_sv_secrets_owner ON squidveil.secrets USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_sv_veilrefs_expires ON squidveil.veilrefs USING btree (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sv_veilrefs_ref_id ON squidveil.veilrefs USING btree (ref_id);

CREATE OR REPLACE VIEW "public"."video_analytics_summary" AS  SELECT f.id AS file_id,
    f.name AS file_name,
    f.type AS file_type,
    f.size AS file_size,
    count(DISTINCT mpl.session_id) AS total_sessions,
    count(DISTINCT mpl.user_id) AS unique_viewers,
    avg(vss.stream_duration) AS avg_watch_time,
    sum(vss.bandwidth_used) AS total_bandwidth,
    count(
        CASE
            WHEN ((mpl.event_type)::text = 'complete'::text) THEN 1
            ELSE NULL::integer
        END) AS completion_count,
    count(
        CASE
            WHEN ((mpl.event_type)::text = 'error'::text) THEN 1
            ELSE NULL::integer
        END) AS error_count,
    max(mpl."timestamp") AS last_viewed,
    avg(
        CASE
            WHEN ((mpl.event_type)::text = 'complete'::text) THEN mpl."position"
            ELSE NULL::numeric
        END) AS avg_completion_time
   FROM ((files f
     LEFT JOIN media_playback_logs mpl ON ((f.id = mpl.file_id)))
     LEFT JOIN video_stream_sessions vss ON ((mpl.session_id = vss.session_id)))
  WHERE (f.type ~~ 'video/%'::text)
  GROUP BY f.id, f.name, f.type, f.size;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash TEXT;
  v_invite RECORD;
  v_email TEXT;
  v_member_limit INTEGER;
  v_member_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM public.workspace_invites
  WHERE token_hash = v_hash
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite token';
  END IF;

  v_email := lower(trim(auth.email()));
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Email not available from auth';
  END IF;
  IF v_invite.invitee_email <> v_email THEN
    RAISE EXCEPTION 'Invite is for a different email address';
  END IF;

  SELECT member_limit INTO v_member_limit
  FROM public.workspaces
  WHERE id = v_invite.workspace_id;

  IF v_member_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_member_count
    FROM public.workspace_members
    WHERE workspace_id = v_invite.workspace_id;

    IF v_member_count >= v_member_limit THEN
      RAISE EXCEPTION 'Workspace member limit reached';
    END IF;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role);

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.workspace_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_file_bytes(p_tags text[], p_size bigint, p_sign integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  raw text;
  j jsonb;
  c jsonb;
  b text;
  sz bigint;
  n int;
BEGIN
  IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN RETURN; END IF;
  raw := p_tags[1];
  BEGIN
    j := raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF jsonb_typeof(j) <> 'object' THEN RETURN; END IF;
  IF NOT (j ? 'chunks') THEN RETURN; END IF;
  n := jsonb_array_length(j->'chunks');
  IF n IS NULL OR n = 0 THEN RETURN; END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(j->'chunks') LOOP
    b := c->>'bucket';
    IF b IS NULL OR b = '' THEN CONTINUE; END IF;
    IF (c->>'repo') = 'supabase' THEN CONTINUE; END IF;
    IF (c->>'size') ~ '^[0-9]+$' THEN
      sz := (c->>'size')::bigint;
    ELSE
      sz := COALESCE(p_size, 0) / n;
    END IF;
    UPDATE public.squidcloud_b2_buckets
      SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + p_sign * sz)
      WHERE bucket_name = b;
    UPDATE public.storage_providers
      SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + p_sign * sz)
      WHERE bucket_name = b;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_file_to_collection(collection_id_param uuid, file_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify collection belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM collections 
    WHERE id = collection_id_param AND user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Collection not found or access denied';
  END IF;
  
  -- Verify file belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM files 
    WHERE id = file_id_param AND user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'File not found or access denied';
  END IF;
  
  -- Add file to collection (ignore if already exists)
  INSERT INTO collections_files (user_id, collection_id, file_id)
  VALUES (current_user_id, collection_id_param, file_id_param)
  ON CONFLICT (user_id, collection_id, file_id) DO NOTHING;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_bucket_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_deleted, false) = false THEN
      PERFORM public.add_file_bytes(NEW.tags, NEW.size, 1);
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.is_deleted, false) = false THEN
      PERFORM public.add_file_bytes(OLD.tags, OLD.size, -1);
    END IF;
    RETURN OLD;
  END IF;
  IF COALESCE(OLD.is_deleted, false) <> COALESCE(NEW.is_deleted, false) THEN
    IF COALESCE(NEW.is_deleted, false) = true THEN
      PERFORM public.add_file_bytes(OLD.tags, OLD.size, -1);
    ELSE
      PERFORM public.add_file_bytes(NEW.tags, NEW.size, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_pin_authorized_operation(operation_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  required_auth BOOLEAN := FALSE;
  consumed_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT public.requires_pin_auth(current_user_id, assert_pin_authorized_operation.operation_type) INTO required_auth;

  IF COALESCE(required_auth, TRUE) = FALSE THEN
    RETURN TRUE;
  END IF;

  SELECT id INTO consumed_id
  FROM public.pin_operation_authorizations
  WHERE user_id = current_user_id
    AND pin_operation_authorizations.operation_type = assert_pin_authorized_operation.operation_type
    AND authorized_until > NOW()
  ORDER BY authorized_until DESC
  LIMIT 1;

  IF consumed_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.pin_operation_authorizations WHERE id = consumed_id;
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_workspace_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.workspace_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.workspace_id := public.get_or_create_default_workspace(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_save_pdf_annotations(p_annotations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_annotation jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  FOR v_annotation IN SELECT * FROM jsonb_array_elements(p_annotations)
  LOOP
    INSERT INTO public.pdf_annotations (user_id, document_id, page_number, annotation_type, color, opacity, content, position_data)
    VALUES (
      v_user_id,
      v_annotation->>'document_id',
      (v_annotation->>'page_number')::integer,
      v_annotation->>'annotation_type',
      COALESCE(v_annotation->>'color', '#FFEB3B'),
      COALESCE((v_annotation->>'opacity')::real, 0.4),
      COALESCE(v_annotation->'content', '{}'::jsonb),
      COALESCE(v_annotation->'position_data', '{}'::jsonb)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(p_annotations));
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_subscription(p_user_id uuid, p_reason text DEFAULT NULL::text, p_cancelled_by text DEFAULT 'user'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_plan_type text;
  v_billing_period text;
  v_result jsonb;
BEGIN
  -- Get caller identity
  v_caller_id := auth.uid();

  -- Authorization: caller must be the user themselves OR an admin
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_caller_id = p_user_id THEN
    -- User cancelling themselves — always allowed
    NULL;
  ELSE
    -- Check if caller is admin
    SELECT is_admin INTO v_is_admin
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_is_admin IS NOT TRUE THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;
  END IF;

  -- Get current plan info for event logging
  SELECT tier INTO v_plan_type
  FROM public.profiles
  WHERE id = p_user_id;

  -- Get latest billing_period from events
  SELECT billing_period INTO v_billing_period
  FROM public.subscription_events
  WHERE user_id = p_user_id AND billing_period IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update profile
  UPDATE public.profiles
  SET
    is_premium = false,
    tier = 'free',
    subscription_starts_at = NULL,
    subscription_expires_at = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  -- Log the event
  INSERT INTO public.subscription_events (
    user_id,
    event_type,
    plan_type,
    billing_period,
    metadata
  ) VALUES (
    p_user_id,
    'cancelled',
    COALESCE(v_plan_type, 'free'),
    v_billing_period,
    jsonb_build_object(
      'reason', p_reason,
      'cancelled_by', p_cancelled_by,
      'cancelled_at', now()::text
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_api_credits(p_user_id uuid, p_operation text DEFAULT 'whoami'::text, p_file_size bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits RECORD;
  v_cost RECORD;
  v_credits_to_deduct INTEGER;
  v_multiplier NUMERIC;
BEGIN
  SELECT * INTO v_credits FROM api_credits WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', true, 'credits_remaining', 1000, 'daily_limit', 1000);
  END IF;
  IF v_credits.credits_remaining = -1 THEN
    RETURN jsonb_build_object('available', true, 'credits_remaining', -1, 'daily_limit', -1);
  END IF;
  SELECT * INTO v_cost FROM api_operation_costs WHERE operation = p_operation AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Unknown operation');
  END IF;
  SELECT COALESCE(
    CASE WHEN jsonb_typeof(value) IN ('number', 'string') THEN (value #>> '{}')::numeric END,
    1.0
  ) INTO v_multiplier
  FROM api_admin_config WHERE key = 'global_daily_credit_multiplier';
  v_credits_to_deduct := GREATEST(1, CEIL((v_cost.base_cost + CEIL(v_cost.per_byte_cost * p_file_size)) * v_multiplier)::INTEGER);
  RETURN jsonb_build_object(
    'available', v_credits.credits_remaining >= v_credits_to_deduct,
    'credits_remaining', v_credits.credits_remaining,
    'required', v_credits_to_deduct,
    'daily_limit', v_credits.daily_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_api_token_available(user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier text;
  limits record;
  tokens_used integer;
  result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id THEN
    RETURN jsonb_build_object('available', false, 'error', 'Unauthorized');
  END IF;

  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;
  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  tokens_used := get_user_api_token_usage_today(user_id);

  IF limits.api_tokens_per_day > 0 AND tokens_used >= limits.api_tokens_per_day THEN
    result := jsonb_build_object(
      'available', false,
      'used', tokens_used,
      'limit', limits.api_tokens_per_day,
      'tier', user_tier,
      'reason', format('You have used all %s API tokens for today. Upgrade your plan for more.', limits.api_tokens_per_day)
    );
    RETURN result;
  END IF;

  result := jsonb_build_object(
    'available', true,
    'used', tokens_used,
    'limit', CASE WHEN limits.api_tokens_per_day > 0 THEN limits.api_tokens_per_day ELSE -1 END,
    'tier', user_tier,
    'remaining', CASE WHEN limits.api_tokens_per_day > 0 THEN limits.api_tokens_per_day - tokens_used ELSE -1 END
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_download_allowed(user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier text;
  limits record;
  active_downloads integer;
  result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Unauthorized');
  END IF;

  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;
  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  SELECT COUNT(*) INTO active_downloads
  FROM shares
  WHERE user_id = check_download_allowed.user_id
    AND created_at > now() - interval '5 minutes';

  IF limits.concurrent_downloads > 0 AND active_downloads >= limits.concurrent_downloads THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', format('You have reached the concurrent download limit of %s for your %s plan.', limits.concurrent_downloads, user_tier),
      'limit', limits.concurrent_downloads,
      'tier', user_tier
    );
    RETURN result;
  END IF;

  result := jsonb_build_object('allowed', true, 'tier', user_tier, 'limit', limits.concurrent_downloads);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_share_access(p_share_id text, p_password text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_device_fingerprint text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  rec record;
BEGIN
  SELECT * INTO rec FROM shares WHERE share_id = p_share_id;

  IF rec IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_found'); END IF;
  IF NOT rec.is_active THEN RETURN jsonb_build_object('allowed', false, 'reason', 'revoked'); END IF;
  IF rec.expires_at IS NOT NULL AND rec.expires_at <= now() THEN RETURN jsonb_build_object('allowed', false, 'reason', 'expired'); END IF;
  IF rec.burn_after_reading AND rec.download_count >= 1 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'burned'); END IF;
  IF rec.max_views IS NOT NULL AND rec.share_views >= rec.max_views THEN RETURN jsonb_build_object('allowed', false, 'reason', 'max_views_reached'); END IF;
  IF rec.max_downloads IS NOT NULL AND rec.download_count >= rec.max_downloads THEN RETURN jsonb_build_object('allowed', false, 'reason', 'max_downloads_reached'); END IF;

  IF rec.access_code IS NOT NULL AND rec.access_code != '' AND (p_password IS NULL OR p_password != rec.access_code) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'wrong_password');
  END IF;

  IF rec.allowed_countries IS NOT NULL AND array_length(rec.allowed_countries, 1) > 0 THEN
    IF p_country IS NULL OR NOT (p_country = ANY(rec.allowed_countries)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'country_blocked');
    END IF;
  END IF;

  IF rec.blocked_countries IS NOT NULL AND array_length(rec.blocked_countries, 1) > 0 THEN
    IF p_country IS NOT NULL AND (p_country = ANY(rec.blocked_countries)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'country_blocked');
    END IF;
  END IF;

  IF rec.device_fingerprint IS NOT NULL THEN
    IF rec.first_device_fingerprint IS NULL THEN
      UPDATE shares SET first_device_fingerprint = p_device_fingerprint WHERE share_id = p_share_id;
    ELSIF p_device_fingerprint IS NULL OR p_device_fingerprint != rec.first_device_fingerprint THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'device_mismatch');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'share_type', rec.share_type,
    'view_only', rec.view_only,
    'require_email', rec.require_email,
    'watermark_email', rec.watermark_email,
    'burn_after_reading', rec.burn_after_reading,
    'shared_encryption_key', rec.shared_encryption_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_subscription_validity(user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_record record;
  days_remaining integer;
  result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO profile_record FROM profiles WHERE id = user_id;

  IF profile_record IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF profile_record.subscription_expires_at IS NOT NULL
     AND profile_record.subscription_expires_at < now()
     AND profile_record.tier != 'free' THEN
    UPDATE profiles
    SET is_premium = false,
        tier = 'free',
        updated_at = now()
    WHERE id = user_id
      AND tier != 'free';
    RETURN jsonb_build_object(
      'valid', false,
      'tier', 'free',
      'is_premium', false,
      'reason', 'subscription_expired'
    );
  END IF;

  IF profile_record.subscription_expires_at IS NOT NULL THEN
    days_remaining := GREATEST(0, EXTRACT(DAY FROM profile_record.subscription_expires_at - now())::integer);
  ELSE
    days_remaining := NULL;
  END IF;

  result := jsonb_build_object(
    'valid', profile_record.is_premium,
    'tier', COALESCE(profile_record.tier, 'free'),
    'is_premium', COALESCE(profile_record.is_premium, false),
    'subscription_starts_at', profile_record.subscription_starts_at,
    'subscription_expires_at', profile_record.subscription_expires_at,
    'days_remaining', days_remaining
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_upload_allowed(user_id uuid, file_size_bytes bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier text;
  limits record;
  active_uploads integer;
  result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Unauthorized');
  END IF;

  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;
  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  SELECT COUNT(*) INTO active_uploads
  FROM files
  WHERE user_id = check_upload_allowed.user_id
    AND created_at > now() - interval '5 minutes';

  IF limits.max_file_size_bytes > 0 AND file_size_bytes > limits.max_file_size_bytes THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', format('File size exceeds your %s plan limit of %s. Upgrade to upload larger files.', user_tier, pg_size_pretty(limits.max_file_size_bytes::bigint)),
      'limit', limits.max_file_size_bytes,
      'tier', user_tier
    );
    RETURN result;
  END IF;

  IF limits.concurrent_uploads > 0 AND active_uploads >= limits.concurrent_uploads THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', format('You have reached the concurrent upload limit of %s for your %s plan. Wait for current uploads to finish.', limits.concurrent_uploads, user_tier),
      'limit', limits.concurrent_uploads,
      'tier', user_tier
    );
    RETURN result;
  END IF;

  result := jsonb_build_object('allowed', true, 'tier', user_tier, 'limit', limits.concurrent_uploads);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_upload_file_size(user_id uuid, file_size_bytes bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier text;
  size_limit bigint;
  upload_limit integer;
  uploads_used integer;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT max_file_size_bytes, daily_upload_limit INTO size_limit, upload_limit
  FROM plan_limits WHERE tier = user_tier;
  IF size_limit IS NULL THEN
    SELECT max_file_size_bytes, daily_upload_limit INTO size_limit, upload_limit
    FROM plan_limits WHERE tier = 'free';
  END IF;

  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date)
  VALUES (check_upload_file_size.user_id, 1000, 1000, CURRENT_DATE, 0, CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT api_credits_pkey DO NOTHING;

  UPDATE api_credits SET
    uploads_used_today = 0,
    uploads_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE api_credits.user_id = check_upload_file_size.user_id
    AND api_credits.uploads_reset_date < CURRENT_DATE;

  SELECT uploads_used_today INTO uploads_used
  FROM api_credits WHERE api_credits.user_id = check_upload_file_size.user_id;

  IF size_limit > 0 AND file_size_bytes > size_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('File size exceeds your %s plan limit of %s. Upgrade to upload larger files.',
        user_tier,
        pg_size_pretty(size_limit)
      ),
      'limit', size_limit,
      'tier', user_tier,
      'daily_upload_limit', upload_limit,
      'uploads_used_today', uploads_used
    );
  END IF;

  IF upload_limit > 0 AND uploads_used >= upload_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('You have reached your daily upload limit of %s files on the %s plan. Resets at midnight UTC.',
        upload_limit,
        user_tier
      ),
      'limit', size_limit,
      'tier', user_tier,
      'daily_upload_limit', upload_limit,
      'uploads_used_today', uploads_used
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', size_limit,
    'tier', user_tier,
    'daily_upload_limit', upload_limit,
    'uploads_used_today', uploads_used
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_pdf_urls()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    DELETE FROM pdf_secure_urls 
    WHERE expires_at < now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_processing_jobs(days_to_keep integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM video_processing_queue 
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up old transcode jobs
    DELETE FROM transcode_jobs
    WHERE status IN ('completed', 'failed')
      AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_video_logs(days_to_keep integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up old playback logs
    DELETE FROM media_playback_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old quality metrics
    DELETE FROM video_quality_metrics 
    WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
    
    -- Clean up old stream sessions
    DELETE FROM video_stream_sessions 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_trashed_files()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM public.files 
    WHERE is_deleted = true 
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_username text DEFAULT NULL::text, p_full_name text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text, p_workspace_name text DEFAULT NULL::text, p_storage_provider text DEFAULT 'squidcloud'::text, p_onboarding_complete boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (
    id, username, full_name, avatar_url, workspace_name,
    storage_provider, onboarding_complete
  )
  VALUES (
    v_user_id, p_username, p_full_name, p_avatar_url, p_workspace_name,
    p_storage_provider, p_onboarding_complete
  )
  ON CONFLICT (id) DO UPDATE SET
    username            = EXCLUDED.username,
    full_name           = EXCLUDED.full_name,
    avatar_url          = EXCLUDED.avatar_url,
    workspace_name      = EXCLUDED.workspace_name,
    storage_provider    = EXCLUDED.storage_provider,
    onboarding_complete = EXCLUDED.onboarding_complete,
    updated_at          = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_processing_job(p_job_id uuid, p_status character varying, p_error_message text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    UPDATE video_processing_queue
    SET status = p_status,
        completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
        error_message = p_error_message,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_entity_notes(p_entity_id uuid, p_entity_type text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.entity_notes
    WHERE entity_id = p_entity_id
      AND entity_type = p_entity_type
      AND user_id = auth.uid()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_file_upload()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF NEW.user_id IS NULL THEN RETURN NEW; END IF; IF NEW.storage_path IS NOT NULL AND NEW.storage_path LIKE '%/migration/%' THEN RETURN NEW; END IF; INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date) VALUES (NEW.user_id, 1000, 1000, CURRENT_DATE, 1, CURRENT_DATE) ON CONFLICT ON CONSTRAINT api_credits_pkey DO UPDATE SET uploads_used_today = CASE WHEN api_credits.uploads_reset_date < CURRENT_DATE THEN 1 ELSE api_credits.uploads_used_today + 1 END, uploads_reset_date = CURRENT_DATE, updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.create_collection(collection_name text, collection_color text DEFAULT NULL::text, collection_icon text DEFAULT NULL::text, collection_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_collection_id UUID;
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate input
  IF collection_name IS NULL OR LENGTH(TRIM(collection_name)) = 0 THEN
    RAISE EXCEPTION 'Collection name is required';
  END IF;
  
  IF LENGTH(collection_name) > 100 THEN
    RAISE EXCEPTION 'Collection name cannot exceed 100 characters';
  END IF;
  
  -- Check for duplicate collection name
  IF EXISTS (
    SELECT 1 FROM collections 
    WHERE user_id = current_user_id AND LOWER(name) = LOWER(TRIM(collection_name))
  ) THEN
    RAISE EXCEPTION 'Collection with this name already exists';
  END IF;
  
  -- Create the collection
  INSERT INTO collections (user_id, name, color, icon, description)
  VALUES (current_user_id, TRIM(collection_name), collection_color, collection_icon, collection_description)
  RETURNING id INTO new_collection_id;
  
  RETURN new_collection_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_default_workspace_for_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.get_or_create_default_workspace(NEW.id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_entity_note(p_entity_id uuid, p_entity_type text, p_content text)
 RETURNS entity_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_note public.entity_notes;
  note_count BIGINT;
  user_tier TEXT;
  max_notes INT;
BEGIN
  SELECT COALESCE(tier, 'free') INTO user_tier FROM profiles WHERE id = auth.uid();
  IF user_tier IS NULL THEN user_tier := 'free'; END IF;

  max_notes := CASE user_tier
    WHEN 'free' THEN 5
    WHEN 'supporter' THEN 20
    WHEN 'supporter-plus' THEN 30
    ELSE 5
  END;

  SELECT COUNT(*) INTO note_count
  FROM public.entity_notes
  WHERE entity_id = p_entity_id
    AND entity_type = p_entity_type
    AND user_id = auth.uid();

  IF note_count >= max_notes THEN
    RAISE EXCEPTION 'Note limit reached for % plan. Max % notes per file/folder.', user_tier, max_notes;
  END IF;

  INSERT INTO public.entity_notes (user_id, entity_id, entity_type, content)
  VALUES (auth.uid(), p_entity_id, p_entity_type, p_content)
  RETURNING * INTO new_note;

  RETURN new_note;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_file_record(p_name text, p_type text, p_size bigint, p_storage_path text, p_user_id uuid, p_encrypted boolean DEFAULT false, p_encryption_key text DEFAULT NULL::text, p_metadata text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  result_id UUID;
  result_record JSON;
BEGIN
  -- Generate new UUID
  result_id := gen_random_uuid();
  
  -- Insert basic file record
  INSERT INTO files (
    id, 
    name, 
    type, 
    size, 
    storage_path, 
    user_id, 
    encrypted, 
    encryption_key,
    created_at, 
    updated_at
  ) VALUES (
    result_id,
    p_name,
    p_type,
    p_size,
    p_storage_path,
    p_user_id,
    COALESCE(p_encrypted, false),
    p_encryption_key,
    NOW(),
    NOW()
  );
  
  -- Update with metadata if provided
  IF p_metadata IS NOT NULL THEN
    UPDATE files 
    SET tags = ARRAY[p_metadata]
    WHERE id = result_id;
  END IF;
  
  -- Return the created record
  SELECT json_build_object(
    'id', id,
    'name', name,
    'type', type,
    'size', size,
    'user_id', user_id,
    'created_at', created_at
  ) INTO result_record
  FROM files 
  WHERE id = result_id;
  
  RETURN result_record;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_file_request(p_user_id uuid, p_title text, p_description text DEFAULT ''::text, p_folder_path text DEFAULT ''::text, p_max_files integer DEFAULT 10, p_max_size_per_file bigint DEFAULT 104857600, p_allowed_types text[] DEFAULT NULL::text[], p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_slug text; v_result jsonb;
BEGIN
  v_slug := lower(regexp_replace(p_title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 8);
  INSERT INTO file_requests (user_id, title, description, folder_path, slug, max_files, max_size_per_file, allowed_types, expires_at)
  VALUES (p_user_id, p_title, p_description, p_folder_path, v_slug, p_max_files, p_max_size_per_file, p_allowed_types, p_expires_at)
  RETURNING jsonb_build_object('id', id, 'slug', slug, 'title', title) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_file_share(file_id_param uuid, shared_encryption_key_param text DEFAULT NULL::text, share_secret_hash_param text DEFAULT NULL::text)
 RETURNS TABLE(share_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_share_id text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM files WHERE id = file_id_param AND user_id = current_user_id) THEN
    RAISE EXCEPTION 'File not found or access denied';
  END IF;

  IF EXISTS (SELECT 1 FROM shares WHERE file_id = file_id_param AND user_id = current_user_id) THEN
    SELECT s.share_id INTO new_share_id
    FROM shares s
    WHERE s.file_id = file_id_param AND s.user_id = current_user_id;

    IF shared_encryption_key_param IS NOT NULL THEN
      UPDATE shares
      SET shared_encryption_key = shared_encryption_key_param,
          share_secret_hash = COALESCE(share_secret_hash_param, shares.share_secret_hash)
      WHERE shares.share_id = new_share_id;
    END IF;

    RETURN QUERY SELECT new_share_id;
    RETURN;
  END IF;

  LOOP
    new_share_id := encode(gen_random_bytes(9), 'base64');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE shares.share_id = new_share_id);
  END LOOP;

  INSERT INTO shares (user_id, file_id, share_id, access_code, created_at, shared_encryption_key, share_secret_hash)
  VALUES (current_user_id, file_id_param, new_share_id, NULL, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_folder_secure(p_name text, p_parent_folder text DEFAULT ''::text, p_workspace_id uuid DEFAULT NULL::uuid, p_storage_provider_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_path TEXT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Folder name is required';
  END IF;

  v_path := CASE
    WHEN p_parent_folder IS NOT NULL AND p_parent_folder != ''
    THEN p_parent_folder || '/' || p_name
    ELSE p_name
  END;

  INSERT INTO public.folders (user_id, name, path, parent_folder, workspace_id, storage_provider_id)
  VALUES (v_user_id, p_name, v_path, NULLIF(p_parent_folder, ''), p_workspace_id, p_storage_provider_id)
  RETURNING jsonb_build_object(
    'id', id,
    'name', name,
    'path', path,
    'created_at', created_at,
    'parent_folder', parent_folder,
    'user_id', user_id
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_folder_share(folder_id_param uuid, shared_encryption_key_param text DEFAULT NULL::text, share_secret_hash_param text DEFAULT NULL::text)
 RETURNS TABLE(share_id text, total_files bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_share_id text;
  current_user_id uuid;
  total_files bigint;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM folders WHERE id = folder_id_param AND user_id = current_user_id) THEN
    RAISE EXCEPTION 'Folder not found or access denied';
  END IF;

  -- Idempotent: if share already exists for this folder+user, return existing
  IF EXISTS (SELECT 1 FROM shares WHERE folder_id = folder_id_param AND user_id = current_user_id AND is_active IS NOT FALSE) THEN
    SELECT s.share_id INTO new_share_id
    FROM shares s
    WHERE s.folder_id = folder_id_param AND s.user_id = current_user_id AND s.is_active IS NOT FALSE;

    -- Update encryption key material if provided
    IF shared_encryption_key_param IS NOT NULL THEN
      UPDATE shares
      SET shared_encryption_key = shared_encryption_key_param,
          share_secret_hash = COALESCE(share_secret_hash_param, shares.share_secret_hash)
      WHERE shares.share_id = new_share_id;
    END IF;

    SELECT COUNT(*) INTO total_files
    FROM files
    WHERE parent_folder = (SELECT path FROM folders WHERE id = folder_id_param)
      AND user_id = current_user_id AND is_deleted = false;

    RETURN QUERY SELECT new_share_id, total_files;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO total_files
  FROM files
  WHERE parent_folder = (SELECT path FROM folders WHERE id = folder_id_param)
    AND user_id = current_user_id AND is_deleted = false;

  LOOP
    new_share_id := encode(gen_random_bytes(9), 'base64');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE shares.share_id = new_share_id);
  END LOOP;

  INSERT INTO shares (user_id, folder_id, share_id, access_code, created_at, shared_encryption_key, share_secret_hash)
  VALUES (current_user_id, folder_id_param, new_share_id, NULL, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id, total_files;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_webhook(p_url text, p_events text[])
 RETURNS webhooks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier TEXT;
  webhook_count BIGINT;
  max_webhooks INT;
  new_webhook public.webhooks;
  secret TEXT;
BEGIN
  SELECT COALESCE(tier, 'free') INTO user_tier FROM profiles WHERE id = auth.uid();
  IF user_tier IS NULL THEN user_tier := 'free'; END IF;

  SELECT COALESCE(webhooks, 0) INTO max_webhooks
  FROM plan_limits
  WHERE tier = user_tier;

  IF max_webhooks = 0 THEN
    RAISE EXCEPTION 'Webhooks are not available on your % plan. Upgrade to create webhooks.', user_tier;
  END IF;

  SELECT COUNT(*) INTO webhook_count FROM public.webhooks WHERE user_id = auth.uid();
  IF max_webhooks > 0 AND webhook_count >= max_webhooks THEN
    RAISE EXCEPTION 'Webhook limit reached for % plan. Max % webhooks.', user_tier, max_webhooks;
  END IF;

  secret := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.webhooks (user_id, url, secret_key, events)
  VALUES (auth.uid(), p_url, secret, p_events)
  RETURNING * INTO new_webhook;

  RETURN new_webhook;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace_invite(p_workspace_id uuid, p_invitee_email text, p_role workspace_role DEFAULT 'viewer'::workspace_role, p_expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval))
 RETURNS TABLE(invite_id uuid, invite_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token TEXT;
  v_hash TEXT;
  v_invitee_email TEXT;
BEGIN
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite with owner role';
  END IF;

  IF NOT public.has_workspace_role(p_workspace_id, auth.uid(), 'admin')
     AND NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_invitee_email := lower(trim(p_invitee_email));
  v_token := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.workspace_invites (
    workspace_id,
    invitee_email,
    invited_by,
    role,
    token_hash,
    expires_at
  ) VALUES (
    p_workspace_id,
    v_invitee_email,
    auth.uid(),
    p_role,
    v_hash,
    p_expires_at
  )
  RETURNING id INTO invite_id;

  invite_token := v_token;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace_owner_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, joined_at)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id, NEW.created_at)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_keyring_secret(p_key_name text, p_ciphertext text, p_nonce text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key_id UUID;
  v_plain  BYTEA;
BEGIN
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = p_key_name;
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Missing keyring entry for %', p_key_name;
  END IF;

  v_plain := pgsodium.crypto_secretbox_open(
    decode(p_ciphertext, 'base64'),
    decode(p_nonce, 'base64'),
    v_key_id
  );

  RETURN convert_from(v_plain, 'utf8');
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_api_credits(p_user_id uuid, p_api_key_id uuid DEFAULT NULL::uuid, p_operation text DEFAULT 'whoami'::text, p_file_size bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_c RECORD; v_cost RECORD; v_lim INTEGER; v_ded INTEGER; v_mul NUMERIC;
  v_key_ok BOOLEAN := false; v_tier TEXT; v_prem BOOLEAN; v_act BOOLEAN; v_base INTEGER;
BEGIN
  SELECT COALESCE(p.tier,'free'), p.is_premium,
         (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
    INTO v_tier, v_prem, v_act
  FROM profiles p WHERE p.id = p_user_id;
  IF NOT FOUND THEN v_tier := 'free'; v_prem := false; v_act := false; END IF;

  v_lim := CASE
    WHEN COALESCE(v_prem,false) AND COALESCE(v_act,false) AND v_tier = 'supporter' THEN 10000
    WHEN COALESCE(v_prem,false) AND COALESCE(v_act,false) AND v_tier IN ('supporter-plus') THEN -1
    ELSE 1000 END;

  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date)
  VALUES (p_user_id, CASE WHEN v_lim=-1 THEN -1 ELSE v_lim END, v_lim, CURRENT_DATE)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_c FROM api_credits WHERE user_id = p_user_id FOR UPDATE;

  IF p_api_key_id IS NOT NULL THEN
    SELECT custom_daily_limit INTO v_lim FROM api_key_limits WHERE api_key_id = p_api_key_id;
    IF v_lim IS NOT NULL AND v_lim > 0 THEN v_c.daily_limit := v_lim; END IF;
    SELECT EXISTS(SELECT 1 FROM api_keys WHERE id = p_api_key_id) INTO v_key_ok;
  END IF;

  IF v_c.last_reset_date < CURRENT_DATE THEN
    v_base := v_c.custom_daily_limit;
    IF v_base IS NULL OR (v_base <> -1 AND v_base < v_lim) THEN v_base := v_lim; END IF;
    UPDATE api_credits SET credits_remaining = CASE WHEN v_base=-1 THEN -1 ELSE v_base END,
      credits_used_today = 0, last_reset_date = CURRENT_DATE, updated_at = now() WHERE user_id = p_user_id;
    v_c.credits_remaining := CASE WHEN v_base=-1 THEN -1 ELSE v_base END;
    v_c.daily_limit := v_base; v_c.credits_used_today := 0;
  END IF;

  IF v_c.credits_remaining = -1 THEN
    RETURN jsonb_build_object('allowed',true,'credits_deducted',0,'credits_remaining',-1,'credits_used_today',COALESCE(v_c.credits_used_today,0),'daily_limit',-1);
  END IF;

  SELECT * INTO v_cost FROM api_operation_costs WHERE operation = p_operation AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed',false,'reason','Unknown operation: '||COALESCE(p_operation,'null'),'code','UNKNOWN_OPERATION');
  END IF;

  IF v_cost.base_cost = 0 AND (v_cost.per_byte_cost = 0 OR p_file_size = 0) THEN
    RETURN jsonb_build_object('allowed',true,'credits_deducted',0,'credits_remaining',v_c.credits_remaining,'credits_used_today',v_c.credits_used_today,'daily_limit',v_c.daily_limit);
  END IF;

  SELECT COALESCE(CASE WHEN jsonb_typeof(value) IN ('number','string') THEN (value #>> '{}')::numeric END,1.0)
    INTO v_mul FROM api_admin_config WHERE key='global_daily_credit_multiplier';

  v_ded := GREATEST(1, CEIL((v_cost.base_cost + CEIL(v_cost.per_byte_cost * p_file_size)) * COALESCE(v_mul,1.0))::INTEGER);

  IF v_c.credits_remaining < v_ded THEN
    RETURN jsonb_build_object('allowed',false,'reason','Insufficient credits. Required: '||v_ded||', Remaining: '||v_c.credits_remaining,'code','INSUFFICIENT_CREDITS');
  END IF;

  UPDATE api_credits SET credits_remaining = credits_remaining - v_ded, credits_used_today = credits_used_today + v_ded, updated_at = now()
    WHERE user_id = p_user_id;

  INSERT INTO api_credit_log (user_id, api_key_id, operation, credits_deducted, file_size)
    VALUES (p_user_id, CASE WHEN v_key_ok THEN p_api_key_id ELSE NULL END, p_operation, v_ded,
            CASE WHEN p_file_size>0 THEN p_file_size ELSE NULL END);

  RETURN jsonb_build_object('allowed',true,'credits_deducted',v_ded,'credits_remaining',v_c.credits_remaining - v_ded,'credits_used_today',v_c.credits_used_today + v_ded,'daily_limit',v_c.daily_limit);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_entity_note(p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted BIGINT;
BEGIN
  DELETE FROM public.entity_notes
  WHERE id = p_note_id AND user_id = auth.uid();

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_file_secure(file_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  is_authorized BOOLEAN := FALSE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.assert_pin_authorized_operation('delete_files') INTO is_authorized;
  IF COALESCE(is_authorized, FALSE) = FALSE THEN
    RAISE EXCEPTION 'PIN authentication required';
  END IF;

  DELETE FROM public.files
  WHERE id = file_uuid
    AND user_id = current_user_id;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_folder_secure(folder_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_folder_path TEXT;
  folder_owner_id UUID;
  folder_workspace_id UUID;
BEGIN
  SELECT user_id, path, workspace_id INTO folder_owner_id, target_folder_path, folder_workspace_id
  FROM public.folders WHERE id = folder_uuid;

  IF folder_owner_id IS NULL THEN
    RAISE EXCEPTION 'Folder not found';
  END IF;

  IF auth.uid() <> folder_owner_id THEN
    IF folder_workspace_id IS NOT NULL THEN
      IF NOT public.has_workspace_role(folder_workspace_id, auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Not authorized to delete this folder';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not authorized to delete this folder';
    END IF;
  END IF;

  IF target_folder_path IS NOT NULL THEN
    UPDATE public.files
    SET is_deleted = true, deleted_at = NOW()
    WHERE parent_folder = target_folder_path OR parent_folder LIKE target_folder_path || '/%';
  END IF;

  DELETE FROM public.folders
  WHERE id = folder_uuid OR (target_folder_path IS NOT NULL AND path LIKE target_folder_path || '/%');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_sde_locators()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.sde_chunk_locators WHERE file_id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_webhook(p_webhook_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE deleted BIGINT;
BEGIN
  DELETE FROM public.webhooks WHERE id = p_webhook_id AND user_id = auth.uid();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_keyring_secret(p_key_name text, p_plaintext text)
 RETURNS TABLE(ciphertext text, nonce text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key_id UUID;
  v_nonce  BYTEA := gen_random_bytes(24);
BEGIN
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = p_key_name;
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Missing keyring entry for %', p_key_name;
  END IF;

  RETURN QUERY
  SELECT
    encode(
      pgsodium.crypto_secretbox(convert_to(p_plaintext, 'utf8'), v_nonce, v_key_id),
      'base64'
    ),
    encode(v_nonce, 'base64');
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_notification_prefs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_notification_prefs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_notification_triggered(p_user_id uuid, p_stage integer, p_notification_type text, p_plan_type text, p_billing_period text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  already_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.subscription_notifications
    WHERE user_id = p_user_id
      AND stage = p_stage
      AND notification_type = p_notification_type
  ) INTO already_exists;

  IF already_exists THEN
    RETURN false;
  END IF;

  INSERT INTO public.subscription_notifications (
    user_id, plan_type, billing_period, stage, notification_type, delivered
  ) VALUES (
    p_user_id, p_plan_type, p_billing_period, p_stage, p_notification_type, true
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.exec_sql(sql text, params jsonb DEFAULT '[]'::jsonb)
 RETURNS json[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  result JSON[];
  query_text TEXT;
BEGIN
  -- Only allow INSERT, UPDATE, SELECT on files table for security
  IF NOT (sql ILIKE '%INSERT INTO files%' OR 
          sql ILIKE '%UPDATE files%' OR 
          sql ILIKE '%SELECT%FROM files%') THEN
    RAISE EXCEPTION 'Only file table operations are allowed';
  END IF;
  
  -- This is a simplified version - in production you'd want proper parameter binding
  -- For now, we'll just return an empty array and let the other methods handle it
  RETURN ARRAY[]::JSON[];
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_burn_after_reading(p_share_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ BEGIN UPDATE shares SET is_active = false WHERE share_id = p_share_id; END; $function$;

CREATE OR REPLACE FUNCTION public.export_pdf_annotations(p_document_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'page', page_number,
        'type', annotation_type,
        'color', color,
        'content', content,
        'position', position_data,
        'created', created_at
      ) ORDER BY page_number, created_at
    )
    FROM public.pdf_annotations
    WHERE document_id = p_document_id AND user_id = v_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fire_webhook_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  internal_key TEXT;
  webhook_url TEXT;
  user_id_val UUID;
  event_name TEXT;
  event_payload JSONB;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'files' THEN
      IF TG_OP = 'INSERT' THEN
        event_name := 'file.uploaded';
        user_id_val := NEW.user_id;
        event_payload := jsonb_build_object('file_id', NEW.id, 'file_name', NEW.name, 'file_size', NEW.size, 'file_type', NEW.type, 'folder_id', NEW.folder_id);
      ELSIF TG_OP = 'DELETE' THEN
        event_name := 'file.deleted';
        user_id_val := OLD.user_id;
        event_payload := jsonb_build_object('file_id', OLD.id, 'file_name', OLD.name);
      ELSIF TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name THEN
        event_name := 'file.renamed';
        user_id_val := NEW.user_id;
        event_payload := jsonb_build_object('file_id', NEW.id, 'old_name', OLD.name, 'new_name', NEW.name);
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'folders' THEN
      IF TG_OP = 'INSERT' THEN
        event_name := 'folder.created';
        user_id_val := NEW.user_id;
        event_payload := jsonb_build_object('folder_id', NEW.id, 'folder_name', NEW.name, 'parent_id', NEW.parent_id);
      ELSIF TG_OP = 'DELETE' THEN
        event_name := 'folder.deleted';
        user_id_val := OLD.user_id;
        event_payload := jsonb_build_object('folder_id', OLD.id, 'folder_name', OLD.name);
      ELSIF TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name THEN
        event_name := 'folder.renamed';
        user_id_val := NEW.user_id;
        event_payload := jsonb_build_object('folder_id', NEW.id, 'old_name', OLD.name, 'new_name', NEW.name);
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'shares' THEN
      IF TG_OP = 'INSERT' THEN
        event_name := 'share.created';
        user_id_val := NEW.owner_id;
        event_payload := jsonb_build_object('share_id', NEW.id, 'file_id', NEW.file_id, 'folder_id', NEW.folder_id);
      ELSIF TG_OP = 'DELETE' THEN
        event_name := 'share.deleted';
        user_id_val := OLD.owner_id;
        event_payload := jsonb_build_object('share_id', OLD.id, 'file_id', OLD.file_id, 'folder_id', OLD.folder_id);
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      RETURN NULL;
  END CASE;

  SELECT value INTO internal_key FROM public.system_config WHERE key = 'INTERNAL_WEBHOOK_KEY';

  webhook_url := current_setting('supabase_functions_url', true) || '/webhook-dispatch';

  PERFORM
    net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Internal-Key', internal_key
      ),
      body := jsonb_build_object(
        'event', event_name,
        'userId', user_id_val,
        'data', event_payload
      )
    );

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gen_random_bytes(len integer)
 RETURNS bytea
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$ SELECT extensions.gen_random_bytes(len) $function$;

CREATE OR REPLACE FUNCTION public.generate_api_key()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  key_string TEXT;
BEGIN
  -- Generate a secure random key with cb_ prefix
  -- Using gen_random_bytes from pgcrypto extension
  key_string := 'cb_' || encode(gen_random_bytes(32), 'hex');
  RETURN key_string;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_share_id()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  -- Generate a random 12-character alphanumeric string
  RETURN encode(gen_random_bytes(9), 'base64')::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_best_account_for_upload(p_user_id uuid, p_min_health_score integer DEFAULT 70)
 RETURNS TABLE(account_id uuid, github_username text, github_token text, health_score integer, current_repositories integer, rate_limit_remaining integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ga.id,
        ga.github_username,
        ga.github_token,
        ga.health_score,
        ga.current_repositories,
        ga.rate_limit_remaining
    FROM github_accounts ga
    WHERE 
        ga.user_id = p_user_id
        AND ga.is_active = true
        AND ga.health_score >= p_min_health_score
        AND ga.current_repositories < ga.max_repositories
        AND (ga.rate_limit_remaining > 100 OR ga.rate_limit_reset < NOW())
    ORDER BY 
        ga.health_score DESC,
        ga.rate_limit_remaining DESC,
        ga.current_repositories ASC
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_book_metadata(p_file_id uuid)
 RETURNS TABLE(id uuid, file_id uuid, cover_storage_path text, extracted_title text, extracted_author text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT bm.id, bm.file_id, bm.cover_storage_path, bm.extracted_title, bm.extracted_author, bm.created_at, bm.updated_at
  FROM public.book_metadata bm
  WHERE bm.file_id = p_file_id AND bm.user_id = auth.uid()
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_collection_files(collection_id_param uuid)
 RETURNS TABLE(id uuid, name text, type text, size bigint, created_at timestamp with time zone, updated_at timestamp with time zone, encrypted boolean, shared boolean, storage_path text, tags text[], parent_folder text, added_to_collection_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify collection belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = collection_id_param AND user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Collection not found or access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.type,
    f.size,
    f.created_at,
    f.updated_at,
    f.encrypted,
    f.shared,
    f.storage_path,
    f.tags,
    f.parent_folder,
    cf.added_at as added_to_collection_at
  FROM files f
  JOIN collections_files cf ON f.id = cf.file_id
  WHERE cf.collection_id = collection_id_param 
    AND cf.user_id = current_user_id
    AND f.user_id = current_user_id
  ORDER BY cf.added_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_credit_usage_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_requests', (SELECT COUNT(*) FROM api_credit_log WHERE created_at >= now() - (p_days || ' days')::interval),
    'total_credits_deducted', (SELECT COALESCE(SUM(credits_deducted), 0) FROM api_credit_log WHERE created_at >= now() - (p_days || ' days')::interval),
    'top_operations', (SELECT jsonb_agg(t) FROM (
      SELECT operation, COUNT(*) as count, SUM(credits_deducted) as total_credits
      FROM api_credit_log
      WHERE created_at >= now() - (p_days || ' days')::interval
      GROUP BY operation ORDER BY COUNT(*) DESC LIMIT 10
    ) t),
    'daily_usage', (SELECT jsonb_agg(t) FROM (
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(credits_deducted) as credits
      FROM api_credit_log
      WHERE created_at >= now() - (p_days || ' days')::interval
      GROUP BY DATE(created_at) ORDER BY date DESC
    ) t),
    'users_with_credits', (SELECT COUNT(*) FROM api_credits)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_entity_notes(p_entity_id uuid, p_entity_type text)
 RETURNS SETOF entity_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.entity_notes
  WHERE entity_id = p_entity_id
    AND entity_type = p_entity_type
    AND user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_file_for_share(share_id_param text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_file_id uuid;
  result jsonb;
BEGIN
  SELECT s.file_id INTO v_file_id
  FROM public.shares s
  WHERE s.share_id = share_id_param
    AND s.is_active IS NOT FALSE
    AND (s.expires_at IS NULL OR s.expires_at > NOW());

  IF v_file_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT row_to_json(f)::jsonb INTO result
  FROM public.files f
  WHERE f.id = v_file_id;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_file_request_by_slug(request_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id, 'title', title, 'description', description,
    'max_files', max_files, 'max_size_per_file', max_size_per_file,
    'allowed_types', allowed_types, 'expires_at', expires_at,
    'is_active', is_active, 'created_at', created_at, 'user_id', user_id
  ) INTO v_result
  FROM file_requests WHERE slug = request_slug AND is_active = true AND (expires_at IS NULL OR expires_at > now());
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_file_share_id(file_id_param uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result_share_id text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT share_id::text
  INTO result_share_id
  FROM public.shares
  WHERE file_id = file_id_param
    AND user_id = current_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN result_share_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_folder_share_contents(share_id_param text)
 RETURNS TABLE(file_id uuid, file_name text, file_type text, file_size bigint, file_created_at timestamp with time zone, file_updated_at timestamp with time zone, is_encrypted boolean, shared_encryption_key text, storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_folder_id uuid;
  v_folder_path text;
  v_user_id uuid;
BEGIN
  SELECT s.folder_id, f.path, f.user_id INTO v_folder_id, v_folder_path, v_user_id
  FROM public.shares s
  JOIN public.folders f ON s.folder_id = f.id
  WHERE s.share_id = share_id_param
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
    AND s.is_active IS NOT FALSE;

  IF v_folder_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fl.id::uuid,
    fl.name,
    fl.type,
    fl.size,
    fl.created_at,
    fl.updated_at,
    fl.encrypted,
    s.shared_encryption_key,
    fl.storage_path
  FROM public.files fl
  CROSS JOIN LATERAL (
    SELECT shared_encryption_key FROM public.shares WHERE share_id = share_id_param
  ) s
  WHERE fl.parent_folder = v_folder_path
    AND fl.user_id = v_user_id
    AND fl.is_deleted = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_hls_files(p_file_id uuid)
 RETURNS TABLE(quality character varying, manifest_path text, file_size bigint, duration numeric, bandwidth integer, resolution character varying, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        hf.quality,
        hf.manifest_path,
        hf.file_size,
        hf.duration,
        hf.bandwidth,
        hf.resolution,
        hf.created_at
    FROM hls_files hf
    WHERE hf.file_id = p_file_id 
      AND hf.user_id = auth.uid()
    ORDER BY hf.bandwidth DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_next_processing_job(p_worker_id character varying)
 RETURNS TABLE(job_id uuid, job_type character varying, file_id uuid, user_id uuid, parameters jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
    selected_job_id UUID;
BEGIN
    -- Select and lock next job
    SELECT id INTO selected_job_id
    FROM video_processing_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
    
    IF selected_job_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Update job status
    UPDATE video_processing_queue
    SET status = 'processing',
        worker_id = p_worker_id,
        started_at = NOW(),
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = selected_job_id;
    
    -- Return job details
    RETURN QUERY
    SELECT 
        vpq.id,
        vpq.job_type,
        vpq.file_id,
        vpq.user_id,
        vpq.parameters
    FROM video_processing_queue vpq
    WHERE vpq.id = selected_job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_optimal_node(p_user_id uuid, p_file_size integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  optimal_node_id UUID;
BEGIN
  -- Find the node with lowest utilization that has capacity
  SELECT n.id INTO optimal_node_id
  FROM nodes n
  JOIN supernodes s ON n.supernode_id = s.id
  WHERE n.is_active = true 
    AND s.is_active = true
    AND n.current_files < n.max_capacity
    AND s.health_score > 50
  ORDER BY 
    (n.current_files::float / n.max_capacity::float), -- Utilization ratio
    n.last_used ASC -- Prefer less recently used
  LIMIT 1;
  
  RETURN optimal_node_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_default_workspace(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id UUID;
  v_workspace_name TEXT;
BEGIN
  SELECT w.id
  INTO v_workspace_id
  FROM public.workspaces w
  WHERE w.user_id = p_user_id
    AND w.is_default = true
  ORDER BY w.created_at ASC
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    RETURN v_workspace_id;
  END IF;

  SELECT COALESCE(
    NULLIF(trim(p.username), ''),
    NULLIF(trim(p.display_name), ''),
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(split_part(u.email, '@', 1)), ''),
    'My Workspace'
  )
  INTO v_workspace_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id;

  v_workspace_name := LEFT(v_workspace_name, 80);

  INSERT INTO public.workspaces (user_id, name, is_default)
  VALUES (p_user_id, v_workspace_name, true)
  ON CONFLICT (user_id, name)
  DO UPDATE
    SET is_default = true,
        updated_at = now()
  RETURNING id INTO v_workspace_id;

  RETURN v_workspace_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_embed_token(p_entity_id uuid, p_entity_type text)
 RETURNS embed_tokens
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE existing_token public.embed_tokens; new_token public.embed_tokens;
BEGIN
  SELECT * INTO existing_token FROM public.embed_tokens
  WHERE entity_id = p_entity_id AND entity_type = p_entity_type AND user_id = auth.uid();
  IF existing_token IS NOT NULL THEN RETURN existing_token; END IF;
  INSERT INTO public.embed_tokens (user_id, entity_id, entity_type)
  VALUES (auth.uid(), p_entity_id, p_entity_type) RETURNING * INTO new_token;
  RETURN new_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pdf_statistics(p_document_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_annotation_count integer;
  v_bookmark_count integer;
  v_reading_time integer;
  v_last_page integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT COUNT(*) INTO v_annotation_count
  FROM public.pdf_annotations
  WHERE document_id = p_document_id AND user_id = v_user_id;

  SELECT COUNT(*) INTO v_bookmark_count
  FROM public.pdf_bookmarks
  WHERE document_id = p_document_id AND user_id = v_user_id;

  SELECT reading_time_seconds, last_page INTO v_reading_time, v_last_page
  FROM public.pdf_reading_progress
  WHERE document_id = p_document_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'annotations', COALESCE(v_annotation_count, 0),
    'bookmarks', COALESCE(v_bookmark_count, 0),
    'reading_time_seconds', COALESCE(v_reading_time, 0),
    'last_page', COALESCE(v_last_page, 1)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_notifications(p_user_id uuid)
 RETURNS TABLE(id uuid, stage integer, notification_type text, plan_type text, billing_period text, triggered_at timestamp with time zone, upsell_offer_shown boolean, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT n.id, n.stage, n.notification_type, n.plan_type, n.billing_period, n.triggered_at, n.upsell_offer_shown, n.metadata
  FROM public.subscription_notifications n
  JOIN public.user_notification_prefs p ON p.user_id = n.user_id
  WHERE n.user_id = p_user_id
    AND n.delivered = true
    AND (n.dismissed = false OR n.dismissed IS NULL)
    AND (n.snoozed_until IS NULL OR n.snoozed_until <= now())
    AND (
      (n.notification_type = 'popup' AND p.popup_enabled = true)
      OR (n.notification_type = 'banner' AND p.popup_enabled = true)
    )
  ORDER BY
    CASE n.notification_type
      WHEN 'popup' THEN 0
      WHEN 'banner' THEN 1
    END,
    n.stage DESC
  LIMIT 5;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_playback_resume(p_file_id uuid)
 RETURNS TABLE("position" numeric, duration numeric, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT pr."position", pr.duration, pr.updated_at
    FROM playback_resume pr
    WHERE pr.user_id = auth.uid() AND pr.file_id = p_file_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_file_info(file_uuid uuid)
 RETURNS TABLE(file_id uuid, file_name text, file_type text, file_size bigint, is_public boolean, shared boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    f.id as file_id,
    f.name as file_name,
    f.type as file_type,
    f.size as file_size,
    f.is_public,
    f.shared
  FROM files f
  WHERE f.id = file_uuid 
    AND (f.is_public = true OR f.shared = true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_folder_contents(folder_uuid uuid)
 RETURNS TABLE(item_id uuid, item_name text, item_type text, item_size bigint, is_folder boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return files in the folder
  RETURN QUERY
  SELECT 
    f.id as item_id,
    f.name as item_name,
    f.type as item_type,
    f.size as item_size,
    false as is_folder,
    f.created_at
  FROM files f
  JOIN folders folder ON folder.path = f.parent_folder
  WHERE folder.id = folder_uuid 
    AND folder.is_public = true;
    
  -- Return subfolders
  RETURN QUERY  
  SELECT
    sf.id as item_id,
    sf.name as item_name,
    'folder' as item_type,
    0::bigint as item_size,
    true as is_folder,
    sf.created_at
  FROM folders sf
  JOIN folders parent ON parent.path = sf.parent_folder
  WHERE parent.id = folder_uuid
    AND parent.is_public = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_progress(p_file_id uuid)
 RETURNS TABLE(progress integer, current_page integer, total_pages integer, last_read_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT rp.progress, rp.current_page, rp.total_pages, rp.last_read_at
  FROM public.reading_progress rp
  WHERE rp.file_id = p_file_id AND rp.user_id = auth.uid()
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_remote_progress(p_book_key text)
 RETURNS TABLE(progress integer, current_page integer, total_pages integer, last_read_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT rp.progress, rp.current_page, rp.total_pages, rp.last_read_at
  FROM public.remote_reading_progress rp
  WHERE rp.book_key = p_book_key AND rp.user_id = auth.uid()
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets WHERE name = secret_name;
  RETURN secret_value;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_shared_file_info(share_id_param text)
 RETURNS TABLE(file_id uuid, file_name text, file_type text, file_size bigint, file_created_at timestamp with time zone, file_updated_at timestamp with time zone, is_encrypted boolean, storage_path text, owner_id uuid, share_created_at timestamp with time zone, share_expires_at timestamp with time zone, share_download_limit integer, share_download_count integer, share_view_only boolean, share_require_email boolean, shared_encryption_key text, is_folder_share boolean, folder_id uuid, folder_name text, is_byok boolean, file_tags text[], file_encryption_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_folder_id uuid;
  v_is_folder boolean;
BEGIN
  SELECT s.folder_id INTO v_folder_id
  FROM public.shares s
  WHERE s.share_id = share_id_param;

  v_is_folder := v_folder_id IS NOT NULL;

  IF v_is_folder THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      f.name,
      'inode/directory',
      0::bigint,
      f.created_at,
      f.updated_at,
      false,
      f.path,
      f.user_id::uuid,
      s.created_at,
      s.expires_at,
      NULL::integer,
      NULL::integer,
      NULL::boolean,
      NULL::boolean,
      s.shared_encryption_key,
      true,
      s.folder_id,
      f.name,
      false,
      NULL::text[],
      NULL::text
    FROM public.shares s
    JOIN public.folders f ON s.folder_id = f.id
    WHERE s.share_id = share_id_param
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND s.is_active IS NOT FALSE;
  ELSE
    RETURN QUERY
    SELECT
      f.id::uuid,
      f.name,
      f.type,
      f.size,
      f.created_at,
      f.updated_at,
      f.encrypted,
      f.storage_path,
      f.user_id::uuid,
      s.created_at,
      s.expires_at,
      s.download_limit,
      s.download_count,
      s.view_only,
      s.require_email,
      s.shared_encryption_key,
      false,
      NULL::uuid,
      NULL::text,
      f.encryption_key IN ('sha256:byok_encrypted', 'byok_encrypted'),
      f.tags,
      f.encryption_key
    FROM public.shares s
    JOIN public.files f ON s.file_id = f.id
    WHERE s.share_id = share_id_param
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND s.is_active IS NOT FALSE;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_subscriptions_needing_notifications()
 RETURNS TABLE(user_id uuid, email text, full_name text, plan_type text, billing_period text, subscription_starts_at timestamp with time zone, subscription_expires_at timestamp with time zone, days_remaining integer, days_since_expiry integer, current_stage integer, max_stage integer, total_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH active_subs AS (
    SELECT
      p.id AS user_id,
      u.email::text AS email,
      p.full_name,
      p.tier AS plan_type,
      'monthly'::text AS billing_period,
      p.subscription_starts_at,
      p.subscription_expires_at,
      CASE
        WHEN p.subscription_expires_at IS NOT NULL AND p.subscription_expires_at > now()
          THEN EXTRACT(DAY FROM p.subscription_expires_at - now())::integer
        ELSE 0
      END AS days_remaining,
      CASE
        WHEN p.subscription_expires_at IS NOT NULL AND p.subscription_expires_at <= now()
          THEN EXTRACT(DAY FROM now() - p.subscription_expires_at)::integer
        ELSE 0
      END AS days_since_expiry
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.is_premium = true
      AND p.subscription_expires_at IS NOT NULL
  )
  SELECT
    s.user_id,
    s.email,
    s.full_name,
    s.plan_type,
    s.billing_period,
    s.subscription_starts_at,
    s.subscription_expires_at,
    s.days_remaining,
    s.days_since_expiry,
    CASE s.billing_period
      WHEN 'weekly' THEN
        CASE
          WHEN s.days_remaining > 2 THEN 0
          WHEN s.days_remaining = 2 THEN 1
          WHEN s.days_remaining = 1 THEN 2
          WHEN s.days_remaining = 0 AND s.subscription_expires_at > now() THEN 3
          WHEN s.days_since_expiry = 0 THEN 4
          WHEN s.days_since_expiry = 1 THEN 5
          WHEN s.days_since_expiry <= 3 THEN 6
          ELSE 99
        END
      WHEN 'monthly' THEN
        CASE
          WHEN s.days_remaining > 9 THEN 0
          WHEN s.days_remaining > 5 THEN 1
          WHEN s.days_remaining > 2 THEN 2
          WHEN s.days_remaining > 1 THEN 3
          WHEN s.days_remaining = 1 THEN 4
          WHEN s.days_remaining = 0 AND s.subscription_expires_at > now() THEN 4
          WHEN s.days_since_expiry = 0 THEN 5
          WHEN s.days_since_expiry <= 1 THEN 6
          WHEN s.days_since_expiry <= 5 THEN 7
          WHEN s.days_since_expiry <= 10 THEN 8
          ELSE 99
        END
      WHEN 'annual' THEN
        CASE
          WHEN s.days_remaining > 30 THEN 0
          WHEN s.days_remaining > 15 THEN 1
          WHEN s.days_remaining > 7 THEN 2
          WHEN s.days_remaining > 3 THEN 3
          WHEN s.days_remaining > 1 THEN 4
          WHEN s.days_remaining = 1 THEN 5
          WHEN s.days_remaining = 0 AND s.subscription_expires_at > now() THEN 5
          WHEN s.days_since_expiry = 0 THEN 6
          WHEN s.days_since_expiry <= 1 THEN 7
          WHEN s.days_since_expiry <= 7 THEN 8
          WHEN s.days_since_expiry <= 14 THEN 9
          WHEN s.days_since_expiry <= 30 THEN 10
          ELSE 99
        END
    END AS current_stage,
    CASE s.billing_period
      WHEN 'weekly' THEN 6
      WHEN 'monthly' THEN 8
      WHEN 'annual' THEN 10
    END AS max_stage,
    CASE s.billing_period
      WHEN 'weekly' THEN 7
      WHEN 'monthly' THEN 30
      WHEN 'annual' THEN 365
    END AS total_days
  FROM active_subs s
  WHERE s.subscription_expires_at <= now() + interval '90 days'
    OR s.days_since_expiry <= 30;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_transcode_job_status(p_file_id uuid)
 RETURNS TABLE(job_id uuid, status character varying, progress integer, output_qualities text[], error text, estimated_time integer, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        tj.id,
        tj.status,
        tj.progress,
        tj.output_qualities,
        tj.error,
        tj.estimated_time,
        tj.created_at,
        tj.updated_at
    FROM transcode_jobs tj
    WHERE tj.file_id = p_file_id 
      AND tj.user_id = auth.uid()
    ORDER BY tj.created_at DESC
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_api_token_usage_today(user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  usage_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_id THEN
    RETURN -1;
  END IF;

  SELECT COUNT(*) INTO usage_count
  FROM api_request_logs
  WHERE user_id = get_user_api_token_usage_today.user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + interval '1 day';

  RETURN COALESCE(usage_count, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_collections()
 RETURNS TABLE(id uuid, name text, color text, icon text, description text, created_at timestamp with time zone, updated_at timestamp with time zone, file_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.color,
    c.icon,
    c.description,
    c.created_at,
    c.updated_at,
    COALESCE(cf.file_count, 0) as file_count
  FROM collections c
  LEFT JOIN (
    SELECT 
      collection_id,
      COUNT(*) as file_count
    FROM collections_files
    WHERE user_id = current_user_id
    GROUP BY collection_id
  ) cf ON c.id = cf.collection_id
  WHERE c.user_id = current_user_id
  ORDER BY c.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_encryption_version(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE((settings->>'key_version')::integer, 1)
  FROM user_encryption_settings
  WHERE user_id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_file_request_limit(user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier text;
  file_req_limit int;
  result jsonb;
BEGIN
  SELECT COALESCE(tier, 'free') INTO user_tier FROM profiles WHERE id = user_id;
  SELECT COALESCE(file_requests, 0) INTO file_req_limit FROM plan_limits WHERE tier = user_tier;

  result := jsonb_build_object(
    'tier', user_tier,
    'file_requests', file_req_limit
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_key_selection_preference(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(settings->>'key_selection_preference', 'always_prompt')
  FROM user_encryption_settings
  WHERE user_id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_plan_limits(user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier text;
  limits record;
  uploads_used integer;
  result jsonb;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;

  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date)
  VALUES (get_user_plan_limits.user_id, 1000, 1000, CURRENT_DATE, 0, CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT api_credits_pkey DO NOTHING;

  UPDATE api_credits SET
    uploads_used_today = 0,
    uploads_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE api_credits.user_id = get_user_plan_limits.user_id
    AND api_credits.uploads_reset_date < CURRENT_DATE;

  SELECT uploads_used_today INTO uploads_used
  FROM api_credits WHERE api_credits.user_id = get_user_plan_limits.user_id;

  result := jsonb_build_object(
    'tier', user_tier,
    'concurrent_uploads', limits.concurrent_uploads,
    'concurrent_downloads', limits.concurrent_downloads,
    'max_file_size_bytes', limits.max_file_size_bytes,
    'api_tokens_per_day', limits.api_tokens_per_day,
    'queue_priority', limits.queue_priority,
    'early_feature_access', limits.early_feature_access,
    'sites_always_active', limits.sites_always_active,
    'custom_domains', limits.custom_domains,
    'auto_archive_days', limits.auto_archive_days,
    'daily_upload_limit', limits.daily_upload_limit,
    'uploads_used_today', COALESCE(uploads_used, 0)
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_storage_preferences(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  prefs JSONB;
BEGIN
  SELECT jsonb_build_object(
    'fallback_mode', COALESCE(usp.fallback_mode, 'squidcloud_then_mine'),
    'upload_distribution', COALESCE(usp.upload_distribution, 'round_robin'),
    'allow_public_sharing', COALESCE(usp.allow_public_sharing, false),
    'max_buckets', COALESCE(usp.max_buckets, 20),
    'active_bucket_count', (SELECT COUNT(*) FROM public.storage_providers WHERE user_id = p_user_id AND is_enabled = true)
  ) INTO prefs
  FROM public.user_storage_preferences usp
  WHERE usp.user_id = p_user_id;

  IF prefs IS NULL THEN
    prefs := jsonb_build_object(
      'fallback_mode', 'squidcloud_then_mine',
      'upload_distribution', 'round_robin',
      'allow_public_sharing', false,
      'max_buckets', 20,
      'active_bucket_count', (SELECT COUNT(*) FROM public.storage_providers WHERE user_id = p_user_id AND is_enabled = true)
    );
  END IF;

  RETURN prefs;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_storage_provider_count(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.storage_providers WHERE user_id = p_user_id AND is_enabled = true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_webhooks()
 RETURNS SETOF webhooks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM public.webhooks WHERE user_id = auth.uid() ORDER BY created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_users_with_expiring_subscriptions(within_days integer DEFAULT 7)
 RETURNS TABLE(user_id uuid, email text, tier text, subscription_expires_at timestamp with time zone, days_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.tier,
    p.subscription_expires_at,
    GREATEST(0, EXTRACT(DAY FROM p.subscription_expires_at - now())::integer)::integer
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.subscription_expires_at IS NOT NULL
    AND p.subscription_expires_at > now()
    AND p.subscription_expires_at <= now() + (within_days || ' days')::interval
    AND p.is_premium = true
  ORDER BY p.subscription_expires_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_users_with_recently_expired_subscriptions()
 RETURNS TABLE(user_id uuid, email text, tier text, subscription_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.tier,
    p.subscription_expires_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.subscription_expires_at IS NOT NULL
    AND p.subscription_expires_at BETWEEN now() - interval '24 hours' AND now()
    AND p.is_premium = true
  ORDER BY p.subscription_expires_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_webhook_deliveries(p_limit integer DEFAULT 50, p_status text DEFAULT NULL::text)
 RETURNS SETOF webhook_events_log
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM public.webhook_events_log
  WHERE user_id = auth.uid()
    AND (p_status IS NULL OR status = p_status)
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id uuid, p_user_id uuid)
 RETURNS workspace_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN w.user_id = p_user_id THEN 'owner'::public.workspace_role
    ELSE wm.role
  END
  FROM public.workspaces w
  LEFT JOIN public.workspace_members wm
    ON wm.workspace_id = w.id
    AND wm.user_id = p_user_id
  WHERE w.id = p_workspace_id;
$function$;

CREATE OR REPLACE FUNCTION public.grant_pin_operation_authorization(operation_type text, ttl_seconds integer DEFAULT 120)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.pin_operation_authorizations (user_id, operation_type, authorized_until)
  VALUES (current_user_id, operation_type, NOW() + make_interval(secs => GREATEST(1, ttl_seconds)));

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_extension_approval_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  -- Only track if approval status changed
  IF OLD.approval IS DISTINCT FROM NEW.approval THEN
    INSERT INTO extension_approval_history (
      extension_id,
      admin_id,
      previous_status,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.approval,
      NEW.approval,
      NEW.approval_notes
    );
    
    -- Set approved_at timestamp if approved
    IF NEW.approval = 'approved' AND OLD.approval != 'approved' THEN
      NEW.approved_at = NOW();
      NEW.approved_by = auth.uid();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace_id uuid, p_user_id uuid, p_min_role workspace_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = p_workspace_id
        AND wm.user_id = p_user_id
        AND public.workspace_role_rank(wm.role) >= public.workspace_role_rank(p_min_role)
    ) THEN true
    WHEN EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = p_workspace_id
        AND w.user_id = p_user_id
    ) THEN true
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION public.hash_file_encryption_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- If encryption_key is provided in plaintext, replace it with salted SHA-256 hash and store salt
  IF NEW.encryption_key IS NOT NULL AND length(trim(NEW.encryption_key)) > 0 THEN
    -- If it already looks hashed (prefixed), skip re-hashing
    IF position('sha256:' in NEW.encryption_key) = 1 THEN
      RETURN NEW;
    END IF;

    -- Generate salt using pgcrypto (extensions schema)
    NEW.encryption_key_salt := encode(extensions.gen_random_bytes(16), 'hex');

    -- Hash = sha256(encryption_key || salt), converting text to bytea via convert_to
    NEW.encryption_key := 'sha256:' || encode(
      extensions.digest(
        convert_to(NEW.encryption_key || NEW.encryption_key_salt, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

    NEW.encrypted := COALESCE(NEW.encrypted, true);
  ELSE
    -- Ensure no stray cleartext value remains
    NEW.encryption_key := NULL;
    NEW.encryption_key_salt := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_embed_view(p_token_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_count BIGINT;
BEGIN
  UPDATE public.embed_tokens SET view_count = view_count + 1, updated_at = now()
  WHERE id = p_token_id AND is_active = true RETURNING view_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_pin_attempts(user_id_param uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  new_attempts INTEGER;
BEGIN
  UPDATE user_security_settings
  SET pin_attempts = pin_attempts + 1
  WHERE user_id = user_id_param
  RETURNING pin_attempts INTO new_attempts;
  
  RETURN COALESCE(new_attempts, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_provider_storage_used(p_provider_id uuid, p_bytes bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.storage_providers
  SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_bytes),
      updated_at = now()
  WHERE id = p_provider_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_share_download(p_share_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE shares SET download_count = COALESCE(download_count, 0) + 1 WHERE share_id = p_share_id;
  PERFORM public.log_share_event(p_share_id, 'download');
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_share_view(p_share_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE shares SET share_views = COALESCE(share_views, 0) + 1 WHERE share_id = p_share_id;
  PERFORM public.log_share_event(p_share_id, 'view');
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false)
$function$;

CREATE OR REPLACE FUNCTION public.is_archive_file(file_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN file_name ~* '\.(zip|rar|7z|tar|gz|tgz|bz2|tar\.gz|tar\.bz2)$';
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_premium_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select exists (select 1 from profiles where id = auth.uid() and is_premium) $function$;

CREATE OR REPLACE FUNCTION public.kza_block_admin_ban()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.is_active = true AND NEW.user_id IS NOT NULL THEN
    IF public.kza_is_admin_user(NEW.user_id) THEN
      RAISE NOTICE 'KZA: Blocked auto-ban attempt on admin user %', NEW.user_id;
      RETURN NULL; -- Cancel the insert/update silently
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_check_country_block(p_country text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_rule RECORD;
BEGIN
  SELECT action, reason INTO v_rule
  FROM kza_geo_fence
  WHERE country_code = upper(p_country)
  LIMIT 1;

  IF v_rule IS NULL THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  RETURN jsonb_build_object(
    'blocked', v_rule.action = 'block',
    'reason', COALESCE(v_rule.reason, 'Region not supported'),
    'country', upper(p_country)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_check_country_block(p_country text, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ DECLARE v_rule RECORD; v_blocked BOOLEAN; v_country TEXT; BEGIN v_country := NULLIF(upper(COALESCE(p_country, '')), ''); SELECT action, reason INTO v_rule FROM kza_geo_fence WHERE country_code = upper(p_country) LIMIT 1; IF v_rule IS NULL THEN v_blocked := false; ELSE v_blocked := (v_rule.action = 'block'); END IF; IF p_ip IS NOT NULL AND p_ip <> '' THEN INSERT INTO kza_geo_events (ip_address, country_code, verdict) VALUES (p_ip, v_country, CASE WHEN v_blocked THEN 'blocked' ELSE 'allowed' END); END IF; IF v_rule IS NULL THEN RETURN jsonb_build_object('blocked', false); END IF; RETURN jsonb_build_object('blocked', v_blocked, 'reason', COALESCE(v_rule.reason, 'Region not supported'), 'country', upper(p_country)); END; $function$;

CREATE OR REPLACE FUNCTION public.kza_check_geo_fence(p_country text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rule record;
BEGIN
  SELECT * INTO v_rule FROM kza_geo_fence
    WHERE country_code = upper(p_country) ORDER BY updated_at DESC LIMIT 1;

  IF v_rule IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_rule.action = 'allow',
    'shadow', v_rule.severity = 'shadow',
    'reason', v_rule.reason
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_check_geo_velocity(p_user_id uuid, p_ip_address text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_max_speed_kmh double precision DEFAULT 900)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_last_event kza_geo_events; v_distance_km DOUBLE PRECISION;
  v_time_diff_hours DOUBLE PRECISION; v_speed_kmh DOUBLE PRECISION; v_score INTEGER;
BEGIN
  SELECT * INTO v_last_event FROM kza_geo_events WHERE user_id = p_user_id AND latitude IS NOT NULL
    AND longitude IS NOT NULL AND occurred_at > now() - interval '24 hours' ORDER BY occurred_at DESC LIMIT 1;
  IF v_last_event.id IS NULL OR p_latitude IS NULL OR p_longitude IS NULL THEN
    INSERT INTO kza_geo_events (user_id, ip_address, latitude, longitude) VALUES (p_user_id, p_ip_address, p_latitude, p_longitude);
    RETURN jsonb_build_object('score', 100, 'alert', false);
  END IF;
  v_distance_km := 6371 * 2 * asin(sqrt(power(sin(radians(p_latitude - v_last_event.latitude) / 2), 2)
    + cos(radians(v_last_event.latitude)) * cos(radians(p_latitude)) * power(sin(radians(p_longitude - v_last_event.longitude) / 2), 2)));
  v_time_diff_hours := EXTRACT(EPOCH FROM now() - v_last_event.occurred_at) / 3600;
  v_speed_kmh := CASE WHEN v_time_diff_hours < 0.01 THEN 0 ELSE v_distance_km / v_time_diff_hours END;
  v_score := CASE WHEN v_speed_kmh > p_max_speed_kmh THEN GREATEST(0, 100 - ((v_speed_kmh - p_max_speed_kmh) / 100)::INTEGER * 10) ELSE 100 END;
  INSERT INTO kza_geo_events (user_id, ip_address, latitude, longitude) VALUES (p_user_id, p_ip_address, p_latitude, p_longitude);
  RETURN jsonb_build_object('score', v_score, 'speed_kmh', round(v_speed_kmh::numeric, 1),
    'distance_km', round(v_distance_km::numeric, 1), 'time_hours', round(v_time_diff_hours::numeric, 2),
    'alert', v_score < 30, 'previous_location', jsonb_build_object('lat', v_last_event.latitude, 'lng', v_last_event.longitude, 'time', v_last_event.occurred_at));
END; $function$;

CREATE OR REPLACE FUNCTION public.kza_check_ip_rate_limit(p_ip_hash text, p_function_id text, p_max_rps integer DEFAULT 10, p_burst_size integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_window TIMESTAMPTZ;
  v_bucket kza_ip_rate_buckets;
  v_tokens_available INTEGER;
  v_now TIMESTAMPTZ := now();
  v_elapsed_seconds DOUBLE PRECISION;
  v_tokens_to_add INTEGER;
BEGIN
  IF p_ip_hash IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_window := date_trunc('second', v_now);

  INSERT INTO kza_ip_rate_buckets (ip_hash, function_id, window_start, tokens_remaining)
  VALUES (p_ip_hash, p_function_id, v_window, p_burst_size)
  ON CONFLICT (ip_hash, function_id, window_start)
  DO NOTHING
  RETURNING * INTO v_bucket;

  IF NOT FOUND THEN
    SELECT * INTO v_bucket
    FROM kza_ip_rate_buckets
    WHERE ip_hash = p_ip_hash
      AND function_id = p_function_id
      AND window_start = v_window;
  END IF;

  UPDATE kza_ip_rate_buckets
  SET request_count = request_count + 1
  WHERE id = v_bucket.id;

  v_elapsed_seconds := EXTRACT(EPOCH FROM v_now - v_bucket.tokens_refilled_at);
  v_tokens_to_add := GREATEST(0, floor(v_elapsed_seconds * p_max_rps)::INTEGER);
  v_tokens_available := LEAST(p_burst_size, v_bucket.tokens_remaining + v_tokens_to_add);

  IF v_tokens_available <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', ceil(1.0 / p_max_rps * 1000)::INTEGER,
      'tokens_remaining', 0
    );
  END IF;

  UPDATE kza_ip_rate_buckets
  SET tokens_remaining = v_tokens_available - 1, tokens_refilled_at = v_now
  WHERE id = v_bucket.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'tokens_remaining', v_tokens_available - 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_check_rate_limit(p_user_id uuid, p_function_id text, p_max_rps integer DEFAULT 10, p_burst_size integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_window TIMESTAMPTZ; v_bucket kza_rate_buckets; v_tokens_available INTEGER;
  v_now TIMESTAMPTZ := now(); v_elapsed_seconds DOUBLE PRECISION; v_tokens_to_add INTEGER;
BEGIN
  v_window := date_trunc('second', v_now);
  INSERT INTO kza_rate_buckets (user_id, function_id, window_start, tokens_remaining)
  VALUES (p_user_id, p_function_id, v_window, p_burst_size)
  ON CONFLICT (user_id, function_id, window_start) DO UPDATE SET request_count = kza_rate_buckets.request_count + 1
  RETURNING * INTO v_bucket;
  UPDATE kza_rate_buckets SET request_count = request_count + 1 WHERE id = v_bucket.id;
  v_elapsed_seconds := EXTRACT(EPOCH FROM v_now - v_bucket.tokens_refilled_at);
  v_tokens_to_add := GREATEST(0, floor(v_elapsed_seconds * p_max_rps)::INTEGER);
  v_tokens_available := LEAST(p_burst_size, v_bucket.tokens_remaining + v_tokens_to_add);
  IF v_tokens_available <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'retry_after', ceil(1.0 / p_max_rps * 1000)::INTEGER, 'tokens_remaining', 0);
  END IF;
  UPDATE kza_rate_buckets SET tokens_remaining = v_tokens_available - 1, tokens_refilled_at = v_now WHERE id = v_bucket.id;
  RETURN jsonb_build_object('allowed', true, 'tokens_remaining', v_tokens_available - 1, 'request_count', v_bucket.request_count + 1);
END; $function$;

CREATE OR REPLACE FUNCTION public.kza_cleanup_hardening_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM kza_rate_buckets WHERE window_start < now() - interval '1 hour';
  DELETE FROM kza_geo_events WHERE occurred_at < now() - interval '7 days';
  UPDATE kza_cip_versions SET deprecated_at = now()
  WHERE is_current = false AND deprecated_at IS NULL AND released_at < now() - interval '90 days';
END; $function$;

CREATE OR REPLACE FUNCTION public.kza_heartbeat_check()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active_functions INT;
  v_expired_sessions INT;
  v_keyring_ok BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT count(*) INTO v_active_functions FROM kza_prel_registry WHERE is_active = true;
  SELECT count(*) INTO v_expired_sessions FROM kza_prel_sessions
    WHERE consumed_at IS NULL AND expires_at < now();

  SELECT EXISTS (
    SELECT 1 FROM security_keyring WHERE name IN ('kza_prel_hmac_v2', 'kza_veil_master', 'kza_prel_f2fa_master')
    HAVING count(*) = 3
  ) INTO v_keyring_ok;

  DELETE FROM kza_prel_sessions
    WHERE expires_at < now() AND consumed_at IS NOT NULL;
  DELETE FROM kza_rate_buckets WHERE window_start < now() - interval '1 hour';
  DELETE FROM kza_ip_rate_buckets WHERE window_start < now() - interval '1 hour';
  DELETE FROM kza_geo_events WHERE occurred_at < now() - interval '7 days';

  INSERT INTO kza_health_checks (check_name, status, details) VALUES
    ('registry', CASE WHEN v_active_functions > 0 THEN 'PASS' ELSE 'FAIL' END,
       jsonb_build_object('active_functions', v_active_functions)),
    ('session_pressure', CASE WHEN v_expired_sessions > 1000 THEN 'WARN' ELSE 'PASS' END,
       jsonb_build_object('expired_unconsumed', v_expired_sessions)),
    ('keyring', CASE WHEN v_keyring_ok THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('keys', 'kza_prel_hmac_v2,kza_veil_master,kza_prel_f2fa_master'));

  v_result := jsonb_build_object(
    'ok', v_active_functions > 0 AND v_keyring_ok,
    'active_functions', v_active_functions,
    'expired_unconsumed_sessions', v_expired_sessions,
    'keyring_ok', v_keyring_ok
  );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_is_admin_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = p_user_id LIMIT 1),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.kza_prel_clean_expired_sessions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.kza_prel_sessions WHERE consumed_at IS NOT NULL AND consumed_at < now() - interval '24 hours';
  DELETE FROM public.kza_prel_sessions WHERE consumed_at IS NULL AND expires_at < now() - interval '1 hour' AND (NOT is_long_op OR (long_op_expires_at IS NOT NULL AND long_op_expires_at < now() - interval '1 hour'));
  DELETE FROM public.kza_prel_f2fa_seeds WHERE created_at < now() - interval '7 days';
END; $function$;

CREATE OR REPLACE FUNCTION public.kza_prel_generate_f2fa_seed(p_function_id text, p_session_nonce text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_user_id UUID; v_key_id UUID; v_day_seed TEXT; v_seed_derived TEXT; v_nonce BYTEA; v_encrypted BYTEA;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'kza_prel_f2fa_master' ORDER BY id DESC LIMIT 1;
  v_day_seed := v_user_id::TEXT || '_' || p_function_id || '_' || to_char(now(), 'YYYYMMDD');
  v_nonce := pgsodium.crypto_aead_det_noncegen();
  v_encrypted := pgsodium.crypto_aead_det_encrypt(message := convert_to(v_day_seed, 'UTF8'), additional := convert_to(p_function_id, 'UTF8'), nonce := v_nonce, key_id := v_key_id);
  v_seed_derived := encode(v_nonce, 'hex') || ':' || encode(v_encrypted, 'hex');
  INSERT INTO public.kza_prel_f2fa_seeds (user_id, function_id, day_seed, session_nonce, seed_derived) VALUES (v_user_id, p_function_id, v_day_seed, p_session_nonce, v_seed_derived);
  RETURN v_seed_derived;
END; $function$;

CREATE OR REPLACE FUNCTION public.kza_prel_generate_f2fa_seed(p_user_id uuid, p_function_id text, p_session_nonce text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pgsodium'
AS $function$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_day_seed TEXT;
  v_seed_derived TEXT;
  v_role TEXT;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_F2FA_NOT_OWNER';
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_prel_f2fa_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'F2FA master key not found';
  END IF;

  v_day_seed := to_char(now(), 'YYYY-MM-DD');
  v_seed_derived := encode(
    pgsodium.crypto_auth(
      convert_to(p_user_id || p_function_id || v_day_seed, 'utf8'),
      v_key_id,
      v_key_ctx
    ),
    'hex'
  );

  INSERT INTO public.kza_prel_f2fa_seeds
    (user_id, function_id, day_seed, session_nonce, seed_derived)
  VALUES
    (p_user_id, p_function_id, v_day_seed, p_session_nonce, v_seed_derived)
  ON CONFLICT DO NOTHING;

  RETURN v_seed_derived;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_prel_hmac_verify(p_function_id text, p_ts text, p_method text, p_path text, p_user_id text, p_signature text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgsodium'
AS $function$
DECLARE
  v_key_name TEXT;
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_message TEXT;
BEGIN
  SELECT key_name INTO v_key_name
  FROM public.kza_prel_hmac_keys
  WHERE function_id = p_function_id AND is_active = true
  LIMIT 1;

  IF v_key_name IS NULL THEN
    RETURN false;
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = v_key_name;

  IF v_key_id IS NULL THEN
    RETURN false;
  END IF;

  v_message := p_ts || ':' || p_method || ':' || p_path || ':' || p_user_id;

  BEGIN
    PERFORM pgsodium.crypto_auth_verify(
      decode(p_signature, 'hex'),
      convert_to(v_message, 'utf8'),
      v_key_id,
      v_key_ctx
    );
    RETURN true;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN false;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_prel_rotate_hmac_key(p_function_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_name TEXT;
BEGIN
  v_new_name := 'kza_hmac_' || p_function_id || '_' || to_char(now(), 'YYYYMMDDHH24MISS');
  INSERT INTO public.security_keyring (name, key_id)
  VALUES (v_new_name, (SELECT (pgsodium.create_key()).id));

  UPDATE public.kza_prel_hmac_keys
  SET is_active = false, rotated_at = now()
  WHERE function_id = p_function_id;

  INSERT INTO public.kza_prel_hmac_keys (function_id, key_name)
  VALUES (p_function_id, v_new_name)
  ON CONFLICT (function_id) DO UPDATE SET key_name = v_new_name, is_active = true, rotated_at = now();

  RETURN v_new_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_prel_sign_token(p_function_id text, p_payload text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pgsodium'
AS $function$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_nonce BYTEA := gen_random_bytes(24);
  v_ciphertext BYTEA;
BEGIN
  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_prel_hmac_v2';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'PREL v2 key not found';
  END IF;

  v_ciphertext := pgsodium.crypto_secretbox(
    convert_to(p_payload, 'utf8'),
    v_nonce,
    v_key_id,
    v_key_ctx
  );

  RETURN 'v2.' || 'kza_prel_hmac_v2' || '.' || encode(v_nonce, 'hex') || '.' || encode(v_ciphertext, 'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_prel_verify_token(p_token text, p_function_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgsodium'
AS $function$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_nonce BYTEA;
  v_ciphertext BYTEA;
  v_parts TEXT[];
  v_plain BYTEA;
BEGIN
  v_parts := string_to_array(p_token, '.');
  IF array_length(v_parts, 1) != 4 THEN
    RETURN NULL;
  END IF;

  IF v_parts[1] != 'v2' THEN
    RETURN NULL;
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = v_parts[2];

  IF v_key_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_nonce := decode(v_parts[3], 'hex');
  v_ciphertext := decode(v_parts[4], 'hex');

  v_plain := pgsodium.crypto_secretbox_open(v_ciphertext, v_nonce, v_key_id, v_key_ctx);
  RETURN convert_from(v_plain, 'utf8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_validate_cip_version(p_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cip kza_cip_versions;
BEGIN
  SELECT * INTO v_cip
  FROM kza_cip_versions
  WHERE version = p_version
    AND (deprecated_at IS NULL OR deprecated_at > now());

  IF v_cip.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'CIP version unknown or deprecated');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'is_current', v_cip.is_current,
    'min_score', v_cip.min_score,
    'entropy_required', v_cip.entropy_required,
    'timing_min_ms', v_cip.timing_min_ms,
    'timing_max_ms', v_cip.timing_max_ms,
    'pow_required', v_cip.pow_required,
    'pow_bits', v_cip.pow_bits
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_veil_decrypt_snapshot(p_ciphertext text, p_nonce text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgsodium'
AS $function$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_plain BYTEA;
BEGIN
  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_veil_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  v_plain := pgsodium.crypto_secretbox_open(
    decode(p_ciphertext, 'hex'),
    decode(p_nonce, 'hex'),
    v_key_id,
    v_key_ctx
  );
  RETURN v_plain::text::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_veil_delete_profile(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_NOT_OWNER';
  END IF;

  DELETE FROM public.kza_threat_events      WHERE user_id = p_user_id;
  DELETE FROM public.kza_user_profiles      WHERE user_id = p_user_id;
  DELETE FROM public.kza_prel_sessions      WHERE user_id = p_user_id;
  DELETE FROM public.kza_prel_f2fa_seeds    WHERE user_id = p_user_id;
  DELETE FROM public.kza_geo_events         WHERE user_id = p_user_id;
  DELETE FROM public.kza_rate_buckets       WHERE user_id = p_user_id;
  DELETE FROM public.kza_honeypot_hits      WHERE user_id = p_user_id;
  DELETE FROM public.kza_linked_accounts    WHERE primary_user_id = p_user_id OR linked_user_id = p_user_id;

  UPDATE public.kza_admin_incidents
  SET attacker_profile =
      CASE WHEN attacker_profile ? 'user_id' THEN
        jsonb_set(attacker_profile, '{user_id}', to_jsonb('<' || p_user_id::text || '>'))
      ELSE attacker_profile END,
      linked_accounts = '[]'::jsonb
  WHERE attacker_profile ? 'user_id'
     OR (linked_accounts IS NOT NULL AND linked_accounts @> jsonb_build_array(p_user_id::text));

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_veil_encrypt_snapshot(p_payload jsonb)
 RETURNS TABLE(ciphertext text, nonce text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pgsodium'
AS $function$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_nonce BYTEA := gen_random_bytes(24);
BEGIN
  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_veil_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  RETURN QUERY SELECT
    encode(pgsodium.crypto_secretbox(convert_to(p_payload::text, 'utf8'), v_nonce, v_key_id, v_key_ctx), 'hex'),
    encode(v_nonce, 'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_veil_export_profile(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_result JSONB;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_NOT_OWNER';
  END IF;

  SELECT jsonb_build_object(
    'profile', CASE WHEN p.user_id IS NOT NULL THEN jsonb_build_object(
      'total_requests', p.total_requests,
      'typical_countries', p.typical_countries,
      'typical_endpoints_count', coalesce(array_length(p.typical_endpoints, 1), 0),
      'typical_active_hours', p.typical_active_hours,
      'device_fingerprint_count', coalesce(jsonb_array_length(
        CASE WHEN p.typical_devices_enc IS NOT NULL THEN
          (kza_veil_decrypt_snapshot(p.typical_devices_enc, p.typical_devices_nonce) #> '{fingerprints}')
        ELSE p.typical_devices END
      ), 0),
      'threat_score', p.threat_score,
      'watchlisted', p.is_watchlisted,
      'first_seen', p.created_at,
      'last_seen', p.last_seen_at
    ) ELSE NULL END,
    'country_activity', (
      SELECT jsonb_agg(jsonb_build_object('country', c.country_code, 'last_activity', max(c.checked_at)))
      FROM kza_ip_reputation c WHERE c.ip_hash IN (
        SELECT e.ip_hash FROM kza_threat_events e WHERE e.user_id = p_user_id AND e.ip_hash IS NOT NULL
      )
    ),
    'threat_events', (
      SELECT jsonb_agg(jsonb_build_object(
        'tier', t.threat_tier, 'type', t.threat_type, 'occurred_at', t.created_at,
        'country', t.country, 'action', t.automated_action_taken
      ))
      FROM (
        SELECT threat_tier, threat_type, created_at, country, automated_action_taken
        FROM kza_threat_events t
        WHERE t.user_id = p_user_id
        ORDER BY t.created_at DESC
        LIMIT 200
      ) t
    ),
    'geo_history', (
      SELECT jsonb_agg(jsonb_build_object('country', g.country_code, 'occurred_at', g.occurred_at))
      FROM (
        SELECT country_code, occurred_at
        FROM kza_geo_events g
        WHERE g.user_id = p_user_id
        ORDER BY g.occurred_at DESC
        LIMIT 100
      ) g
    ),
    'active_sessions', (
      SELECT count(*) FROM kza_prel_sessions s
      WHERE s.user_id = p_user_id AND s.consumed_at IS NULL AND s.expires_at > now()
    )
  ) INTO v_result
  FROM kza_user_profiles p WHERE p.user_id = p_user_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('profile', NULL);
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.kza_veil_ip_hash(p_ip text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgsodium'
AS $function$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
BEGIN
  IF p_ip IS NULL OR p_ip = '' OR p_ip = 'unknown' THEN
    RETURN NULL;
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_veil_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  RETURN encode(
    pgsodium.crypto_auth(convert_to(p_ip, 'utf8'), v_key_id, v_key_ctx),
    'hex'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_remote_progress(p_limit integer DEFAULT 12)
 RETURNS TABLE(book_key text, title text, author text, cover_url text, progress integer, current_page integer, total_pages integer, last_read_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT rp.book_key, rp.title, rp.author, rp.cover_url, rp.progress, rp.current_page, rp.total_pages, rp.last_read_at
  FROM public.remote_reading_progress rp
  WHERE rp.user_id = auth.uid()
  ORDER BY rp.last_read_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
END;
$function$;

CREATE OR REPLACE FUNCTION public.lock_pin(user_id_param uuid, lock_duration_minutes integer DEFAULT 5)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE user_security_settings
  SET pin_locked_until = NOW() + (lock_duration_minutes || ' minutes')::INTERVAL,
      pin_attempts = 3
  WHERE user_id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_extension_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO extension_analytics (extension_id, user_id, event_type, event_data)
    VALUES (NEW.extension_id, NEW.user_id, 'install', jsonb_build_object('installed_at', NEW.installed_at));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO extension_analytics (extension_id, user_id, event_type, event_data)
    VALUES (OLD.extension_id, OLD.user_id, 'uninstall', jsonb_build_object('uninstalled_at', NOW()));
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_key_access(p_key_type text, p_key_id text, p_action text, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.key_access_logs (
    user_id,
    key_type,
    key_id,
    action,
    success,
    error_message
  ) VALUES (
    auth.uid(),
    p_key_type,
    p_key_id,
    p_action,
    p_success,
    p_error_message
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_playback_event(p_file_id uuid, p_session_id uuid, p_event_type character varying, p_position numeric DEFAULT NULL::numeric, p_metadata jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO media_playback_logs (
        user_id, file_id, session_id, event_type, "position", 
        metadata, ip_address, user_agent
    )
    VALUES (
        auth.uid(), p_file_id, p_session_id, p_event_type, p_position,
        p_metadata, p_ip_address, p_user_agent
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_share_decrypt_attempt(p_share_id text, p_success boolean, p_failure_reason text DEFAULT NULL::text, p_ip inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO share_decrypt_logs (share_id, success, failure_reason, actor_ip, user_agent)
  VALUES (p_share_id, p_success, p_failure_reason, p_ip, p_user_agent);

  UPDATE shares
  SET decrypt_attempts = COALESCE(decrypt_attempts, 0) + 1,
      last_decrypt_attempt_at = NOW()
  WHERE share_id = p_share_id;

  -- Auto-revoke share after 10 failed attempts (brute force protection)
  IF NOT p_success THEN
    UPDATE shares
    SET is_active = false
    WHERE share_id = p_share_id
      AND COALESCE(decrypt_attempts, 0) >= 10;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_share_event(p_share_id text, p_event_type text, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_geo_country text DEFAULT NULL::text, p_device_fingerprint text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO share_audit_logs (
    share_id, event_type, ip_address, user_agent,
    geo_country, success, error_message
  ) VALUES (
    p_share_id, p_event_type,
    COALESCE(NULLIF(p_ip, ''), '0.0.0.0')::inet,
    p_user_agent, p_geo_country,
    p_success, p_error_message
  );

  IF p_event_type = 'view' AND p_success THEN
    UPDATE shares SET share_views = share_views + 1 WHERE share_id = p_share_id;
  ELSIF p_event_type = 'download' AND p_success THEN
    UPDATE shares SET download_count = download_count + 1 WHERE share_id = p_share_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_upload_stats(p_account_id uuid, p_repository_id uuid, p_user_id uuid, p_file_size bigint, p_upload_duration_ms integer, p_chunks_uploaded integer DEFAULT 1, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO upload_stats (
        account_id,
        repository_id,
        user_id,
        file_size,
        upload_duration_ms,
        chunks_uploaded,
        success,
        error_message,
        upload_metadata
    ) VALUES (
        p_account_id,
        p_repository_id,
        p_user_id,
        p_file_size,
        p_upload_duration_ms,
        p_chunks_uploaded,
        p_success,
        p_error_message,
        p_metadata
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_app_startup_auth(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE user_security_settings
  SET last_pin_auth = NOW()
  WHERE user_id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_trash(file_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.files 
    SET 
        is_deleted = true,
        deleted_at = NOW(),
        original_parent_folder = parent_folder,
        parent_folder = 'trash'
    WHERE id = file_uuid 
    AND user_id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_trash_secure(file_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  is_authorized BOOLEAN := FALSE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.assert_pin_authorized_operation('delete_files') INTO is_authorized;
  IF COALESCE(is_authorized, FALSE) = FALSE THEN
    RAISE EXCEPTION 'PIN authentication required';
  END IF;

  UPDATE public.files 
  SET 
    is_deleted = true,
    deleted_at = NOW(),
    original_parent_folder = parent_folder,
    parent_folder = 'trash'
  WHERE id = file_uuid 
    AND user_id = current_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_playback_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    PERFORM pg_notify('playback_event', json_build_object(
        'user_id', NEW.user_id,
        'file_id', NEW.file_id,
        'event_type', NEW.event_type,
        'position', NEW."position"
    )::text);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_transcode_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    PERFORM pg_notify('transcode_progress', json_build_object(
        'job_id', NEW.id,
        'file_id', NEW.file_id,
        'user_id', NEW.user_id,
        'status', NEW.status,
        'progress', NEW.progress
    )::text);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.permanently_delete_file(file_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.files WHERE id = file_uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ping_webhook(p_webhook_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_webhook public.webhooks;
  v_url TEXT;
BEGIN
  SELECT * INTO v_webhook FROM public.webhooks WHERE id = p_webhook_id AND user_id = auth.uid();
  IF v_webhook.id IS NULL THEN
    RAISE EXCEPTION 'Webhook not found or access denied';
  END IF;

  UPDATE public.webhooks
  SET last_triggered_at = now(), last_status = 'ping',
      updated_at = now()
  WHERE id = v_webhook.id;

  RETURN jsonb_build_object(
    'ok', true,
    'webhook_id', v_webhook.id,
    'url', v_webhook.url,
    'events', v_webhook.events
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.queue_transcode_job(p_file_id uuid, p_output_qualities text[], p_priority character varying DEFAULT 'normal'::character varying)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
    job_id UUID;
    file_size BIGINT;
BEGIN
    -- Get file size for estimation
    SELECT size INTO file_size
    FROM files
    WHERE id = p_file_id AND user_id = auth.uid();
    
    IF file_size IS NULL THEN
        RAISE EXCEPTION 'File not found or access denied';
    END IF;
    
    -- Create transcode job
    INSERT INTO transcode_jobs (
        file_id,
        user_id,
        output_qualities,
        priority,
        estimated_time
    )
    VALUES (
        p_file_id,
        auth.uid(),
        p_output_qualities,
        p_priority,
        GREATEST(1, CEIL((file_size / 1073741824.0) * array_length(p_output_qualities, 1))) -- 1 min per GB per quality
    )
    RETURNING id INTO job_id;
    
    -- Queue processing job
    INSERT INTO video_processing_queue (
        job_type,
        file_id,
        user_id,
        priority,
        parameters
    )
    VALUES (
        'transcode',
        p_file_id,
        auth.uid(),
        CASE p_priority
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 5
            WHEN 'low' THEN 8
            ELSE 5
        END,
        json_build_object(
            'transcode_job_id', job_id,
            'output_qualities', p_output_qualities
        )
    );
    
    RETURN job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_file_from_collection(collection_id_param uuid, file_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Remove the file from collection
  DELETE FROM collections_files 
  WHERE user_id = current_user_id 
    AND collection_id = collection_id_param 
    AND file_id = file_id_param;
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.requires_pin_auth(user_id_param uuid, operation_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  settings RECORD;
  time_since_auth INTERVAL;
  requires_auth BOOLEAN := false;
BEGIN
  SELECT * INTO settings
  FROM user_security_settings
  WHERE user_id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF NOT settings.pin_enabled THEN
    RETURN false;
  END IF;
  
  IF settings.pin_locked_until IS NOT NULL AND settings.pin_locked_until > NOW() THEN
    RETURN true;
  END IF;
  
  IF settings.last_pin_auth IS NOT NULL THEN
    time_since_auth := NOW() - settings.last_pin_auth;
  ELSE
    time_since_auth := INTERVAL '999 hours';
  END IF;
  
  CASE operation_type
    WHEN 'open_vault' THEN
      requires_auth := settings.require_pin_for_vault;
    WHEN 'create_share' THEN
      requires_auth := settings.require_pin_for_shares;
    WHEN 'revoke_share' THEN
      requires_auth := settings.require_pin_for_shares;
    WHEN 'view_security_settings' THEN
      requires_auth := settings.require_pin_for_settings;
    WHEN 'delete_files' THEN
      requires_auth := settings.require_pin_for_vault;
    WHEN 'export_data' THEN
      requires_auth := settings.require_pin_for_vault;
    WHEN 'app_startup' THEN
      requires_auth := settings.require_pin_on_startup;
      IF requires_auth AND time_since_auth <= make_interval(mins => GREATEST(COALESCE(settings.pin_timeout, 0), 0)) THEN
        requires_auth := false;
      END IF;
    ELSE
      requires_auth := true;
  END CASE;
  
  RETURN requires_auth;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_all_api_credits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE api_credits SET
    credits_remaining = CASE WHEN last_reset_date < CURRENT_DATE THEN daily_limit ELSE credits_remaining END,
    credits_used_today = CASE WHEN last_reset_date < CURRENT_DATE THEN 0 ELSE credits_used_today END,
    last_reset_date = CASE WHEN last_reset_date < CURRENT_DATE THEN CURRENT_DATE ELSE last_reset_date END,
    uploads_used_today = CASE WHEN uploads_reset_date < CURRENT_DATE THEN 0 ELSE uploads_used_today END,
    uploads_reset_date = CASE WHEN uploads_reset_date < CURRENT_DATE THEN CURRENT_DATE ELSE uploads_reset_date END,
    updated_at = now()
  WHERE last_reset_date < CURRENT_DATE OR uploads_reset_date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_pin_attempts(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE user_security_settings
  SET pin_attempts = 0,
      pin_locked_until = NULL
      -- REMOVED: last_pin_auth = NOW()
      -- This was causing PIN to be "remembered" after successful auth
  WHERE user_id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_from_trash(file_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.files 
    SET 
        is_deleted = false,
        deleted_at = NULL,
        parent_folder = original_parent_folder
    WHERE id = file_uuid 
    AND user_id = auth.uid()
    AND is_deleted = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_embed_token(p_token_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE updated BIGINT;
BEGIN
  UPDATE public.embed_tokens SET is_active = false, updated_at = now()
  WHERE id = p_token_id AND user_id = auth.uid();
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_file_share(file_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  deleted_count integer;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Delete the share if it exists and user owns it
  DELETE FROM shares 
  WHERE file_id = file_id_param 
    AND user_id = current_user_id;
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rotate_master_key(p_old_wrapped_key text, p_new_wrapped_key text, p_new_salt text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_version INTEGER;
BEGIN
  -- Get current key version
  SELECT COALESCE(MAX(key_version), 0) INTO current_version
  FROM public.master_keys
  WHERE user_id = auth.uid();
  
  -- Insert new version
  INSERT INTO public.master_keys (
    user_id,
    encrypted_master_key,
    kdf_salt,
    key_version,
    last_rotated
  ) VALUES (
    auth.uid(),
    p_new_wrapped_key,
    p_new_salt,
    current_version + 1,
    NOW()
  );
  
  -- Log the rotation
  PERFORM public.log_key_access(
    'master_key',
    auth.uid()::TEXT,
    'rotate',
    true
  );
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rotate_webhook_secret(p_webhook_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_secret TEXT;
BEGIN
  new_secret := encode(gen_random_bytes(32), 'hex');
  UPDATE public.webhooks SET secret_key = new_secret, updated_at = now()
  WHERE id = p_webhook_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhook not found or access denied'; END IF;
  RETURN new_secret;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_book_metadata(p_file_id uuid, p_cover_storage_path text DEFAULT NULL::text, p_extracted_title text DEFAULT NULL::text, p_extracted_author text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.book_metadata (file_id, user_id, cover_storage_path, extracted_title, extracted_author, updated_at)
  VALUES (p_file_id, auth.uid(), p_cover_storage_path, p_extracted_title, p_extracted_author, now())
  ON CONFLICT (user_id, file_id)
  DO UPDATE SET
    cover_storage_path = COALESCE(EXCLUDED.cover_storage_path, book_metadata.cover_storage_path),
    extracted_title = COALESCE(EXCLUDED.extracted_title, book_metadata.extracted_title),
    extracted_author = COALESCE(EXCLUDED.extracted_author, book_metadata.extracted_author),
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_reading_progress(p_file_id uuid, p_progress integer DEFAULT 0, p_current_page integer DEFAULT 0, p_total_pages integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.reading_progress (file_id, user_id, progress, current_page, total_pages, last_read_at, updated_at)
  VALUES (p_file_id, auth.uid(), p_progress, p_current_page, p_total_pages, now(), now())
  ON CONFLICT (user_id, file_id)
  DO UPDATE SET
    progress = EXCLUDED.progress,
    current_page = EXCLUDED.current_page,
    total_pages = EXCLUDED.total_pages,
    last_read_at = now(),
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_remote_progress(p_book_key text, p_progress integer DEFAULT 0, p_current_page integer DEFAULT 0, p_total_pages integer DEFAULT 0, p_title text DEFAULT NULL::text, p_author text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_subjects jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.remote_reading_progress
    (book_key, user_id, progress, current_page, total_pages, title, author, cover_url, subjects, last_read_at, updated_at)
  VALUES
    (p_book_key, auth.uid(), p_progress, p_current_page, p_total_pages, p_title, p_author, p_cover_url, COALESCE(p_subjects, '[]'::jsonb), now(), now())
  ON CONFLICT (user_id, book_key)
  DO UPDATE SET
    progress = EXCLUDED.progress,
    current_page = EXCLUDED.current_page,
    total_pages = EXCLUDED.total_pages,
    title = COALESCE(EXCLUDED.title, public.remote_reading_progress.title),
    author = COALESCE(EXCLUDED.author, public.remote_reading_progress.author),
    cover_url = COALESCE(EXCLUDED.cover_url, public.remote_reading_progress.cover_url),
    subjects = CASE WHEN EXCLUDED.subjects = '[]'::jsonb THEN public.remote_reading_progress.subjects ELSE EXCLUDED.subjects END,
    last_read_at = now(),
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_entities_with_notes(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(entity_id uuid, entity_type text, entity_name text, match_source text, snippet text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT f.id, 'file'::TEXT, f.name, 'file_name'::TEXT, ''::TEXT
  FROM files f
  WHERE f.user_id = auth.uid() AND f.name ILIKE '%' || p_query || '%'
  LIMIT p_limit;

  RETURN QUERY
  SELECT fo.id, 'folder'::TEXT, fo.name, 'folder_name'::TEXT, ''::TEXT
  FROM folders fo
  WHERE fo.user_id = auth.uid() AND fo.name ILIKE '%' || p_query || '%'
  LIMIT p_limit;

  RETURN QUERY
  SELECT en.entity_id, en.entity_type,
    COALESCE(
      (SELECT f.name FROM files f WHERE f.id = en.entity_id AND f.user_id = auth.uid()),
      (SELECT fo.name FROM folders fo WHERE fo.id = en.entity_id AND fo.user_id = auth.uid()),
      'Unknown'
    ), 'note_content'::TEXT, LEFT(en.content, 100)
  FROM entity_notes en
  WHERE en.user_id = auth.uid() AND en.content ILIKE '%' || p_query || '%'
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.spike_cleanup_old_rows()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- pg_net responses: keep 24 hours
  DELETE FROM net._http_response WHERE created < now() - interval '24 hours';

  -- API request logs: keep 30 days
  DELETE FROM public.api_request_logs WHERE created_at < now() - interval '30 days';

  -- API credit log: keep 90 days
  DELETE FROM public.api_credit_log WHERE created_at < now() - interval '90 days';

  -- KZA health checks: keep 7 days
  DELETE FROM public.kza_health_checks WHERE checked_at < now() - interval '7 days';

  -- pg_cron job run details: keep 14 days
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '14 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_file_request(p_file_request_id uuid, p_file_id uuid, p_file_name text, p_file_size bigint DEFAULT 0, p_uploader_name text DEFAULT ''::text, p_uploader_email text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_count int;
  fr_record record;
  result jsonb;
BEGIN
  SELECT * INTO fr_record
  FROM public.file_requests
  WHERE id = p_file_request_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF fr_record.id IS NULL THEN
    RAISE EXCEPTION 'File request not found or no longer accepting submissions';
  END IF;

  IF fr_record.max_files > 0 THEN
    SELECT COUNT(*) INTO current_count
    FROM public.file_request_submissions
    WHERE file_request_id = p_file_request_id;

    IF current_count >= fr_record.max_files THEN
      RAISE EXCEPTION 'Maximum number of submissions reached';
    END IF;
  END IF;

  INSERT INTO public.file_request_submissions (
    file_request_id, file_id, file_name, file_size,
    uploader_name, uploader_email
  ) VALUES (
    p_file_request_id, p_file_id, p_file_name, p_file_size,
    p_uploader_name, p_uploader_email
  )
  RETURNING jsonb_build_object('id', id, 'created_at', created_at) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_provider_storage_used()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.storage_provider_id IS NOT NULL THEN
      UPDATE public.storage_providers
      SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + COALESCE(NEW.size, 0),
          updated_at = now()
      WHERE id = NEW.storage_provider_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.storage_provider_id IS NOT NULL THEN
      UPDATE public.storage_providers
      SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - COALESCE(OLD.size, 0)),
          updated_at = now()
      WHERE id = OLD.storage_provider_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.storage_provider_id IS DISTINCT FROM NEW.storage_provider_id THEN
      IF OLD.storage_provider_id IS NOT NULL THEN
        UPDATE public.storage_providers
        SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - COALESCE(OLD.size, 0)),
            updated_at = now()
        WHERE id = OLD.storage_provider_id;
      END IF;
      IF NEW.storage_provider_id IS NOT NULL THEN
        UPDATE public.storage_providers
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + COALESCE(NEW.size, 0),
            updated_at = now()
        WHERE id = NEW.storage_provider_id;
      END IF;
    ELSIF COALESCE(OLD.size, 0) <> COALESCE(NEW.size, 0) THEN
      IF NEW.storage_provider_id IS NOT NULL THEN
        UPDATE public.storage_providers
        SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + COALESCE(NEW.size, 0) - COALESCE(OLD.size, 0)),
            updated_at = now()
        WHERE id = NEW.storage_provider_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_storage_provider_permission(p_provider_id uuid, p_permission text, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.storage_providers
  WHERE id = p_provider_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Provider not found or access denied';
  END IF;

  IF p_permission = 'read' THEN
    UPDATE public.storage_providers
    SET read_enabled = p_enabled, updated_at = now()
    WHERE id = p_provider_id;
  ELSIF p_permission = 'write' THEN
    UPDATE public.storage_providers
    SET write_enabled = p_enabled, updated_at = now()
    WHERE id = p_provider_id;
  ELSE
    RAISE EXCEPTION 'Invalid permission type. Use ''read'' or ''write''.';
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_account_health(p_account_id uuid, p_health_score integer, p_response_time_ms integer DEFAULT NULL::integer, p_rate_limit_remaining integer DEFAULT NULL::integer, p_rate_limit_reset timestamp with time zone DEFAULT NULL::timestamp with time zone, p_errors jsonb DEFAULT '[]'::jsonb, p_warnings jsonb DEFAULT '[]'::jsonb, p_metrics jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
    health_status_text TEXT;
BEGIN
    -- Determine health status based on score
    IF p_health_score >= 80 THEN
        health_status_text := 'healthy';
    ELSIF p_health_score >= 60 THEN
        health_status_text := 'warning';
    ELSE
        health_status_text := 'error';
    END IF;
    
    -- Update account health
    UPDATE github_accounts 
    SET 
        health_score = p_health_score,
        health_status = health_status_text,
        last_health_check = NOW(),
        rate_limit_remaining = COALESCE(p_rate_limit_remaining, rate_limit_remaining),
        rate_limit_reset = COALESCE(p_rate_limit_reset, rate_limit_reset),
        updated_at = NOW()
    WHERE id = p_account_id;
    
    -- Log the health check
    INSERT INTO account_health_logs (
        account_id,
        health_score,
        response_time_ms,
        rate_limit_remaining,
        rate_limit_reset,
        errors_encountered,
        warnings_encountered,
        additional_metrics
    ) VALUES (
        p_account_id,
        p_health_score,
        p_response_time_ms,
        p_rate_limit_remaining,
        p_rate_limit_reset,
        p_errors,
        p_warnings,
        p_metrics
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_api_credits_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_embed_config(p_token_id uuid, p_config jsonb)
 RETURNS embed_tokens
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE updated_token public.embed_tokens;
BEGIN
  UPDATE public.embed_tokens SET embed_config = p_config, updated_at = now()
  WHERE id = p_token_id AND user_id = auth.uid() RETURNING * INTO updated_token;
  IF updated_token IS NULL THEN RAISE EXCEPTION 'Embed token not found or access denied'; END IF;
  RETURN updated_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_entity_note(p_note_id uuid, p_content text)
 RETURNS entity_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_note public.entity_notes;
BEGIN
  UPDATE public.entity_notes
  SET content = p_content, updated_at = now()
  WHERE id = p_note_id AND user_id = auth.uid()
  RETURNING * INTO updated_note;

  IF updated_note IS NULL THEN
    RAISE EXCEPTION 'Note not found or access denied';
  END IF;

  RETURN updated_note;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_extension_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  UPDATE extensions
  SET 
    rating = (
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM extension_ratings
      WHERE extension_id = NEW.extension_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM extension_ratings
      WHERE extension_id = NEW.extension_id
    )
  WHERE id = NEW.extension_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_game_preference(p_enable boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET enable_game_suggestions = p_enable,
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_maintenance_schedules_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_master_keys_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_migration_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_passkey_last_used()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.last_used_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_playback_resume(p_file_id uuid, p_position numeric, p_duration numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO playback_resume (user_id, file_id, "position", duration)
    VALUES (auth.uid(), p_file_id, p_position, p_duration)
    ON CONFLICT (user_id, file_id)
    DO UPDATE SET
        "position" = EXCLUDED."position",
        duration = COALESCE(EXCLUDED.duration, playback_resume.duration),
        updated_at = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_provider_health(p_provider_id uuid, p_health_status text, p_last_error text DEFAULT NULL::text, p_storage_used_bytes bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.storage_providers
  SET health_status = p_health_status,
      last_health_check = now(),
      last_error = p_last_error,
      storage_used_bytes = COALESCE(p_storage_used_bytes, storage_used_bytes),
      updated_at = now()
  WHERE id = p_provider_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_repository_usage(p_repository_id uuid, p_file_size_delta bigint DEFAULT 0, p_file_count_delta integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    UPDATE repositories 
    SET 
        repository_size = GREATEST(0, repository_size + p_file_size_delta),
        file_count = GREATEST(0, file_count + p_file_count_delta),
        last_used = NOW()
    WHERE id = p_repository_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_share_options(p_share_id text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_access_code text DEFAULT NULL::text, p_download_limit integer DEFAULT NULL::integer, p_view_only boolean DEFAULT NULL::boolean, p_require_email boolean DEFAULT NULL::boolean, p_max_views integer DEFAULT NULL::integer, p_max_downloads integer DEFAULT NULL::integer, p_burn_after_reading boolean DEFAULT NULL::boolean, p_allowed_countries text[] DEFAULT NULL::text[], p_blocked_countries text[] DEFAULT NULL::text[], p_device_fingerprint text DEFAULT NULL::text, p_watermark_email boolean DEFAULT NULL::boolean, p_is_active boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE shares SET
    expires_at = COALESCE(p_expires_at, expires_at),
    access_code = COALESCE(p_access_code, access_code),
    download_limit = COALESCE(p_download_limit, download_limit),
    view_only = COALESCE(p_view_only, view_only),
    require_email = COALESCE(p_require_email, require_email),
    max_views = COALESCE(p_max_views, max_views),
    max_downloads = COALESCE(p_max_downloads, max_downloads),
    burn_after_reading = COALESCE(p_burn_after_reading, burn_after_reading),
    allowed_countries = COALESCE(p_allowed_countries, allowed_countries),
    blocked_countries = COALESCE(p_blocked_countries, blocked_countries),
    device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
    watermark_email = COALESCE(p_watermark_email, watermark_email),
    is_active = COALESCE(p_is_active, is_active)
  WHERE share_id = p_share_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_squid_vault_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_supernode_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE supernodes 
    SET current_repos = current_repos + 1,
        updated_at = NOW()
    WHERE id = NEW.supernode_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE supernodes 
    SET current_repos = current_repos - 1,
        updated_at = NOW()
    WHERE id = OLD.supernode_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_support_refunds_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_webhook(p_webhook_id uuid, p_url text DEFAULT NULL::text, p_events text[] DEFAULT NULL::text[], p_is_active boolean DEFAULT NULL::boolean)
 RETURNS webhooks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE updated_webhook public.webhooks;
BEGIN
  UPDATE public.webhooks
  SET url = COALESCE(p_url, url), events = COALESCE(p_events, events),
      is_active = COALESCE(p_is_active, is_active), updated_at = now()
  WHERE id = p_webhook_id AND user_id = auth.uid()
  RETURNING * INTO updated_webhook;
  IF updated_webhook IS NULL THEN RAISE EXCEPTION 'Webhook not found or access denied'; END IF;
  RETURN updated_webhook;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_stream_session(p_session_id uuid, p_file_id uuid, p_quality character varying DEFAULT NULL::character varying, p_bandwidth_used bigint DEFAULT 0, p_stream_duration numeric DEFAULT 0, p_errors_count integer DEFAULT 0, p_completed boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO video_stream_sessions (
        session_id, user_id, file_id, quality, bandwidth_used, 
        stream_duration, errors_count, completed, last_activity
    )
    VALUES (
        p_session_id, auth.uid(), p_file_id, p_quality, p_bandwidth_used,
        p_stream_duration, p_errors_count, p_completed, NOW()
    )
    ON CONFLICT (session_id)
    DO UPDATE SET
        quality = COALESCE(EXCLUDED.quality, video_stream_sessions.quality),
        bandwidth_used = video_stream_sessions.bandwidth_used + EXCLUDED.bandwidth_used,
        stream_duration = GREATEST(video_stream_sessions.stream_duration, EXCLUDED.stream_duration),
        errors_count = video_stream_sessions.errors_count + EXCLUDED.errors_count,
        completed = EXCLUDED.completed,
        last_activity = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_workspace_presence(p_workspace_id uuid, p_current_file_id uuid DEFAULT NULL::uuid, p_socket_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_workspace_role(p_workspace_id, auth.uid(), 'viewer') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.workspace_presence (
    workspace_id,
    user_id,
    current_file_id,
    socket_id,
    last_heartbeat
  ) VALUES (
    p_workspace_id,
    auth.uid(),
    p_current_file_id,
    p_socket_id,
    now()
  )
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    current_file_id = EXCLUDED.current_file_id,
    socket_id = EXCLUDED.socket_id,
    last_heartbeat = now(),
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_vault(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.vaults
    WHERE user_id = p_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_pin_hash TEXT;
  v_pin_salt TEXT;
BEGIN
  SELECT pin_hash, pin_salt INTO v_pin_hash, v_pin_salt
  FROM profiles
  WHERE id = p_user_id AND pin_enabled = true;
  
  IF v_pin_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Hash the provided PIN with salt and compare
  RETURN v_pin_hash = encode(extensions.digest(convert_to(p_pin || v_pin_salt, 'UTF8'), 'sha256'), 'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_vault_password(p_user_id uuid, p_vault_name text, p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_password_hash TEXT;
BEGIN
  SELECT password_hash INTO v_password_hash
  FROM public.vaults
  WHERE user_id = p_user_id AND name = p_vault_name;
  
  IF v_password_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_password_hash = extensions.crypt(p_password, v_password_hash);
END;
$function$;

CREATE OR REPLACE FUNCTION public.workspace_role_rank(p_role workspace_role)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE p_role
    WHEN 'viewer' THEN 1
    WHEN 'editor' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;
$function$;

CREATE OR REPLACE FUNCTION squidveil.next_version(p_secret_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
    select coalesce(max(version_number), 0) + 1
    from squidveil.secret_versions
    where secret_id = p_secret_id;
$function$;

CREATE OR REPLACE FUNCTION squidveil.purge_expired()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    purged int := 0;
    v_count int;
begin
    delete from squidveil.secrets
    where deleted_at is not null
      and delete_after is not null
      and delete_after < now();
    get diagnostics v_count = row_count;
    purged := purged + v_count;

    delete from squidveil.veilrefs
    where expires_at < now();
    get diagnostics v_count = row_count;
    purged := purged + v_count;

    return purged;
end $function$;

DROP TRIGGER IF EXISTS "update_access_policies_updated_at" ON "public"."access_policies";
CREATE TRIGGER update_access_policies_updated_at BEFORE UPDATE ON access_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trigger_update_api_credits_updated_at" ON "public"."api_credits";
CREATE TRIGGER trigger_update_api_credits_updated_at BEFORE UPDATE ON api_credits FOR EACH ROW EXECUTE FUNCTION update_api_credits_updated_at();
DROP TRIGGER IF EXISTS "update_archive_extractions_updated_at" ON "public"."archive_extractions";
CREATE TRIGGER update_archive_extractions_updated_at BEFORE UPDATE ON archive_extractions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_extension_rating_trigger" ON "public"."extension_ratings";
CREATE TRIGGER update_extension_rating_trigger AFTER INSERT OR DELETE OR UPDATE ON extension_ratings FOR EACH ROW EXECUTE FUNCTION update_extension_rating();
DROP TRIGGER IF EXISTS "extension_approval_change_trigger" ON "public"."extensions";
CREATE TRIGGER extension_approval_change_trigger BEFORE UPDATE ON extensions FOR EACH ROW EXECUTE FUNCTION handle_extension_approval_change();
DROP TRIGGER IF EXISTS "files_assign_workspace_id" ON "public"."files";
CREATE TRIGGER files_assign_workspace_id BEFORE INSERT ON files FOR EACH ROW EXECUTE FUNCTION assign_workspace_id();
DROP TRIGGER IF EXISTS "trg_bucket_usage" ON "public"."files";
CREATE TRIGGER trg_bucket_usage AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON files FOR EACH ROW EXECUTE FUNCTION adjust_bucket_usage();
DROP TRIGGER IF EXISTS "trg_count_file_upload" ON "public"."files";
CREATE TRIGGER trg_count_file_upload AFTER INSERT ON files FOR EACH ROW EXECUTE FUNCTION count_file_upload();
DROP TRIGGER IF EXISTS "trg_hash_file_encryption_key" ON "public"."files";
CREATE TRIGGER trg_hash_file_encryption_key BEFORE INSERT OR UPDATE ON files FOR EACH ROW EXECUTE FUNCTION hash_file_encryption_key();
DROP TRIGGER IF EXISTS "trg_sde_locators_cleanup" ON "public"."files";
CREATE TRIGGER trg_sde_locators_cleanup AFTER DELETE ON files FOR EACH ROW EXECUTE FUNCTION delete_sde_locators();
DROP TRIGGER IF EXISTS "trg_sync_provider_storage_used" ON "public"."files";
CREATE TRIGGER trg_sync_provider_storage_used AFTER INSERT OR DELETE OR UPDATE OF size, storage_provider_id ON files FOR EACH ROW EXECUTE FUNCTION sync_provider_storage_used();
DROP TRIGGER IF EXISTS "update_files_updated_at" ON "public"."files";
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "folders_assign_workspace_id" ON "public"."folders";
CREATE TRIGGER folders_assign_workspace_id BEFORE INSERT ON folders FOR EACH ROW EXECUTE FUNCTION assign_workspace_id();
DROP TRIGGER IF EXISTS "log_extension_install_trigger" ON "public"."installed_extensions";
CREATE TRIGGER log_extension_install_trigger AFTER INSERT OR DELETE ON installed_extensions FOR EACH ROW EXECUTE FUNCTION log_extension_event();
DROP TRIGGER IF EXISTS "kza_admin_ban_protection" ON "public"."kza_banned_entities";
CREATE TRIGGER kza_admin_ban_protection BEFORE INSERT OR UPDATE ON kza_banned_entities FOR EACH ROW EXECUTE FUNCTION kza_block_admin_ban();
DROP TRIGGER IF EXISTS "update_maintenance_mode_updated_at" ON "public"."maintenance_mode";
CREATE TRIGGER update_maintenance_mode_updated_at BEFORE UPDATE ON maintenance_mode FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_maintenance_schedules_updated_at" ON "public"."maintenance_schedules";
CREATE TRIGGER update_maintenance_schedules_updated_at BEFORE UPDATE ON maintenance_schedules FOR EACH ROW EXECUTE FUNCTION update_maintenance_schedules_updated_at();
DROP TRIGGER IF EXISTS "trigger_update_master_keys_updated_at" ON "public"."master_keys";
CREATE TRIGGER trigger_update_master_keys_updated_at BEFORE UPDATE ON master_keys FOR EACH ROW EXECUTE FUNCTION update_master_keys_updated_at();
DROP TRIGGER IF EXISTS "playback_event_notification" ON "public"."media_playback_logs";
CREATE TRIGGER playback_event_notification AFTER INSERT ON media_playback_logs FOR EACH ROW EXECUTE FUNCTION notify_playback_event();
DROP TRIGGER IF EXISTS "update_migration_jobs_updated_at" ON "public"."migration_jobs";
CREATE TRIGGER update_migration_jobs_updated_at BEFORE UPDATE ON migration_jobs FOR EACH ROW EXECUTE FUNCTION update_migration_updated_at_column();
DROP TRIGGER IF EXISTS "profiles_create_default_workspace" ON "public"."profiles";
CREATE TRIGGER profiles_create_default_workspace AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_default_workspace_for_profile();
DROP TRIGGER IF EXISTS "update_squid_vault_timestamp" ON "public"."squid_vaults";
CREATE TRIGGER update_squid_vault_timestamp BEFORE UPDATE ON squid_vaults FOR EACH ROW EXECUTE FUNCTION update_squid_vault_updated_at();
DROP TRIGGER IF EXISTS "update_support_refunds_updated_at" ON "public"."support_refunds";
CREATE TRIGGER update_support_refunds_updated_at BEFORE UPDATE ON support_refunds FOR EACH ROW EXECUTE FUNCTION update_support_refunds_updated_at();
DROP TRIGGER IF EXISTS "update_support_tickets_updated_at" ON "public"."support_tickets";
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "system_settings_updated_at" ON "public"."system_settings";
CREATE TRIGGER system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_system_settings_updated_at();
DROP TRIGGER IF EXISTS "transcode_progress_notification" ON "public"."transcode_jobs";
CREATE TRIGGER transcode_progress_notification AFTER UPDATE ON transcode_jobs FOR EACH ROW WHEN (old.progress IS DISTINCT FROM new.progress OR old.status::text IS DISTINCT FROM new.status::text) EXECUTE FUNCTION notify_transcode_progress();
DROP TRIGGER IF EXISTS "update_transcode_jobs_updated_at" ON "public"."transcode_jobs";
CREATE TRIGGER update_transcode_jobs_updated_at BEFORE UPDATE ON transcode_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_user_encryption_settings_updated_at" ON "public"."user_encryption_settings";
CREATE TRIGGER update_user_encryption_settings_updated_at BEFORE UPDATE ON user_encryption_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_passkey_last_used_trigger" ON "public"."user_passkeys";
CREATE TRIGGER update_passkey_last_used_trigger BEFORE UPDATE ON user_passkeys FOR EACH ROW WHEN (old.credential_id IS DISTINCT FROM new.credential_id) EXECUTE FUNCTION update_passkey_last_used();
DROP TRIGGER IF EXISTS "update_user_security_settings_updated_at" ON "public"."user_security_settings";
CREATE TRIGGER update_user_security_settings_updated_at BEFORE UPDATE ON user_security_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_video_processing_queue_updated_at" ON "public"."video_processing_queue";
CREATE TRIGGER update_video_processing_queue_updated_at BEFORE UPDATE ON video_processing_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_workspace_invites_updated_at" ON "public"."workspace_invites";
CREATE TRIGGER update_workspace_invites_updated_at BEFORE UPDATE ON workspace_invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_workspace_members_updated_at" ON "public"."workspace_members";
CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_workspace_presence_updated_at" ON "public"."workspace_presence";
CREATE TRIGGER update_workspace_presence_updated_at BEFORE UPDATE ON workspace_presence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "workspaces_create_owner_member" ON "public"."workspaces";
CREATE TRIGGER workspaces_create_owner_member AFTER INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION create_workspace_owner_member();

ALTER TABLE "public"."8djcvk3222" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."access_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account_health_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_admin_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_credit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_key_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_operation_costs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_request_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."archive_extractions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."beta_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."book_metadata" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cli_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cli_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discount_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."downloads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."embed_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."encrypted_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."entity_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."extension_analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."extension_approval_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."extension_ratings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."extensions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_key_vault" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_request_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."github_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."installed_extensions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."key_access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_admin_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_banned_entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_cip_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_geo_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_geo_fence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_health_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_honeypot_hits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_ip_rate_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_ip_reputation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_linked_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_phantom_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_prel_f2fa_seeds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_prel_hmac_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_prel_registry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_prel_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_rate_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_swk_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_swk_denylist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_swk_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_swk_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_swk_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_swk_verdict_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_threat_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kza_user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."login_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."maintenance_mode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."maintenance_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."master_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."media_playback_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."migration_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."migration_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partner_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."passkey_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payment_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pdf_annotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pdf_bookmarks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pdf_reading_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pdf_secure_urls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pdf_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pin_attempt_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pin_operation_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."plan_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."playback_resume" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reading_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."redeem_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."remote_reading_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."repositories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reviewers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sde_chunk_locators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sde_identity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sde_recall_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."security_keyring" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."share_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."share_collection_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."share_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."share_decrypt_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."site_publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_run_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_run_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_script_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_script_triggers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_scripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_vault_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squid_vaults" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squidcdn_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squidcloud_b2_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squidveil_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squidveil_refs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."squidveil_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."storage_cleanup_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."storage_provider_vault" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."storage_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."storage_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."threat_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."transcode_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."upload_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."upload_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_encryption_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_notification_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_passkeys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_redeem_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_security_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_storage_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_terms_acceptance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vault_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vaults" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."video_processing_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."video_quality_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."video_stream_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_events_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_presence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."access_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."rotation_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."secret_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."secret_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."system_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "squidveil"."veilrefs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only access to 8djcvk3222" ON "public"."8djcvk3222";
CREATE POLICY "Service role only access to 8djcvk3222" ON "public"."8djcvk3222" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Users can manage own access policies" ON "public"."access_policies";
CREATE POLICY "Users can manage own access policies" ON "public"."access_policies" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own account changes" ON "public"."account_changes";
CREATE POLICY "Users can insert their own account changes" ON "public"."account_changes" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own account changes" ON "public"."account_changes";
CREATE POLICY "Users can view their own account changes" ON "public"."account_changes" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own account health logs" ON "public"."account_health_logs";
CREATE POLICY "Users can insert own account health logs" ON "public"."account_health_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((account_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view own account health logs" ON "public"."account_health_logs";
CREATE POLICY "Users can view own account health logs" ON "public"."account_health_logs" AS PERMISSIVE FOR SELECT TO authenticated USING ((account_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage admin access logs" ON "public"."admin_access_logs";
CREATE POLICY "Admins can manage admin access logs" ON "public"."admin_access_logs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "No public access to admin logs" ON "public"."admin_access_logs";
CREATE POLICY "No public access to admin logs" ON "public"."admin_access_logs" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Users can insert own analytics events" ON "public"."analytics_events";
CREATE POLICY "Users can insert own analytics events" ON "public"."analytics_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own analytics events" ON "public"."analytics_events";
CREATE POLICY "Users can view own analytics events" ON "public"."analytics_events" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can manage admin config" ON "public"."api_admin_config";
CREATE POLICY "Admins can manage admin config" ON "public"."api_admin_config" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Anyone can read admin config" ON "public"."api_admin_config";
CREATE POLICY "Anyone can read admin config" ON "public"."api_admin_config" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages admin config" ON "public"."api_admin_config";
CREATE POLICY "Service role manages admin config" ON "public"."api_admin_config" AS PERMISSIVE FOR ALL TO authenticated USING (false);
DROP POLICY IF EXISTS "System can insert credit logs" ON "public"."api_credit_log";
CREATE POLICY "System can insert credit logs" ON "public"."api_credit_log" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view own credit logs" ON "public"."api_credit_log";
CREATE POLICY "Users can view own credit logs" ON "public"."api_credit_log" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can manage all API credits" ON "public"."api_credits";
CREATE POLICY "Admins can manage all API credits" ON "public"."api_credits" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Service role manages credits" ON "public"."api_credits";
CREATE POLICY "Service role manages credits" ON "public"."api_credits" AS PERMISSIVE FOR ALL TO authenticated USING (false);
DROP POLICY IF EXISTS "Users can view own credits" ON "public"."api_credits";
CREATE POLICY "Users can view own credits" ON "public"."api_credits" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own key limits" ON "public"."api_key_limits";
CREATE POLICY "Users can manage own key limits" ON "public"."api_key_limits" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM api_keys
  WHERE ((api_keys.id = api_key_limits.api_key_id) AND (api_keys.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Admins can manage all API keys" ON "public"."api_keys";
CREATE POLICY "Admins can manage all API keys" ON "public"."api_keys" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Users can create their own API keys" ON "public"."api_keys";
CREATE POLICY "Users can create their own API keys" ON "public"."api_keys" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own API keys" ON "public"."api_keys";
CREATE POLICY "Users can delete their own API keys" ON "public"."api_keys" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own API keys" ON "public"."api_keys";
CREATE POLICY "Users can update their own API keys" ON "public"."api_keys" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own API keys" ON "public"."api_keys";
CREATE POLICY "Users can view their own API keys" ON "public"."api_keys" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can update operation costs" ON "public"."api_operation_costs";
CREATE POLICY "Admins can update operation costs" ON "public"."api_operation_costs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Anyone can read operation costs" ON "public"."api_operation_costs";
CREATE POLICY "Anyone can read operation costs" ON "public"."api_operation_costs" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Only service role modifies costs" ON "public"."api_operation_costs";
CREATE POLICY "Only service role modifies costs" ON "public"."api_operation_costs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Admins can read all API request logs" ON "public"."api_request_logs";
CREATE POLICY "Admins can read all API request logs" ON "public"."api_request_logs" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Users can insert their own API request logs" ON "public"."api_request_logs";
CREATE POLICY "Users can insert their own API request logs" ON "public"."api_request_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own API request logs" ON "public"."api_request_logs";
CREATE POLICY "Users can view their own API request logs" ON "public"."api_request_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own archive extractions" ON "public"."archive_extractions";
CREATE POLICY "Users can delete own archive extractions" ON "public"."archive_extractions" AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own archive extractions" ON "public"."archive_extractions";
CREATE POLICY "Users can insert own archive extractions" ON "public"."archive_extractions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own archive extractions" ON "public"."archive_extractions";
CREATE POLICY "Users can update own archive extractions" ON "public"."archive_extractions" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own archive extractions" ON "public"."archive_extractions";
CREATE POLICY "Users can view own archive extractions" ON "public"."archive_extractions" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own audit logs" ON "public"."audit_logs";
CREATE POLICY "Users can insert own audit logs" ON "public"."audit_logs" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own audit logs" ON "public"."audit_logs";
CREATE POLICY "Users can view own audit logs" ON "public"."audit_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own beta enrollments" ON "public"."beta_enrollments";
CREATE POLICY "Users can manage own beta enrollments" ON "public"."beta_enrollments" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own book metadata" ON "public"."book_metadata";
CREATE POLICY "Users can manage own book metadata" ON "public"."book_metadata" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role full access CLI authorizations" ON "public"."cli_authorizations";
CREATE POLICY "Service role full access CLI authorizations" ON "public"."cli_authorizations" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can insert own CLI authorizations" ON "public"."cli_authorizations";
CREATE POLICY "Users can insert own CLI authorizations" ON "public"."cli_authorizations" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own CLI authorizations" ON "public"."cli_authorizations";
CREATE POLICY "Users can read own CLI authorizations" ON "public"."cli_authorizations" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own CLI authorizations" ON "public"."cli_authorizations";
CREATE POLICY "Users can update own CLI authorizations" ON "public"."cli_authorizations" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role full access CLI devices" ON "public"."cli_devices";
CREATE POLICY "Service role full access CLI devices" ON "public"."cli_devices" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete own CLI devices" ON "public"."cli_devices";
CREATE POLICY "Users can delete own CLI devices" ON "public"."cli_devices" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own CLI devices" ON "public"."cli_devices";
CREATE POLICY "Users can insert own CLI devices" ON "public"."cli_devices" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own CLI devices" ON "public"."cli_devices";
CREATE POLICY "Users can read own CLI devices" ON "public"."cli_devices" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own CLI devices" ON "public"."cli_devices";
CREATE POLICY "Users can update own CLI devices" ON "public"."cli_devices" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can create their own downloads" ON "public"."downloads";
CREATE POLICY "Users can create their own downloads" ON "public"."downloads" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own downloads" ON "public"."downloads";
CREATE POLICY "Users can delete their own downloads" ON "public"."downloads" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own downloads" ON "public"."downloads";
CREATE POLICY "Users can update their own downloads" ON "public"."downloads" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own downloads" ON "public"."downloads";
CREATE POLICY "Users can view their own downloads" ON "public"."downloads" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage their own embed tokens" ON "public"."embed_tokens";
CREATE POLICY "Users can manage their own embed tokens" ON "public"."embed_tokens" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own encrypted keys" ON "public"."encrypted_keys";
CREATE POLICY "Users can manage own encrypted keys" ON "public"."encrypted_keys" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage their own notes" ON "public"."entity_notes";
CREATE POLICY "Users can manage their own notes" ON "public"."entity_notes" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Extension authors can view analytics for their extensions" ON "public"."extension_analytics";
CREATE POLICY "Extension authors can view analytics for their extensions" ON "public"."extension_analytics" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IN ( SELECT extensions.author_id
   FROM extensions
  WHERE (extensions.id = extension_analytics.extension_id))));
DROP POLICY IF EXISTS "Users can insert their own extension analytics" ON "public"."extension_analytics";
CREATE POLICY "Users can insert their own extension analytics" ON "public"."extension_analytics" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin can insert approval history" ON "public"."extension_approval_history";
CREATE POLICY "Admin can insert approval history" ON "public"."extension_approval_history" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM api_keys
  WHERE ((api_keys.user_id = auth.uid()) AND (api_keys.key_prefix = 'cb_926d45e'::text) AND (api_keys.is_active = true)))));
DROP POLICY IF EXISTS "Admin can view all approval history" ON "public"."extension_approval_history";
CREATE POLICY "Admin can view all approval history" ON "public"."extension_approval_history" AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM api_keys
  WHERE ((api_keys.user_id = auth.uid()) AND (api_keys.key_prefix = 'cb_926d45e'::text) AND (api_keys.is_active = true)))));
DROP POLICY IF EXISTS "Extension ratings are viewable by everyone" ON "public"."extension_ratings";
CREATE POLICY "Extension ratings are viewable by everyone" ON "public"."extension_ratings" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Users can delete their own ratings" ON "public"."extension_ratings";
CREATE POLICY "Users can delete their own ratings" ON "public"."extension_ratings" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own ratings" ON "public"."extension_ratings";
CREATE POLICY "Users can insert their own ratings" ON "public"."extension_ratings" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own ratings" ON "public"."extension_ratings";
CREATE POLICY "Users can update their own ratings" ON "public"."extension_ratings" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admin can update extension approval" ON "public"."extensions";
CREATE POLICY "Admin can update extension approval" ON "public"."extensions" AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM api_keys
  WHERE ((api_keys.user_id = auth.uid()) AND (api_keys.key_prefix = 'cb_926d45e'::text) AND (api_keys.is_active = true)))));
DROP POLICY IF EXISTS "Public extensions are viewable by everyone" ON "public"."extensions";
CREATE POLICY "Public extensions are viewable by everyone" ON "public"."extensions" AS PERMISSIVE FOR SELECT TO public USING ((((is_active = true) AND (approval = 'approved'::text)) OR (auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM api_keys
  WHERE ((api_keys.user_id = auth.uid()) AND (api_keys.key_prefix = 'cb_926d45e'::text) AND (api_keys.is_active = true))))));
DROP POLICY IF EXISTS "Users can delete their own extensions" ON "public"."extensions";
CREATE POLICY "Users can delete their own extensions" ON "public"."extensions" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = author_id));
DROP POLICY IF EXISTS "Users can insert their own extensions" ON "public"."extensions";
CREATE POLICY "Users can insert their own extensions" ON "public"."extensions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = author_id));
DROP POLICY IF EXISTS "Users can update their own extensions" ON "public"."extensions";
CREATE POLICY "Users can update their own extensions" ON "public"."extensions" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = author_id));
DROP POLICY IF EXISTS "file_key_vault owner all" ON "public"."file_key_vault";
CREATE POLICY "file_key_vault owner all" ON "public"."file_key_vault" AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert submissions" ON "public"."file_request_submissions";
CREATE POLICY "Anyone can insert submissions" ON "public"."file_request_submissions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM file_requests
  WHERE ((file_requests.id = file_request_submissions.file_request_id) AND (file_requests.is_active = true) AND ((file_requests.expires_at IS NULL) OR (file_requests.expires_at > now()))))));
DROP POLICY IF EXISTS "Owners can view submissions" ON "public"."file_request_submissions";
CREATE POLICY "Owners can view submissions" ON "public"."file_request_submissions" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM file_requests
  WHERE ((file_requests.id = file_request_submissions.file_request_id) AND (file_requests.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can view submissions for own file requests" ON "public"."file_request_submissions";
CREATE POLICY "Users can view submissions for own file requests" ON "public"."file_request_submissions" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM file_requests
  WHERE ((file_requests.id = file_request_submissions.file_request_id) AND (file_requests.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Anyone can read active file requests by slug" ON "public"."file_requests";
CREATE POLICY "Anyone can read active file requests by slug" ON "public"."file_requests" AS PERMISSIVE FOR SELECT TO public USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now()))));
DROP POLICY IF EXISTS "Anyone can read active file_requests by slug" ON "public"."file_requests";
CREATE POLICY "Anyone can read active file_requests by slug" ON "public"."file_requests" AS PERMISSIVE FOR SELECT TO public USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now()))));
DROP POLICY IF EXISTS "Users can CRUD own file_requests" ON "public"."file_requests";
CREATE POLICY "Users can CRUD own file_requests" ON "public"."file_requests" AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage own file requests" ON "public"."file_requests";
CREATE POLICY "Users can manage own file requests" ON "public"."file_requests" AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can delete all files" ON "public"."files";
CREATE POLICY "Admins can delete all files" ON "public"."files" AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can read all files" ON "public"."files";
CREATE POLICY "Admins can read all files" ON "public"."files" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all files" ON "public"."files";
CREATE POLICY "Admins can update all files" ON "public"."files" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Allow authenticated selects from files" ON "public"."files";
CREATE POLICY "Allow authenticated selects from files" ON "public"."files" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Allow public access to public files" ON "public"."files";
CREATE POLICY "Allow public access to public files" ON "public"."files" AS PERMISSIVE FOR SELECT TO public USING ((is_public = true));
DROP POLICY IF EXISTS "Allow public access to shared files" ON "public"."files";
CREATE POLICY "Allow public access to shared files" ON "public"."files" AS PERMISSIVE FOR SELECT TO anon,authenticated USING (((EXISTS ( SELECT 1
   FROM shares
  WHERE ((shares.file_id = files.id) AND (shares.share_id IS NOT NULL) AND ((shares.expires_at IS NULL) OR (shares.expires_at > now())) AND (COALESCE(shares.is_active, true) = true)))) OR (auth.uid() = user_id)));
DROP POLICY IF EXISTS "Allow users to delete their own files" ON "public"."files";
CREATE POLICY "Allow users to delete their own files" ON "public"."files" AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Allow users to update their own files" ON "public"."files";
CREATE POLICY "Allow users to update their own files" ON "public"."files" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can delete their files" ON "public"."files";
CREATE POLICY "Owners can delete their files" ON "public"."files" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can insert their files" ON "public"."files";
CREATE POLICY "Owners can insert their files" ON "public"."files" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can update their files" ON "public"."files";
CREATE POLICY "Owners can update their files" ON "public"."files" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Strict zero-knowledge file privacy" ON "public"."files";
CREATE POLICY "Strict zero-knowledge file privacy" ON "public"."files" AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR ((workspace_id IS NOT NULL) AND (workspace_id IN ( SELECT workspaces.id
   FROM workspaces
  WHERE (workspaces.user_id = auth.uid())))) OR (is_public = true) OR (shared = true)));
DROP POLICY IF EXISTS "Users can create their own files" ON "public"."files";
CREATE POLICY "Users can create their own files" ON "public"."files" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own files" ON "public"."files";
CREATE POLICY "Users can delete own files" ON "public"."files" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own files" ON "public"."files";
CREATE POLICY "Users can insert own files" ON "public"."files" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own files" ON "public"."files";
CREATE POLICY "Users can read own files" ON "public"."files" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own files" ON "public"."files";
CREATE POLICY "Users can update own files" ON "public"."files" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "files_select_shared" ON "public"."files";
CREATE POLICY "files_select_shared" ON "public"."files" AS PERMISSIVE FOR SELECT TO public USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM shares s
  WHERE ((s.file_id = files.id) AND (s.share_type = 'public'::text) AND ((s.expires_at IS NULL) OR (s.expires_at > now()))))) OR ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM shares s
  WHERE ((s.file_id = files.id) AND (s.share_type = 'user_specific'::text) AND ((s.expires_at IS NULL) OR (s.expires_at > now())) AND ((auth.uid())::text = ANY (s.allowed_users))))))));
DROP POLICY IF EXISTS "Allow public access to public folders" ON "public"."folders";
CREATE POLICY "Allow public access to public folders" ON "public"."folders" AS PERMISSIVE FOR SELECT TO public USING ((is_public = true));
DROP POLICY IF EXISTS "Owners can delete their folders" ON "public"."folders";
CREATE POLICY "Owners can delete their folders" ON "public"."folders" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can insert their folders" ON "public"."folders";
CREATE POLICY "Owners can insert their folders" ON "public"."folders" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can update their folders" ON "public"."folders";
CREATE POLICY "Owners can update their folders" ON "public"."folders" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can view their folders" ON "public"."folders";
CREATE POLICY "Owners can view their folders" ON "public"."folders" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own GitHub connections" ON "public"."github_connections";
CREATE POLICY "Users can delete their own GitHub connections" ON "public"."github_connections" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own GitHub connections" ON "public"."github_connections";
CREATE POLICY "Users can insert their own GitHub connections" ON "public"."github_connections" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own GitHub connections" ON "public"."github_connections";
CREATE POLICY "Users can view their own GitHub connections" ON "public"."github_connections" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can install extensions" ON "public"."installed_extensions";
CREATE POLICY "Users can install extensions" ON "public"."installed_extensions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can uninstall their extensions" ON "public"."installed_extensions";
CREATE POLICY "Users can uninstall their extensions" ON "public"."installed_extensions" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their installed extensions" ON "public"."installed_extensions";
CREATE POLICY "Users can update their installed extensions" ON "public"."installed_extensions" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their installed extensions" ON "public"."installed_extensions";
CREATE POLICY "Users can view their installed extensions" ON "public"."installed_extensions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own key access logs" ON "public"."key_access_logs";
CREATE POLICY "Users can insert their own key access logs" ON "public"."key_access_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view own key access logs" ON "public"."key_access_logs";
CREATE POLICY "Users can view own key access logs" ON "public"."key_access_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role only access to kza_admin_incidents" ON "public"."kza_admin_incidents";
CREATE POLICY "Service role only access to kza_admin_incidents" ON "public"."kza_admin_incidents" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role only access to kza_banned_entities" ON "public"."kza_banned_entities";
CREATE POLICY "Service role only access to kza_banned_entities" ON "public"."kza_banned_entities" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "kza_cip_versions_service_role" ON "public"."kza_cip_versions";
CREATE POLICY "kza_cip_versions_service_role" ON "public"."kza_cip_versions" AS PERMISSIVE FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "kza_geo_events_service_role" ON "public"."kza_geo_events";
CREATE POLICY "kza_geo_events_service_role" ON "public"."kza_geo_events" AS PERMISSIVE FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "admin access to geo_fence" ON "public"."kza_geo_fence";
CREATE POLICY "admin access to geo_fence" ON "public"."kza_geo_fence" AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))));
DROP POLICY IF EXISTS "service_role only — kza_geo_fence" ON "public"."kza_geo_fence";
CREATE POLICY "service_role only — kza_geo_fence" ON "public"."kza_geo_fence" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role only access to kza_honeypot_hits" ON "public"."kza_honeypot_hits";
CREATE POLICY "Service role only access to kza_honeypot_hits" ON "public"."kza_honeypot_hits" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Admins can manage ip reputation" ON "public"."kza_ip_reputation";
CREATE POLICY "Admins can manage ip reputation" ON "public"."kza_ip_reputation" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "service_role only — kza_ip_reputation" ON "public"."kza_ip_reputation";
CREATE POLICY "service_role only — kza_ip_reputation" ON "public"."kza_ip_reputation" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role only access to kza_linked_accounts" ON "public"."kza_linked_accounts";
CREATE POLICY "Service role only access to kza_linked_accounts" ON "public"."kza_linked_accounts" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role only access to kza_phantom_assets" ON "public"."kza_phantom_assets";
CREATE POLICY "Service role only access to kza_phantom_assets" ON "public"."kza_phantom_assets" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "kza_prel_f2fa_seeds_service_role" ON "public"."kza_prel_f2fa_seeds";
CREATE POLICY "kza_prel_f2fa_seeds_service_role" ON "public"."kza_prel_f2fa_seeds" AS PERMISSIVE FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "kza_prel_registry_service_role" ON "public"."kza_prel_registry";
CREATE POLICY "kza_prel_registry_service_role" ON "public"."kza_prel_registry" AS PERMISSIVE FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "kza_prel_sessions_service_role" ON "public"."kza_prel_sessions";
CREATE POLICY "kza_prel_sessions_service_role" ON "public"."kza_prel_sessions" AS PERMISSIVE FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "kza_rate_buckets_service_role" ON "public"."kza_rate_buckets";
CREATE POLICY "kza_rate_buckets_service_role" ON "public"."kza_rate_buckets" AS PERMISSIVE FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role only access to kza_threat_events" ON "public"."kza_threat_events";
CREATE POLICY "Service role only access to kza_threat_events" ON "public"."kza_threat_events" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role only access to kza_user_profiles" ON "public"."kza_user_profiles";
CREATE POLICY "Service role only access to kza_user_profiles" ON "public"."kza_user_profiles" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Users can delete their own login sessions" ON "public"."login_sessions";
CREATE POLICY "Users can delete their own login sessions" ON "public"."login_sessions" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own login sessions" ON "public"."login_sessions";
CREATE POLICY "Users can insert their own login sessions" ON "public"."login_sessions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own login sessions" ON "public"."login_sessions";
CREATE POLICY "Users can update their own login sessions" ON "public"."login_sessions" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own login sessions" ON "public"."login_sessions";
CREATE POLICY "Users can view their own login sessions" ON "public"."login_sessions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can manage maintenance mode" ON "public"."maintenance_mode";
CREATE POLICY "Admins can manage maintenance mode" ON "public"."maintenance_mode" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Admins can manage maintenance schedules" ON "public"."maintenance_schedules";
CREATE POLICY "Admins can manage maintenance schedules" ON "public"."maintenance_schedules" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Users can manage own master keys" ON "public"."master_keys";
CREATE POLICY "Users can manage own master keys" ON "public"."master_keys" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own playback logs" ON "public"."media_playback_logs";
CREATE POLICY "Users can insert own playback logs" ON "public"."media_playback_logs" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own playback logs" ON "public"."media_playback_logs";
CREATE POLICY "Users can view own playback logs" ON "public"."media_playback_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can create their own migration jobs" ON "public"."migration_jobs";
CREATE POLICY "Users can create their own migration jobs" ON "public"."migration_jobs" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own migration jobs" ON "public"."migration_jobs";
CREATE POLICY "Users can update their own migration jobs" ON "public"."migration_jobs" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own migration jobs" ON "public"."migration_jobs";
CREATE POLICY "Users can view their own migration jobs" ON "public"."migration_jobs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own migration logs" ON "public"."migration_logs";
CREATE POLICY "Users can insert their own migration logs" ON "public"."migration_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own migration logs" ON "public"."migration_logs";
CREATE POLICY "Users can view their own migration logs" ON "public"."migration_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role can insert payment logs" ON "public"."payment_logs";
CREATE POLICY "Service role can insert payment logs" ON "public"."payment_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Service role can update payment logs" ON "public"."payment_logs";
CREATE POLICY "Service role can update payment logs" ON "public"."payment_logs" AS PERMISSIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Users can view their own payment logs" ON "public"."payment_logs";
CREATE POLICY "Users can view their own payment logs" ON "public"."payment_logs" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own annotations" ON "public"."pdf_annotations";
CREATE POLICY "Users can manage own annotations" ON "public"."pdf_annotations" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON "public"."pdf_bookmarks";
CREATE POLICY "Users can manage own bookmarks" ON "public"."pdf_bookmarks" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own reading progress" ON "public"."pdf_reading_progress";
CREATE POLICY "Users can manage own reading progress" ON "public"."pdf_reading_progress" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage their own PDF secure URLs" ON "public"."pdf_secure_urls";
CREATE POLICY "Users can manage their own PDF secure URLs" ON "public"."pdf_secure_urls" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own sessions" ON "public"."pdf_sessions";
CREATE POLICY "Users can manage own sessions" ON "public"."pdf_sessions" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own PIN attempt logs" ON "public"."pin_attempt_logs";
CREATE POLICY "Users can insert own PIN attempt logs" ON "public"."pin_attempt_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own PIN attempt logs" ON "public"."pin_attempt_logs";
CREATE POLICY "Users can view own PIN attempt logs" ON "public"."pin_attempt_logs" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own pin operation authorizations" ON "public"."pin_operation_authorizations";
CREATE POLICY "Users can delete own pin operation authorizations" ON "public"."pin_operation_authorizations" AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own pin operation authorizations" ON "public"."pin_operation_authorizations";
CREATE POLICY "Users can insert own pin operation authorizations" ON "public"."pin_operation_authorizations" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own pin operation authorizations" ON "public"."pin_operation_authorizations";
CREATE POLICY "Users can view own pin operation authorizations" ON "public"."pin_operation_authorizations" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Anyone can view plan limits" ON "public"."plan_limits";
CREATE POLICY "Anyone can view plan limits" ON "public"."plan_limits" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Only service role can insert plan limits" ON "public"."plan_limits";
CREATE POLICY "Only service role can insert plan limits" ON "public"."plan_limits" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Only service role can update plan limits" ON "public"."plan_limits";
CREATE POLICY "Only service role can update plan limits" ON "public"."plan_limits" AS PERMISSIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "Users can manage own resume positions" ON "public"."playback_resume";
CREATE POLICY "Users can manage own resume positions" ON "public"."playback_resume" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can read all profiles" ON "public"."profiles";
CREATE POLICY "Admins can read all profiles" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all profiles" ON "public"."profiles";
CREATE POLICY "Admins can update all profiles" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Users can insert own profile" ON "public"."profiles";
CREATE POLICY "Users can insert own profile" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can read own profile" ON "public"."profiles";
CREATE POLICY "Users can read own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
CREATE POLICY "Users can update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON "public"."profiles";
CREATE POLICY "Users can update own profile (restricted)" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND (is_admin = ( SELECT profiles_1.is_admin
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))) AND (is_premium = ( SELECT profiles_1.is_premium
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))));
DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."profiles";
CREATE POLICY "Users can update their own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
CREATE POLICY "Users can view own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can view their own profile" ON "public"."profiles";
CREATE POLICY "Users can view their own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users can manage own reading progress" ON "public"."reading_progress";
CREATE POLICY "Users can manage own reading progress" ON "public"."reading_progress" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own remote progress" ON "public"."remote_reading_progress";
CREATE POLICY "Users manage own remote progress" ON "public"."remote_reading_progress" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can delete all repositories" ON "public"."repositories";
CREATE POLICY "Admins can delete all repositories" ON "public"."repositories" AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can read all repositories" ON "public"."repositories";
CREATE POLICY "Admins can read all repositories" ON "public"."repositories" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all repositories" ON "public"."repositories";
CREATE POLICY "Admins can update all repositories" ON "public"."repositories" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Users can create their own repositories" ON "public"."repositories";
CREATE POLICY "Users can create their own repositories" ON "public"."repositories" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own repositories" ON "public"."repositories";
CREATE POLICY "Users can view their own repositories" ON "public"."repositories" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Reviewers can view own profile" ON "public"."reviewers";
CREATE POLICY "Reviewers can view own profile" ON "public"."reviewers" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Users manage own SDE locators" ON "public"."sde_chunk_locators";
CREATE POLICY "Users manage own SDE locators" ON "public"."sde_chunk_locators" AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own SDE identity" ON "public"."sde_identity";
CREATE POLICY "Users can insert own SDE identity" ON "public"."sde_identity" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own SDE identity" ON "public"."sde_identity";
CREATE POLICY "Users can read own SDE identity" ON "public"."sde_identity" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own SDE identity" ON "public"."sde_identity";
CREATE POLICY "Users can update own SDE identity" ON "public"."sde_identity" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own recall tokens" ON "public"."sde_recall_tokens";
CREATE POLICY "Users can delete own recall tokens" ON "public"."sde_recall_tokens" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own recall tokens" ON "public"."sde_recall_tokens";
CREATE POLICY "Users can insert own recall tokens" ON "public"."sde_recall_tokens" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own recall tokens" ON "public"."sde_recall_tokens";
CREATE POLICY "Users can read own recall tokens" ON "public"."sde_recall_tokens" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role can manage security_events" ON "public"."security_events";
CREATE POLICY "Service role can manage security_events" ON "public"."security_events" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can insert own security events" ON "public"."security_events";
CREATE POLICY "Users can insert own security events" ON "public"."security_events" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own security events" ON "public"."security_events";
CREATE POLICY "Users can view own security events" ON "public"."security_events" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can view own share audit logs" ON "public"."share_audit_logs";
CREATE POLICY "Owners can view own share audit logs" ON "public"."share_audit_logs" AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM shares s
  WHERE ((s.share_id = share_audit_logs.share_id) AND (s.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Public can insert share audit logs" ON "public"."share_audit_logs";
CREATE POLICY "Public can insert share audit logs" ON "public"."share_audit_logs" AS PERMISSIVE FOR INSERT TO anon,authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM shares s
  WHERE (s.share_id = share_audit_logs.share_id))));
DROP POLICY IF EXISTS "Users can delete own share collection files" ON "public"."share_collection_files";
CREATE POLICY "Users can delete own share collection files" ON "public"."share_collection_files" AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM share_collections sc
  WHERE ((sc.id = share_collection_files.collection_id) AND (sc.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can insert own share collection files" ON "public"."share_collection_files";
CREATE POLICY "Users can insert own share collection files" ON "public"."share_collection_files" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM share_collections sc
  WHERE ((sc.id = share_collection_files.collection_id) AND (sc.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can view own share collection files" ON "public"."share_collection_files";
CREATE POLICY "Users can view own share collection files" ON "public"."share_collection_files" AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM share_collections sc
  WHERE ((sc.id = share_collection_files.collection_id) AND (sc.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can delete own share collections" ON "public"."share_collections";
CREATE POLICY "Users can delete own share collections" ON "public"."share_collections" AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own share collections" ON "public"."share_collections";
CREATE POLICY "Users can insert own share collections" ON "public"."share_collections" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own share collections" ON "public"."share_collections";
CREATE POLICY "Users can update own share collections" ON "public"."share_collections" AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view own share collections" ON "public"."share_collections";
CREATE POLICY "Users can view own share collections" ON "public"."share_collections" AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert decrypt logs" ON "public"."share_decrypt_logs";
CREATE POLICY "Anyone can insert decrypt logs" ON "public"."share_decrypt_logs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Share owners can view decrypt logs" ON "public"."share_decrypt_logs";
CREATE POLICY "Share owners can view decrypt logs" ON "public"."share_decrypt_logs" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM shares
  WHERE ((shares.share_id = share_decrypt_logs.share_id) AND (shares.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Allow public access to shares by share_id" ON "public"."shares";
CREATE POLICY "Allow public access to shares by share_id" ON "public"."shares" AS PERMISSIVE FOR SELECT TO anon,authenticated USING (((share_id IS NOT NULL) AND ((expires_at IS NULL) OR (expires_at > now())) AND (COALESCE(is_active, true) = true) AND ((share_type = 'public'::text) OR ((auth.uid() IS NOT NULL) AND (share_type = 'user_specific'::text) AND ((auth.uid())::text = ANY (allowed_users))))));
DROP POLICY IF EXISTS "Users can create shares for their files" ON "public"."shares";
CREATE POLICY "Users can create shares for their files" ON "public"."shares" AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM files
  WHERE ((files.id = shares.file_id) AND (files.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Users can create their own shares" ON "public"."shares";
CREATE POLICY "Users can create their own shares" ON "public"."shares" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own shares" ON "public"."shares";
CREATE POLICY "Users can delete their own shares" ON "public"."shares" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read their own shares" ON "public"."shares";
CREATE POLICY "Users can read their own shares" ON "public"."shares" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own shares" ON "public"."shares";
CREATE POLICY "Users can update their own shares" ON "public"."shares" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own shares" ON "public"."shares";
CREATE POLICY "Users can view their own shares" ON "public"."shares" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "shares_select_user_specific" ON "public"."shares";
CREATE POLICY "shares_select_user_specific" ON "public"."shares" AS PERMISSIVE FOR SELECT TO public USING (((share_type = 'user_specific'::text) AND ((expires_at IS NULL) OR (expires_at > now())) AND (auth.uid() IS NOT NULL) AND ((auth.uid())::text = ANY (allowed_users))));
DROP POLICY IF EXISTS "signals_delete_own" ON "public"."signals";
CREATE POLICY "signals_delete_own" ON "public"."signals" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "signals_select_own" ON "public"."signals";
CREATE POLICY "signals_select_own" ON "public"."signals" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "signals_update_own" ON "public"."signals";
CREATE POLICY "signals_update_own" ON "public"."signals" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Anyone can view public sites" ON "public"."site_publications";
CREATE POLICY "Anyone can view public sites" ON "public"."site_publications" AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((visibility = 'public'::text));
DROP POLICY IF EXISTS "Users can create own publications" ON "public"."site_publications";
CREATE POLICY "Users can create own publications" ON "public"."site_publications" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "Users can delete own publications" ON "public"."site_publications";
CREATE POLICY "Users can delete own publications" ON "public"."site_publications" AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "Users can update own publications" ON "public"."site_publications";
CREATE POLICY "Users can update own publications" ON "public"."site_publications" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "Users can view own publications" ON "public"."site_publications";
CREATE POLICY "Users can view own publications" ON "public"."site_publications" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "Users can manage own run jobs" ON "public"."squid_run_jobs";
CREATE POLICY "Users can manage own run jobs" ON "public"."squid_run_jobs" AS PERMISSIVE FOR ALL TO authenticated USING ((run_id IN ( SELECT squid_script_runs.id
   FROM squid_script_runs
  WHERE (squid_script_runs.user_id = auth.uid())))) WITH CHECK ((run_id IN ( SELECT squid_script_runs.id
   FROM squid_script_runs
  WHERE (squid_script_runs.user_id = auth.uid()))));
DROP POLICY IF EXISTS "Users can manage own run steps" ON "public"."squid_run_steps";
CREATE POLICY "Users can manage own run steps" ON "public"."squid_run_steps" AS PERMISSIVE FOR ALL TO authenticated USING ((job_id IN ( SELECT squid_run_jobs.id
   FROM squid_run_jobs
  WHERE (squid_run_jobs.run_id IN ( SELECT squid_script_runs.id
           FROM squid_script_runs
          WHERE (squid_script_runs.user_id = auth.uid())))))) WITH CHECK ((job_id IN ( SELECT squid_run_jobs.id
   FROM squid_run_jobs
  WHERE (squid_run_jobs.run_id IN ( SELECT squid_script_runs.id
           FROM squid_script_runs
          WHERE (squid_script_runs.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Users can manage own runs" ON "public"."squid_script_runs";
CREATE POLICY "Users can manage own runs" ON "public"."squid_script_runs" AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage own triggers" ON "public"."squid_script_triggers";
CREATE POLICY "Users can manage own triggers" ON "public"."squid_script_triggers" AS PERMISSIVE FOR ALL TO authenticated USING ((script_id IN ( SELECT squid_scripts.id
   FROM squid_scripts
  WHERE (squid_scripts.user_id = auth.uid())))) WITH CHECK ((script_id IN ( SELECT squid_scripts.id
   FROM squid_scripts
  WHERE (squid_scripts.user_id = auth.uid()))));
DROP POLICY IF EXISTS "Users can manage own scripts" ON "public"."squid_scripts";
CREATE POLICY "Users can manage own scripts" ON "public"."squid_scripts" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own vault secrets" ON "public"."squid_vault_secrets";
CREATE POLICY "Users can manage own vault secrets" ON "public"."squid_vault_secrets" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can create their own vault" ON "public"."squid_vaults";
CREATE POLICY "Users can create their own vault" ON "public"."squid_vaults" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own vault" ON "public"."squid_vaults";
CREATE POLICY "Users can delete their own vault" ON "public"."squid_vaults" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own vault" ON "public"."squid_vaults";
CREATE POLICY "Users can update their own vault" ON "public"."squid_vaults" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own vault" ON "public"."squid_vaults";
CREATE POLICY "Users can view their own vault" ON "public"."squid_vaults" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Public can read active CDN files" ON "public"."squidcdn_files";
CREATE POLICY "Public can read active CDN files" ON "public"."squidcdn_files" AS PERMISSIVE FOR SELECT TO anon USING ((is_active = true));
DROP POLICY IF EXISTS "Users can manage own CDN files" ON "public"."squidcdn_files";
CREATE POLICY "Users can manage own CDN files" ON "public"."squidcdn_files" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can delete squidcloud buckets" ON "public"."squidcloud_b2_buckets";
CREATE POLICY "Admins can delete squidcloud buckets" ON "public"."squidcloud_b2_buckets" AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert squidcloud buckets" ON "public"."squidcloud_b2_buckets";
CREATE POLICY "Admins can insert squidcloud buckets" ON "public"."squidcloud_b2_buckets" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can update squidcloud buckets" ON "public"."squidcloud_b2_buckets";
CREATE POLICY "Admins can update squidcloud buckets" ON "public"."squidcloud_b2_buckets" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view squidcloud buckets" ON "public"."squidcloud_b2_buckets";
CREATE POLICY "Admins can view squidcloud buckets" ON "public"."squidcloud_b2_buckets" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "service_role_all_audit" ON "public"."squidveil_audit_log";
CREATE POLICY "service_role_all_audit" ON "public"."squidveil_audit_log" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_refs" ON "public"."squidveil_refs";
CREATE POLICY "service_role_all_refs" ON "public"."squidveil_refs" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_sessions" ON "public"."squidveil_sessions";
CREATE POLICY "service_role_all_sessions" ON "public"."squidveil_sessions" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can create own storage providers" ON "public"."storage_providers";
CREATE POLICY "Users can create own storage providers" ON "public"."storage_providers" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own storage providers" ON "public"."storage_providers";
CREATE POLICY "Users can delete own storage providers" ON "public"."storage_providers" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage their own storage providers" ON "public"."storage_providers";
CREATE POLICY "Users can manage their own storage providers" ON "public"."storage_providers" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own storage providers" ON "public"."storage_providers";
CREATE POLICY "Users can update own storage providers" ON "public"."storage_providers" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own storage providers" ON "public"."storage_providers";
CREATE POLICY "Users can view own storage providers" ON "public"."storage_providers" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can read all subscription events" ON "public"."subscription_events";
CREATE POLICY "Admins can read all subscription events" ON "public"."subscription_events" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Service role can insert subscription events" ON "public"."subscription_events";
CREATE POLICY "Service role can insert subscription events" ON "public"."subscription_events" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Users can view their own subscription events" ON "public"."subscription_events";
CREATE POLICY "Users can view their own subscription events" ON "public"."subscription_events" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role can manage notifications" ON "public"."subscription_notifications";
CREATE POLICY "Service role can manage notifications" ON "public"."subscription_notifications" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role manages notifications" ON "public"."subscription_notifications";
CREATE POLICY "Service role manages notifications" ON "public"."subscription_notifications" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "Users can view own notifications" ON "public"."subscription_notifications";
CREATE POLICY "Users can view own notifications" ON "public"."subscription_notifications" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users update own notifications" ON "public"."subscription_notifications";
CREATE POLICY "Users update own notifications" ON "public"."subscription_notifications" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users view own notifications" ON "public"."subscription_notifications";
CREATE POLICY "Users view own notifications" ON "public"."subscription_notifications" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Anyone can view subscriptions" ON "public"."subscriptions";
CREATE POLICY "Anyone can view subscriptions" ON "public"."subscriptions" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Reviewers can manage all activity logs" ON "public"."support_activity_log";
CREATE POLICY "Reviewers can manage all activity logs" ON "public"."support_activity_log" AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin()));
DROP POLICY IF EXISTS "Users can view own ticket activity" ON "public"."support_activity_log";
CREATE POLICY "Users can view own ticket activity" ON "public"."support_activity_log" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_activity_log.ticket_id) AND (support_tickets.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Admins can manage all support messages" ON "public"."support_messages";
CREATE POLICY "Admins can manage all support messages" ON "public"."support_messages" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Reviewers can manage all support messages" ON "public"."support_messages";
CREATE POLICY "Reviewers can manage all support messages" ON "public"."support_messages" AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin()));
DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON "public"."support_messages";
CREATE POLICY "Users can insert messages for their tickets" ON "public"."support_messages" AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_messages.ticket_id) AND (support_tickets.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON "public"."support_messages";
CREATE POLICY "Users can view messages for their tickets" ON "public"."support_messages" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_messages.ticket_id) AND (support_tickets.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Reviewers can manage all refunds" ON "public"."support_refunds";
CREATE POLICY "Reviewers can manage all refunds" ON "public"."support_refunds" AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin()));
DROP POLICY IF EXISTS "Users can view own refunds" ON "public"."support_refunds";
CREATE POLICY "Users can view own refunds" ON "public"."support_refunds" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can manage all support tickets" ON "public"."support_tickets";
CREATE POLICY "Admins can manage all support tickets" ON "public"."support_tickets" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Reviewers can manage all support tickets" ON "public"."support_tickets";
CREATE POLICY "Reviewers can manage all support tickets" ON "public"."support_tickets" AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin())) WITH CHECK (((EXISTS ( SELECT 1
   FROM reviewers
  WHERE ((reviewers.id = auth.uid()) AND (reviewers.is_active = true)))) OR is_admin()));
DROP POLICY IF EXISTS "Users can insert their own tickets" ON "public"."support_tickets";
CREATE POLICY "Users can insert their own tickets" ON "public"."support_tickets" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own tickets" ON "public"."support_tickets";
CREATE POLICY "Users can update their own tickets" ON "public"."support_tickets" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own tickets" ON "public"."support_tickets";
CREATE POLICY "Users can view their own tickets" ON "public"."support_tickets" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "service_role access" ON "public"."system_config";
CREATE POLICY "service_role access" ON "public"."system_config" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read system settings" ON "public"."system_settings";
CREATE POLICY "Admins can read system settings" ON "public"."system_settings" AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Admins can update system settings" ON "public"."system_settings";
CREATE POLICY "Admins can update system settings" ON "public"."system_settings" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));
DROP POLICY IF EXISTS "Anyone can read maintenance mode" ON "public"."system_settings";
CREATE POLICY "Anyone can read maintenance mode" ON "public"."system_settings" AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((setting_key = 'maintenance_mode'::text));
DROP POLICY IF EXISTS "Users can insert their own threat alerts" ON "public"."threat_alerts";
CREATE POLICY "Users can insert their own threat alerts" ON "public"."threat_alerts" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view threat alerts" ON "public"."threat_alerts";
CREATE POLICY "Users can view threat alerts" ON "public"."threat_alerts" AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR (user_id IS NULL)));
DROP POLICY IF EXISTS "Users can create own transcode jobs" ON "public"."transcode_jobs";
CREATE POLICY "Users can create own transcode jobs" ON "public"."transcode_jobs" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own transcode jobs" ON "public"."transcode_jobs";
CREATE POLICY "Users can update own transcode jobs" ON "public"."transcode_jobs" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own transcode jobs" ON "public"."transcode_jobs";
CREATE POLICY "Users can view own transcode jobs" ON "public"."transcode_jobs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can manage upload sessions" ON "public"."upload_sessions";
CREATE POLICY "Admins can manage upload sessions" ON "public"."upload_sessions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Users can view their own upload stats" ON "public"."upload_stats";
CREATE POLICY "Users can view their own upload stats" ON "public"."upload_stats" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own encryption settings" ON "public"."user_encryption_settings";
CREATE POLICY "Users can manage own encryption settings" ON "public"."user_encryption_settings" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Service role can manage notification prefs" ON "public"."user_notification_prefs";
CREATE POLICY "Service role can manage notification prefs" ON "public"."user_notification_prefs" AS PERMISSIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service role reads prefs" ON "public"."user_notification_prefs";
CREATE POLICY "Service role reads prefs" ON "public"."user_notification_prefs" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "Users can update own notification prefs" ON "public"."user_notification_prefs";
CREATE POLICY "Users can update own notification prefs" ON "public"."user_notification_prefs" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own notification prefs" ON "public"."user_notification_prefs";
CREATE POLICY "Users can view own notification prefs" ON "public"."user_notification_prefs" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own notification prefs" ON "public"."user_notification_prefs";
CREATE POLICY "Users manage own notification prefs" ON "public"."user_notification_prefs" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own passkeys" ON "public"."user_passkeys";
CREATE POLICY "Users can delete their own passkeys" ON "public"."user_passkeys" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own passkeys" ON "public"."user_passkeys";
CREATE POLICY "Users can insert their own passkeys" ON "public"."user_passkeys" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own passkeys" ON "public"."user_passkeys";
CREATE POLICY "Users can update their own passkeys" ON "public"."user_passkeys" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own passkeys" ON "public"."user_passkeys";
CREATE POLICY "Users can view their own passkeys" ON "public"."user_passkeys" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own preferences" ON "public"."user_preferences";
CREATE POLICY "Users manage own preferences" ON "public"."user_preferences" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own redeem code claims" ON "public"."user_redeem_codes";
CREATE POLICY "Users can read own redeem code claims" ON "public"."user_redeem_codes" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own security settings" ON "public"."user_security_settings";
CREATE POLICY "Users can insert own security settings" ON "public"."user_security_settings" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own security settings" ON "public"."user_security_settings";
CREATE POLICY "Users can update own security settings" ON "public"."user_security_settings" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own security settings" ON "public"."user_security_settings";
CREATE POLICY "Users can view own security settings" ON "public"."user_security_settings" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own preferences" ON "public"."user_storage_preferences";
CREATE POLICY "Users can update own preferences" ON "public"."user_storage_preferences" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can upsert own preferences" ON "public"."user_storage_preferences";
CREATE POLICY "Users can upsert own preferences" ON "public"."user_storage_preferences" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own preferences" ON "public"."user_storage_preferences";
CREATE POLICY "Users can view own preferences" ON "public"."user_storage_preferences" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their subscriptions" ON "public"."user_subscriptions";
CREATE POLICY "Users can view their subscriptions" ON "public"."user_subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert their own terms acceptance" ON "public"."user_terms_acceptance";
CREATE POLICY "Users can insert their own terms acceptance" ON "public"."user_terms_acceptance" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own terms acceptance" ON "public"."user_terms_acceptance";
CREATE POLICY "Users can update their own terms acceptance" ON "public"."user_terms_acceptance" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own terms acceptance" ON "public"."user_terms_acceptance";
CREATE POLICY "Users can view their own terms acceptance" ON "public"."user_terms_acceptance" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own vault files" ON "public"."vault_files";
CREATE POLICY "Users can manage own vault files" ON "public"."vault_files" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own vaults" ON "public"."vaults";
CREATE POLICY "Users can manage own vaults" ON "public"."vaults" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can create own processing jobs" ON "public"."video_processing_queue";
CREATE POLICY "Users can create own processing jobs" ON "public"."video_processing_queue" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own processing jobs" ON "public"."video_processing_queue";
CREATE POLICY "Users can view own processing jobs" ON "public"."video_processing_queue" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can access own quality metrics" ON "public"."video_quality_metrics";
CREATE POLICY "Users can access own quality metrics" ON "public"."video_quality_metrics" AS PERMISSIVE FOR SELECT TO public USING ((session_id IN ( SELECT video_stream_sessions.session_id
   FROM video_stream_sessions
  WHERE (video_stream_sessions.user_id = auth.uid()))));
DROP POLICY IF EXISTS "Users can insert own quality metrics" ON "public"."video_quality_metrics";
CREATE POLICY "Users can insert own quality metrics" ON "public"."video_quality_metrics" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((session_id IN ( SELECT video_stream_sessions.session_id
   FROM video_stream_sessions
  WHERE (video_stream_sessions.user_id = auth.uid()))));
DROP POLICY IF EXISTS "Users can manage own stream sessions" ON "public"."video_stream_sessions";
CREATE POLICY "Users can manage own stream sessions" ON "public"."video_stream_sessions" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own webhook event logs" ON "public"."webhook_events_log";
CREATE POLICY "Users can view their own webhook event logs" ON "public"."webhook_events_log" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage their own webhooks" ON "public"."webhooks";
CREATE POLICY "Users can manage their own webhooks" ON "public"."webhooks" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Workspace owners manage invites" ON "public"."workspace_invites";
CREATE POLICY "Workspace owners manage invites" ON "public"."workspace_invites" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_invites.workspace_id) AND (w.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_invites.workspace_id) AND (w.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Workspace owners manage members" ON "public"."workspace_members";
CREATE POLICY "Workspace owners manage members" ON "public"."workspace_members" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Workspace owners manage presence" ON "public"."workspace_presence";
CREATE POLICY "Workspace owners manage presence" ON "public"."workspace_presence" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_presence.workspace_id) AND (w.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspaces w
  WHERE ((w.id = workspace_presence.workspace_id) AND (w.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Owners can delete their workspaces" ON "public"."workspaces";
CREATE POLICY "Owners can delete their workspaces" ON "public"."workspaces" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can update their workspaces" ON "public"."workspaces";
CREATE POLICY "Owners can update their workspaces" ON "public"."workspaces" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Owners can view their workspaces" ON "public"."workspaces";
CREATE POLICY "Owners can view their workspaces" ON "public"."workspaces" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can create workspaces" ON "public"."workspaces";
CREATE POLICY "Users can create workspaces" ON "public"."workspaces" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "sv_tokens_owner_all" ON "squidveil"."access_tokens";
CREATE POLICY "sv_tokens_owner_all" ON "squidveil"."access_tokens" AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "sv_audit_owner_all" ON "squidveil"."audit_log";
CREATE POLICY "sv_audit_owner_all" ON "squidveil"."audit_log" AS PERMISSIVE FOR ALL TO authenticated USING (((actor_id = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM squidveil.secrets s
  WHERE (s.owner_id = auth.uid()))))) WITH CHECK (true);
DROP POLICY IF EXISTS "sv_policies_owner_all" ON "squidveil"."policies";
CREATE POLICY "sv_policies_owner_all" ON "squidveil"."policies" AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "sv_rotation_owner_all" ON "squidveil"."rotation_config";
CREATE POLICY "sv_rotation_owner_all" ON "squidveil"."rotation_config" AS PERMISSIVE FOR ALL TO authenticated USING ((secret_id IN ( SELECT secrets.id
   FROM squidveil.secrets
  WHERE (secrets.owner_id = auth.uid())))) WITH CHECK ((secret_id IN ( SELECT secrets.id
   FROM squidveil.secrets
  WHERE (secrets.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "sv_keys_owner_all" ON "squidveil"."secret_keys";
CREATE POLICY "sv_keys_owner_all" ON "squidveil"."secret_keys" AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "sv_versions_owner_all" ON "squidveil"."secret_versions";
CREATE POLICY "sv_versions_owner_all" ON "squidveil"."secret_versions" AS PERMISSIVE FOR ALL TO authenticated USING ((secret_id IN ( SELECT secrets.id
   FROM squidveil.secrets
  WHERE (secrets.owner_id = auth.uid())))) WITH CHECK ((secret_id IN ( SELECT secrets.id
   FROM squidveil.secrets
  WHERE (secrets.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "sv_secrets_owner_all" ON "squidveil"."secrets";
CREATE POLICY "sv_secrets_owner_all" ON "squidveil"."secrets" AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "sv_veilrefs_owner_all" ON "squidveil"."veilrefs";
CREATE POLICY "sv_veilrefs_owner_all" ON "squidveil"."veilrefs" AS PERMISSIVE FOR ALL TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));

COMMIT;