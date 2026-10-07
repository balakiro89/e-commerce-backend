DROP TABLE IF EXISTS "product_specifications" CASCADE;--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "category_id" TO "product_type";
