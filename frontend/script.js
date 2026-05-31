const form = document.getElementById('sensorForm');
const historyBody = document.getElementById('historyBody');
const apiState = document.getElementById('apiState');
const predictionValue = document.getElementById('predictionValue');
const predictionNote = document.getElementById('predictionNote');
const readingCount = document.getElementById('readingCount');
const requestStatus = document.getElementById('requestStatus');

function formatPrediction(record) {
  if (!record || !record.prediction) {
    return { value: '—', note: 'No prediction returned yet.' };
  }

  const rawValue = record.prediction.predicted_kw;
  return {
    value: `${Number(rawValue).toFixed(3)} kW`,
    note: `Prediction generated from the five model inputs for ${new Date(record.timestamp).toLocaleString()}.`
  };
}

function renderHistory(readings) {
  readingCount.textContent = String(readings.length);

  if (!readings.length) {
    historyBody.innerHTML = '<tr><td colspan="7" class="empty">No sensor readings stored yet.</td></tr>';
    return;
  }

  historyBody.innerHTML = readings.map((reading) => {
    const prediction = reading.prediction?.predicted_kw;
    return `
      <tr>
        <td>${new Date(reading.timestamp).toLocaleString()}</td>
        <td>${reading.features.Voltage.toFixed(2)}</td>
        <td>${reading.features.Global_intensity.toFixed(2)}</td>
        <td>${reading.features.Hour}</td>
        <td>${reading.features.DayOfWeek}</td>
        <td>${reading.features.RollingMean_3hr.toFixed(2)}</td>
        <td>${prediction === undefined || prediction === null ? 'Pending' : `${Number(prediction).toFixed(3)} kW`}</td>
      </tr>
    `;
  }).join('');
}

async function loadHistory() {
  try {
    const response = await fetch('/api/readings');
    const readings = await response.json();
    renderHistory(readings);
    apiState.textContent = 'Connected';
    apiState.style.background = 'var(--accent)';
    apiState.style.color = '#02221f';

    if (readings[0]) {
      const latest = formatPrediction(readings[0]);
      predictionValue.textContent = latest.value;
      predictionNote.textContent = latest.note;
      requestStatus.textContent = readings[0].prediction ? 'Predicted' : 'Stored only';
    }
  } catch (error) {
    apiState.textContent = 'Offline';
    apiState.classList.add('warning');
    predictionNote.textContent = error.message;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  requestStatus.textContent = 'Saving...';
  predictionNote.textContent = 'Sending reading to the backend.';

  try {
    const response = await fetch('/api/readings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || 'Prediction request failed');
    }

    const latest = formatPrediction(result);
    predictionValue.textContent = latest.value;
    predictionNote.textContent = latest.note;
    requestStatus.textContent = 'Predicted';

    const currentHistory = await fetch('/api/readings');
    renderHistory(await currentHistory.json());
    form.reset();
  } catch (error) {
    requestStatus.textContent = 'Error';
    predictionNote.textContent = error.message;
    predictionValue.textContent = 'Prediction unavailable';
  }
});

loadHistory();