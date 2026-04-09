import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { PlusCircle, Trash2, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Department } from "@shared/schema";

export default function DepartmentsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast({ title: "Department created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department deleted" });
    },
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Departments"
        description="Manage organizational departments"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-dept"><PlusCircle className="h-4 w-4 mr-2" /> Add Department</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Department</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Department Name</Label>
                  <Input data-testid="input-dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Radiology" className="mt-1" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input data-testid="input-dept-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." className="mt-1" />
                </div>
                <Button
                  data-testid="button-save-dept"
                  onClick={() => name.trim() && createMutation.mutate({ name: name.trim(), description: description.trim() })}
                  disabled={!name.trim() || createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "Creating..." : "Create Department"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !departments || departments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No departments configured yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departments.map((dept) => (
              <div key={dept.id} className="rounded-lg border bg-card p-4 flex items-center justify-between" data-testid={`dept-${dept.id}`}>
                <div>
                  <p className="text-sm font-medium">{dept.name}</p>
                  {dept.description && <p className="text-xs text-muted-foreground mt-0.5">{dept.description}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`button-delete-dept-${dept.id}`}
                  onClick={() => {
                    if (confirm(`Delete "${dept.name}"?`)) deleteMutation.mutate(dept.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
