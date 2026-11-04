FROM python:3.12-slim

WORKDIR /app

# Install uv from official binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency specifications and lockfile
COPY pyproject.toml uv.lock ./

# Install locked dependencies into .venv
RUN uv sync --frozen --no-dev --no-install-project

RUN uv run playwright install --with-deps chromium

# Copy application source code
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 4321

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4321"]
