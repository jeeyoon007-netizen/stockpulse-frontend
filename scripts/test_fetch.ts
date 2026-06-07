

async function testFetch() {
  const code = "005930";
  const url = `https://stock-brv7.onrender.com/api/v1/analysis/backtest?code=${code}`;
  console.log("Fetching from Render backend:", url);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Success:", json.success);
    if (json.data) {
      console.log("Best strategy:", json.data.best_strategy_name);
      console.log("Total return:", json.data.total_return);
      console.log("Trades count:", json.data.trades ? json.data.trades.length : "N/A");
    } else {
      console.log("No data returned:", json);
    }
  } catch (e: any) {
    console.error("Fetch failed:", e.message);
  }
}

testFetch();
