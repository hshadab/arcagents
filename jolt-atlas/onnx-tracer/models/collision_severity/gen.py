#!/usr/bin/env python3
"""
Collision Severity Model for Robot Commerce Demo

This model takes sensor data from a robot collision and outputs
a severity assessment that determines whether to purchase witness footage.

Inputs (one-hot encoded, 64 features total):
- impact_force: 0-15 (16 buckets) - accelerometer magnitude
- velocity: 0-7 (8 buckets) - speed at impact
- angle: 0-7 (8 buckets) - angle of impact (0=front, 2=right, 4=back, 6=left)
- object_type: 0-7 (8 buckets) - detected object (0=unknown, 1=vehicle, 2=person, etc.)
- damage_zone: 0-7 (8 buckets) - which part of robot hit
- robot_load: 0-3 (4 buckets) - cargo value (0=empty, 3=high-value)
- time_since_last: 0-7 (8 buckets) - time since last collision (fraud detection)
- weather: 0-3 (4 buckets) - weather conditions (0=clear, 1=rain, 2=snow, 3=fog)

Total: 16+8+8+8+8+4+8+4 = 64 features

Output (4 classes for power-of-2):
- 0: MINOR (no footage needed)
- 1: MODERATE (footage recommended, $0.02)
- 2: SEVERE (footage required, $0.05)
- 3: CRITICAL (footage + report, $0.10)
"""

import os
import json
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

try:
    import onnx
    import torch.onnx
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    print("Warning: ONNX not available. Model export will be disabled.")

# Set random seeds
torch.manual_seed(42)
np.random.seed(42)
random.seed(42)

# Configuration (Power-of-2 dimensions for SNARK compatibility)
INPUT_SIZE = 64     # Total one-hot encoded features
HIDDEN_SIZE = 32    # Hidden layer size
NUM_CLASSES = 4     # MINOR, MODERATE, SEVERE, CRITICAL
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 0.001

# Feature dimensions (all power of 2 or sum to 64)
IMPACT_FORCE_BUCKETS = 16   # Accelerometer magnitude (0-15)
VELOCITY_BUCKETS = 8        # Speed at impact
ANGLE_BUCKETS = 8           # Impact angle (8 directions)
OBJECT_TYPE_BUCKETS = 8     # Type of object hit
DAMAGE_ZONE_BUCKETS = 8     # Part of robot damaged
ROBOT_LOAD_BUCKETS = 4      # Cargo value
TIME_SINCE_LAST_BUCKETS = 8 # Time since last collision
WEATHER_BUCKETS = 4         # Weather conditions

TOTAL_FEATURES = (IMPACT_FORCE_BUCKETS + VELOCITY_BUCKETS + ANGLE_BUCKETS +
                 OBJECT_TYPE_BUCKETS + DAMAGE_ZONE_BUCKETS + ROBOT_LOAD_BUCKETS +
                 TIME_SINCE_LAST_BUCKETS + WEATHER_BUCKETS)
assert TOTAL_FEATURES == INPUT_SIZE, f"Feature dimensions don't match: {TOTAL_FEATURES} != {INPUT_SIZE}"


