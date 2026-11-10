ALTER TABLE "talkentra"."messages" ADD COLUMN "thread_id" text;--> statement-breakpoint
ALTER TABLE "talkentra"."messages" ADD COLUMN "reply_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "talkentra"."messages" ADD COLUMN "reactions" jsonb DEFAULT '[]'::jsonb NOT NULL;
