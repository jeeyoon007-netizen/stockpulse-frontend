import path from 'path';
import fs from 'fs';

// Load .env.local from frontend folder
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const isVts = env.KIS_VTS === "true";
const baseUrl = isVts 
  ? "https://openapivts.koreainvestment.com:29443" 
  : "https://openapi.koreainvestment.com:9443";
const appKey = env.KIS_APP_KEY;
const appSecret = env.KIS_APP_SECRET;

async function getAccessToken() {
  const res = await fetch(`${baseUrl}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
  });
  const data = await res.json() as any;
  return data.access_token;
}

async function run() {
  const token = await getAccessToken();
  
  // 주식일별분봉조회 API 호출
  // tr_id: FHKST03010230
  const searchParams = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',
    FID_INPUT_ISCD: '005930', // 삼성전자
    FID_INPUT_HOUR_1: '153000', // 당일 기준시점 (보통 장 마감 시간)
    FID_INPUT_DATE_1: '20260616', // 최근 날짜
    FID_PW_DATA_INCU_YN: 'N', // 과거 데이터 포함 여부 (기본 N)
    FID_FAKE_TICK_INCU_YN: '',
  });

  const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-time-dailychartprice?${searchParams.toString()}`;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    authorization: `Bearer ${token}`,
    appkey: appKey!,
    appsecret: appSecret!,
    tr_id: 'FHKST03010230',
  };

  const res = await fetch(url, { headers });
  const data = await res.json() as any;
  console.log('Response status:', res.status);
  console.log('Response body keys:', Object.keys(data));
  console.log('rt_cd:', data.rt_cd);
  console.log('msg1:', data.msg1);
  if (data.output2 && data.output2.length > 0) {
    console.log('output2 Sample:', data.output2.slice(0, 3));
    console.log('output2 count:', data.output2.length);
  }
}

run().catch(console.error);
