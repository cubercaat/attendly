FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 TZ=Asia/Tashkent

# InsightFace / OpenCV uchun kerakli kutubxonalar
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libgl1 libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Yuz tanishni yoqish uchun quyidagi qatorni oching (~300MB)
# RUN pip install --no-cache-dir insightface==0.7.3 onnxruntime==1.20.1 \
#     opencv-python-headless==4.10.0.84

COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
