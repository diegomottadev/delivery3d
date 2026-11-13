FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=app:create_app \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

EXPOSE 5000

# El modo debug (recarga + debugger de Werkzeug) se activa SOLO con FLASK_DEBUG=1 en backend/.env.
# Nunca en producción: el debugger permite ejecutar código. En prod usar gunicorn.
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
