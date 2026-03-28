import torch
import os

model_path = "/Users/bazingacooper2/Downloads/results (2)/models_improved/deployment_checkpoint.pth"

try:
    checkpoint = torch.load(model_path, map_location='cpu')
    print(f"Model Class: {checkpoint.get('model_class')}")
    print(f"Config: {checkpoint.get('config')}")
except Exception as e:
    print(f"Error: {e}")