class CollisionSeverityClassifier(nn.Module):
    """
    MLP classifier for collision severity assessment.
    Architecture: Input(64) -> Linear(32) -> ReLU -> Linear(16) -> ReLU -> Linear(4)
    """
    def __init__(self, input_size=INPUT_SIZE, hidden_size=HIDDEN_SIZE, num_classes=NUM_CLASSES):
        super(CollisionSeverityClassifier, self).__init__()

        self.fc1 = nn.Linear(input_size, hidden_size)           # 64 -> 32
        self.fc2 = nn.Linear(hidden_size, hidden_size // 2)     # 32 -> 16
        self.fc3 = nn.Linear(hidden_size // 2, num_classes)     # 16 -> 4
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        x = self.relu(x)
        x = self.fc3(x)
        return x


def create_feature_mapping():
    """Create feature encoding mappings for one-hot representation"""

    feature_ranges = {
        'impact_force': IMPACT_FORCE_BUCKETS,
        'velocity': VELOCITY_BUCKETS,
        'angle': ANGLE_BUCKETS,
        'object_type': OBJECT_TYPE_BUCKETS,
        'damage_zone': DAMAGE_ZONE_BUCKETS,
        'robot_load': ROBOT_LOAD_BUCKETS,
        'time_since_last': TIME_SINCE_LAST_BUCKETS,
        'weather': WEATHER_BUCKETS
    }

    vocab_mapping = {}
    feature_mapping = {}
    current_idx = 0

    for feature_type, bucket_count in feature_ranges.items():
        feature_values = [f'{feature_type}_{i}' for i in range(bucket_count)]
        feature_mapping[feature_type] = feature_values

        for value in feature_values:
            vocab_mapping[value] = {
                "index": current_idx,
                "feature_type": feature_type
            }
            current_idx += 1

    return vocab_mapping, feature_mapping


def generate_synthetic_collision():
    """Generate a single synthetic collision with realistic severity patterns"""

    # Generate sensor readings
    impact_force = random.randint(0, IMPACT_FORCE_BUCKETS - 1)  # 0 = gentle tap, 15 = major crash
    velocity = random.randint(0, VELOCITY_BUCKETS - 1)          # 0 = stationary, 7 = fast
    angle = random.randint(0, ANGLE_BUCKETS - 1)                # 0 = front, 4 = back
    object_type = random.randint(0, OBJECT_TYPE_BUCKETS - 1)    # 0 = unknown, 1 = vehicle, 2 = person
    damage_zone = random.randint(0, DAMAGE_ZONE_BUCKETS - 1)    # 0 = front, 4 = cargo
    robot_load = random.randint(0, ROBOT_LOAD_BUCKETS - 1)      # 0 = empty, 3 = high value
    time_since_last = random.randint(0, TIME_SINCE_LAST_BUCKETS - 1)  # 0 = recent, 7 = long ago
    weather = random.randint(0, WEATHER_BUCKETS - 1)            # 0 = clear, 3 = fog

    # Determine severity based on realistic rules
    severity_score = 0

    # Impact force is primary factor (0-15 -> 0-30 points)
    severity_score += impact_force * 2

    # High velocity adds severity (0-7 -> 0-14 points)
    severity_score += velocity * 2

    # Object type matters
    if object_type == 2:  # Person - always severe
        severity_score += 20
    elif object_type == 1:  # Vehicle - significant
        severity_score += 10
    elif object_type in [3, 4]:  # Infrastructure, animal
        severity_score += 5

    # Cargo damage increases severity
    if damage_zone == 4 and robot_load >= 2:  # Cargo area with valuable load
        severity_score += 15

    # High-value cargo increases stakes
    severity_score += robot_load * 3

    # Suspicious patterns (many collisions)
    if time_since_last <= 2:  # Recent collision - possible fraud
        severity_score += 8

    # Bad weather slightly increases severity (harder to avoid)
    severity_score += weather * 2

    # Front/back collisions generally less severe than side
    if angle in [2, 6]:  # Side impact
        severity_score += 5

    # Map score to severity class
    if severity_score < 15:
        severity = 0  # MINOR
    elif severity_score < 35:
        severity = 1  # MODERATE
    elif severity_score < 55:
        severity = 2  # SEVERE
    else:
        severity = 3  # CRITICAL

    # Add some noise (10% random adjustment)
    if random.random() < 0.1:
        severity = max(0, min(3, severity + random.choice([-1, 1])))

    return {
        'impact_force': impact_force,
        'velocity': velocity,
        'angle': angle,
        'object_type': object_type,
        'damage_zone': damage_zone,
        'robot_load': robot_load,
        'time_since_last': time_since_last,
        'weather': weather,
        'severity': severity
    }


def create_one_hot_vector(collision, vocab_mapping):
    """Convert collision data to one-hot encoded vector"""

    vector = np.zeros(INPUT_SIZE)
    features = ['impact_force', 'velocity', 'angle', 'object_type',
                'damage_zone', 'robot_load', 'time_since_last', 'weather']

    for feature in features:
        value = collision[feature]
        feature_key = f'{feature}_{value}'

        if feature_key in vocab_mapping:
            idx = vocab_mapping[feature_key]['index']
            vector[idx] = 1.0

    return vector


def generate_dataset(num_samples=10000):
    """Generate synthetic collision dataset"""

    print(f"Generating {num_samples} synthetic collisions...")

    vocab_mapping, feature_mapping = create_feature_mapping()

    X = []
    y = []
    severity_counts = [0, 0, 0, 0]

    for i in range(num_samples):
        collision = generate_synthetic_collision()
        input_vector = create_one_hot_vector(collision, vocab_mapping)
        X.append(input_vector)

        # One-hot label for 4 classes
        label = [0, 0, 0, 0]
        label[collision['severity']] = 1
        y.append(label)
        severity_counts[collision['severity']] += 1

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    print(f"Dataset shape: X={X.shape}, y={y.shape}")
    print(f"MINOR: {severity_counts[0]} ({severity_counts[0]/num_samples*100:.1f}%)")
    print(f"MODERATE: {severity_counts[1]} ({severity_counts[1]/num_samples*100:.1f}%)")
    print(f"SEVERE: {severity_counts[2]} ({severity_counts[2]/num_samples*100:.1f}%)")
    print(f"CRITICAL: {severity_counts[3]} ({severity_counts[3]/num_samples*100:.1f}%)")

    return X, y, vocab_mapping, feature_mapping


def train_model(X, y, vocab_mapping):
    """Train the collision severity model"""

    print("\n🤖 Training Collision Severity Model")
    print("=" * 50)

    # Split into train/validation
    train_size = int(0.8 * len(X))
    indices = np.random.permutation(len(X))
    train_indices = indices[:train_size]
    val_indices = indices[train_size:]

    X_train, X_val = X[train_indices], X[val_indices]
    y_train, y_val = y[train_indices], y[val_indices]

    # Convert to tensors
    X_train_tensor = torch.FloatTensor(X_train)
    y_train_tensor = torch.FloatTensor(y_train)
    X_val_tensor = torch.FloatTensor(X_val)
    y_val_tensor = torch.FloatTensor(y_val)

    # Create data loaders
    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)

    # Create model
    model = CollisionSeverityClassifier()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    best_val_acc = 0.0

    for epoch in range(EPOCHS):
        # Training
        model.train()
        train_loss = 0.0

        for inputs, labels in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            label_indices = torch.argmax(labels, dim=1)
            loss = criterion(outputs, label_indices)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        # Validation
        model.eval()
        with torch.no_grad():
            outputs = model(X_val_tensor)
            predicted = torch.argmax(outputs, dim=1)
            actual = torch.argmax(y_val_tensor, dim=1)
            val_acc = (predicted == actual).float().mean().item() * 100

        train_loss /= len(train_loader)

        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}/{EPOCHS} - Loss: {train_loss:.4f}, Val Acc: {val_acc:.2f}%")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), 'collision_model.pth')

    print(f"\n✅ Training complete! Best val accuracy: {best_val_acc:.2f}%")

    # Load best model
    model.load_state_dict(torch.load('collision_model.pth'))

    # Calculate final training accuracy
    model.eval()
    with torch.no_grad():
        train_outputs = model(X_train_tensor)
        train_predicted = torch.argmax(train_outputs, dim=1)
        train_labels = torch.argmax(y_train_tensor, dim=1)
        final_train_acc = (train_predicted == train_labels).float().mean().item() * 100

    return model, final_train_acc, best_val_acc


