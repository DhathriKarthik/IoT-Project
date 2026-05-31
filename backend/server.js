const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const backendRoot = __dirname;
const frontendRoot = path.join(backendRoot, '..', 'frontend');
const dataDir = path.join(backendRoot, 'data');
const dataFile = path.join(dataDir, 'readings.json');

app.use(cors());
app.use(express.json());
app.use(express.static(frontendRoot));

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '[]\n', 'utf8');
  }
}

async function readReadings() {
  ensureStorage();

  const raw = await fsp.readFile(dataFile, 'utf8');
  if (!raw.trim()) {
    return [];
  }

  return JSON.parse(raw);
}

async function writeReadings(readings) {
  ensureStorage();
  await fsp.writeFile(dataFile, `${JSON.stringify(readings, null, 2)}\n`, 'utf8');
}

function parseNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return parsed;
}

function parseInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return parsed;
}

function buildFeaturePayload(body) {
  return {
    Voltage: parseNumber(body.Voltage, 'Voltage'),
    Global_intensity: parseNumber(body.Global_intensity, 'Global_intensity'),
    Hour: parseInteger(body.Hour, 'Hour'),
    DayOfWeek: parseInteger(body.DayOfWeek, 'DayOfWeek'),
    RollingMean_3hr: parseNumber(body.RollingMean_3hr, 'RollingMean_3hr')
  };
}

async function predictWithModel(features) {
  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(features)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML service returned ${response.status}: ${errorText}`);
  }

  return response.json();
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    mlServiceUrl: ML_SERVICE_URL
  });
});

app.get('/api/readings', async (_request, response) => {
  const readings = await readReadings();
  response.json(readings.slice().reverse());
});

app.post('/api/readings', async (request, response) => {
  try {
    const features = buildFeaturePayload(request.body);
    const allReadings = await readReadings();

    const record = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      features,
      prediction: null
    };

    allReadings.push(record);
    await writeReadings(allReadings);

    try {
      const prediction = await predictWithModel(features);
      record.prediction = prediction;
      allReadings[allReadings.length - 1] = record;
      await writeReadings(allReadings);

      response.status(201).json(record);
    } catch (predictionError) {
      record.predictionError = predictionError.message;
      allReadings[allReadings.length - 1] = record;
      await writeReadings(allReadings);

      response.status(502).json({
        message: 'Sensor data stored, but the ML model could not be reached.',
        reading: record,
        error: predictionError.message
      });
    }
  } catch (error) {
    response.status(400).json({
      message: error.message
    });
  }
});

app.get('/', (_request, response) => {
  response.sendFile(path.join(frontendRoot, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Proxying predictions to ${ML_SERVICE_URL}`);
});