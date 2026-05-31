const form = document.getElementById('sensorForm');
const historyBody = document.getElementById('historyBody');
const apiState = document.getElementById('apiState');
const predictionValue = document.getElementById('predictionValue');
const predictionNote = document.getElementById('predictionNote');
const readingCount = document.getElementById('readingCount');
const requestStatus = document.getElementById('requestStatus');

// Realtime socket (updates when hardware posts to backend)
let socket;
try {
  socket = io();
  socket.on('connect', () => console.log('Realtime connected:', socket.id));
  socket.on('new-reading', (record) => {
    try {
      // Prepend new record to history table
      if (historyBody.querySelector('.empty')) historyBody.innerHTML = '';

      const prediction = record.prediction?.predicted_kw;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(record.timestamp).toLocaleString()}</td>
        <td>${record.features.Voltage.toFixed(2)}</td>
        <td>${record.features.Global_intensity.toFixed(2)}</td>
        <td>${record.features.Hour}</td>
        <td>${record.features.DayOfWeek}</td>
        <td>${record.features.RollingMean_3hr.toFixed(2)}</td>
        <td>${prediction === undefined || prediction === null ? 'Pending' : `${Number(prediction).toFixed(3)} kW`}</td>
      `;
      historyBody.prepend(tr);

      // Update counts and latest panel
      readingCount.textContent = String(Number(readingCount.textContent || '0') + 1);
      if (record.prediction) {
        const latest = formatPrediction(record);
        predictionValue.textContent = latest.value;
        predictionNote.textContent = latest.note;
        requestStatus.textContent = 'Predicted';
      } else {
        predictionNote.textContent = 'New reading received (prediction pending)';
        requestStatus.textContent = 'Stored only';
      }
    } catch (e) {
      console.error('Realtime update error', e);
      loadHistory();
    }
  });
} catch (e) {
  // socket.io script may not be available in some contexts
  console.warn('Realtime socket not available', e.message);
}

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