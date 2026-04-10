import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  pgEnum,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "supervisor",
  "staff",
  "technician",
  "readonly",
  "tech",
  "viewer",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "critical",
  "high",
  "normal",
  "low",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "new",
  "triage",
  "assigned",
  "waiting_department",
  "waiting_vendor",
  "in_progress",
  "escalated",
  "resolved",
  "closed",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "it_infrastructure",
  "medical_equipment",
  "supplies_inventory",
  "facilities_building",
  "housekeeping_environmental",
  "safety_compliance",
  "vendor_external",
  "administrative",
  "hr_staff",
  "other",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "active",
  "under_service",
  "retired",
  "offline",
]);

export const supplyRequestStatusEnum = pgEnum("supply_request_status", [
  "pending",
  "approved",
  "ordered",
  "fulfilled",
  "denied",
]);

export const facilityRequestTypeEnum = pgEnum("facility_request_type", [
  "hvac",
  "plumbing",
  "lighting",
  "doors_locks",
  "electrical",
  "room_condition",
  "furniture_workspace",
  "cleaning_environmental",
  "other",
]);

export const authModeEnum = pgEnum("auth_mode", [
  "local",
  "m365",
  "hybrid",
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  authSource: text("auth_source").default("local"),
  entraObjectId: text("entra_object_id"),
  entraUPN: text("entra_upn"),
  entraDepartment: text("entra_department"),
  entraJobTitle: text("entra_job_title"),
  entraManagerId: text("entra_manager_id"),
  graphLastSyncedAt: timestamp("graph_last_synced_at"),
  lastLoginAt: timestamp("last_login_at"),
});

export const orgPlanEnum = pgEnum("org_plan", [
  "free",
  "pro",
  "pro_plus",
  "enterprise",
  "unlimited",
  "individual",
  "small_business",
]);

