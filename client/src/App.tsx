import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import OrgSetup from "@/pages/org-setup";
import Dashboard from "@/pages/dashboard";
import TicketsPage from "@/pages/tickets";
import TicketDetail from "@/pages/ticket-detail";
import SubmitIssue from "@/pages/submit-issue";
import DepartmentsPage from "@/pages/departments";
import AssetsPage from "@/pages/assets";
import SupplyRequestsPage from "@/pages/supply-requests";
import FacilityRequestsPage from "@/pages/facility-requests";
import VendorsPage from "@/pages/vendors";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import { Skeleton } from "@/components/ui/skeleton";

function AppContent() {
  const { user, org, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route><AuthPage /></Route>
      </Switch>
    );
  }

  if (!org) {
    return <OrgSetup />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/tickets" component={TicketsPage} />
            <Route path="/tickets/:id" component={TicketDetail} />
            <Route path="/submit" component={SubmitIssue} />
            <Route path="/departments" component={DepartmentsPage} />
            <Route path="/assets" component={AssetsPage} />
            <Route path="/supply-requests" component={SupplyRequestsPage} />
            <Route path="/facility-requests" component={FacilityRequestsPage} />
            <Route path="/vendors" component={VendorsPage} />
            <Route path="/analytics" component={AnalyticsPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
