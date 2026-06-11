# Visio — AI Visual Scanner (Free)

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> A **Progressive Web App** that turns your camera into an AI-powered visual scanner — powered by Google Gemini 2.0 Flash. Point at anything and get instant AI analysis, spoken aloud in your language. **100% free, no backend, no subscription.**

🌐 **[Live Demo →](https://rishichamp.github.io/visio-ai-scanner)**

---

## Features

- **6 Scanning Modes** — each with a tailored Gemini prompt:
  - 🔍 **Scan** — identify any object and explain what it does
  - 📖 **Read Text** — OCR any visible text, signs, or documents
  - 🥗 **Nutrition** — estimate calories and nutrients from food
  - 📦 **Barcode** — identify products from packaging and labels
  - ⚠️ **Danger** — detect hazards, warning labels, unsafe situations
  - 🎯 **Quiz Me** — generates an interactive multiple-choice quiz about the scanned object
- **Voice in, voice out** — ask questions by speaking; answers read aloud via Web Speech API
- **Auto-scan mode** — continuous scanning on an interval, hands-free
- **Offline fallback** — MobileNet (TensorFlow.js) for basic classification when offline
- **Multi-language** — responds in whichever language you choose
- **Scan history** — recent scans saved locally via localStorage
- **Installable PWA** — works on Android and iOS as a home screen app
- **No backend** — runs entirely in the browser; your API key stays on your device

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML5, CSS3, JavaScript (ES2022) |
| AI Vision | Google Gemini 2.0 Flash (`gemini-2.0-flash`) |
| Offline AI | TensorFlow.js + MobileNet v2 |
| QR / Barcode | jsQR |
| Speech | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Camera | MediaDevices API (`getUserMedia`) |
| PWA | Service Worker + Web App Manifest |
| Hosting | GitHub Pages |

---

## Getting Started

### Option 1 — Use the live app
Visit **[rishichamp.github.io/visio-ai-scanner](https://rishichamp.github.io/visio-ai-scanner)** — no install needed.

### Option 2 — Run locally

**1. Clone the repo**
```bash
git clone https://github.com/Rishichamp/visio-ai-scanner.git
cd visio-ai-scanner
```

**2. Start a local server**
```bash
npm install -g live-server
live-server
```
Your browser opens automatically at `http://127.0.0.1:8080`.

> A local server is required because the camera API (`getUserMedia`) only works on `localhost` or HTTPS — opening `index.html` directly as a file won't work.

**3. Get a free Gemini API key**

- Go to [aistudio.google.com](https://aistudio.google.com)
- Click **Get API Key** → **Create API Key**
- Free tier gives **1,500 requests/day** — no credit card needed

**4. Enter your key in the app**

Click the 🔒 icon (top-right) → Settings → paste your `AIza...` key → Save.

---

## Project Structure

```
visio-ai-scanner/
│
├── index.html          ← App shell, onboarding screen, main UI
├── app.js              ← All logic: Gemini calls, camera, modes, voice, quiz
├── styles.css          ← Full UI styling, dark theme, animations
├── manifest.json       ← PWA manifest (name, icons, theme colour)
├── sw.js               ← Service worker for offline caching
├── icon-192.png        ← PWA icon
└── icon-512.png        ← PWA icon (large)
```

---

## How It Works

```
User points camera
        ↓
Tap scan button  (or auto-scan interval fires)
        ↓
captureFrame() → canvas → JPEG base64
        ↓
callGemini(imageB64, modePrompt)
        ↓
POST → Gemini 2.0 Flash API (vision + text)
        ↓
Response text → displayed + spoken aloud (TTS)
        ↓
Saved to scan history (localStorage)
```

For the **Quiz Me** mode, Gemini returns structured JSON (`object`, `question`, `options[]`, `correct`, `explanation`) which the app parses and renders as an interactive multiple-choice widget.

For **offline mode**, TensorFlow.js loads MobileNet v2 locally and classifies the captured frame without any API call.

---

## Privacy

- Your API key is stored in `sessionStorage` only — cleared when you close the tab
- No images or scan results are ever sent to any server other than Google's Gemini API
- No analytics, no tracking, no accounts

---

## Future Improvements

- **Saved gallery** — persist scan history with thumbnails across sessions
- **Share button** — share scan results as an image card
- **Custom prompts** — let users define their own scanning modes
- **On-device AI** — replace Gemini with a fully local model (WebLLM / Llama.cpp WASM) for full offline support
- **AR overlay** — draw bounding boxes on detected objects using Canvas API

---

## License

MIT License — free to use, modify, and distribute.

---

*Built with Google Gemini 2.0 Flash · TensorFlow.js · Web Speech API · PWA*
