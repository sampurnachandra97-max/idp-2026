# Soil Intelligence Documentation

Set up Soil Intelligence, train it on your own soil data, and connect it to your applications.

## Contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Train on your own data](#train-on-your-own-data)
- [Adjust the thresholds](#adjust-the-thresholds)
- [API reference](#api-reference)
- [Integrate with your app](#integrate-with-your-app)
- [Testing](#testing)
- [Deployment](#deployment)
- [Limitations](#limitations)

## Overview

Soil Intelligence takes five readings from a routine soil test, plus local climate, and returns estimates for seven further soil properties, stress findings, prioritised actions and ranked crops.

It has two parts:

- A **Python API** that trains and serves the models.
- A **Next.js web app** that provides the landing page and dashboard.

## Quick start

You need Python 3.11 or newer and Node.js 22 or newer.

### 1. Get the code

```bash
git clone https://github.com/sampurnachandra97-max/idp-2026.git
cd idp-2026
```

### 2. Install the backend and train the models

Training only needs to be repeated when the data changes.

**Windows PowerShell**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m ml.train
```

**macOS or Linux**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m ml.train
```

### 3. Start the API

```bash
uvicorn app.main:app --port 8000
```

### 4. Start the web app

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with any email and a password of at least 8 characters. A new email creates an account automatically.

## Configuration

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `BACKEND_URL` | Web app | `http://127.0.0.1:8000` | Address of the API |
| `SOIL_DB_PATH` | API | `backend/data/app.db` | Location of the accounts database |
| `COOKIE_SECURE` | API | Off | Set to `true` when serving over HTTPS |

## How it works

1. **Prepare.** Repeat readings of one field are grouped, so a field is never on both sides of a split.
2. **Compare.** Ridge regression, Random Forest and XGBoost compete for each property using 5-fold group cross-validation.
3. **Test.** The best model is scored on 20% of fields held out from training.
4. **Quantify.** A 90% range is built from errors on unseen fields.
5. **Serve.** The API estimates properties, reads them against agronomic bands and ranks crops.

| Path | Contains |
| --- | --- |
| `backend/ml/train.py` | Data preparation, model comparison and evaluation |
| `backend/app/engine.py` | Turns a sample into estimates, findings and crops |
| `backend/app/rules.py` | Agronomic thresholds and recommended actions |
| `backend/app/auth.py` | Accounts and sessions |
| `frontend/app` | Landing page, sign-in and dashboard routes |

## Train on your own data

The bundled soil data comes from one district, so retrain with local lab results for other regions.

1. Replace `backend/data/raw/agrinet_soil_tests.csv`, keeping the column names below.
2. Keep repeat readings of a field next to each other, so that they are grouped correctly.
3. Run `python -m ml.train` from `backend/`.
4. Restart the API and check the new scores under **Model performance** in the dashboard.

| File | Required columns |
| --- | --- |
| `agrinet_soil_tests.csv` | `pH, EC, OC, N, P, K, S, Zn, B, Fe, Mn, Cu` |
| `crop_recommendation.csv` | `temperature, humidity, ph, rainfall, label` |

> [!IMPORTANT]
> Use the same units as the bundled data: N, P and K in kg/ha, EC in dS/m, organic carbon in %, and sulphur and micronutrients in mg/kg.

## Adjust the thresholds

Status labels and recommended actions come from `backend/app/rules.py`. Edit an indicator to match local guidance, then restart the API. No retraining is needed.

```python
Indicator(
    "P", "Available phosphorus", "kg/ha", (0, 40), _fertility(10, 25),
    "Band phosphorus near the root zone at sowing rather than broadcasting it.",
),
```

## API reference

Interactive documentation is available at <http://127.0.0.1:8000/docs> while the API is running.

| Method | Path | Purpose | Sign-in |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Service status | No |
| `POST` | `/api/auth/signup` | Create an account | No |
| `POST` | `/api/auth/login` | Sign in, or start an account for a new email | No |
| `POST` | `/api/auth/logout` | End the session | No |
| `GET` | `/api/auth/me` | The signed-in user | Yes |
| `GET` | `/api/model-card` | Evaluation results | Yes |
| `POST` | `/api/analyze` | Analyse one soil sample | Yes |

### Sample fields

| Field | Meaning | Unit | Accepted range |
| --- | --- | --- | --- |
| `pH` | Soil reaction | | 0 to 14 |
| `EC` | Electrical conductivity | dS/m | 0 to 20 |
| `N` | Available nitrogen | kg/ha | 0 to 1500 |
| `P` | Available phosphorus | kg/ha | 0 to 500 |
| `K` | Available potassium | kg/ha | 0 to 2000 |
| `temperature` | Mean air temperature | °C | -10 to 60 |
| `humidity` | Mean relative humidity | % | 0 to 100 |
| `rainfall` | Seasonal rainfall | mm | 0 to 5000 |

### Example response

Lists are shortened here for clarity.

```json
{
  "summary": { "in_range": 8, "needs_action": 4, "watch": 0, "total": 12 },
  "measured": [
    { "key": "pH", "name": "Soil pH", "value": 6.78, "status": "Neutral", "level": "ok" }
  ],
  "estimated": [
    {
      "key": "OC",
      "name": "Organic carbon",
      "unit": "%",
      "value": 0.37,
      "low": 0.34,
      "high": 0.4,
      "borderline": false,
      "reliability": "high"
    }
  ],
  "crops": [{ "crop": "jute", "fit": 0.58 }],
  "actions": [
    {
      "key": "N",
      "level": "act",
      "source": "measured",
      "confirm_first": false,
      "action": "Split nitrogen across growth stages and add a legume or compost to the rotation."
    }
  ],
  "warnings": []
}
```

### Status codes

| Code | Meaning |
| --- | --- |
| `400` | A new account was requested with a password under 8 characters |
| `401` | Not signed in, or the password is incorrect |
| `409` | An account with this email already exists |
| `422` | A value is missing or outside its accepted range |
| `429` | Too many failed sign-ins; try again in 15 minutes |

## Integrate with your app

Sign in once to receive a session cookie, then send that cookie with each request.

### cURL

```bash
curl -c cookies.txt -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@example.com","password":"a-long-password"}'

curl -b cookies.txt -X POST http://127.0.0.1:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"pH":6.78,"EC":0.25,"N":179,"P":7.93,"K":256,"temperature":27,"humidity":72,"rainfall":180}'
```

### Python

This example also needs `pip install requests`.

```python
import requests

api = requests.Session()
api.post(
    "http://127.0.0.1:8000/api/auth/login",
    json={"email": "asha@example.com", "password": "a-long-password"},
).raise_for_status()

sample = {
    "pH": 6.78, "EC": 0.25, "N": 179, "P": 7.93, "K": 256,
    "temperature": 27, "humidity": 72, "rainfall": 180,
}
result = api.post("http://127.0.0.1:8000/api/analyze", json=sample).json()

print(result["summary"], result["crops"][0])
```

### JavaScript

This runs on the same origin as the web app, so the session cookie is sent automatically.

```js
const response = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pH: 6.78, EC: 0.25, N: 179, P: 7.93, K: 256,
    temperature: 27, humidity: 72, rainfall: 180,
  }),
});

if (response.status === 401) window.location.assign("/login");
const analysis = await response.json();
```

## Testing

```bash
# Backend
cd backend
python -m pytest

# Frontend
cd frontend
npm test
npm run typecheck
```

## Deployment

1. Train the models on the server, or copy `backend/artifacts/` to it.
2. Set `COOKIE_SECURE=true` and serve the site over HTTPS.
3. Point `SOIL_DB_PATH` at storage that survives restarts.
4. Set `BACKEND_URL` for both the build and start commands below.

```bash
# API, from backend/
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Web app, from frontend/
npm run build
npm start
```

> [!WARNING]
> Email addresses are not verified, and a new email creates an account at sign-in. Add email verification before opening the site to the public.

## Limitations

- The bundled soil models come from one district: Bareilly, India.
- Soil moisture is not modelled, because neither dataset measures it.
- Crop ranking uses climate and pH only, and was tested on a clean public benchmark.
- Results support decisions, and do not replace a lab report before spending on inputs.
