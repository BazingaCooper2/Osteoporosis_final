import sys
import json
from pathlib import Path
from typing import Any, Dict, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import cv2
from skimage.feature import local_binary_pattern, graycomatrix, graycoprops
from PIL import Image, ImageEnhance, ImageFilter
from torchvision import transforms

# Configuration
CONFIG: Dict[str, Any] = {
    'img_size': (224, 224),
    'num_classes': 3,
    'class_names': ['Normal', 'Osteopenia', 'Osteoporosis'],
    'lbp_radius': 3,
    'lbp_n_points': 24,
    'glcm_distances': [1, 3, 5],
    'glcm_angles': [0, np.pi / 4, np.pi / 2, 3 * np.pi / 4],
    'use_texture_features': True,
    'apply_advanced_preprocessing': True,
    'confidence_threshold': 0.8,
}

# --- Preprocessing ---
class AdvancedPreprocessing:
    @staticmethod
    def bilateral_filter(img):
        img_np = np.array(img)
        filtered = cv2.bilateralFilter(img_np, d=9, sigmaColor=75, sigmaSpace=75)
        return Image.fromarray(filtered)
    
    @staticmethod
    def unsharp_mask(img, radius=2, amount=1.2):
        blurred = img.filter(ImageFilter.GaussianBlur(radius))
        sharpened = Image.blend(img, blurred, -amount)
        return sharpened
    
    @staticmethod
    def apply_clahe_lab(img):
        img_np = np.array(img)
        lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        return Image.fromarray(enhanced)
    
    @staticmethod
    def enhance_contrast(img):
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.3)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.2)
        return img

