import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/** The D1 database for this request (binding "DB" in wrangler.jsonc). */
export const getDb = () => drizzle(getCloudflareContext().env.DB, { schema });
