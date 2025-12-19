#!/usr/bin/env python3
"""
Create spending-model.onnx for zkML-proven spending decisions.
Uses ONNX directly to avoid PyTorch export issues.

Input: 8 features (normalized)
Output: 3 values (shouldBuy, confidence, riskScore)
"""

import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper
import os

def create_spending_model():
    """Create spending model ONNX graph directly."""

    # Input: [batch, 8]
    input_tensor = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 8])

    # Output: [batch, 3]
    output_tensor = helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3])

    # Layer 1: 8 -> 16
    np.random.seed(42)
    w1 = np.random.randn(8, 16).astype(np.float32) * 0.1
    b1 = np.zeros(16).astype(np.float32)

    w1_init = numpy_helper.from_array(w1, name='fc1_weight')
    b1_init = numpy_helper.from_array(b1, name='fc1_bias')

    # Layer 2: 16 -> 8
    w2 = np.random.randn(16, 8).astype(np.float32) * 0.1
    b2 = np.zeros(8).astype(np.float32)

    w2_init = numpy_helper.from_array(w2, name='fc2_weight')
    b2_init = numpy_helper.from_array(b2, name='fc2_bias')

    # Layer 3: 8 -> 3
    w3 = np.random.randn(8, 3).astype(np.float32) * 0.1
    b3 = np.zeros(3).astype(np.float32)

    w3_init = numpy_helper.from_array(w3, name='fc3_weight')
    b3_init = numpy_helper.from_array(b3, name='fc3_bias')

    # Create nodes
    # FC1: MatMul + Add + Relu
    fc1_matmul = helper.make_node('MatMul', ['input', 'fc1_weight'], ['fc1_mm'])
    fc1_add = helper.make_node('Add', ['fc1_mm', 'fc1_bias'], ['fc1_out'])
    fc1_relu = helper.make_node('Relu', ['fc1_out'], ['fc1_relu'])

    # FC2: MatMul + Add + Relu
    fc2_matmul = helper.make_node('MatMul', ['fc1_relu', 'fc2_weight'], ['fc2_mm'])
    fc2_add = helper.make_node('Add', ['fc2_mm', 'fc2_bias'], ['fc2_out'])
    fc2_relu = helper.make_node('Relu', ['fc2_out'], ['fc2_relu'])

    # FC3: MatMul + Add
    fc3_matmul = helper.make_node('MatMul', ['fc2_relu', 'fc3_weight'], ['fc3_mm'])
    fc3_add = helper.make_node('Add', ['fc3_mm', 'fc3_bias'], ['output'])

    # Create graph
    graph = helper.make_graph(
        nodes=[fc1_matmul, fc1_add, fc1_relu, fc2_matmul, fc2_add, fc2_relu, fc3_matmul, fc3_add],
        name='SpendingModel',
        inputs=[input_tensor],
        outputs=[output_tensor],
        initializer=[w1_init, b1_init, w2_init, b2_init, w3_init, b3_init]
    )

    # Create model
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 11)])
    model.ir_version = 6

    # Check model
    onnx.checker.check_model(model)

    return model

def main():
    print("Creating spending model...")

    model = create_spending_model()

    # Save model
    output_dir = os.path.join(os.path.dirname(__file__), "..", "public", "models")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "spending-model.onnx")

    onnx.save(model, output_path)
    print(f"Model exported to {output_path}")

    # Get file size
    size = os.path.getsize(output_path)
    print(f"Model size: {size} bytes")

    # Also copy to prover
    prover_dir = os.path.join(os.path.dirname(__file__), "..", "..", "jolt-atlas-fork", "arc-prover", "models")
    if os.path.exists(prover_dir):
        import shutil
        shutil.copy(output_path, prover_dir)
        print(f"Model also copied to {prover_dir}")

    print("\nDone!")

if __name__ == "__main__":
    main()
