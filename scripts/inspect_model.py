import joblib
import torch
import os
import json

# Correct paths
models_dir = "/Users/bazingacooper2/Downloads/results (2)/models_improved"
pipeline_path = os.path.join(models_dir, "osteoporosis_pipeline.pkl")
config_path = os.path.join(models_dir, "deployment_config.json")
model_path = os.path.join(models_dir, "deployment_checkpoint.pth")

print("--- Inspecting ML Components ---")

if os.path.exists(config_path):
    with open(config_path, 'r') as f:
        config = json.load(f)
        print(f"Config loaded: {json.dumps(config, indent=2)}")

try:
    pipeline = joblib.load(pipeline_path)
    print(f"Pipeline type: {type(pipeline)}")
    if hasattr(pipeline, 'named_steps'):
        print(f"Pipeline steps: {list(pipeline.named_steps.keys())}")
    else:
        print(f"Pipeline attributes: {dir(pipeline)}")
except Exception as e:
    print(f"Error loading pipeline: {e}")

try:
    checkpoint = torch.load(model_path, map_location='cpu')
    print(f"Model checkpoint type: {type(checkpoint)}")
    if isinstance(checkpoint, dict):
        print(f"Checkpoint keys: {list(checkpoint.keys())}")
        if 'model_state_dict' in checkpoint:
            print("Found model_state_dict")
except Exception as e:
    print(f"Error loading model: {e}")
