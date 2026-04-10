import { pool } from "./db";

export async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ticket_priority AS ENUM ('critical','high','normal','low');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ticket_status AS ENUM ('new','triage','assigned','waiting_department','waiting_vendor','in_progress','escalated','resolved','closed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ticket_category AS ENUM ('it_infrastructure','medical_equipment','supplies_inventory','facilities_building','housekeeping_environmental','safety_compliance','vendor_external','administrative','hr_staff','other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE asset_status AS ENUM ('active','under_service','retired','offline');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE supply_request_status AS ENUM ('pending','approved','ordered','fulfilled','denied');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE facility_request_type AS ENUM ('hvac','plumbing','lighting','doors_locks','electrical','room_condition','furniture_workspace','cleaning_environmental','other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        name text NOT NULL,
        description text DEFAULT '',
        contact_name text DEFAULT '',
        contact_phone text DEFAULT '',
        contact_email text DEFAULT '',
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        asset_tag text NOT NULL,
        name text NOT NULL,
        asset_type text DEFAULT '',
        location text DEFAULT '',
        department_id varchar REFERENCES departments(id),
        service_vendor text DEFAULT '',
        warranty_notes text DEFAULT '',
        maintenance_notes text DEFAULT '',
        status asset_status NOT NULL DEFAULT 'active',
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        ticket_number text NOT NULL,
        title text NOT NULL,
        description text DEFAULT '',
        category ticket_category NOT NULL DEFAULT 'other',
        priority ticket_priority NOT NULL DEFAULT 'normal',
        status ticket_status NOT NULL DEFAULT 'new',
        department_id varchar REFERENCES departments(id),
        location text DEFAULT '',
        building text DEFAULT '',
        floor text DEFAULT '',
        room text DEFAULT '',
        asset_id varchar REFERENCES assets(id),
        reported_by varchar REFERENCES users(id),
        assigned_to varchar REFERENCES users(id),
        due_date timestamp,
        internal_notes text DEFAULT '',
        vendor_reference text DEFAULT '',
        root_cause text DEFAULT '',
        resolution_summary text DEFAULT '',
        is_recurring boolean NOT NULL DEFAULT false,
        is_patient_impacting boolean NOT NULL DEFAULT false,
        is_repeat_issue boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        ticket_id varchar NOT NULL REFERENCES tickets(id),
        type text NOT NULL,
        content text DEFAULT '',
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS supply_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        request_type text DEFAULT '',
        item_name text NOT NULL,
        quantity integer NOT NULL DEFAULT 1,
        urgency ticket_priority NOT NULL DEFAULT 'normal',
        department_id varchar REFERENCES departments(id),
        justification text DEFAULT '',
        status supply_request_status NOT NULL DEFAULT 'pending',
        requested_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS facility_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        request_type facility_request_type NOT NULL DEFAULT 'other',
        title text NOT NULL,
        description text DEFAULT '',
        location text DEFAULT '',
        building text DEFAULT '',
        floor text DEFAULT '',
        room text DEFAULT '',
        priority ticket_priority NOT NULL DEFAULT 'normal',
        status ticket_status NOT NULL DEFAULT 'new',
        requested_by varchar REFERENCES users(id),
        assigned_to varchar REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        name text NOT NULL,
        service_type text DEFAULT '',
        phone text DEFAULT '',
        email text DEFAULT '',
        emergency_contact text DEFAULT '',
        contract_notes text DEFAULT '',
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM ('ticket_created','ticket_assigned','ticket_status_changed','ticket_note_added','ticket_escalated','ticket_overdue','supply_request_update','facility_request_update');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE org_plan AS ENUM ('free','pro','pro_plus','enterprise','unlimited');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TYPE org_plan ADD VALUE IF NOT EXISTS 'pro_plus';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE org_plan ADD VALUE IF NOT EXISTS 'unlimited';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE orgs ADD COLUMN plan org_plan NOT NULL DEFAULT 'free';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE orgs ADD COLUMN stripe_customer_id text;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE orgs ADD COLUMN stripe_subscription_id text;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE orgs ADD COLUMN plan_expires_at timestamp;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        user_id varchar NOT NULL REFERENCES users(id),
        type notification_type NOT NULL,
        title text NOT NULL,
        message text NOT NULL,
        ticket_id varchar REFERENCES tickets(id),
        read boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE onboarding_status AS ENUM ('pending','in_progress','complete','skipped');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS onboarding_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id varchar NOT NULL REFERENCES orgs(id),
        title text NOT NULL,
        description text DEFAULT '',
        route text DEFAULT '',
        sort_order integer NOT NULL DEFAULT 0,
        status onboarding_status NOT NULL DEFAULT 'pending',
        completion_source text DEFAULT 'manual',
        completed_by varchar REFERENCES users(id),
        completed_at timestamp,
        dismissed_at timestamp,
        auto_complete_key text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);

    await client.query("COMMIT");
    console.log("Schema verification complete - all tables ensured.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Schema migration error:", err);
    throw err;
  } finally {
    client.release();
  }
}
