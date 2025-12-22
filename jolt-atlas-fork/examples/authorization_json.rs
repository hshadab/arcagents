//! Authorization Model JSON Output
//!
//! Wrapper for Node.js integration - outputs JSON for zkml-proof-service

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
    decision: String,
    confidence: f32,
    proof_hash: String,
    proof_size: usize,
    prove_time_ms: u128,
    verify_time_ms: u128,
    input_features: InputFeatures,
}

#[derive(Serialize, Deserialize)]
struct InputFeatures {
    budget: usize,
    trust: usize,
    amount: usize,
    category: usize,
    velocity: usize,
    day: usize,
    time: usize,
    risk: usize,
}

fn load_authorization_vocab(
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

fn build_authorization_vector(
    features: &InputFeatures,
    vocab: &HashMap<String, usize>,
) -> Vec<i32> {
    let mut vec = vec![0; 64];

    let feature_values = [
        ("budget", features.budget),
        ("trust", features.trust),
        ("amount", features.amount),
        ("category", features.category),
        ("velocity", features.velocity),
        ("day", features.day),
        ("time", features.time),
        ("risk", features.risk),
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

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    // Parse input features from command line args
    // Usage: authorization_json <budget> <trust> <amount> <category> <velocity> <day> <time> <risk>
    let features = if args.len() >= 9 {
        InputFeatures {
            budget: args[1].parse().unwrap_or(10),
            trust: args[2].parse().unwrap_or(5),
            amount: args[3].parse().unwrap_or(5),
            category: args[4].parse().unwrap_or(0),
            velocity: args[5].parse().unwrap_or(2),
            day: args[6].parse().unwrap_or(1),
            time: args[7].parse().unwrap_or(1),
            risk: args[8].parse().unwrap_or(0),
        }
    } else {
        // Default test case: high trust, sufficient budget -> should authorize
        InputFeatures {
            budget: 15,
            trust: 7,
            amount: 8,
            category: 0,
            velocity: 2,
            day: 1,
            time: 1,
            risk: 0,
        }
    };

    // Determine working directory
    let working_dir = if PathBuf::from("onnx-tracer/models/authorization/").exists() {
        "onnx-tracer/models/authorization/"
    } else if PathBuf::from("../onnx-tracer/models/authorization/").exists() {
        "../onnx-tracer/models/authorization/"
    } else {
        eprintln!("Error: Cannot find authorization model directory");
        std::process::exit(1);
    };

    // Load vocab
    let vocab_path = format!("{working_dir}/vocab.json");
    let vocab = load_authorization_vocab(&vocab_path)?;

    // Build input vector
    let input_vector = build_authorization_vector(&features, &vocab);
    let input = Tensor::new(Some(&input_vector), &[1, 64]).unwrap();

    // Run model to get prediction
    let model_fn = || model(&PathBuf::from(format!("{working_dir}network.onnx")));
    let model_instance = model_fn();
    let result = model_instance.forward(&[input.clone()]).unwrap();
    let output = result.outputs[0].clone();

    // Get prediction
    let (pred_idx, confidence_val) = output
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .unwrap();

    let decision = if pred_idx == 1 { "AUTHORIZED" } else { "DENIED" };
    let confidence = *confidence_val as f32;

    // Generate proof
    eprintln!("Preprocessing model...");
    let preprocessing =
        JoltSNARK::<Fr, PCS, KeccakTranscript>::prover_preprocess(model_fn, 1 << 14);

    eprintln!("Generating proof...");
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
        decision: decision.to_string(),
        confidence,
        proof_hash,
        proof_size,
        prove_time_ms: prove_time.as_millis(),
        verify_time_ms: verify_time.as_millis(),
        input_features: features,
    };

    println!("{}", serde_json::to_string(&output)?);

    Ok(())
}
