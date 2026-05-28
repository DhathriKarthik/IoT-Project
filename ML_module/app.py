from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

# Create FastAPI app
app = FastAPI(
    title="Smart Energy Forecast API",
    description="IoT + ML Energy Consumption Prediction System",
    version="1.0"
)

# Load trained model
model = joblib.load("models/energy_model.pkl")


# Input schema
class EnergyInput(BaseModel):

    Voltage: float
    Global_intensity: float
    Hour: int
    DayOfWeek: int
    RollingMean_3hr: float


# Home route
@app.get("/")
def home():

    return {
        "message": "Smart Energy Forecast API Running"
    }


# Prediction route
@app.post("/predict")
def predict(data: EnergyInput):

    # Convert input into model format
    features = np.array([[
        data.Voltage,
        data.Global_intensity,
        data.Hour,
        data.DayOfWeek,
        data.RollingMean_3hr,
    ]])

    # Predict
    prediction = model.predict(features)

    # Return response
    return {
        "predicted_kw": round(float(prediction[0]), 3)
    }