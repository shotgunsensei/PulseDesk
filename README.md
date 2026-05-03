# PulseDesk

**The operational heartbeat of your healthcare facility.**

PulseDesk is a multi-tenant healthcare operations coordination platform: ticketing, departments, assets, supply requests, facility requests, vendors, analytics, billing, and email-to-ticket — all role-gated and ready for HIPAA-conscious workflows.

Live: [pulsedesk.support](https://pulsedesk.support)

---

## Part of the Shotgun Ninjas Productions ecosystem

PulseDesk is one product in a connected family of operations and diagnostic tools built by [Shotgun Ninjas Productions](https://shotgunninjas.com).

| Product | Focus | When to reach for it |
|---|---|---|
| **[PulseDesk](https://pulsedesk.support)** | Healthcare operations | Coordinating a clinic, hospital, or care facility |
| **[TechDeck](https://techdeck.app)** | IT ops & automation | Scripts, runbooks, MSP tooling for technical teams |
| **[TradeFlowKit](https://tradeflowkit.com)** | Business ops & revenue | Vendor spend, contracts, throughput dashboards |
| **[TorqueShed](https://torqueshed.pro)** | Automotive diagnostics | Repair cases, parts, mechanic community |
| **[FaultlineLab](https://faultlinelab.com)** | Diagnostic challenges | Logic, troubleshooting, investigation training |
| **[Shotgun Ninja Village](https://shotgunninjavillage.com)** | Community & creator hub | Games, merch, content |
| **[Shotgun Ninjas](https://shotgunninjas.com)** | Ecosystem hub | The front door to everything above |

PulseDesk is most often paired with **TechDeck** (for the IT teams that keep healthcare facilities online) and **TradeFlowKit** (for tracking vendor and contract throughput across an organization). In-app, you will find a "Related tools" card surfacing these connections in non-intrusive places.

---

## Stack

- **Frontend:** React 18 + Vite + TypeScript + wouter + TanStack Query v5 + shadcn/ui + Tailwind
- **Backend:** Express + tsx + Drizzle ORM + PostgreSQL
- **Auth:** Local + Microsoft 365 Entra ID (per-org OAuth, multi-tenant)
- **Email:** SendGrid Inbound Parse + IMAP polling + Google/Microsoft connector OAuth
- **Billing:** Stripe (per-org subscriptions, webhook-driven plan sync)
- **PWA:** installable, theme-aware, offline-capable shell

## Develop

```bash
npm install
npm run dev    # starts Express + Vite on :5000
npm run build  # client + server production bundles
```

## Project conventions

- Multi-tenant by design — every API route is org-scoped via `requireOrg`.
- OAuth credentials are stored **per-org** (no global `GOOGLE_CLIENT_ID` env required).
- Stripe plans drive feature gates via `shared/billingConfig.ts`.
- All interactive elements carry `data-testid` for stable test selectors.

## Contact & support

- Product support: support@pulsedesk.support
- Ecosystem: [shotgunninjas.com](https://shotgunninjas.com)
