# RAQIB AI Service

## Overview

RAQIB AI Service is the intelligent core of the RAQIB platform. It is responsible for analyzing uploaded images, detecting urban issues using deep learning, estimating damage severity, and providing structured AI responses to the backend system.

The service exposes RESTful APIs through FastAPI, allowing seamless integration with the ASP.NET Core backend. Once a citizen uploads an image, the AI model processes it and returns the predicted issue type, confidence score, severity level, and damage assessment in real time.

---

## Features

- AI-powered urban issue classification
- Image preprocessing and normalization
- Deep Learning inference using TensorFlow
- Severity estimation
- Confidence score generation
- Damage percentage estimation
- REST API built with FastAPI
- Seamless integration with ASP.NET Core
- JSON-based response format
- Optimized for real-time predictions

---

## Supported Urban Issues

The AI model classifies images into the following categories:

- Damaged Road
- Normal Road
- Damaged Building
- Normal Building
- Large Trash
- Small Trash

---

## AI Workflow

1. Receive an image from the backend.
2. Preprocess the image.
3. Resize and normalize input.
4. Run inference using the trained MobileNetV2 model.
5. Predict the issue category.
6. Calculate confidence score.
7. Estimate damage severity.
8. Return the prediction as a JSON response.

---

## Model Architecture

The model is based on Transfer Learning using MobileNetV2.

Architecture:

- MobileNetV2 Backbone
- Global Average Pooling
- Batch Normalization
- Dense Layer
- Dropout
- Output Layer (Softmax)

The model was trained to recognize six different urban issue classes while maintaining fast inference suitable for deployment.

---

## Technologies

### AI & Machine Learning

- Python 3.12
- TensorFlow
- Keras
- MobileNetV2
- NumPy
- Pillow
- OpenCV

### API

- FastAPI
- Uvicorn
- Pydantic

---

## Project Structure

```text
RAQIB_AI/
│
├── app.py
├── predict.py
├── chatbot.py
├── requirements.txt
├── disaster_6class_model_final.keras
├── uploads/
└── utils/
```

---

## API Endpoints

### Health Check

```
GET /
```

Returns the service status.

---

### Predict

```
POST /predict
```

Receives an image and returns:

- Predicted Class
- Confidence Score
- Severity Level
- Severity Score
- Damage Percentage
- AI Response

---

## Installation

Clone the repository

```bash
git clone https://github.com/your-username/RAQIB_AI.git
```

Navigate to the project directory

```bash
cd RAQIB_AI
```

Create a virtual environment

```bash
python -m venv venv
```

Activate the environment

Windows

```bash
venv\Scripts\activate
```

Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Run the server

```bash
uvicorn app:app --reload
```

The API will be available at:

```
http://127.0.0.1:8000
```

---

## Integration

The AI service is consumed by the ASP.NET Core backend.

Workflow:

Citizen → Frontend → ASP.NET Core API → FastAPI AI Service → Prediction → ASP.NET Core → Database → Frontend

---

## Performance

- Real-time inference
- Lightweight deployment
- Optimized MobileNetV2 architecture
- Fast API response
- High prediction accuracy

---

## Future Improvements

- Object Detection
- Image Segmentation
- Multi-label Classification
- Automatic Damage Localization
- Continuous Model Retraining

---

## Developed By

- Zyad Atef
- Manal Mahmoud
- Nourhan Hamada
- Hager Zakaria
- Ahmed Mamdouh
- Abdallah Kamel

---

## License

This project was developed for educational purposes as part of a Graduation Project.