# --- Texture Features ---
class TextureFeatureExtractor:
    def __init__(self):
        pass

    @staticmethod
    def extract_lbp_features(image, radius=3, n_points=24):
        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        lbp = local_binary_pattern(gray, n_points, radius, method='uniform')
        n_bins = n_points + 2
        hist, _ = np.histogram(lbp.ravel(), bins=n_bins, range=(0, n_bins), density=True)
        lbp_mean = np.mean(lbp)
        lbp_std = np.std(lbp)
        lbp_energy = np.sum(hist ** 2)
        return np.concatenate([hist, [lbp_mean, lbp_std, lbp_energy]])

    @staticmethod
    def extract_glcm_features(image, distances=[1, 3, 5], angles=[0, np.pi/4, np.pi/2, 3*np.pi/4]):
        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        gray = ((gray - gray.min()) / (max(1, gray.max() - gray.min())) * 255).astype(np.uint8)
        gray = (gray // 32)
        glcm = graycomatrix(gray, distances=distances, angles=angles, levels=8, symmetric=True, normed=True)
        features = []
        for prop in ['contrast', 'dissimilarity', 'homogeneity', 'energy', 'correlation', 'ASM']:
            values = graycoprops(glcm, prop).flatten()
            features.extend([np.mean(values), np.std(values), np.max(values), np.min(values)])
        return np.array(features)

    def extract_all_features(self, image):
        lbp = self.extract_lbp_features(image)
        glcm = self.extract_glcm_features(image)
        return np.concatenate([lbp, glcm])

# --- Architecture ---
class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super(ChannelAttention, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Sequential(
            nn.Conv2d(channels, channels // reduction, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(channels // reduction, channels, 1, bias=False)
        )
        self.sigmoid = nn.Sigmoid()
    def forward(self, x):
        avg_out = self.fc(self.avg_pool(x))
        max_out = self.fc(self.max_pool(x))
        return self.sigmoid(avg_out + max_out)

class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super(SpatialAttention, self).__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=kernel_size//2, bias=False)
        self.sigmoid = nn.Sigmoid()
    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        x = torch.cat([avg_out, max_out], dim=1)
        x = self.conv(x)
        return self.sigmoid(x)

class CBAM(nn.Module):
    def __init__(self, channels, reduction=16, kernel_size=7):
        super(CBAM, self).__init__()
        self.channel_attention = ChannelAttention(channels, reduction)
        self.spatial_attention = SpatialAttention(kernel_size)
    def forward(self, x):
        x = x * self.channel_attention(x)
        x = x * self.spatial_attention(x)
        return x

class ResidualBlockWithCBAM(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1, use_cbam=True):
        super(ResidualBlockWithCBAM, self).__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.cbam = CBAM(out_channels) if use_cbam else nn.Identity()
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=stride),
                nn.BatchNorm2d(out_channels)
            )
    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.cbam(out)
        out += self.shortcut(x)
        return F.relu(out)

class ImprovedCNN(nn.Module):
    def __init__(self, num_classes=3, dropout=0.5, use_cbam=True):
        super(ImprovedCNN, self).__init__()
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        )
        self.layer1 = self._make_layer(64, 64, 2, use_cbam=use_cbam)
        self.layer2 = self._make_layer(64, 128, 2, stride=2, use_cbam=use_cbam)
        self.layer3 = self._make_layer(128, 256, 2, stride=2, use_cbam=use_cbam)
        self.layer4 = self._make_layer(256, 512, 2, stride=2, use_cbam=use_cbam)
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        # This is replaced in HybridModel if use_texture is True
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(256)
        )
    def _make_layer(self, in_channels, out_channels, num_blocks, stride=1, use_cbam=True):
        layers = [ResidualBlockWithCBAM(in_channels, out_channels, stride, use_cbam)]
        for _ in range(1, num_blocks):
            layers.append(ResidualBlockWithCBAM(out_channels, out_channels, 1, use_cbam))
        return nn.Sequential(*layers)
    def forward(self, x):
        x = self.conv1(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.avgpool(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

class HybridModel(nn.Module):
    def __init__(self, num_classes=3, dropout=0.5, use_cbam=True, use_texture=True):
        super(HybridModel, self).__init__()
        self.use_texture = use_texture
        self.cnn = ImprovedCNN(num_classes=num_classes, dropout=dropout, use_cbam=use_cbam)
        if use_texture:
            self.texture_fc = nn.Sequential(
                nn.Linear(53, 128),
                nn.ReLU(inplace=True),
                nn.BatchNorm1d(128),
                nn.Dropout(0.3),
                nn.Linear(128, 64),
                nn.ReLU(inplace=True)
            )
            # Override CNN classifier to match notebook's Hybrid behavior
            self.cnn.classifier = nn.Sequential(
                nn.Dropout(dropout),
                nn.Linear(512, 256),
                nn.ReLU(inplace=True),
                nn.BatchNorm1d(256)
            )
            self.fusion = nn.Sequential(
                nn.Dropout(dropout * 0.7),
                nn.Linear(256 + 64, 128),
                nn.ReLU(inplace=True),
                nn.BatchNorm1d(128),
                nn.Dropout(dropout * 0.5),
                nn.Linear(128, num_classes)
            )
    def forward(self, x, texture_features):
        cnn_out = self.cnn(x)
        if self.use_texture and texture_features is not None:
            texture_out = self.texture_fc(texture_features)
            combined = torch.cat([cnn_out, texture_out], dim=1)
            return self.fusion(combined)
        return cnn_out


def _normalize_img_size(val: Any) -> Tuple[int, int]:
    if isinstance(val, (list, tuple)) and len(val) == 2:
        return int(val[0]), int(val[1])
    return 224, 224


def _merge_config(*configs: Dict[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for cfg in configs:
        merged.update(cfg or {})
    merged['img_size'] = _normalize_img_size(merged.get('img_size', CONFIG['img_size']))
    if 'class_names' not in merged:
        merged['class_names'] = CONFIG['class_names']
    merged['num_classes'] = merged.get('num_classes', len(merged['class_names']))
    merged['use_texture_features'] = merged.get('use_texture_features', True)
    merged['confidence_threshold'] = merged.get('confidence_threshold', 0.8)
    merged['apply_advanced_preprocessing'] = merged.get('apply_advanced_preprocessing', True)
    return merged


def _resolve_model_path(model_arg: str | None) -> Tuple[Path, Dict[str, Any]]:
    search_dirs = []

    if model_arg:
        candidate = Path(model_arg)
        if candidate.is_file():
            return candidate, {}
        if candidate.is_dir():
            search_dirs.append(candidate)

    # Prefer packaged deployment artifacts from notebook export
    root = Path(__file__).resolve().parents[1]
    search_dirs.append(root / 'Direct_Models' / 'models_improved')
    search_dirs.append(root / 'models')

    for base_dir in search_dirs:
        if not base_dir.exists():
            continue

        config_path = base_dir / 'deployment_config.json'
        cfg: Dict[str, Any] = {}
        if config_path.exists():
            with open(config_path, 'r') as f:
                cfg = json.load(f)

        # Candidate names ordered by specificity
        names = [
            cfg.get('main_model_only_state'),
            'main_model_only_state.pth',
            cfg.get('model_path'),
            'deployment_checkpoint.pth',
            'best_improved_model.pth',
        ]

        for name in names:
            if not name:
                continue
            candidate = base_dir / name
            if candidate.exists():
                return candidate, cfg

    raise FileNotFoundError('No model checkpoint found. Provide a path or place artifacts in Direct_Models/models_improved or models/.')


def _extract_state_dict(checkpoint: Any) -> Dict[str, Any]:
    if isinstance(checkpoint, dict):
        if 'model_state_dict' in checkpoint:
            return checkpoint['model_state_dict']
        if 'state_dict' in checkpoint:
            return checkpoint['state_dict']
    return checkpoint


def _build_transform(cfg: Dict[str, Any]):
    return transforms.Compose([
        transforms.Resize(cfg['img_size']),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


def _preprocess_image(img: Image.Image, cfg: Dict[str, Any]) -> Image.Image:
    prep = AdvancedPreprocessing()
    if cfg.get('apply_advanced_preprocessing', True):
        img = prep.bilateral_filter(img)
        img = prep.apply_clahe_lab(img)
        img = prep.unsharp_mask(img, radius=2, amount=1.2)
        img = prep.enhance_contrast(img)
    return img


def _get_risk_level(predicted_class: int, confidence: float, cfg: Dict[str, Any]) -> str:
    threshold = cfg.get('confidence_threshold', 0.8)
    if predicted_class == 0 and confidence >= threshold:
        return 'low'
    if predicted_class == 2:
        return 'high'
    return 'moderate'


def _get_recommendation(risk_level: str, predicted_label: str) -> str:
    if risk_level == 'low':
        return (
            f"Assessment: Imaging aligns with {predicted_label}.\n"
            "Plan: Continue preventive lifestyle (weight-bearing exercise, nutrition).\n"
            "Monitoring: Repeat DEXA/dental imaging in 18–24 months or earlier if risk factors change."
        )
    if risk_level == 'moderate':
        return (
            f"Assessment: Pattern indicates {predicted_label}.\n"
            "Diagnostics: Schedule confirmatory DEXA within 3–6 months.\n"
            "Management: Start supplementation + targeted exercise; consider pharmacologic prevention."
        )
    return (
        f"Assessment: Severe fragility pattern ({predicted_label}).\n"
        "Urgent Steps: Refer to endocrinology; order DEXA + VFA within 4 weeks.\n"
        "Therapy: Initiate anti-resorptive/anabolic plan with close follow-up."
    )


def _compute_t_score(prediction: str, class_probs: Dict[str, float]) -> float:
    if prediction == 'Normal':
        return -0.5 + (class_probs.get('Normal', 0.0) * 0.4)
    if prediction == 'Osteopenia':
        return -1.8 + (class_probs.get('Osteopenia', 0.0) * 0.6)
    return -3.2 + (class_probs.get('Osteoporosis', 0.0) * 0.4)

def run_inference(image_path: str, model_arg: str | None = None) -> Dict[str, Any]:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    checkpoint_path, cfg_from_disk = _resolve_model_path(model_arg)
    checkpoint = torch.load(checkpoint_path, map_location=device)
    cfg = _merge_config(CONFIG, cfg_from_disk, checkpoint.get('config', {}) if isinstance(checkpoint, dict) else {})

    use_texture = bool(cfg.get('use_texture_features', True))
    if use_texture:
        model = HybridModel(num_classes=cfg['num_classes'], use_texture=True).to(device)
    else:
        model = ImprovedCNN(num_classes=cfg['num_classes']).to(device)

    state_dict = _extract_state_dict(checkpoint)
    model.load_state_dict(state_dict, strict=False)
    model.eval()

    img = Image.open(image_path).convert('RGB')
    img = _preprocess_image(img, cfg)

    transform = _build_transform(cfg)
    img_tensor = transform(img).unsqueeze(0).to(device)

    texture_tensor = None
    if use_texture:
        texture_features = TextureFeatureExtractor().extract_all_features(img)
        texture_tensor = torch.tensor(texture_features, dtype=torch.float32).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(img_tensor, texture_tensor) if use_texture else model(img_tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

    prob_dict = {cls: float(probs[i]) for i, cls in enumerate(cfg['class_names'])}
    confidence = float(np.max(probs))
    predicted_class = int(np.argmax(probs))
    predicted_label = cfg['class_names'][predicted_class]

    risk_level = _get_risk_level(predicted_class, confidence, cfg)
    recommendation = _get_recommendation(risk_level, predicted_label)
    t_score = round(_compute_t_score(predicted_label, prob_dict), 2)

    return {
        'prediction': predicted_label,
        'predicted_label': predicted_label,
        'predicted_class': predicted_class,
        'confidence': confidence,
        'probabilities': prob_dict,
        'risk_level': risk_level,
        'recommendation': recommendation,
        't_score': t_score,
        'model_path': str(checkpoint_path),
        'config_used': cfg,
        'texture_used': use_texture,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inference.py <image_path> [model_dir_or_file]")
        sys.exit(1)
    try:
        model_arg = sys.argv[2] if len(sys.argv) > 2 else None
        res = run_inference(sys.argv[1], model_arg)
        print(f"RESULT:{json.dumps(res)}")
    except Exception as e:
        import traceback
        print(f"ERROR:{str(e)}\n{traceback.format_exc()}")
        sys.exit(1)
