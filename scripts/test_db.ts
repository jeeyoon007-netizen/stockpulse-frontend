import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log("Supabase URL:", supabaseUrl);
  
  // 1. Check some rows from backtest_results
  console.log("\n--- backtest_results (Limit 5) ---");
  const { data: bList, error: bErr } = await supabase
    .from("backtest_results")
    .select("stock_code, best_strategy_name, win_rate, total_return")
    .limit(5);
  
  if (bErr) {
    console.error("Error fetching backtest_results:", bErr);
  } else {
    console.log(bList);
  }

  // 2. Query specific watchlist stock codes from the screenshot
  const targetCodes = ["062040", "189300", "099320", "005930", "464080"];
  console.log(`\n--- Querying targets: ${targetCodes.join(", ")} ---`);
  
  const { data: bTargets, error: btErr } = await supabase
    .from("backtest_results")
    .select("stock_code, best_strategy_name, win_rate, total_return")
    .in("stock_code", targetCodes);
    
  if (btErr) {
    console.error("Error fetching target backtest_results:", btErr);
  } else {
    console.log("Matches in backtest_results:", bTargets);
  }

  const { data: aTargets, error: atErr } = await supabase
    .from("analysis_logs")
    .select("stock_code, wyckoff_phase, wyckoff_confidence, analyzed_at")
    .in("stock_code", targetCodes)
    .order("analyzed_at", { ascending: false });

  if (atErr) {
    console.error("Error fetching target analysis_logs:", atErr);
  } else {
    console.log("Matches in analysis_logs (raw):", aTargets);
  }
}

testQuery();
