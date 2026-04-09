import { useState } from "react";
import { Bell, AlertTriangle, UserCheck, ArrowUpRight, Clock, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { isReadOnly } from "@/lib/permissions";

interface MockNotification {
  id: string;
  icon: typeof Bell;
  iconColor: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "1",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    title: "Overdue ticket attention",
    description: "PD-00003 has exceeded its due date",
    time: "2h ago",
    unread: true,
  },
  {
    id: "2",
    icon: UserCheck,
    iconColor: "text-primary",
    title: "Ticket assigned to you",
    description: "PD-00007 — HVAC unit making unusual noise",
    time: "4h ago",
    unread: true,
  },
  {
    id: "3",
    icon: ArrowUpRight,
    iconColor: "text-rose-500",
    title: "Escalation requires review",
    description: "PD-00012 escalated to supervisor level",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "4",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    title: "Ticket resolved",
    description: "PD-00005 — Network outage in Wing B resolved",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "5",
    icon: Package,
    iconColor: "text-blue-500",
    title: "Supply request approved",
    description: "Surgical gloves order has been approved",
    time: "2 days ago",
    unread: false,
  },
];

export function NotificationCenter() {
  const { membership } = useAuth();
  const [open, setOpen] = useState(false);
  const role = membership?.role;

  const notifications = isReadOnly(role)
    ? MOCK_NOTIFICATIONS.filter(n => n.id !== "2")
    : MOCK_NOTIFICATIONS;

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center pulse-dot-critical">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted">
              Preview
            </span>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-muted/50 cursor-pointer ${
                n.unread ? "bg-accent/5" : ""
              }`}
              data-testid={`notification-${n.id}`}
            >
              <div className="pt-0.5">
                <n.icon className={`h-4 w-4 ${n.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-snug ${n.unread ? "font-medium" : "text-muted-foreground"}`}>
                  {n.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.description}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {n.time}
                </p>
              </div>
              {n.unread && (
                <div className="pt-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent block" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t bg-muted/30">
          <p className="text-[10px] text-center text-muted-foreground">
            Notification delivery coming soon
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
