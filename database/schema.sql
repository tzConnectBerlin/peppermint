CREATE SCHEMA IF NOT EXISTS peppermint;

DO $$ BEGIN
   CREATE TYPE peppermint.operation_state AS ENUM
     ('pending', 'processing', 'rejected', 'waiting', 'confirmed', 'unknown', 'failed', 'lost', 'canary');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS peppermint.operations
(
    id SERIAL,
    submitted_at timestamp with time zone NOT NULL DEFAULT now(),
    originator character(36) NOT NULL,
    state peppermint.operation_state NOT NULL DEFAULT 'pending'::peppermint.operation_state,
    command jsonb NOT NULL,
    included_in character(51),
    last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT operations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS peppermint.processes
(
    originator character(36),
    process_uuid character(36) NOT NULL,
    messages jsonb NOT NULL DEFAULT '{}',
    last_updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT processes_pkey PRIMARY KEY (originator)
);

CREATE INDEX IF NOT EXISTS idx_state_id
    ON peppermint.operations USING btree
    (state ASC NULLS LAST, originator ASC NULLS LAST, id ASC NULLS LAST);

CREATE OR REPLACE FUNCTION peppermint.update_last_updated_at_column()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
BEGIN
   NEW.last_updated_at = now();
   RETURN NEW;
END;
$BODY$;


DO $$ BEGIN
CREATE TRIGGER update_operations_last_updated_at
    BEFORE UPDATE
    ON peppermint.operations
    FOR EACH ROW
    EXECUTE FUNCTION peppermint.update_last_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
CREATE TRIGGER update_processes_last_updated_at
    BEFORE UPDATE
    ON peppermint.operations
    FOR EACH ROW
    EXECUTE FUNCTION peppermint.update_last_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
