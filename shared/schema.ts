import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const membershipRoleEnum = pgEnum("membership_role", [
  "admin",
  "supervisor",
  "staff",
  "technician",
  "readonly",
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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
});

export const orgs = pgTable("orgs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  phone: text("phone").default(""),
  email: text("email").default(""),
  address: text("address").default(""),
  logoUrl: text("logo_url"),
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
