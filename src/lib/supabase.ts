import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 에러를 던지는 대신, 환경변수가 없을 경우 null을 반환하여 앱이 죽지 않도록 합니다.
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) {
  console.warn("Supabase credentials are missing. Analysis logging is disabled.");
}
