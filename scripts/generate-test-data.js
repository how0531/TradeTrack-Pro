#!/usr/bin/env node
/**
 * 生成 50,000 筆測試交易資料用於效能測試
 * 用法: node scripts/generate-test-data.js
 */

const fs = require('fs');
const path = require('path');

// 策略和情緒標籤
const STRATEGIES = ['動能突破', '急殺抄底', '波段趨勢', '籌碼面', '技術面'];
const EMOTIONS = ['短線', '事件', '產業', '波段', '隔日沖'];
const PORTFOLIOS = ['main', 'portfolio-1', 'portfolio-2'];

// 生成隨機日期（過去2年）
function randomDate() {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 2);
    const timestamp = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(timestamp).toISOString().split('T')[0];
}

// 生成符合實際分布的 PnL (60% 獲利, 40% 虧損)
function randomPnL() {
    const isProfit = Math.random() < 0.6;
    
    if (isProfit) {
        // 獲利: 100 ~ 50,000，偏向小額
        const base = Math.random() ** 2; // 平方讓小數字更多
        return Math.floor(100 + base * 49900);
    } else {
        // 虧損: -50 ~ -30,000，偏向小額
        const base = Math.random() ** 2;
        return -Math.floor(50 + base * 29950);
    }
}

// 生成單筆交易
function generateTrade(index) {
    const date = randomDate();
    const pnl = randomPnL();
    
    return {
        id: `trade-${Date.now()}-${index}`,
        date,
        pnl,
        amount: String(Math.abs(pnl)),
        type: pnl >= 0 ? 'profit' : 'loss',
        strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
        emotion: EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)],
        portfolioId: PORTFOLIOS[Math.floor(Math.random() * PORTFOLIOS.length)],
        note: Math.random() > 0.7 ? `測試交易 ${index}` : '',
        timestamp: new Date(date).toISOString()
    };
}

// 生成所有交易資料
function generateTrades(count) {
    console.log(`🔄 開始生成 ${count.toLocaleString()} 筆測試資料...`);
    const trades = [];
    
    for (let i = 0; i < count; i++) {
        trades.push(generateTrade(i));
        
        // 進度顯示
        if ((i + 1) % 10000 === 0) {
            console.log(`   已生成 ${(i + 1).toLocaleString()} 筆 (${((i + 1) / count * 100).toFixed(1)}%)`);
        }
    }
    
    // 按日期排序 (最新的在前面)
    trades.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`✅ 資料生成完成！`);
    return trades;
}

// 計算統計資訊
function calculateStats(trades) {
    const total = trades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl < 0).length;
    const winRate = (wins / trades.length * 100).toFixed(2);
    
    return {
        總筆數: trades.length.toLocaleString(),
        總損益: total.toLocaleString(),
        獲利筆數: wins.toLocaleString(),
        虧損筆數: losses.toLocaleString(),
        勝率: `${winRate}%`,
        資料大小: `${(JSON.stringify(trades).length / 1024 / 1024).toFixed(2)} MB`
    };
}

// 主函數
function main() {
    const COUNT = 50000;
    
    console.log('📊 TradeTrack 效能測試 - 資料生成器\n');
    
    // 生成資料
    const trades = generateTrades(COUNT);
    
    // 統計資訊
    const stats = calculateStats(trades);
    console.log('\n📈 統計資訊:');
    Object.entries(stats).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });
    
    // 儲存到檔案
    const outputPath = path.join(__dirname, 'test-data-50k.json');
    fs.writeFileSync(outputPath, JSON.stringify(trades, null, 2));
    console.log(`\n💾 資料已儲存至: ${outputPath}`);
    
    // 生成注入腳本
    const injectScript = `
// 效能測試：注入 50,000 筆測試資料
// 在瀏覽器 Console 執行此腳本

// 1. 備份現有資料
const backup = {
    trades: localStorage.getItem('local_trades'),
    strategies: localStorage.getItem('local_strategies'),
    emotions: localStorage.getItem('local_emotions'),
    portfolios: localStorage.getItem('local_portfolios')
};
console.log('✅ 已備份現有資料至 backup 變數');
console.log('💾 備份大小:', JSON.stringify(backup).length, 'bytes');

// 2. 載入測試資料
const testTrades = ${JSON.stringify(trades)};

// 3. 注入資料
localStorage.setItem('local_trades', JSON.stringify(testTrades));
console.log('✅ 已注入', testTrades.length.toLocaleString(), '筆測試資料');

// 4. 重新整理頁面
console.log('🔄 即將重新整理頁面...');
setTimeout(() => location.reload(), 1000);

// 還原資料的指令:
// Object.entries(backup).forEach(([key, value]) => value && localStorage.setItem(key, value));
// location.reload();
`.trim();
    
    const scriptPath = path.join(__dirname, 'inject-test-data.js');
    fs.writeFileSync(scriptPath, injectScript);
    console.log(`📝 注入腳本已生成: ${scriptPath}`);
    
    console.log('\n📋 下一步:');
    console.log('   1. 開啟瀏覽器 Console (F12)');
    console.log('   2. 複製 inject-test-data.js 的內容');
    console.log('   3. 貼上並執行');
    console.log('   4. 等待頁面重新整理');
    console.log('\n⚠️  還原指令已包含在腳本註解中\n');
}

main();
