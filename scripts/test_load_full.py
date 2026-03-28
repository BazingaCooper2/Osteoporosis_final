import torch
import os

model_path = "/Users/bazingacooper2/Downloads/results (2)/models_improved/improved_model_complete.pth"

try:
    # Attempt to load the full model object
    model = torch.load(model_path, map_location='cpu', weights_only=False)
    print(f"Loaded successfully! Type: {type(model)}")
    if hasattr(model, 'eval'):
        print("Model is an nn.Module and can be used for inference.")
        model.eval()
        print("Model set to eval mode.")
    else:
        print(f"Loaded object: {model}")
except Exception as e:
    print(f"Error loading model: {e}")
