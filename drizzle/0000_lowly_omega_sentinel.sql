CREATE TABLE "gift_metadata" (
	"hash" text PRIMARY KEY NOT NULL,
	"canonical" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
