export type Role = "admin" | "supervisor" | "staff" | "technician" | "readonly";

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  supervisor: 80,
  technician: 60,
  staff: 40,
  readonly: 10,
};

export function hasRole(userRole: string | undefined, minRole: Role): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole as Role] || 0) >= ROLE_HIERARCHY[minRole];
}

export function canManageTickets(role: string | undefined): boolean {
  return hasRole(role, "technician");
}

export function canAssignTickets(role: string | undefined): boolean {
  return hasRole(role, "supervisor");
}

export function canManageSettings(role: string | undefined): boolean {
  return hasRole(role, "admin");
}

export function canSubmitIssues(role: string | undefined): boolean {
  return role !== "readonly";
}

export function canAddNotes(role: string | undefined): boolean {
  return role !== "readonly";
}

export function canEscalate(role: string | undefined): boolean {
  return hasRole(role, "supervisor");
}

export function canViewAnalytics(role: string | undefined): boolean {
  return hasRole(role, "supervisor") || role === "readonly";
}

export function canManageUsers(role: string | undefined): boolean {
  return hasRole(role, "admin");
}

export function isReadOnly(role: string | undefined): boolean {
  return role === "readonly";
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  staff: "Staff",
  technician: "Technician",
  readonly: "Executive (Read-Only)",
};