export const orgs = pgTable("orgs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  phone: text("phone").default(""),
  email: text("email").default(""),
  address: text("address").default(""),
  logoUrl: text("logo_url"),
  plan: orgPlanEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planExpiresAt: timestamp("plan_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  role: membershipRoleEnum("role").notNull().default("staff"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inviteCodes = pgTable("invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  code: text("code").notNull().unique(),
  role: membershipRoleEnum("role").notNull().default("staff"),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  name: text("name").notNull(),
  description: text("description").default(""),
  contactName: text("contact_name").default(""),
  contactPhone: text("contact_phone").default(""),
  contactEmail: text("contact_email").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  ticketNumber: text("ticket_number").notNull(),
  title: text("title").notNull(),
  description: text("description").default(""),
  category: ticketCategoryEnum("category").notNull().default("other"),
  priority: ticketPriorityEnum("priority").notNull().default("normal"),
  status: ticketStatusEnum("status").notNull().default("new"),
  departmentId: varchar("department_id").references(() => departments.id),
  location: text("location").default(""),
  building: text("building").default(""),
  floor: text("floor").default(""),
  room: text("room").default(""),
  assetId: varchar("asset_id").references(() => assets.id),
  reportedBy: varchar("reported_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  dueDate: timestamp("due_date"),
  internalNotes: text("internal_notes").default(""),
  vendorReference: text("vendor_reference").default(""),
  rootCause: text("root_cause").default(""),
  resolutionSummary: text("resolution_summary").default(""),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  isPatientImpacting: boolean("is_patient_impacting").default(false).notNull(),
  isRepeatIssue: boolean("is_repeat_issue").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketEvents = pgTable("ticket_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  ticketId: varchar("ticket_id")
    .notNull()
    .references(() => tickets.id),
  type: text("type").notNull(),
  content: text("content").default(""),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  assetTag: text("asset_tag").notNull(),
  name: text("name").notNull(),
  assetType: text("asset_type").default(""),
  location: text("location").default(""),
  departmentId: varchar("department_id").references(() => departments.id),
  serviceVendor: text("service_vendor").default(""),
  warrantyNotes: text("warranty_notes").default(""),
  maintenanceNotes: text("maintenance_notes").default(""),
  status: assetStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyRequests = pgTable("supply_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  requestType: text("request_type").default(""),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  urgency: ticketPriorityEnum("urgency").notNull().default("normal"),
  departmentId: varchar("department_id").references(() => departments.id),
  justification: text("justification").default(""),
  status: supplyRequestStatusEnum("status").notNull().default("pending"),
  requestedBy: varchar("requested_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const facilityRequests = pgTable("facility_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  requestType: facilityRequestTypeEnum("request_type").notNull().default("other"),
  title: text("title").notNull(),
  description: text("description").default(""),
  location: text("location").default(""),
  building: text("building").default(""),
  floor: text("floor").default(""),
  room: text("room").default(""),
  priority: ticketPriorityEnum("priority").notNull().default("normal"),
  status: ticketStatusEnum("status").notNull().default("new"),
  requestedBy: varchar("requested_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  name: text("name").notNull(),
  serviceType: text("service_type").default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  emergencyContact: text("emergency_contact").default(""),
  contractNotes: text("contract_notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orgAuthConfig = pgTable("org_auth_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id)
    .unique(),
  authMode: authModeEnum("auth_mode").notNull().default("local"),
  entraTenantId: text("entra_tenant_id"),
  entraTenantDomain: text("entra_tenant_domain"),
  entraClientId: text("entra_client_id"),
  entraClientSecretEncrypted: text("entra_client_secret_encrypted"),
  entraRedirectUri: text("entra_redirect_uri"),
  entraPostLogoutRedirectUri: text("entra_post_logout_redirect_uri"),
  entraAllowedDomains: text("entra_allowed_domains").array(),
  entraJitProvisioningEnabled: boolean("entra_jit_provisioning_enabled").default(true).notNull(),
  entraRequireAdminConsent: boolean("entra_require_admin_consent").default(false).notNull(),
  entraLastTestStatus: text("entra_last_test_status"),
  entraLastTestedAt: timestamp("entra_last_tested_at"),
  graphEnabled: boolean("graph_enabled").default(false).notNull(),
  graphScopes: text("graph_scopes").array(),
  graphSyncInterval: integer("graph_sync_interval"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orgRoleMappings = pgTable("org_role_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  entraGroupId: text("entra_group_id").notNull(),
  displayLabel: text("display_label"),
  pulsedeskRole: text("pulsedesk_role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgGroup: uniqueIndex("idx_org_role_mappings_org_group").on(table.orgId, table.entraGroupId),
}));

export const notificationTypeEnum = pgEnum("notification_type", [
  "ticket_created",
  "ticket_assigned",
  "ticket_status_changed",
  "ticket_note_added",
  "ticket_escalated",
  "ticket_overdue",
  "supply_request_update",
  "facility_request_update",
]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  ticketId: varchar("ticket_id").references(() => tickets.id),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authAuditLog = pgTable("auth_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => orgs.id),
  userId: varchar("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  authSource: text("auth_source"),
  tenantResolved: text("tenant_resolved"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  success: boolean("success").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  phone: true,
  email: true,
});

export const insertOrgSchema = createInsertSchema(orgs).pick({
  name: true,
  slug: true,
  phone: true,
  email: true,
  address: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).pick({
  orgId: true,
  userId: true,
  role: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).pick({
  name: true,
  description: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
});

export const insertTicketSchema = createInsertSchema(tickets).pick({
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  departmentId: true,
  location: true,
  building: true,
  floor: true,
  room: true,
  assetId: true,
  assignedTo: true,
  dueDate: true,
  internalNotes: true,
  vendorReference: true,
  rootCause: true,
  resolutionSummary: true,
  isRecurring: true,
  isPatientImpacting: true,
  isRepeatIssue: true,
});

export const insertAssetSchema = createInsertSchema(assets).pick({
  assetTag: true,
  name: true,
  assetType: true,
  location: true,
  departmentId: true,
  serviceVendor: true,
  warrantyNotes: true,
  maintenanceNotes: true,
  status: true,
});

export const insertSupplyRequestSchema = createInsertSchema(supplyRequests).pick({
  requestType: true,
  itemName: true,
  quantity: true,
  urgency: true,
  departmentId: true,
  justification: true,
  status: true,
});

export const insertFacilityRequestSchema = createInsertSchema(facilityRequests).pick({
  requestType: true,
  title: true,
  description: true,
  location: true,
  building: true,
  floor: true,
  room: true,
  priority: true,
  status: true,
  assignedTo: true,
});

export const insertVendorSchema = createInsertSchema(vendors).pick({
  name: true,
  serviceType: true,
  phone: true,
  email: true,
  emergencyContact: true,
  contractNotes: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Org = typeof orgs.$inferSelect;
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type SupplyRequest = typeof supplyRequests.$inferSelect;
export type InsertSupplyRequest = z.infer<typeof insertSupplyRequestSchema>;
export type FacilityRequest = typeof facilityRequests.$inferSelect;
export type InsertFacilityRequest = z.infer<typeof insertFacilityRequestSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type OrgAuthConfig = typeof orgAuthConfig.$inferSelect;
export type OrgRoleMapping = typeof orgRoleMappings.$inferSelect;
export type AuthAuditLogEntry = typeof authAuditLog.$inferSelect;

export const insertOrgAuthConfigSchema = createInsertSchema(orgAuthConfig).omit({
  id: true,
  updatedAt: true,
});
export type InsertOrgAuthConfig = z.infer<typeof insertOrgAuthConfigSchema>;

export const insertOrgRoleMappingSchema = createInsertSchema(orgRoleMappings).omit({
  id: true,
  createdAt: true,
});
export type InsertOrgRoleMapping = z.infer<typeof insertOrgRoleMappingSchema>;

export const AUTH_MODE_LABELS: Record<string, string> = {
  local: "Local Authentication",
  m365: "Microsoft 365 Only",
  hybrid: "Hybrid (M365 + Local Fallback)",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  normal: "Standard",
  low: "Low",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  new: "Intake",
  triage: "Triage",
  assigned: "Assigned",
  waiting_department: "Dept. Pending",
  waiting_vendor: "Vendor Pending",
  in_progress: "In Progress",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  it_infrastructure: "IT / Infrastructure",
  medical_equipment: "Medical Equipment",
  supplies_inventory: "Supplies / Inventory",
  facilities_building: "Facilities / Building",
  housekeeping_environmental: "Environmental Services",
  safety_compliance: "Safety / Compliance",
  vendor_external: "Vendor / External",
  administrative: "Administrative",
  hr_staff: "HR / Staffing",
  other: "General",
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  triage: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  assigned: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  waiting_department: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  waiting_vendor: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  in_progress: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  escalated: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
};

export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  normal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  under_service: "Under Service",
  retired: "Retired",
  offline: "Offline",
};

export const SUPPLY_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  ordered: "Ordered",
  fulfilled: "Fulfilled",
  denied: "Denied",
};

export const FACILITY_STATUS_LABELS: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FACILITY_TYPE_LABELS: Record<string, string> = {
  hvac: "HVAC",
  plumbing: "Plumbing",
  lighting: "Lighting",
  doors_locks: "Doors / Locks",
  electrical: "Electrical",
  room_condition: "Room Condition",
  furniture_workspace: "Furniture / Workspace",
  cleaning_environmental: "Cleaning / Environmental",
  other: "Other",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  staff: "Staff",
  technician: "Technician",
  readonly: "Read-Only Executive",
};

export const PLAN_LIMITS = {
  free: { maxMembers: 5, maxTickets: Infinity, entraEnabled: false, label: "Free", price: 0 },
  pro: { maxMembers: 50, maxTickets: Infinity, entraEnabled: true, label: "Pro", price: 60 },
  pro_plus: { maxMembers: 100, maxTickets: Infinity, entraEnabled: true, label: "Pro Plus", price: 80 },
  enterprise: { maxMembers: 200, maxTickets: Infinity, entraEnabled: true, label: "Enterprise", price: 100 },
  unlimited: { maxMembers: Infinity, maxTickets: Infinity, entraEnabled: true, label: "Unlimited", price: 200 },
} as const;

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "pending",
  "in_progress",
  "complete",
  "skipped",
]);

export const onboardingItems = pgTable("onboarding_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id")
    .notNull()
    .references(() => orgs.id),
  title: text("title").notNull(),
  description: text("description").default(""),
  route: text("route").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  status: onboardingStatusEnum("status").notNull().default("pending"),
  completionSource: text("completion_source").default("manual"),
  completedBy: varchar("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  dismissedAt: timestamp("dismissed_at"),
  autoCompleteKey: text("auto_complete_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOnboardingItemSchema = createInsertSchema(onboardingItems).pick({
  title: true,
  description: true,
  route: true,
  sortOrder: true,
  status: true,
});

export type OnboardingItem = typeof onboardingItems.$inferSelect;
export type InsertOnboardingItem = z.infer<typeof insertOnboardingItemSchema>;

export const DEFAULT_ONBOARDING_ITEMS = [
  { title: "Configure departments", description: "Review and customize your facility's departments for ticket routing", route: "/departments", sortOrder: 1, autoCompleteKey: null },
  { title: "Register equipment & assets", description: "Add medical equipment and facility assets to track", route: "/assets", sortOrder: 2, autoCompleteKey: "assets" },
  { title: "Add vendor contacts", description: "Register external vendors for service tracking", route: "/vendors", sortOrder: 3, autoCompleteKey: "vendors" },
  { title: "Invite team members", description: "Add staff to your organization", route: "/settings", sortOrder: 4, autoCompleteKey: "members" },
  { title: "Submit your first issue", description: "Create your first operations ticket", route: "/submit", sortOrder: 5, autoCompleteKey: "tickets" },
];

export const DEFAULT_DEPARTMENTS = [
  "Radiology",
  "Front Desk",
  "Billing",
  "Administration",
  "Nursing",
  "Lab",
  "Maintenance",
  "IT",
  "Facilities",
  "Clinical Operations",
];
