CREATE TABLE IF NOT EXISTS "talkentra"."chat_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "talkentra"."chat_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"chat_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "talkentra"."chat_events" ADD CONSTRAINT "chat_events_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "talkentra"."chats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_events_chat_id_id_idx" ON "talkentra"."chat_events" USING btree ("chat_id","id");
