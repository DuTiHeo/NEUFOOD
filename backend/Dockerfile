FROM python:3.11-slim

WORKDIR /app

# Cài đặt các gói hệ thống cần thiết cho psycopg2 và build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Tạo thư mục uploads nếu chưa có
RUN mkdir -p /app/app/uploads

EXPOSE 5000

ENV FLASK_APP=run.py
ENV PYTHONUNBUFFERED=1

CMD ["python", "run.py"]
