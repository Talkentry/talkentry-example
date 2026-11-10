ALTER TABLE "talkentra"."chats" ADD COLUMN "next_sequence" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "talkentra"."messages" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "talkentra"."messages" ADD COLUMN "sequence" bigint;--> statement-breakpoint
WITH ordered AS (
	SELECT
		id,
		ROW_NUMBER() OVER (
			PARTITION BY chat_id
			ORDER BY created_at ASC, id ASC
		) AS seq
	FROM "talkentra"."messages"
)
UPDATE "talkentra"."messages" AS m
SET "sequence" = ordered.seq
FROM ordered
WHERE m.id = ordered.id;--> statement-breakpoint
UPDATE "talkentra"."chats" AS c
SET "next_sequence" = COALESCE((
	SELECT MAX(m."sequence") FROM "talkentra"."messages" AS m WHERE m.chat_id = c.id
), 0);--> statement-breakpoint
ALTER TABLE "talkentra"."messages" ALTER COLUMN "sequence" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_chat_id_local_id_uidx" ON "talkentra"."messages" USING btree ("chat_id","local_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_chat_id_sequence_uidx" ON "talkentra"."messages" USING btree ("chat_id","sequence");
