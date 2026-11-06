// Creates the tables before `next build`, so a fresh deploy with Neon attached is ready to use.
import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(schema);
await pool.end();
