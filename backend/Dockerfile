# 使用 Python 3.9 輕量版作為基底
FROM python:3.9-slim

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴（Shioaji 可能需要一些編譯環境）
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製依賴檔案
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製程式碼 (假設 Build context 是專案根目錄)
COPY backend/ .
COPY scripts/ /scripts/

# 設定 PYTHONPATH 讓他能找到 scripts
ENV PYTHONPATH=/app:/scripts

# 開放連接埠
EXPOSE 5000

# 啟動指令：限制單一 worker 以節省記憶體，並增加超時時間避免 502
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120", "app:app"]
