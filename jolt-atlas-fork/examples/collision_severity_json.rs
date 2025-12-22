//! Collision Severity Model JSON Output
//!
//! zkML prover for collision severity assessment in robot commerce.
//! Takes sensor data from collision and outputs severity + cryptographic proof.
//!
//! Usage: collision_severity_json <impact_force> <velocity> <angle> <object_type> <damage_zone> <robot_load> <time_since_last> <weather>
//!
//! Example: collision_severity_json 10 5 0 2 0 1 5 0
//!   -> Person hit at moderate speed, returns SEVERE with proof

use ark_bn254::Fr;
use jolt_core::{poly::commitment::dory::DoryCommitmentScheme, transcripts::KeccakTranscript};
use onnx_tracer::{model, tensor::Tensor};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, env, fs::File, io::Read, path::PathBuf, time::Instant};
use zkml_jolt_core::jolt::JoltSNARK;

#[allow(clippy::upper_case_acronyms)]
type PCS = DoryCommitmentScheme;

#[derive(Serialize)]
struct ProofOutput {
    success: bool,
    severity: String,
    severity_code: usize,
    confidence: f32,
    recommended_price_usd: f32,
    proof_hash: String,
    proof_size: usize,
    prove_time_ms: u128,
    verify_time_ms: u128,
    sensor_data: SensorData,
}

#[derive(Serialize, Deserialize)]
struct SensorData {
    impact_force: usize,    // 0-15: accelerometer magnitude
    velocity: usize,        // 0-7: speed at impact
    angle: usize,           // 0-7: impact angle (0=front, 2=right, 4=back, 6=left)
    object_type: usize,     // 0-7: detected object (0=unknown, 1=vehicle, 2=person, etc.)
    damage_zone: usize,     // 0-7: which part of robot hit
    robot_load: usize,      // 0-3: cargo value (0=empty, 3=high-value)
    time_since_last: usize, // 0-7: time since last collision
    weather: usize,         // 0-3: weather conditions
}

fn load_collision_vocab(
    path: &str,
) -> Result<HashMap<String, usize>, Box<dyn std::error::Error>> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;

    let json_value: Value = serde_json::from_str(&contents)?;
    let mut vocab = HashMap::new();

    if let Some(Value::Object(map)) = json_value.get("vocab_mapping") {
        for (feature_key, data) in map {
            if let Some(index) = data.get("index").and_then(|v| v.as_u64()) {
                vocab.insert(feature_key.clone(), index as usize);
            }
        }
    }

    Ok(vocab)
}

fn build_sensor_vector(
    sensor_data: &SensorData,
    vocab: &HashMap<String, usize>,
) -> Vec<i32> {
    let mut vec = vec![0; 64];

    let feature_values = [
        ("impact_force", sensor_data.impact_force),
        ("velocity", sensor_data.velocity),
        ("angle", sensor_data.angle),
        ("object_type", sensor_data.object_type),
        ("damage_zone", sensor_data.damage_zone),
        ("robot_load", sensor_data.robot_load),
        ("time_since_last", sensor_data.time_since_last),
        ("weather", sensor_data.weather),
    ];

    for (feature_type, value) in feature_values {
        let feature_key = format!("{feature_type}_{value}");
        if let Some(&index) = vocab.get(&feature_key) {
            if index < 64 {
                vec[index] = 1;
            }
        }
    }

    vec
}

fn get_severity_info(severity_code: usize) -> (&'static str, f32) {
    match severity_code {
        0 => ("MINOR", 0.00),
        1 => ("MODERATE", 0.02),
        2 => ("SEVERE", 0.05),
        3 => ("CRITICAL", 0.10),
        _ => ("UNKNOWN", 0.00),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    // Parse sensor data from command line args
    // Usage: collision_severity_json <impact_force> <velocity> <angle> <object_type> <damage_zone> <robot_load> <time_since_last> <weather>
    let sensor_data = if args.len() >= 9 {
        SensorData {
            impact_force: args[1].parse().unwrap_or(5),
            velocity: args[2].parse().unwrap_or(3),
            angle: args[3].parse().unwrap_or(0),
            object_type: args[4].parse().unwrap_or(0),
            damage_zone: args[5].parse().unwrap_or(0),
            robot_load: args[6].parse().unwrap_or(0),
            time_since_last: args[7].parse().unwrap_or(7),
            weather: args[8].parse().unwrap_or(0),
        }
    } else {
        // Default test case: moderate impact, should be MODERATE severity
        SensorData {
            impact_force: 8,
            velocity: 4,
            angle: 0,
            object_type: 0,
            damage_zone: 0,
            robot_load: 1,
            time_since_last: 5,
            weather: 0,
        }
    };

    // Determine working directory
    let working_dir = if PathBuf::from("onnx-tracer/models/collision_severity/").exists() {
        "onnx-tracer/models/collision_severity/"
    } else if PathBuf::from("../onnx-tracer/models/collision_severity/").exists() {
        "../onnx-tracer/models/collision_severity/"
    } else {
        eprintln!("Error: Cannot find collision_severity model directory");
        std::process::exit(1);
    };

    // Load vocab
    let vocab_path = format!("{working_dir}/vocab.json");
    let vocab = load_collision_vocab(&vocab_path)?;

    // Build input vector
    let input_vector = build_sensor_vector(&sensor_data, &vocab);
    let input = Tensor::new(Some(&input_vector), &[1, 64]).unwrap();

    // Run model to get prediction
    let model_fn = || model(&PathBuf::from(format!("{working_dir}network.onnx")));
    let model_instance = model_fn();
    let result = model_instance.forward(&[input.clone()]).unwrap();
    let output = result.outputs[0].clone();

    // Get prediction (severity class)
    let (severity_code, confidence_val) = output
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .unwrap();

    let (severity_name, recommended_price) = get_severity_info(severity_code);
    let confidence = *confidence_val as f32;

    // Generate proof
    eprintln!("Preprocessing collision severity model...");
    let preprocessing =
        JoltSNARK::<Fr, PCS, KeccakTranscript>::prover_preprocess(model_fn, 1 << 14);

    eprintln!("Generating zkML proof for collision severity assessment...");
    let prove_start = Instant::now();
    let (snark, program_io, _debug_info) =
        JoltSNARK::<Fr, PCS, KeccakTranscript>::prove(&preprocessing, model_fn, &input);
    let prove_time = prove_start.elapsed();

    // Get proof size before verification consumes snark
    let proof_size = std::mem::size_of_val(&snark);

    // Generate proof hash from program_io
    let io_bytes = format!("{:?}", program_io);
    let proof_hash = format!("{:x}", md5::compute(io_bytes.as_bytes()));

    eprintln!("Verifying proof...");
    let verify_start = Instant::now();
    snark.verify(&(&preprocessing).into(), program_io.clone(), None)?;
    let verify_time = verify_start.elapsed();

    // Output JSON
    let output = ProofOutput {
        success: true,
        severity: severity_name.to_string(),
        severity_code,
        confidence,
        recommended_price_usd: recommended_price,
        proof_hash,
        proof_size,
        prove_time_ms: prove_time.as_millis(),
        verify_time_ms: verify_time.as_millis(),
        sensor_data,
    };

    println!("{}", serde_json::to_string(&output)?);

    Ok(())
}
