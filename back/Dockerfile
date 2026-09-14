FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd --create-home --shell /bin/sh appuser

RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./

ENV UV_SYSTEM_PYTHON=1
RUN uv sync --frozen --no-dev
ENV PATH="/app/.venv/bin:$PATH"

COPY api ./api
COPY migrations ./migrations
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8020

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8020/health', timeout=4)"

ENTRYPOINT ["./entrypoint.sh"]
