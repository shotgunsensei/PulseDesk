import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ArrowLeft, Clock, User, MapPin, Building2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
  TICKET_CATEGORY_LABELS,
  type Ticket,
  type TicketEvent,
} from "@shared/schema";

type TicketWithNames = Ticket & { departmentName?: string; reportedByName?: string; assignedToName?: string };

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");

  const { data: ticket, isLoading } = useQuery<TicketWithNames>({
    queryKey: ["/api/tickets", id],
  });

  const { data: events } = useQuery<TicketEvent[]>({
    queryKey: ["/api/tickets", id, "events"],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) =>
      apiRequest("PATCH", `/api/tickets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id, "events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket updated" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/tickets/${id}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id, "events"] });
      setNoteContent("");
      toast({ title: "Note added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tickets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setLocation("/tickets");
      toast({ title: "Ticket deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Ticket Details" description="Loading..." />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Ticket Not Found" description="" />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Link href="/tickets"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Tickets</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={`${ticket.ticketNumber}: ${ticket.title}`}
        description={TICKET_CATEGORY_LABELS[ticket.category] || ticket.category}
        action={
          <Link href="/tickets">
            <Button variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ticket.description || "No description provided."}</p>
              </CardContent>
            </Card>

            {(ticket.rootCause || ticket.resolutionSummary) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Resolution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ticket.rootCause && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Root Cause</p>
                      <p className="text-sm">{ticket.rootCause}</p>
                    </div>
                  )}
                  {ticket.resolutionSummary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Resolution Summary</p>
                      <p className="text-sm">{ticket.resolutionSummary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {!events || events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events yet</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div key={event.id} className="flex gap-3 items-start" data-testid={`event-${event.id}`}>
                        <div className="h-2 w-2 rounded-full bg-[hsl(213,64%,33%)] mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm">{event.content || event.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-2 border-t pt-4">
                  <Textarea
                    data-testid="input-note"
                    placeholder="Add an internal note..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={2}
                  />
                  <Button
                    data-testid="button-add-note"
                    size="sm"
                    onClick={() => noteContent.trim() && addNoteMutation.mutate(noteContent.trim())}
                    disabled={!noteContent.trim() || addNoteMutation.isPending}
                  >
                    Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select
                    value={ticket.status}
                    onValueChange={(val) => updateMutation.mutate({ status: val as any })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Select
                    value={ticket.priority}
                    onValueChange={(val) => updateMutation.mutate({ priority: val as any })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm">{ticket.departmentName || "Unassigned"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm">{ticket.location || "Not specified"}</p>
                    {(ticket.building || ticket.floor || ticket.room) && (
                      <p className="text-xs text-muted-foreground">
                        {[ticket.building && `Bldg ${ticket.building}`, ticket.floor && `Floor ${ticket.floor}`, ticket.room && `Room ${ticket.room}`].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Reported By</p>
                    <p className="text-sm">{ticket.reportedByName || "Unknown"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <p className="text-sm">{ticket.assignedToName || "Unassigned"}</p>
                  </div>
                </div>

                {ticket.dueDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="text-sm">{format(new Date(ticket.dueDate), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                )}

                {ticket.vendorReference && (
                  <div>
                    <p className="text-xs text-muted-foreground">Vendor Reference</p>
                    <p className="text-sm">{ticket.vendorReference}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {ticket.isPatientImpacting && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Patient Impacting
                    </span>
                  )}
                  {ticket.isRecurring && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      Recurring
                    </span>
                  )}
                  {ticket.isRepeatIssue && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                      Repeat Issue
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Timestamps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm">{format(new Date(ticket.updatedAt), "MMM d, yyyy h:mm a")}</p>
                </div>
              </CardContent>
            </Card>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              data-testid="button-delete-ticket"
              onClick={() => {
                if (confirm("Delete this ticket? This cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              Delete Ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
