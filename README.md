# Osteoporosis Detection from Dental Periapical Radiographs

A hybrid deep learning system for three-class osteoporosis severity classification using dental periapical radiograph images. The pipeline combines a residual convolutional backbone with handcrafted texture features, attention mechanisms, ordinal-aware training, and conformal prediction-based uncertainty quantification.

---

## Overview

Standard diagnostic workup for osteoporosis relies on dual-energy X-ray absorptiometry (DXA), which is costly and inaccessible for large-scale screening. This project investigates whether routinely acquired dental periapical radiographs can serve as an opportunistic screening modality by training a deep learning model to classify bone density into three severity categories: **Normal**, **Osteopenia**, and **Osteoporosis**.

The system is designed with clinical deployment in mind. Beyond classification accuracy, it provides interpretable spatial attention maps, uncertainty estimates with statistical coverage guarantees, and ordinal-consistent predictions that respect the natural severity ordering of the disease.

---

## Dataset

**Source:** Dataset of Dental Periapical Radiograph for Osteoporosis Classification  
**Link:** [https://data.mendeley.com/datasets/7xgzy69fw2/1](https://data.mendeley.com/datasets/7xgzy69fw2/1)  
**Provider:** Mendeley Data  
**Subjects:** Postmenopausal Javanese women, age greater than 50  
**Gold standard:** DXA-derived T-score labels  
**Classes:** Normal, Osteopenia, Osteoporosis  
**Image type:** 80x80 pixel cropped ROI patches from periapical radiographs  
**Total images:** 96,122 (train / validation / test splits provided)

---

## Pipeline Structure

The notebook (`osteoporosis-final-notebook.ipynb`) implements the following sequential pipeline:

1. Environment setup and dependency installation
2. Global configuration
3. Data loading and dataframe construction
4. Image preprocessing
5. Texture feature extraction
6. Preprocessing visualisation
7. Data augmentation
8. Dataset class with weighted sampling
9. Model architecture definition
10. Training setup
11. Training loop with MixUp
12. Training history visualisation
13. Test set evaluation
14. Confusion matrix and ROC curve analysis
15. Ordinal-aware retraining with CORAL
16. Conformal prediction calibration
17. Results export
18. Deployment artifact packaging

---

## Methods

### Image Preprocessing

A four-stage preprocessing pipeline is applied to each image to enhance bone texture visibility:

| Stage | Method | Parameters |
|-------|--------|------------|
| 1 | Bilateral filtering | d=9, sigmaColor=75, sigmaSpace=75 |
| 2 | CLAHE in LAB colour space | clipLimit=3.0, tileGridSize=8x8 |
| 3 | Unsharp masking | radius=2, amount=1.5 |
| 4 | Contrast stretching | range normalisation to [0, 255] |

Bilateral filtering removes noise while preserving trabecular bone edges. CLAHE applied in the LAB colour space enhances local contrast without over-amplifying background regions. Unsharp masking sharpens cortical and trabecular boundaries. The output is contrast-stretched for consistent dynamic range across all images.

### Texture Feature Extraction

Handcrafted radiomics features are extracted in parallel with the CNN pathway:

**Local Binary Patterns (LBP)**
- Uniform LBP with radius=3 and n\_points=24
- Produces a 26-dimensional normalised histogram capturing local texture uniformity
- Additional statistical descriptors: mean, standard deviation, and entropy of the LBP map

**Grey-Level Co-occurrence Matrix (GLCM)**
- Computed at distances [1, 2] and angles [0, 45, 90, 135 degrees]
- Extracted properties: contrast, dissimilarity, homogeneity, energy, and correlation
- Produces a 27-dimensional feature vector

Total texture feature dimensionality: **53 features** (concatenated and Z-score normalised).

### Data Augmentation

Training augmentation pipeline applied per sample:

- Random rotation up to 20 degrees
- Random horizontal flip (p=0.5)
- Random resized crop (scale 0.85–1.0)
- Colour jitter (brightness, contrast, saturation: 0.2)
- Random erasing (p=0.2, scale 0.02–0.1)
- MixUp (alpha=0.2) applied at batch level
- Normalisation using ImageNet statistics (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

Weighted random sampling is used during training to address class imbalance.

### Model Architecture

The model is a hybrid architecture combining a deep CNN backbone with a texture feature branch, fused at the embedding level.

**CNN Backbone (8 convolutional layers)**

| Block | Filters | Operations |
|-------|---------|------------|
| 1 | 64 | Conv 3x3, BatchNorm, ReLU, MaxPool 2x2 |
| 2 | 128 | Conv 3x3, BatchNorm, ReLU, MaxPool 2x2 |
| 3 | 256 x 2 | Conv 3x3, BatchNorm, ReLU, Residual connection, MaxPool 2x2 |
| 4 | 512 x 2 | Conv 3x3, BatchNorm, ReLU, Residual connection, AdaptiveAvgPool |

Dropout (rate=0.5) is applied throughout. Residual connections are included in Blocks 3 and 4 to enable gradient flow through the deeper layers.

**Convolutional Block Attention Module (CBAM)**

CBAM is applied after Block 4 and consists of two sequential sub-modules:

- Channel Attention: uses both global average pooling and global max pooling, passed through a shared two-layer MLP (reduction ratio=16), and recombined via sigmoid gating.
- Spatial Attention: averages and max-pools along the channel axis, concatenates, and passes through a 7x7 convolution followed by sigmoid.

The attention maps allow the network to focus selectively on diagnostically relevant bone regions.

**Texture Branch**

The 53-dimensional handcrafted feature vector is passed through two fully connected layers with batch normalisation and ReLU activation, producing a 128-dimensional embedding.

**Fusion and Classification Head**

The CNN embedding (512-d) and texture embedding (128-d) are concatenated (640-d total) and passed through two fully connected layers to produce the final class logits.

### Training Configuration

| Parameter | Value |
|-----------|-------|
| Optimiser | AdamW |
| Weight decay | 0.01 |
| Base learning rate | 0.001 |
| Scheduler | OneCycleLR (max\_lr=0.001) |
| Batch size | 64 |
| Epochs | 20 |
| Early stopping patience | 7 |
| Loss function | Focal Loss (gamma=2.0) |

**Focal Loss** down-weights the contribution of easy-to-classify examples, directing training focus toward hard and borderline cases. This is particularly effective under class imbalance.

### Ordinal-Aware Learning (CORAL)

Standard cross-entropy training treats the three classes as unordered nominal categories, assigning equal cost to all misclassifications. This is clinically inappropriate — confusing Normal with Osteoporosis is far more dangerous than confusing Normal with Osteopenia.

CORAL (Consistent Rank Logits) addresses this by reformulating the classification as a set of binary threshold problems:

- Is severity greater than Normal?
- Is severity greater than Osteopenia?

The model is trained with a binary cross-entropy loss over these K-1 rank thresholds. This structure encodes the Normal < Osteopenia < Osteoporosis severity ordering directly into the loss function, penalising cross-severity errors more heavily than adjacent-class errors.

CORAL training reduces the cross-severity misclassification rate (Normal misclassified as Osteoporosis and vice versa) to below 1%.

### Uncertainty Quantification (Conformal Prediction)

Standard neural network softmax probabilities are frequently overconfident and poorly calibrated. A model may assign high confidence to a wrong prediction, which is particularly dangerous in clinical screening.

This pipeline implements **Adaptive Prediction Sets (APS)**, a split conformal prediction method:

1. The calibration set is used to compute nonconformity scores for each sample.
2. A threshold (q-hat) is derived from these scores at the desired coverage level (alpha=0.10, targeting 90% coverage).
3. At inference, the prediction set contains all classes whose inclusion keeps the score below q-hat.

This produces prediction sets rather than point predictions. A set of size 1 indicates a confident prediction; a set of size 2 or 3 indicates uncertainty and flags the case for expert review.

In the evaluated model, approximately 80% of test predictions produce single-label confident outputs, and 20% produce two-label uncertain sets that are referred for clinical review.

### Evaluation Metrics

The model is evaluated on a held-out test set using:

- Per-class and macro-averaged: Precision, Recall, F1-score
- Per-class AUC-ROC
- Mean AUC
- Confusion matrix (raw counts)
- Conformal prediction set size distribution

### Deployment Artifacts

The full inference pipeline is exported as a deployable bundle:

| File | Contents |
|------|----------|
| `best_improved_model.pth` | Trained CNN + texture hybrid model weights |
| `pipeline.pkl` | Serialised `OsteoporosisPipeline` inference class |
| `conformal_calibrator.joblib` | Calibrated conformal predictor |
| `config.json` | Model configuration and class definitions |

The `OsteoporosisPipeline` class encapsulates preprocessing, texture extraction, CNN inference, CORAL ordinal decoding, conformal set prediction, and clinical risk recommendation into a single callable object.

---

## Results

| Metric | Value |
|--------|-------|
| Test Accuracy | 91.56% |
| Mean AUC | 0.981 |
| Normal AUC | 0.973 |
| Osteopenia AUC | 0.975 |
| Osteoporosis AUC | 0.995 |
| Osteoporosis Precision | 0.981 |
| Osteoporosis Recall | 0.958 |
| Macro F1-Score | 0.907 |
| Cross-severity error rate | less than 0.75% |

---

## Project Structure

```
Osteoporosis_final/
├── osteoporosis-final-notebook.ipynb   Main training and evaluation notebook
├── Direct_Models/
│   └── results_improved/               Final evaluation outputs
│       ├── evaluation_results.json     Accuracy, AUC, confusion matrix, classification report
│       ├── confusion_matrix.png        Normalised and count confusion matrix
│       ├── roc_curves.png              Per-class ROC curves
│       ├── training_history.png        Loss and accuracy curves
│       ├── gradcam_visualizations.png  Grad-CAM heatmaps per class
│       ├── gradcam_detailed_analysis.png  Per-class activation maps with probabilities
│       ├── conformal_prediction_analysis.png  Prediction set size distributions
│       ├── preprocessing_comparison.png  Pipeline stage visualisation
│       └── texture_features_comparison.png  LBP/GLCM distributions by class
├── comparative_analysis.md             Comparison with Bhat & Shanthi (IEEE Access, 2026)
├── comparative_analysis_paper2.md      Comparison with Singh et al. (IEEE RMKMATE, 2025)
├── research_paper.md                   Full IEEE-style research manuscript
└── README.md                           This file
```

---

## Dependencies

Core libraries used in the notebook:

- Python 3.8+
- PyTorch and torchvision
- scikit-learn
- scikit-image (for LBP)
- OpenCV (cv2)
- NumPy
- Matplotlib
- Pillow
- joblib

---

## Citation

If you use this work or the dataset, please cite:

**Dataset:**
[https://data.mendeley.com/datasets/7xgzy69fw2/1](https://data.mendeley.com/datasets/7xgzy69fw2/1)