def test_sample_scenarios(model, vocab_mapping):
    """Test the model with specific collision scenarios"""

    print("\n🧪 Testing Sample Collision Scenarios")
    print("=" * 50)

    severity_names = ['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL']
    price_map = {'MINOR': '$0.00', 'MODERATE': '$0.02', 'SEVERE': '$0.05', 'CRITICAL': '$0.10'}

    model.eval()

    test_scenarios = [
        {
            'name': 'Gentle tap, empty robot (should be MINOR)',
            'collision': {
                'impact_force': 2, 'velocity': 1, 'angle': 0, 'object_type': 0,
                'damage_zone': 0, 'robot_load': 0, 'time_since_last': 7, 'weather': 0
            }
        },
        {
            'name': 'Medium impact at moderate speed (should be MODERATE)',
            'collision': {
                'impact_force': 8, 'velocity': 4, 'angle': 0, 'object_type': 3,
                'damage_zone': 0, 'robot_load': 1, 'time_since_last': 5, 'weather': 0
            }
        },
        {
            'name': 'Hit a person - always severe (should be SEVERE/CRITICAL)',
            'collision': {
                'impact_force': 6, 'velocity': 3, 'angle': 0, 'object_type': 2,
                'damage_zone': 0, 'robot_load': 0, 'time_since_last': 7, 'weather': 0
            }
        },
        {
            'name': 'High-speed vehicle collision (should be CRITICAL)',
            'collision': {
                'impact_force': 14, 'velocity': 7, 'angle': 2, 'object_type': 1,
                'damage_zone': 4, 'robot_load': 3, 'time_since_last': 1, 'weather': 2
            }
        },
        {
            'name': 'Cargo area hit with valuable load (should be SEVERE)',
            'collision': {
                'impact_force': 10, 'velocity': 4, 'angle': 4, 'object_type': 3,
                'damage_zone': 4, 'robot_load': 3, 'time_since_last': 4, 'weather': 1
            }
        }
    ]

    with torch.no_grad():
        for scenario in test_scenarios:
            input_vector = create_one_hot_vector(scenario['collision'], vocab_mapping)
            input_tensor = torch.FloatTensor(input_vector).unsqueeze(0)

            output = model(input_tensor)
            probabilities = torch.softmax(output, dim=1)
            predicted_class = torch.argmax(output, dim=1).item()

            severity = severity_names[predicted_class]
            confidence = probabilities[0][predicted_class].item()

            print(f"\n{scenario['name']}")
            print(f"  Severity: {severity}")
            print(f"  Footage Price: {price_map[severity]}")
            print(f"  Confidence: {confidence:.1%}")


