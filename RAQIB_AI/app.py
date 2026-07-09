from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from predict import predict_image

import os
import shutil

app = FastAPI()

from chatbot import get_ai_reply
from pydantic import BaseModel
from typing import Optional, List, Dict

class ChatRequest(BaseModel):
    prediction_result: dict
    message: str
    history: Optional[List[Dict[str, str]]] = []

@app.post("/chat")
async def chat(req: ChatRequest):
    reply = get_ai_reply(req.prediction_result, req.message, req.history)
    return {"reply": reply}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.get("/")
def home():
    return {
        "message": "Urban Issue Detection API is running successfully!",
        "status": "OK"
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = predict_image(file_path)

    os.remove(file_path)

    return result