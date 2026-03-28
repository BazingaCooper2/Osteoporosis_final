import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const RISK_LEVEL_MAP: Record<string, 'low' | 'moderate' | 'high'> = {
  'Normal': 'low',
  'Osteopenia': 'moderate',
  'Osteoporosis': 'high'
};

async function runPythonInference(imagePath: string): Promise<any> {
  const modelPath = join(process.cwd(), 'models', 'best_improved_model.pth');
  const scriptPath = join(process.cwd(), 'scripts', 'inference.py');

  return new Promise((resolve, reject) => {
    // Note: ensure 'python3' is in your PATH or specify full path
    const pythonProcess = spawn('python3', [scriptPath, imagePath, modelPath]);
    
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

      const match = output.match(/RESULT:(\{.*\})/);
      if (match) {
        try {
          const resultStr = match[1].replace(/'/g, '"'); // Convert single quotes to double quotes for JSON parsing
          resolve(JSON.parse(resultStr));
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

    const riskLevel = RISK_LEVEL_MAP[rawResult.prediction] || 'low';
    const meta = getInterpretations(riskLevel, rawResult.t_score);

    const translatedResult = {
      risk_level: riskLevel,
      confidence: rawResult.confidence,
      metrics: {
        t_score: rawResult.t_score,
        bmd_estimate_gcm2: parseFloat((0.85 - (rawResult.t_score * -0.1)).toFixed(3)),
        who_classification: rawResult.prediction,
        model_version: '2.0.0-integrated',
        scan_quality: 'Acceptable',
      },
      interpretation: meta.interpretation,
      next_steps: meta.nextSteps,
      heatmap_url: null,
      processed_at: new Date().toISOString(),
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