def export_to_onnx(model, output_path='network.onnx'):
    """Export trained model to ONNX format"""

    if not ONNX_AVAILABLE:
        print("❌ Cannot export to ONNX: torch.onnx not available")
        return False

    print(f"\n📦 Exporting model to ONNX: {output_path}")

    model.eval()
    dummy_input = torch.randn(1, INPUT_SIZE)

    try:
        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )

        print(f"✅ Model exported successfully to {output_path}")

        onnx_model = onnx.load(output_path)
        onnx.checker.check_model(onnx_model)
        print("✅ ONNX model verified")

        return True

    except Exception as e:
        print(f"❌ ONNX export failed: {e}")
        return False


def save_metadata(vocab_mapping, feature_mapping, model_stats):
    """Save model metadata for testing"""

    vocab_data = {
        'vocab_mapping': vocab_mapping,
        'feature_mapping': feature_mapping
    }

    with open('vocab.json', 'w') as f:
        json.dump(vocab_data, f, indent=2)

    metadata = {
        "model_type": "collision_severity_classifier",
        "input_size": INPUT_SIZE,
        "hidden_size": HIDDEN_SIZE,
        "output_size": NUM_CLASSES,
        "training_accuracy": model_stats['training_accuracy'],
        "validation_accuracy": model_stats['validation_accuracy'],
        "architecture": {
            "type": "MLP",
            "layers": [
                {"type": "Linear", "in_features": INPUT_SIZE, "out_features": HIDDEN_SIZE},
                {"type": "ReLU"},
                {"type": "Linear", "in_features": HIDDEN_SIZE, "out_features": HIDDEN_SIZE // 2},
                {"type": "ReLU"},
                {"type": "Linear", "in_features": HIDDEN_SIZE // 2, "out_features": NUM_CLASSES}
            ]
        },
        "feature_buckets": {
            "impact_force": IMPACT_FORCE_BUCKETS,
            "velocity": VELOCITY_BUCKETS,
            "angle": ANGLE_BUCKETS,
            "object_type": OBJECT_TYPE_BUCKETS,
            "damage_zone": DAMAGE_ZONE_BUCKETS,
            "robot_load": ROBOT_LOAD_BUCKETS,
            "time_since_last": TIME_SINCE_LAST_BUCKETS,
            "weather": WEATHER_BUCKETS
        },
        "severity_classes": {
            "0": {"name": "MINOR", "description": "No footage needed", "price_usd": 0.00},
            "1": {"name": "MODERATE", "description": "Footage recommended", "price_usd": 0.02},
            "2": {"name": "SEVERE", "description": "Footage required", "price_usd": 0.05},
            "3": {"name": "CRITICAL", "description": "Footage + report", "price_usd": 0.10}
        }
    }

    with open('meta.json', 'w') as f:
        json.dump(metadata, f, indent=2)

    print("✅ Metadata saved to vocab.json and meta.json")


if __name__ == '__main__':
    print("🚀 Starting Collision Severity Model Training")
    print("=" * 60)
    print("This model assesses collision severity for robot commerce")
    print("Output determines if/how much to pay for witness footage")
    print("=" * 60)

    # Generate dataset
    X, y, vocab_mapping, feature_mapping = generate_dataset(num_samples=10000)

    # Train model
    model, train_acc, val_acc = train_model(X, y, vocab_mapping)

    # Test sample scenarios
    test_sample_scenarios(model, vocab_mapping)

    # Export to ONNX
    export_success = export_to_onnx(model, 'network.onnx')

    # Save metadata
    model_stats = {
        "dataset_size": len(X),
        "train_size": int(0.8 * len(X)),
        "val_size": int(0.2 * len(X)),
        "epochs": EPOCHS,
        "batch_size": BATCH_SIZE,
        "learning_rate": LEARNING_RATE,
        "training_accuracy": train_acc,
        "validation_accuracy": val_acc
    }
    save_metadata(vocab_mapping, feature_mapping, model_stats)

    print(f"\n✨ Collision Severity Model training complete!")
    if export_success:
        print(f"📁 Model saved as: network.onnx")
        print(f"📁 Metadata saved as: vocab.json, meta.json")

    print("\n📋 Model Summary:")
    print(f"  • Input: Sensor data (impact, velocity, angle, object, etc.)")
    print(f"  • Output: Severity class (MINOR, MODERATE, SEVERE, CRITICAL)")
    print(f"  • Use case: Determines if robot should buy witness footage")
    print(f"  • Architecture: {INPUT_SIZE} → {HIDDEN_SIZE} → {HIDDEN_SIZE//2} → {NUM_CLASSES}")
