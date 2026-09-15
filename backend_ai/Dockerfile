# 🤖 AI Engine - Neural Intelligence Layer
FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema (curl para healthcheck)
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements primeiro (camada de cache separada)
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir uv && \
    uv pip install --system --no-cache -r requirements.txt

# Copia o código da aplicação
COPY . .

EXPOSE 8001

# Inicia o servidor FastAPI
CMD ["python", "main.py"]
