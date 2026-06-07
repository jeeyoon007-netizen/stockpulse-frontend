import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkSchema() {
  console.log("Checking analysis_logs schema...");
  // Query a single row from analysis_logs to see its columns
  const { data: aRow, error: aErr } = await supabase
    .from("analysis_logs")
    .select("*")
    .limit(1);

  if (aErr) {
    console.error("Error fetching analysis_logs:", aErr);
  } else {
    console.log("Single row from analysis_logs:", aRow);
  }

  // Also query a single row from backtest_results to see if anything is there
  console.log("\nChecking backtest_results count...");
  const { count, error: countErr } = await supabase
    .from("backtest_results")
    .select("*", { count: "exact", head: true });

  if (countErr) {
    console.error("Error counting backtest_results:", countErr);
  } else {
    console.log("Total rows in backtest_results:", count);
  }
}

checkSchema();
