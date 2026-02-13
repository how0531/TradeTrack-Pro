#!/bin/bash
# 診斷腳本：測試前後端連接

echo "========================================="
echo "🔍 TradeTrack Pro 連接診斷"
echo "========================================="
echo ""

# 1. 檢查後端健康狀態
echo "1️⃣ 檢查後端健康狀態..."
HEALTH=$(curl -s http://localhost:5000/health)
echo "   回應: $HEALTH"
echo ""

# 2. 測試 CORS
echo "2️⃣ 測試 CORS 設定..."
curl -s -I -X OPTIONS http://localhost:5000/api/broker/profile \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" | grep -i "access-control"
echo ""

# 3. 測試 broker/profile API（模擬完整請求）
echo "3️⃣ 測試 broker/profile API..."
curl -s -X POST http://localhost:5000/api/broker/profile \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "apiKey": "test_key",
    "apiSecret": "test_secret",
    "personId": "test_person",
    "caPath": "test_path",
    "caPassword": "test_password"
  }' | python3 -m json.tool 2>/dev/null || echo "回應不是 valid JSON"
echo ""

# 4. 檢查前端是否運行
echo "4️⃣ 檢查前端服務..."
if curl -s http://localhost:5173 > /dev/null; then
    echo "   ✅ 前端正常運行在 http://localhost:5173"
else
    echo "   ❌ 前端未運行"
fi
echo ""

# 5. 檢查端口佔用
echo "5️⃣ 檢查端口佔用..."
echo "   Port 5000 (後端):"
netstat -an | grep "5000.*LISTEN" || echo "   ⚠️ 未監聽"
echo "   Port 5173 (前端):"
netstat -an | grep "5173.*LISTEN" || echo "   ⚠️ 未監聽"
echo ""

echo "========================================="
echo "🎯 診斷完成"
echo "========================================="
