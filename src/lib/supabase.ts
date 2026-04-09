import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client for the browser (using anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for the server/bot (using service role key for full access/bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
