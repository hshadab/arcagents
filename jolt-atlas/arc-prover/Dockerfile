# JOLT-Atlas zkML Prover Service
# Multi-stage build for smaller final image

# Build stage
FROM rust:1.75-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY Cargo.toml ./

# Create dummy src for dependency caching
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (cached layer)
RUN cargo build --release 2>/dev/null || true

# Copy actual source
COPY src ./src

# Build the prover
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Create non-root user for security
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid 1000 -m appuser

WORKDIR /app

# Install runtime dependencies including curl for healthcheck
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/arc-prover /app/arc-prover

# Create models directory and set ownership
RUN mkdir -p /app/models && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables
ENV MODELS_DIR=/app/models
ENV PORT=3001
ENV RUST_LOG=info

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["/app/arc-prover"]
