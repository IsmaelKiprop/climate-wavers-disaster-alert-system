FROM python:3.11-slim-bookworm

EXPOSE 5000

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV MPLBACKEND=Agg

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

RUN python -m analysis_model.train_models
RUN mkdir -p recognition_model/models && \
    curl -fsSL --retry 3 -o recognition_model/models/mobilenetv2-10.onnx \
      https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-10.onnx && \
    test "$(stat -c%s recognition_model/models/mobilenetv2-10.onnx)" -gt 1000000 \
    || rm -f recognition_model/models/mobilenetv2-10.onnx

RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} app:app"]
