# syntax=docker/dockerfile:1.7

# ─── Stage 1: build deps ─────────────────────────────────────────────────
# We compile wheels in a fat builder image, then copy only the resulting
# site-packages + the slim runtime files into the final image. Drops
# build-essential + libpq-dev out of the final layer.
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip wheel --wheel-dir=/wheels -r requirements.txt


# ─── Stage 2: final image ────────────────────────────────────────────────
FROM python:3.12-slim AS final

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app

# Runtime needs libpq + curl (for the healthcheck below). No
# build toolchain — keeps the image small + reduces CVE surface.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    # Non-root user so an RCE doesn't immediately get root inside the
    # container. UID/GID 1000 to match common host conventions.
    && groupadd --system --gid 1000 app \
    && useradd --system --uid 1000 --gid app --home-dir /app --shell /sbin/nologin app

WORKDIR /app

# Install the pre-built wheels from the builder stage.
COPY --from=builder /wheels /wheels
COPY requirements.txt ./
RUN pip install --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy app code with the non-root user as owner.
COPY --chown=app:app . .

USER app
EXPOSE 8000

# Readiness probe lives inside the app (DB + Redis ping). k8s and
# docker-compose both honor this; the curl exit code is what they
# read.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/v1/health/ready || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
