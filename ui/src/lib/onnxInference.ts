/**
 * ONNX Model Inference Module
 *
 * Provides browser-based ONNX model inference using onnxruntime-web.
 * Models are loaded from the /public/models directory.
 *
 * The spending model is used by all agents to evaluate purchase decisions.
 */

import * as ort from 'onnxruntime-web';
import { DECISION_MODELS, type DecisionModelId } from './models';

// Model cache to avoid reloading
const modelCache = new Map<string, ort.InferenceSession>();

/**
 * Inference result
 */
export interface InferenceResult {
  success: boolean;
  output?: number;
  rawOutput?: number[];
  confidence?: number;
  category?: string;
  error?: string;
  inferenceTimeMs?: number;
}


/**
 * Initialize ONNX Runtime with WebAssembly backend
 */
export async function initOnnxRuntime(): Promise<void> {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  console.log('[ONNX] Runtime initialized');
}

/**
 * Load an ONNX model from the models directory
 */
export async function loadModel(modelId: string): Promise<ort.InferenceSession | null> {
  if (modelCache.has(modelId)) {
    return modelCache.get(modelId)!;
  }

  const modelPath = `/models/${modelId}.onnx`;

  try {
    console.log(`[ONNX] Loading model: ${modelPath}`);
    const response = await fetch(modelPath);
    if (!response.ok) {
      console.warn(`[ONNX] Model not found: ${modelPath} (${response.status})`);
      return null;
    }

    const modelBuffer = await response.arrayBuffer();
    const session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    modelCache.set(modelId, session);
    console.log(`[ONNX] Model loaded: ${modelId}`);
    console.log(`[ONNX] Input names: ${session.inputNames}`);
    console.log(`[ONNX] Output names: ${session.outputNames}`);

    return session;
  } catch (error) {
    console.error(`[ONNX] Failed to load model ${modelId}:`, error);
    return null;
  }
}

/**
 * Run inference on a loaded model
 */
export async function runInference(
  session: ort.InferenceSession,
  inputData: number[],
  modelId: string
): Promise<InferenceResult> {
  const startTime = performance.now();

  try {
    const modelConfig = DECISION_MODELS[modelId as DecisionModelId];
    if (!modelConfig) {
      return { success: false, error: `Unknown model: ${modelId}` };
    }

    const inputName = session.inputNames[0];
    const inputShape = modelConfig.inputShape;

    // Create float32 tensor (spending model uses float32)
    const tensor = new ort.Tensor('float32', Float32Array.from(inputData), inputShape);

    // Run inference
    const results = await session.run({ [inputName]: tensor });

    // Get output
    const outputName = session.outputNames[0];
    const outputTensor = results[outputName];
    const outputData = Array.from(outputTensor.data as Float32Array);

    // Process spending model output: [shouldBuy, confidence, riskScore]
    const shouldBuy = sigmoid(outputData[0]);
    const modelConfidence = sigmoid(outputData[1]);
    const output = shouldBuy;
    const confidence = modelConfidence;
    const category = shouldBuy > 0.5 ? 'APPROVE' : 'REJECT';

    const inferenceTimeMs = performance.now() - startTime;

    return {
      success: true,
      output,
      rawOutput: outputData,
      confidence,
      category,
      inferenceTimeMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Inference failed',
      inferenceTimeMs: performance.now() - startTime,
    };
  }
}

/**
 * Run inference with automatic model loading
 */
export async function runModelInference(
  modelId: string,
  inputData: number[] | Record<string, unknown>
): Promise<InferenceResult> {
  const modelConfig = DECISION_MODELS[modelId as DecisionModelId];
  if (!modelConfig) {
    return { success: false, error: `Unknown model: ${modelId}` };
  }

  // Convert input to number array if it's an object
  const numericInput = Array.isArray(inputData)
    ? inputData
    : extractNumericFeatures(inputData, modelId);

  // Ensure correct size
  const targetSize = modelConfig.inputShape.reduce((a, b) => a * b, 1);
  const paddedInput = padOrTruncate(numericInput, targetSize);

  // Try to load the real model
  const session = await loadModel(modelId);

  if (session) {
    return await runInference(session, paddedInput, modelId);
  }

  // Fallback: Deterministic simulation when model doesn't exist
  console.log(`[ONNX] Using deterministic simulation for ${modelId}`);
  return runDeterministicInference(modelId, paddedInput);
}

/**
 * Deterministic inference fallback
 */
function runDeterministicInference(
  modelId: string,
  inputData: number[]
): InferenceResult {
  const startTime = performance.now();

  // Create deterministic hash from inputs
  const inputHash = hashArray(inputData);
  const modelHash = hashString(modelId);
  const combinedHash = (inputHash ^ modelHash) >>> 0;
  const output = (combinedHash % 10000) / 10000;
  const category = output > 0.5 ? 'APPROVE' : 'REJECT';

  const inferenceTimeMs = performance.now() - startTime;

  return {
    success: true,
    output,
    rawOutput: [output],
    confidence: Math.abs(output - 0.5) * 2,
    category,
    inferenceTimeMs,
  };
}

/**
 * Extract numeric features from arbitrary input data
 */
function extractNumericFeatures(
  data: Record<string, unknown>,
  modelId: string
): number[] {
  const modelConfig = DECISION_MODELS[modelId as DecisionModelId];
  const targetLength = modelConfig
    ? modelConfig.inputShape.reduce((a, b) => a * b, 1)
    : 8;

  const features: number[] = [];

  const extractNumbers = (obj: unknown, depth = 0): void => {
    if (depth > 3) return;

    if (typeof obj === 'number' && isFinite(obj)) {
      features.push(obj);
    } else if (typeof obj === 'string') {
      // Hash strings to numbers (normalized)
      features.push(hashString(obj) / 0xFFFFFFFF);
    } else if (typeof obj === 'boolean') {
      features.push(obj ? 1 : 0);
    } else if (Array.isArray(obj)) {
      obj.slice(0, 20).forEach(item => extractNumbers(item, depth + 1));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).slice(0, 20).forEach(val => extractNumbers(val, depth + 1));
    }
  };

  extractNumbers(data);

  return padOrTruncate(features, targetLength);
}

/**
 * Pad or truncate array to target length
 */
function padOrTruncate(arr: number[], targetLength: number): number[] {
  if (arr.length >= targetLength) {
    return arr.slice(0, targetLength);
  }
  const result = [...arr];
  while (result.length < targetLength) {
    result.push(0);
  }
  return result;
}

/**
 * Sigmoid activation function
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Softmax activation for multi-class output
 */
function softmax(arr: number[]): number[] {
  const maxVal = Math.max(...arr);
  const expArr = arr.map(v => Math.exp(v - maxVal));
  const sumExp = expArr.reduce((a, b) => a + b, 0);
  return expArr.map(v => v / sumExp);
}

/**
 * Hash a number array deterministically
 */
function hashArray(arr: number[]): number {
  let hash = 0;
  for (let i = 0; i < arr.length; i++) {
    const val = Math.floor(arr[i] * 1000000);
    hash = ((hash << 5) - hash + val) | 0;
  }
  return Math.abs(hash);
}

/**
 * Hash a string deterministically (djb2)
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Check if a model file exists
 */
export async function modelExists(modelId: string): Promise<boolean> {
  try {
    const response = await fetch(`/models/${modelId}.onnx`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Clear the model cache
 */
export function clearModelCache(): void {
  modelCache.clear();
  console.log('[ONNX] Model cache cleared');
}
