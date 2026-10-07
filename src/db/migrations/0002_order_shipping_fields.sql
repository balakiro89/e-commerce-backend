ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_id" varchar(128);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipment_service" varchar(128);
