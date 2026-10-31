FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1
WORKDIR /home/user/app

# نسخة المعالج (CPU) من torch: أصغر بكثير من نسخة CUDA
RUN pip install --no-cache-dir --user torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# تضمين النموذج في الصورة: في Cloud Run نظام الملفات في الذاكرة، فالتحميل عند كل تشغيل يستهلكها ويبطئ البدء
ARG MUAALEM_MODEL=obadx/muaalem-model-v3_2
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('${MUAALEM_MODEL}')"
ENV HF_HUB_OFFLINE=1

COPY --chown=user . .
# فحص الاستيراد أثناء البناء: إن كان هناك خطأ في المكتبات يفشل البناء برسالة واضحة بدل فشل التشغيل
RUN python -c "import app; print('imports ok')"
# Cloud Run يحدد المنفذ في PORT (8080)، وHugging Face يستخدم 7860
ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 900"]
