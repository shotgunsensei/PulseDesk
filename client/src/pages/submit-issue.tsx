import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS, type Department, type Asset } from "@shared/schema";

export default function SubmitIssue() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("normal");
  const [departmentId, setDepartmentId] = useState("");
  const [location_, setLocation_] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [assetId, setAssetId] = useState("");
  const [isPatientImpacting, setIsPatientImpacting] = useState(false);
  const [isRepeatIssue, setIsRepeatIssue] = useState(false);

  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: assets } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tickets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Issue submitted successfully" });
      setLocation("/tickets");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      departmentId: departmentId || null,
      location: location_.trim(),
      building: building.trim(),
      floor: floor.trim(),
      room: room.trim(),
      assetId: assetId || null,
      isPatientImpacting,
      isRepeatIssue,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Submit New Issue"
        description="Report an operational issue quickly and easily"
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Issue Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">What's the issue? *</Label>
                <Input
                  id="title"
                  data-testid="input-title"
                  placeholder="Brief description of the problem..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-1" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TICKET_CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Urgency</Label>
                  <Select value={priority} onValueChange={setPriority}>
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
              </div>

              <div>
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="mt-1" data-testid="select-department">
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-description"
                  placeholder="Provide more details about the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="location">Location Description</Label>
                <Input
                  id="location"
                  data-testid="input-location"
                  placeholder="e.g., Building A, Floor 2, Near nurses station"
                  value={location_}
                  onChange={(e) => setLocation_(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="building">Building</Label>
                  <Input id="building" data-testid="input-building" placeholder="A" value={building} onChange={(e) => setBuilding(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="floor">Floor</Label>
                  <Input id="floor" data-testid="input-floor" placeholder="2" value={floor} onChange={(e) => setFloor(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="room">Room</Label>
                  <Input id="room" data-testid="input-room" placeholder="205" value={room} onChange={(e) => setRoom(e.target.value)} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Affected Equipment</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger className="mt-1" data-testid="select-asset">
                    <SelectValue placeholder="Select equipment (if applicable)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {assets?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.assetTag} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="patient-impacting"
                  data-testid="check-patient-impacting"
                  checked={isPatientImpacting}
                  onCheckedChange={(v) => setIsPatientImpacting(!!v)}
                />
                <Label htmlFor="patient-impacting" className="text-sm font-normal cursor-pointer">
                  This issue is impacting patient care or safety
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="repeat-issue"
                  data-testid="check-repeat-issue"
                  checked={isRepeatIssue}
                  onCheckedChange={(v) => setIsRepeatIssue(!!v)}
                />
                <Label htmlFor="repeat-issue" className="text-sm font-normal cursor-pointer">
                  This is a repeat or recurring issue
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              data-testid="button-submit-issue"
              disabled={submitMutation.isPending}
              className="flex-1"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Issue"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setLocation("/tickets")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
