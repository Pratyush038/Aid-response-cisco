CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'normal' NOT NULL,
	"routing_path" text[],
	"hops" integer DEFAULT 1 NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"signature" text,
	"sender_public_key" text
);
--> statement-breakpoint
CREATE TABLE "network_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"distance" real NOT NULL,
	"latency" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"name" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"is_online" boolean DEFAULT true NOT NULL,
	"signal_strength" integer DEFAULT 100 NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "network_nodes_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
