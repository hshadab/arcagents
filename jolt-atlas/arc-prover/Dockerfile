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

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/arc-prover /app/arc-prover

# Create models directory
RUN mkdir -p /app/models

# Environment variables
ENV MODELS_DIR=/app/models
ENV PORT=3001
ENV RUST_LOG=info

EXPOSE 3001

CMD ["/app/arc-prover"]
