import type { PoolClient } from "pg";

/** Idempotent upgrade for existing PulseDesk databases. Fresh databases can use migrations/. */
export async function ensureServiceDeskSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), name text NOT NULL,
      client_code text NOT NULL, status text NOT NULL DEFAULT 'active', phone text DEFAULT '', email text DEFAULT '', website text DEFAULT '',
      address text DEFAULT '', notes text DEFAULT '', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), archived_at timestamp
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_org_code ON clients(org_id, client_code);

    CREATE TABLE IF NOT EXISTS sites (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), client_id varchar NOT NULL REFERENCES clients(id),
      name text NOT NULL, site_code text NOT NULL, address_1 text DEFAULT '', address_2 text DEFAULT '', city text DEFAULT '', state text DEFAULT '',
      postal_code text DEFAULT '', country text DEFAULT 'US', phone text DEFAULT '', timezone text DEFAULT 'America/New_York', notes text DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), archived_at timestamp
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_org_code ON sites(org_id, site_code);

    CREATE TABLE IF NOT EXISTS contacts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), client_id varchar NOT NULL REFERENCES clients(id),
      site_id varchar REFERENCES sites(id), first_name text NOT NULL, last_name text DEFAULT '', title text DEFAULT '', email text DEFAULT '', phone text DEFAULT '',
      mobile text DEFAULT '', is_primary boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, notes text DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS queues (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), name text NOT NULL, description text DEFAULT '',
      email_alias text, color text DEFAULT '#2563eb', is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_queues_org_name ON queues(org_id, name);

    CREATE TABLE IF NOT EXISTS teams (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), name text NOT NULL, description text DEFAULT '',
      queue_id varchar REFERENCES queues(id), is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_org_name ON teams(org_id, name);

    CREATE TABLE IF NOT EXISTS team_members (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), team_id varchar NOT NULL REFERENCES teams(id),
      user_id varchar NOT NULL REFERENCES users(id), is_lead boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique ON team_members(org_id, team_id, user_id);

    CREATE TABLE IF NOT EXISTS ticket_statuses (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), key text NOT NULL, name text NOT NULL,
      color text DEFAULT '#64748b', sort_order integer NOT NULL DEFAULT 0, is_closed_state boolean NOT NULL DEFAULT false,
      is_default boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_statuses_org_key ON ticket_statuses(org_id, key);

    CREATE TABLE IF NOT EXISTS ticket_priorities (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), key text NOT NULL, name text NOT NULL,
      color text DEFAULT '#64748b', sort_order integer NOT NULL DEFAULT 0, response_minutes integer, resolution_minutes integer, is_active boolean NOT NULL DEFAULT true
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_priorities_org_key ON ticket_priorities(org_id, key);

    CREATE TABLE IF NOT EXISTS ticket_types (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), key text NOT NULL, name text NOT NULL,
      description text DEFAULT '', is_active boolean NOT NULL DEFAULT true
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_types_org_key ON ticket_types(org_id, key);

    CREATE TABLE IF NOT EXISTS ticket_categories (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), key text NOT NULL, name text NOT NULL,
      parent_id varchar, description text DEFAULT '', is_active boolean NOT NULL DEFAULT true
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_categories_org_key ON ticket_categories(org_id, key);

    CREATE TABLE IF NOT EXISTS sla_policies (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), name text NOT NULL, description text DEFAULT '',
      response_minutes integer NOT NULL DEFAULT 240, resolution_minutes integer NOT NULL DEFAULT 1440, business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
      pause_statuses text[] DEFAULT ARRAY[]::text[], is_default boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_policies_org_name ON sla_policies(org_id, name);

    CREATE TABLE IF NOT EXISTS ticket_counters (
      org_id varchar PRIMARY KEY REFERENCES orgs(id), next_number integer NOT NULL DEFAULT 1, updated_at timestamp NOT NULL DEFAULT now()
    );

    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS client_id varchar REFERENCES clients(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS site_id varchar REFERENCES sites(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_id varchar REFERENCES contacts(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS queue_id varchar REFERENCES queues(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS team_id varchar REFERENCES teams(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_policy_id varchar REFERENCES sla_policies(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type_id varchar REFERENCES ticket_types(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status_config_id varchar REFERENCES ticket_statuses(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority_config_id varchar REFERENCES ticket_priorities(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category_config_id varchar REFERENCES ticket_categories(id);
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS response_due_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_due_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_responded_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reopened_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_at timestamp;
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_by varchar REFERENCES users(id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_org_number ON tickets(org_id, ticket_number);

    ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number text DEFAULT '';
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS client_id varchar REFERENCES clients(id);
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS site_id varchar REFERENCES sites(id);
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_user_id varchar REFERENCES users(id);
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date timestamp;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_start timestamp;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_end timestamp;
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE assets ADD COLUMN IF NOT EXISTS archived_at timestamp;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_org_tag ON assets(org_id, asset_tag);

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar NOT NULL REFERENCES tickets(id),
      body text NOT NULL, body_format text NOT NULL DEFAULT 'plain', created_by varchar REFERENCES users(id), created_at timestamp NOT NULL DEFAULT now(), edited_at timestamp
    );
    CREATE TABLE IF NOT EXISTS ticket_internal_notes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar NOT NULL REFERENCES tickets(id),
      body text NOT NULL, body_format text NOT NULL DEFAULT 'plain', created_by varchar REFERENCES users(id), created_at timestamp NOT NULL DEFAULT now(), edited_at timestamp
    );
    CREATE TABLE IF NOT EXISTS ticket_assignments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar NOT NULL REFERENCES tickets(id),
      technician_id varchar REFERENCES users(id), queue_id varchar REFERENCES queues(id), team_id varchar REFERENCES teams(id), assigned_by varchar REFERENCES users(id),
      assigned_at timestamp NOT NULL DEFAULT now(), unassigned_at timestamp
    );
    CREATE TABLE IF NOT EXISTS sla_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar NOT NULL REFERENCES tickets(id),
      sla_policy_id varchar REFERENCES sla_policies(id), event_type text NOT NULL, target_at timestamp, occurred_at timestamp NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE TABLE IF NOT EXISTS time_entries (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar NOT NULL REFERENCES tickets(id), user_id varchar NOT NULL REFERENCES users(id),
      minutes integer NOT NULL CHECK (minutes > 0), work_type text NOT NULL DEFAULT 'remote', description text DEFAULT '', billable boolean NOT NULL DEFAULT false,
      started_at timestamp, ended_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar REFERENCES tickets(id),
      comment_id varchar REFERENCES ticket_comments(id), internal_note_id varchar REFERENCES ticket_internal_notes(id), uploaded_by varchar REFERENCES users(id),
      original_name text NOT NULL, storage_key text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL, checksum_sha256 text NOT NULL,
      is_internal boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tags (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), name text NOT NULL, color text DEFAULT '#64748b', created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_org_name ON tags(org_id, name);
    CREATE TABLE IF NOT EXISTS ticket_tags (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), ticket_id varchar NOT NULL REFERENCES tickets(id),
      tag_id varchar NOT NULL REFERENCES tags(id), created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_tags_unique ON ticket_tags(org_id, ticket_id, tag_id);

    CREATE TABLE IF NOT EXISTS devices (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), asset_id varchar NOT NULL REFERENCES assets(id),
      hostname text NOT NULL, device_type text DEFAULT 'workstation', operating_system text DEFAULT '', ip_address text DEFAULT '', mac_address text DEFAULT '',
      manufacturer text DEFAULT '', model text DEFAULT '', last_seen_at timestamp, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_org_hostname ON devices(org_id, hostname);

    CREATE TABLE IF NOT EXISTS contracts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), client_id varchar REFERENCES clients(id), vendor_id varchar REFERENCES vendors(id),
      name text NOT NULL, contract_number text DEFAULT '', status text NOT NULL DEFAULT 'active', start_date timestamp, end_date timestamp, renewal_date timestamp,
      terms text DEFAULT '', notes text DEFAULT '', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS knowledge_categories (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), name text NOT NULL, slug text NOT NULL,
      description text DEFAULT '', parent_id varchar, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_categories_org_slug ON knowledge_categories(org_id, slug);
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), category_id varchar REFERENCES knowledge_categories(id),
      title text NOT NULL, slug text NOT NULL, summary text DEFAULT '', body text NOT NULL, status text NOT NULL DEFAULT 'draft', visibility text NOT NULL DEFAULT 'internal',
      author_id varchar NOT NULL REFERENCES users(id), published_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_articles_org_slug ON knowledge_articles(org_id, slug);
    CREATE TABLE IF NOT EXISTS saved_views (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), user_id varchar NOT NULL REFERENCES users(id), name text NOT NULL,
      resource text NOT NULL DEFAULT 'tickets', filters jsonb NOT NULL DEFAULT '{}'::jsonb, sort jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_shared boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), user_id varchar NOT NULL REFERENCES users(id),
      email_enabled boolean NOT NULL DEFAULT true, in_app_enabled boolean NOT NULL DEFAULT true, event_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
      quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_org_user ON notification_preferences(org_id, user_id);
    CREATE TABLE IF NOT EXISTS activity_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), org_id varchar NOT NULL REFERENCES orgs(id), actor_user_id varchar REFERENCES users(id),
      entity_type text NOT NULL, entity_id varchar NOT NULL, action text NOT NULL, summary text DEFAULT '', before jsonb, after jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb, ip_address text, created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_events_org_entity ON activity_events(org_id, entity_type, entity_id, created_at DESC);
  `);

  await client.query(`
    INSERT INTO ticket_statuses (org_id, key, name, sort_order, is_closed_state, is_default)
    SELECT o.id, seed.key, seed.name, seed.sort_order, seed.is_closed, seed.is_default
    FROM orgs o CROSS JOIN (VALUES
      ('new','New',10,false,true), ('triage','Triage',20,false,false), ('assigned','Assigned',30,false,false),
      ('in_progress','In Progress',40,false,false), ('waiting_department','Waiting on Client',50,false,false),
      ('waiting_vendor','Waiting on Vendor',60,false,false), ('escalated','Escalated',70,false,false),
      ('resolved','Resolved',80,true,false), ('closed','Closed',90,true,false)
    ) AS seed(key,name,sort_order,is_closed,is_default)
    ON CONFLICT (org_id, key) DO NOTHING;

    INSERT INTO ticket_priorities (org_id, key, name, sort_order, response_minutes, resolution_minutes)
    SELECT o.id, seed.key, seed.name, seed.sort_order, seed.response_minutes, seed.resolution_minutes
    FROM orgs o CROSS JOIN (VALUES
      ('critical','Critical',10,15,240), ('high','High',20,60,480), ('normal','Normal',30,240,1440), ('low','Low',40,480,4320)
    ) AS seed(key,name,sort_order,response_minutes,resolution_minutes)
    ON CONFLICT (org_id, key) DO NOTHING;

    INSERT INTO ticket_types (org_id, key, name, description)
    SELECT o.id, seed.key, seed.name, seed.description
    FROM orgs o CROSS JOIN (VALUES
      ('incident','Incident','An unplanned interruption or degradation'),
      ('service_request','Service Request','A standard request for service'),
      ('problem','Problem','Root-cause investigation for recurring incidents'),
      ('change','Change','A controlled change to a service or asset')
    ) AS seed(key,name,description)
    ON CONFLICT (org_id, key) DO NOTHING;
  `);
}
