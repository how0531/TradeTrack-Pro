# 使用 Python 3.9 輕量版作為基底
FROM python:3.9-slim

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴（Shioaji 可能需要一些編譯環境）
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 複製 requirements.txt 並安裝 Python 依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製後端程式碼與腳本
COPY . .
COPY ../scripts /scripts

# 設定 PYTHONPATH 讓他能找到 scripts
ENV PYTHONPATH=/app:/scripts

# 開放連接埠
EXPOSE 5000

# 啟動指令（使用 gunicorn）
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
