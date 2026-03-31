import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';

const KOSPI_URL = "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip";
const KOSDAQ_URL = "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip";

interface StockEntry {
  code: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
}

/**
 * URL에서 Zip 파일을 다운로드한 후, 내부의 MST 파일을 파싱하여 반환합니다.
 */
async function fetchAndUnzip(url: string, market: 'KOSPI' | 'KOSDAQ'): Promise<StockEntry[]> {
  console.log(`[${market}] 다운로드 시작: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`다운로드 실패: HTTP ${res.status}`);
    }
    
    // ArrayBuffer를 NodeJS Buffer로 변환
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 메모리에 로드된 압축 해제
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    if (zipEntries.length === 0) {
      throw new Error(`[${market}] 압축 파일 내에 파일이 없음`);
    }

    // 첫 번째 파일을 MST 파일로 간주
    const mstBuffer = zipEntries[0].getData();
    
    return parseMstBuffer(mstBuffer, market);
  } catch (error) {
    console.error(`[${market}] 파일 갱신 실패:`, error);
    return [];
  }
}

/**
 * 고정 길이 바이트 (EUC-KR) 구조의 MST 버퍼를 파싱합니다.
 */
function parseMstBuffer(buffer: Buffer, market: 'KOSPI' | 'KOSDAQ'): StockEntry[] {
  const records: StockEntry[] = [];
  let start = 0;
  
  // 개행(10) 단위로 루프를 돕니다.
  while (start < buffer.length) {
    let end = buffer.indexOf(10, start); // 10 is '\n'
    if (end === -1) end = buffer.length;
    
    const lineBuffer = buffer.subarray(start, end);
    
    // 최소 길이 보장 (종목코드 9바이트 + 한글명 구간 등 총합은 228바이트 이상이나, 이름까지만 파싱하므로 여유있게 61바이트 이상)
    if (lineBuffer.length >= 61) {
      const codeBytes = lineBuffer.subarray(0, 9);
      const nameBytes = lineBuffer.subarray(21, 61);
      
      const rawCode = iconv.decode(codeBytes, 'euc-kr').trim();
      const rawName = iconv.decode(nameBytes, 'euc-kr').trim();
      
      // 우측 6자리 숫자 종목코드만 식별 (주식, ETF 모두 지원)
      const codeMatch = rawCode.match(/\d{6}$/);
      
      if (codeMatch && codeMatch[0] && rawName) {
        records.push({
          code: codeMatch[0],
          name: rawName,
          market
        });
      }
    }
    
    start = end + 1;
  }
  
  console.log(`[${market}] 파싱 완료, 총 ${records.length} 종목`);
  return records;
}

/**
 * 메인 실행 함수
 */
export async function updateStocks() {
  console.log("=== KIS 마스터 파일 기반 종목 리스트 갱신 시작 ===");
  
  const kospi = await fetchAndUnzip(KOSPI_URL, "KOSPI");
  const kosdaq = await fetchAndUnzip(KOSDAQ_URL, "KOSDAQ");
  
  const allStocks = [...kospi, ...kosdaq];
  
  // 1. 공백이나 중복 정리
  const uniqueStocks = new Map<string, StockEntry>();
  allStocks.forEach((s) => {
    // 중복 코드가 있더라도 KOSPI/KOSDAQ 기준 최신으로 덮어씌움 (일반적으로는 안겹침)
    uniqueStocks.set(s.code, s);
  });
  
  const finalStocks = Array.from(uniqueStocks.values());
  
  // 이름순으로 정렬
  finalStocks.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
  
  // JSON 파일로 저장 (public 디렉토리)
  const outPath = path.join(process.cwd(), 'public', 'stocks.json');
  
  // public 폴더가 없으면 생성
  if (!fs.existsSync(path.dirname(outPath))) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(finalStocks, null, 2), 'utf-8');
  console.log(`=== 성공: ${finalStocks.length}개 종목이 ${outPath} 에 저장되었습니다. ===`);
}

// 스크립트로 직접 실행됐을 때만 수행 (require.main === module 대체)
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && process.argv[1].endsWith(path.basename(__filename));
if (isMain) {
  updateStocks().catch(console.error);
}
