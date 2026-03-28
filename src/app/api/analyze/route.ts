import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const RISK_LEVEL_MAP: Record<string, 'low' | 'moderate' | 'high'> = {
  'Normal': 'low',
  'Osteopenia': 'moderate',
  'Osteoporosis': 'high'
};

const DEFAULT_MODEL_DIR = join(process.cwd(), 'Direct_Models', 'models_improved');
const FALLBACK_MODEL_DIR = join(process.cwd(), 'models');

async function runPythonInference(imagePath: string): Promise<any> {
  const scriptPath = join(process.cwd(), 'scripts', 'inference.py');
  const defaultPython = join(process.cwd(), '.venv', 'bin', 'python');
  const pythonExecutable = process.env.PYTHON_BIN || (existsSync(defaultPython) ? defaultPython : 'python3');

  const resolvedModelDir = process.env.MODEL_DIR || (existsSync(DEFAULT_MODEL_DIR) ? DEFAULT_MODEL_DIR : FALLBACK_MODEL_DIR);

  return new Promise((resolve, reject) => {
    // Note: ensure 'python3' is in your PATH or specify full path
    // Prefer the project venv's interpreter to guarantee the right deps, fallback to system python3.
    const pythonProcess = spawn(pythonExecutable, [scriptPath, imagePath, resolvedModelDir]);
    
    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process error:', errorOutput);
        return reject(new Error(`Python process exited with code ${code}`));
      }

      const match = output.match(/RESULT:({[\s\S]*})/);
      if (match) {
        try {
          resolve(JSON.parse(match[1]));
        } catch (e) {
          reject(new Error('Failed to parse Python output: ' + e));
        }
      } else {
        reject(new Error('No result found in Python output'));
      }
    });
  });
}

function getInterpretations(level: string, tScore: number) {
  const meta: Record<string, { interpretation: string, nextSteps: string[] }> = {
    low: {
      interpretation: 'Bone mineral density appears within normal range. Continued routine screening is recommended per age-appropriate guidelines.',
      nextSteps: [
        'Continue weight-bearing exercise and calcium-rich diet.',
        'Schedule routine DXA screening per USPSTF guidelines.',
        'Report any new fractures or back pain to your clinician.',
      ]
    },
    moderate: {
      interpretation: 'Findings are consistent with low bone mass (osteopenia). Lifestyle modifications and clinical follow-up are recommended.',
      nextSteps: [
        'Consult your primary care provider to review DXA results.',
        'Discuss calcium, vitamin D supplementation, and fall prevention.',
        'Evaluate secondary causes of bone loss (e.g., thyroid, medications).',
        'Consider lifestyle counselling for smoking/alcohol reduction.',
      ]
    },
    high: {
      interpretation: 'Findings are consistent with significantly reduced bone mineral density. Prompt clinical evaluation and treatment assessment are strongly advised.',
      nextSteps: [
        'Seek prompt evaluation by a bone health specialist or endocrinologist.',
        'Discuss pharmacological treatment options (bisphosphonates, etc.).',
        'Fall risk assessment and home safety review are strongly recommended.',
        'Repeat formal DXA scan to confirm and establish a baseline.',
        'Alert clinician immediately if you experience any new fractures.',
      ]
    }
  };
  return meta[level] || meta['low'];
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided.' },
        { status: 400 }
      );
    }

    // Save to temp file for Python to read
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = join(tmpdir(), `analyze_${uuidv4()}.png`);
    await writeFile(tempFilePath, buffer);

    // Real inference
    const rawResult = await runPythonInference(tempFilePath);
    
    // Clean up
    await unlink(tempFilePath);
    tempFilePath = null;

    const riskLevelFromPy = typeof rawResult?.risk_level === 'string' ? rawResult.risk_level.toLowerCase() : undefined;
    const riskLevel = (riskLevelFromPy as 'low' | 'moderate' | 'high' | undefined) || RISK_LEVEL_MAP[rawResult?.prediction] || 'low';

    const confidence = typeof rawResult?.confidence === 'number' ? rawResult.confidence : Number(rawResult?.confidence ?? 0);
    const whoClassification = rawResult?.predicted_label || rawResult?.prediction || 'Normal';
    const tScore = typeof rawResult?.t_score === 'number' ? rawResult.t_score : Number(rawResult?.t_score ?? 0);

    const recText = typeof rawResult?.recommendation === 'string' ? rawResult.recommendation : '';
    const recLines = recText.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);

    const meta = getInterpretations(riskLevel, tScore);
    const interpretation = recLines[0] || meta.interpretation;
    const nextSteps = recLines.length > 1 ? recLines.slice(1) : meta.nextSteps;

    const modelVersion = rawResult?.config_used?.pipeline_version || rawResult?.config_used?.model_version || '2.0.0-integrated';
    const bmdEstimate = parseFloat((0.85 - (tScore * -0.1)).toFixed(3));

    const translatedResult = {
      risk_level: riskLevel,
      confidence,
      metrics: {
        t_score: tScore,
        bmd_estimate_gcm2: bmdEstimate,
        who_classification: whoClassification,
        model_version: modelVersion,
        scan_quality: rawResult?.scan_quality || 'Acceptable',
      },
      interpretation,
      next_steps: nextSteps,
      heatmap_url: rawResult?.heatmap_url || null,
      processed_at: rawResult?.processed_at || new Date().toISOString(),
    };

    return NextResponse.json(translatedResult, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (tempFilePath) await unlink(tempFilePath).catch(() => {});
    console.error('[/api/analyze] Error:', error);
    return NextResponse.json(
      { error: 'Inference service error. ' + (error instanceof Error ? error.message : '') },
      { status: 500 }
    );
  }
}
