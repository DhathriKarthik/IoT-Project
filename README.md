# IoT-Project

This repo now has two parts:

- `ML_module/` keeps the Python FastAPI model service.
- `backend/` is the Node.js API that stores sensor readings and forwards the model features to the ML service.
- `frontend/` is the HTML/CSS/JS dashboard that posts sensor data and shows the latest prediction.

## Run It Locally

1. Start the ML service from `ML_module/`:

	```bash
	uvicorn app:app --reload --port 8000
	```

2. Install and start the Node backend from `backend/`:

	```bash
	npm install
	npm start
	```

3. Open `http://localhost:3000` in the browser.

## Data Flow

The frontend collects the five model inputs: `Voltage`, `Global_intensity`, `Hour`, `DayOfWeek`, and `RollingMean_3hr`.

The Node backend saves each reading in `backend/data/readings.json` and then calls the Python model at `/predict` to get `predicted_kw`.