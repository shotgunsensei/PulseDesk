CREATE TABLE "ticket_counters" (
	"org_id" varchar PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_counters" ADD CONSTRAINT "ticket_counters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;