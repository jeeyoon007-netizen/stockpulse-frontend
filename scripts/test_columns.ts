import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkColumns() {
  console.log("Checking if created_at exists in analysis_logs...");
  const { data, error } = await supabase
    .from("analysis_logs")
    .select("created_at")
    .limit(1);

  if (error) {
    console.error("Error with created_at:", error);
  } else {
    console.log("Success! created_at exists. Result:", data);
  }
}

checkColumns();
