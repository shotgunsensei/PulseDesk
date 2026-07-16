CREATE TYPE "public"."asset_status" AS ENUM('active', 'under_service', 'retired', 'offline');--> statement-breakpoint
CREATE TYPE "public"."auth_mode" AS ENUM('local', 'm365', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."connector_event_type" AS ENUM('poll_success', 'poll_error', 'auth_success', 'auth_error', 'disabled', 'enabled', 'config_changed');--> statement-breakpoint
CREATE TYPE "public"."connector_provider" AS ENUM('google', 'microsoft', 'imap', 'forwarding');--> statement-breakpoint
CREATE TYPE "public"."connector_status" AS ENUM('active', 'error', 'disabled', 'pending_auth');--> statement-breakpoint
CREATE TYPE "public"."facility_request_type" AS ENUM('hvac', 'plumbing', 'lighting', 'doors_locks', 'electrical', 'room_condition', 'furniture_workspace', 'cleaning_environmental', 'other');--> statement-breakpoint
CREATE TYPE "public"."inbound_email_status" AS ENUM('accepted', 'rejected', 'failed', 'threaded', 'created');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'supervisor', 'staff', 'technician', 'readonly', 'tech', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ticket_created', 'ticket_assigned', 'ticket_status_changed', 'ticket_note_added', 'ticket_escalated', 'ticket_overdue', 'supply_request_update', 'facility_request_update');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('pending', 'in_progress', 'complete', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('free', 'pro', 'pro_plus', 'enterprise', 'unlimited', 'individual', 'small_business');--> statement-breakpoint
CREATE TYPE "public"."supply_request_status" AS ENUM('pending', 'approved', 'ordered', 'fulfilled', 'denied');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('it_infrastructure', 'medical_equipment', 'supplies_inventory', 'facilities_building', 'housekeeping_environmental', 'safety_compliance', 'vendor_external', 'administrative', 'hr_staff', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('critical', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."ticket_source" AS ENUM('manual', 'email');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'triage', 'assigned', 'waiting_department', 'waiting_vendor', 'in_progress', 'escalated', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"actor_user_id" varchar,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"summary" text DEFAULT '',
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"asset_tag" text NOT NULL,
	"name" text NOT NULL,
	"asset_type" text DEFAULT '',
	"serial_number" text DEFAULT '',
	"client_id" varchar,
	"site_id" varchar,
	"location" text DEFAULT '',
	"department_id" varchar,
	"service_vendor" text DEFAULT '',
	"warranty_notes" text DEFAULT '',
	"maintenance_notes" text DEFAULT '',
	"assigned_user_id" varchar,
	"purchase_date" timestamp,
	"warranty_start" timestamp,
	"warranty_end" timestamp,
	"notes" text DEFAULT '',
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar,
	"comment_id" varchar,
	"internal_note_id" varchar,
	"uploaded_by" varchar,
	"original_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar,
	"user_id" varchar,
	"event_type" text NOT NULL,
	"auth_source" text,
	"tenant_resolved" text,
	"ip_address" text,
	"user_agent" text,
	"details" jsonb,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"client_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"phone" text DEFAULT '',
	"email" text DEFAULT '',
	"website" text DEFAULT '',
	"address" text DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "connector_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"event_type" "connector_event_type" NOT NULL,
	"message" text DEFAULT '',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"site_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '',
	"title" text DEFAULT '',
	"email" text DEFAULT '',
	"phone" text DEFAULT '',
	"mobile" text DEFAULT '',
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"client_id" varchar,
	"vendor_id" varchar,
	"name" text NOT NULL,
	"contract_number" text DEFAULT '',
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"renewal_date" timestamp,
	"terms" text DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"contact_name" text DEFAULT '',
	"contact_phone" text DEFAULT '',
	"contact_email" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"asset_id" varchar NOT NULL,
	"hostname" text NOT NULL,
	"device_type" text DEFAULT 'workstation',
	"operating_system" text DEFAULT '',
	"ip_address" text DEFAULT '',
	"mac_address" text DEFAULT '',
	"manufacturer" text DEFAULT '',
	"model" text DEFAULT '',
	"last_seen_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"inbound_alias" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"default_department_id" varchar,
	"default_assignee_id" varchar,
	"allowed_sender_domains" text[],
	"auto_create_contacts" boolean DEFAULT true NOT NULL,
	"append_replies_to_tickets" boolean DEFAULT true NOT NULL,
	"unknown_sender_action" text DEFAULT 'create_ticket' NOT NULL,
	"imap_host" text,
	"imap_port" integer DEFAULT 993,
	"imap_user" text,
	"imap_password_encrypted" text,
	"imap_tls" boolean DEFAULT true NOT NULL,
	"imap_enabled" boolean DEFAULT false NOT NULL,
	"imap_last_polled_at" timestamp,
	"imap_last_error" text,
	"imap_poll_interval_seconds" integer DEFAULT 120,
	"imap_folder" text DEFAULT 'INBOX',
	"imap_consecutive_failures" integer DEFAULT 0 NOT NULL,
	"imap_emails_processed" integer DEFAULT 0 NOT NULL,
	"google_client_id" text,
	"google_client_secret_encrypted" text,
	"microsoft_client_id" text,
	"microsoft_client_secret_encrypted" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_settings_org_id_unique" UNIQUE("org_id"),
	CONSTRAINT "email_settings_inbound_alias_unique" UNIQUE("inbound_alias")
);
--> statement-breakpoint
CREATE TABLE "facility_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"request_type" "facility_request_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"location" text DEFAULT '',
	"building" text DEFAULT '',
	"floor" text DEFAULT '',
	"room" text DEFAULT '',
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"requested_by" varchar,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_email_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar,
	"message_id" text,
	"from_email" text NOT NULL,
	"from_name" text DEFAULT '',
	"to_address" text NOT NULL,
	"subject" text DEFAULT '',
	"body_plain" text DEFAULT '',
	"body_html" text DEFAULT '',
	"in_reply_to" text,
	"references_header" text,
	"headers" jsonb,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"spf_result" text,
	"dkim_result" text,
	"dmarc_result" text,
	"status" "inbound_email_status" NOT NULL,
	"status_reason" text DEFAULT '',
	"ticket_id" varchar,
	"provider" text DEFAULT 'mock',
	"connector_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"code" text NOT NULL,
	"role" "membership_role" DEFAULT 'staff' NOT NULL,
	"expires_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"category_id" varchar,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text DEFAULT '',
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"author_id" varchar NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"parent_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_connectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"provider" "connector_provider" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"status" "connector_status" DEFAULT 'pending_auth' NOT NULL,
	"email_address" text,
	"credentials_encrypted" text,
	"imap_host" text,
	"imap_port" integer DEFAULT 993,
	"imap_tls" boolean DEFAULT true NOT NULL,
	"imap_folder" text DEFAULT 'INBOX',
	"poll_interval_seconds" integer DEFAULT 120,
	"last_polled_at" timestamp,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"emails_processed" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" "membership_role" DEFAULT 'staff' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"event_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"ticket_id" varchar,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"route" text DEFAULT '',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "onboarding_status" DEFAULT 'pending' NOT NULL,
	"completion_source" text DEFAULT 'manual',
	"completed_by" varchar,
	"completed_at" timestamp,
	"dismissed_at" timestamp,
	"auto_complete_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operatoros_entitlement_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operatoros_user_id" text NOT NULL,
	"operatoros_tenant_id" text NOT NULL,
	"local_user_id" varchar,
	"local_org_id" varchar,
	"module_slug" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"access_level" text DEFAULT 'none' NOT NULL,
	"module_role" text DEFAULT 'none' NOT NULL,
	"tenant_role" text,
	"tenant_role_alias" text,
	"subscription_status" text,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "org_auth_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"auth_mode" "auth_mode" DEFAULT 'local' NOT NULL,
	"entra_tenant_id" text,
	"entra_tenant_domain" text,
	"entra_client_id" text,
	"entra_client_secret_encrypted" text,
	"entra_redirect_uri" text,
	"entra_post_logout_redirect_uri" text,
	"entra_allowed_domains" text[],
	"entra_jit_provisioning_enabled" boolean DEFAULT true NOT NULL,
	"entra_require_admin_consent" boolean DEFAULT false NOT NULL,
	"entra_last_test_status" text,
	"entra_last_tested_at" timestamp,
	"graph_enabled" boolean DEFAULT false NOT NULL,
	"graph_scopes" text[],
	"graph_sync_interval" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_auth_config_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "org_role_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"entra_group_id" text NOT NULL,
	"display_label" text,
	"pulsedesk_role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"phone" text DEFAULT '',
	"email" text DEFAULT '',
	"address" text DEFAULT '',
	"logo_url" text,
	"plan" "org_plan" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_expires_at" timestamp,
	"subscription_status" text,
	"cancel_at_period_end" boolean DEFAULT false,
	"last_stripe_event_id" text,
	"last_stripe_event_created" integer,
	"operatoros_org_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "orgs_operatoros_org_id_unique" UNIQUE("operatoros_org_id")
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"email_alias" text,
	"color" text DEFAULT '#2563eb',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"resource" text DEFAULT 'tickets' NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"site_code" text NOT NULL,
	"address_1" text DEFAULT '',
	"address_2" text DEFAULT '',
	"city" text DEFAULT '',
	"state" text DEFAULT '',
	"postal_code" text DEFAULT '',
	"country" text DEFAULT 'US',
	"phone" text DEFAULT '',
	"timezone" text DEFAULT 'America/New_York',
	"notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sla_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"sla_policy_id" varchar,
	"event_type" text NOT NULL,
	"target_at" timestamp,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"response_minutes" integer DEFAULT 240 NOT NULL,
	"resolution_minutes" integer DEFAULT 1440 NOT NULL,
	"business_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pause_statuses" text[] DEFAULT ARRAY[]::text[],
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"request_type" text DEFAULT '',
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"urgency" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"department_id" varchar,
	"justification" text DEFAULT '',
	"status" "supply_request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#64748b',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"team_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"queue_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"technician_id" varchar,
	"queue_id" varchar,
	"team_id" varchar,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"unassigned_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ticket_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar,
	"description" text DEFAULT '',
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"body" text NOT NULL,
	"body_format" text DEFAULT 'plain' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ticket_email_metadata" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"org_id" varchar NOT NULL,
	"message_id" text,
	"in_reply_to" text,
	"references_header" text,
	"from_email" text NOT NULL,
	"from_name" text DEFAULT '',
	"original_subject" text DEFAULT '',
	"contact_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"type" text NOT NULL,
	"content" text DEFAULT '',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_internal_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"body" text NOT NULL,
	"body_format" text DEFAULT 'plain' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ticket_priorities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#64748b',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"response_minutes" integer,
	"resolution_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_statuses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#64748b',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_closed_state" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"source" "ticket_source" DEFAULT 'manual' NOT NULL,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"client_id" varchar,
	"site_id" varchar,
	"contact_id" varchar,
	"queue_id" varchar,
	"team_id" varchar,
	"sla_policy_id" varchar,
	"ticket_type_id" varchar,
	"status_config_id" varchar,
	"priority_config_id" varchar,
	"category_config_id" varchar,
	"department_id" varchar,
	"location" text DEFAULT '',
	"building" text DEFAULT '',
	"floor" text DEFAULT '',
	"room" text DEFAULT '',
	"asset_id" varchar,
	"reported_by" varchar,
	"assigned_to" varchar,
	"due_date" timestamp,
	"internal_notes" text DEFAULT '',
	"vendor_reference" text DEFAULT '',
	"vendor_contacted_at" timestamp,
	"vendor_expected_follow_up_at" timestamp,
	"root_cause" text DEFAULT '',
	"resolution_summary" text DEFAULT '',
	"is_recurring" boolean DEFAULT false NOT NULL,
	"is_patient_impacting" boolean DEFAULT false NOT NULL,
	"is_repeat_issue" boolean DEFAULT false NOT NULL,
	"response_due_at" timestamp,
	"resolution_due_at" timestamp,
	"first_responded_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"reopened_at" timestamp,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"minutes" integer NOT NULL,
	"work_type" text DEFAULT 'remote' NOT NULL,
	"description" text DEFAULT '',
	"billable" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '',
	"email" text DEFAULT '',
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"auth_source" text DEFAULT 'local',
	"entra_object_id" text,
	"entra_upn" text,
	"entra_department" text,
	"entra_job_title" text,
	"entra_manager_id" text,
	"graph_last_synced_at" timestamp,
	"last_login_at" timestamp,
	"operatoros_user_id" text,
	"operatoros_role" text,
	"operatoros_plan_slug" text,
	"operatoros_org_id" text,
	"last_sso_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_operatoros_user_id_unique" UNIQUE("operatoros_user_id")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"name" text NOT NULL,
	"service_type" text DEFAULT '',
	"phone" text DEFAULT '',
	"email" text DEFAULT '',
	"emergency_contact" text DEFAULT '',
	"contract_notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_ticket_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."ticket_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_internal_note_id_ticket_internal_notes_id_fk" FOREIGN KEY ("internal_note_id") REFERENCES "public"."ticket_internal_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_log" ADD CONSTRAINT "auth_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_events" ADD CONSTRAINT "connector_events_connector_id_mail_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."mail_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_events" ADD CONSTRAINT "connector_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_contacts" ADD CONSTRAINT "email_contacts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_default_department_id_departments_id_fk" FOREIGN KEY ("default_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_requests" ADD CONSTRAINT "facility_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_requests" ADD CONSTRAINT "facility_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_requests" ADD CONSTRAINT "facility_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_email_log" ADD CONSTRAINT "inbound_email_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_email_log" ADD CONSTRAINT "inbound_email_log_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_email_log" ADD CONSTRAINT "inbound_email_log_connector_id_mail_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."mail_connectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_connectors" ADD CONSTRAINT "mail_connectors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_items" ADD CONSTRAINT "onboarding_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_items" ADD CONSTRAINT "onboarding_items_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operatoros_entitlement_snapshots" ADD CONSTRAINT "operatoros_entitlement_snapshots_local_user_id_users_id_fk" FOREIGN KEY ("local_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operatoros_entitlement_snapshots" ADD CONSTRAINT "operatoros_entitlement_snapshots_local_org_id_orgs_id_fk" FOREIGN KEY ("local_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_auth_config" ADD CONSTRAINT "org_auth_config_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_role_mappings" ADD CONSTRAINT "org_role_mappings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_events_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_email_metadata" ADD CONSTRAINT "ticket_email_metadata_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_email_metadata" ADD CONSTRAINT "ticket_email_metadata_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_email_metadata" ADD CONSTRAINT "ticket_email_metadata_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_internal_notes" ADD CONSTRAINT "ticket_internal_notes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_internal_notes" ADD CONSTRAINT "ticket_internal_notes_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_internal_notes" ADD CONSTRAINT "ticket_internal_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_priorities" ADD CONSTRAINT "ticket_priorities_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_statuses" ADD CONSTRAINT "ticket_statuses_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_config_id_ticket_statuses_id_fk" FOREIGN KEY ("status_config_id") REFERENCES "public"."ticket_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_priority_config_id_ticket_priorities_id_fk" FOREIGN KEY ("priority_config_id") REFERENCES "public"."ticket_priorities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_config_id_ticket_categories_id_fk" FOREIGN KEY ("category_config_id") REFERENCES "public"."ticket_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_assets_org_tag" ON "assets" USING btree ("org_id","asset_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clients_org_code" ON "clients" USING btree ("org_id","client_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_devices_org_hostname" ON "devices" USING btree ("org_id","hostname");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_contacts_org_email" ON "email_contacts" USING btree ("org_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_articles_org_slug" ON "knowledge_articles" USING btree ("org_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_categories_org_slug" ON "knowledge_categories" USING btree ("org_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_preferences_org_user" ON "notification_preferences" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_operatoros_entitlement_snapshots_unique" ON "operatoros_entitlement_snapshots" USING btree ("operatoros_user_id","operatoros_tenant_id","module_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_role_mappings_org_group" ON "org_role_mappings" USING btree ("org_id","entra_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_queues_org_name" ON "queues" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sites_org_code" ON "sites" USING btree ("org_id","site_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sla_policies_org_name" ON "sla_policies" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tags_org_name" ON "tags" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_team_members_unique" ON "team_members" USING btree ("org_id","team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_teams_org_name" ON "teams" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ticket_categories_org_key" ON "ticket_categories" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ticket_priorities_org_key" ON "ticket_priorities" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ticket_statuses_org_key" ON "ticket_statuses" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ticket_tags_unique" ON "ticket_tags" USING btree ("org_id","ticket_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ticket_types_org_key" ON "ticket_types" USING btree ("org_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tickets_org_number" ON "tickets" USING btree ("org_id","ticket_number");