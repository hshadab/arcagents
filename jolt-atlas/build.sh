#!/bin/bash
# Build script for jolt-atlas zkML proof system

set -e

echo "Building jolt-atlas zkML proof system..."
echo "========================================"

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "Error: Rust/Cargo not found. Install from https://rustup.rs/"
    exit 1
fi

# Build release examples
echo "Building authorization_json example (this may take a few minutes)..."
cargo build --release --example authorization_json

echo ""
echo "Build complete!"
echo ""
echo "Binary location:"
echo "  target/release/examples/authorization_json"
echo ""
echo "To test the authorization model:"
echo "  cargo run --release --example authorization"
echo ""
echo "To generate a proof with JSON output:"
echo "  ./target/release/examples/authorization_json 15 7 8 0 2 1 1 0"
echo ""
echo "Arguments: budget trust amount category velocity day time risk"
