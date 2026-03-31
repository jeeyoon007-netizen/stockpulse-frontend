import cron from 'node-cron';
import { updateStocks } from './update-stocks';

console.log("=== KIS 종목 자동 갱신 스케줄러 시작 ===");
console.log("설정 시간: 매일 오전 8시 30분");

// 0 30 8 * * * : 매일 아침 08:30:00 KST 기준 (서버 시간이 한국 시간이면 바로 동작)
cron.schedule('30 8 * * *', async () => {
    console.log(`[${new Date().toISOString()}] 예약된 종목 갱신 작업 실행`);
    try {
        await updateStocks();
        console.log("예약 작업 성공");
    } catch (e) {
        console.error("예약 작업 실패:", e);
    }
});

// 스케줄러가 백그라운드에서 꺼지지 않도록 무한 루프처럼 유지됩니다.
