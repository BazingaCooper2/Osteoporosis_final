import sys
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import cv2
from skimage.feature import local_binary_pattern, graycomatrix, graycoprops
from PIL import Image, ImageEnhance, ImageFilter

# Configuration
CONFIG = {
    'img_size': (224, 224),
    'num_classes': 3,
    'class_names': ['Normal', 'Osteopenia', 'Osteoporosis'],
    'lbp_radius': 3,
    'lbp_n_points': 24,
    'glcm_distances': [1, 3, 5],
    'glcm_angles': [0, np.pi/4, np.pi/2, 3*np.pi/4]
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

def run_inference(image_path, model_path):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = HybridModel(use_texture=True).to(device)
    state_dict = torch.load(model_path, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()
    
    img = Image.open(image_path).convert('RGB')
    prep = AdvancedPreprocessing()
    # Preprocessing
    img = prep.bilateral_filter(img)
    img = prep.apply_clahe_lab(img)
    img = prep.unsharp_mask(img, radius=2, amount=1.2)
    img = prep.enhance_contrast(img)
    
    # Texture
    texture_extractor = TextureFeatureExtractor()
    texture_features = texture_extractor.extract_all_features(img)
    texture_tensor = torch.FloatTensor(texture_features).unsqueeze(0).to(device)
    
    # CNN
    img_cnn = img.resize(CONFIG['img_size'], Image.BILINEAR)
    img_tensor = torch.from_numpy(np.array(img_cnn)).permute(2, 0, 1).float().unsqueeze(0).to(device) / 255.0
    
    with torch.no_grad():
        output = model(img_tensor, texture_tensor)
        probabilities = F.softmax(output, dim=1)
        confidence, predicted = torch.max(probabilities, 1)
        
    prediction = CONFIG['class_names'][predicted.item()]
    if prediction == 'Normal':
        t_score = -0.5 + (probabilities[0][0].item() * 0.4)
    elif prediction == 'Osteopenia':
        t_score = -1.8 + (probabilities[0][1].item() * 0.6)
    else:
        t_score = -3.2 + (probabilities[0][2].item() * 0.4)
        
    return {'prediction': prediction, 'confidence': confidence.item(),'t_score': round(t_score, 2), 'probabilities': probabilities[0].tolist()}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python inference.py <image_path> <model_path>")
        sys.exit(1)
    try:
        res = run_inference(sys.argv[1], sys.argv[2])
        print(f"RESULT:{res}")
    except Exception as e:
        import traceback
        print(f"ERROR:{str(e)}\n{traceback.format_exc()}")
        sys.exit(1)
