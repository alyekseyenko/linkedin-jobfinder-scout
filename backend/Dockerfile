# 🧠 Neural Backend - Docker Infrastructure
FROM node:20-slim

# Install system dependencies (curl para healthcheck + libs do Playwright + Python)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install uv (astral) for fast python tooling and uvx execution
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:/root/.local/bin:${PATH}"
ENV UVX_PATH="/root/.local/bin/uvx"
ENV UV_CACHE_DIR="/root/.cache/uv"

# Install the LinkedIn Scraper MCP tool globally in the container
RUN uv tool install linkedin-scraper-mcp
RUN /root/.local/share/uv/tools/linkedin-scraper-mcp/bin/patchright install chromium
COPY patch_mcp.py /tmp/patch_mcp.py
RUN python3 /tmp/patch_mcp.py && rm /tmp/patch_mcp.py

WORKDIR /app

# Copia apenas os manifests primeiro (camada de cache)
COPY package*.json ./

# Instala TODAS as dependências (incluindo devDeps para nodemon não ser necessário)
RUN npm ci --omit=dev

# Prepara diretórios de persistência de cofre criptografado e logs
RUN mkdir -p /app/vault /app/logs /app/config

# Copia o código da aplicação
COPY . .

EXPOSE 3001

# Usa node diretamente (sem nodemon) para produção/docker
CMD ["node", "server.js"]
