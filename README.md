# Language Practice Room

A two-person English practice room: direct browser-to-browser video/audio through WebRTC, a Flask signaling and coaching API, WAV speech transcription with Python `SpeechRecognition`, and Gemini grammar feedback. Your Gemini key never reaches the browser.

## Run locally

1. Create and activate a virtual environment, then run `pip install -r requirements.txt`.
2. Copy `.env.example` to `.env` and add your Gemini API key.
3. Run `python app.py`, then visit `http://localhost:5000`.
4. Two users enter the same room code and choose **Join room**. Share a topic, speak, then use **Record practice speech** and **Stop & analyze**.

## Deploy to Vercel

Import the repository (or run `vercel` in the project), then set `GEMINI_API_KEY` and optionally `GEMINI_MODEL=gemini-3.6-flash` in **Project Settings → Environment Variables**. Redeploy after saving the variable. Do not upload `.env`.

`vercel.json` runs the Flask app as a Python function. Room signaling uses Firebase Realtime Database when `FIREBASE_DATABASE_URL` and `FIREBASE_SERVICE_ACCOUNT_JSON` are configured; otherwise it falls back to in-memory storage for local development. WebRTC itself is peer-to-peer; add TURN credentials for users behind restrictive networks.

For Vercel, add these environment variables:
- `FIREBASE_DATABASE_URL`: the Realtime Database URL from Firebase.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete service-account JSON on one line. Create it in **Firebase Console -> Project settings -> Service accounts -> Generate new private key**. Keep this value private.

Set Realtime Database rules to deny direct unauthenticated client access because Flask uses the Admin SDK:
```json
{
	"rules": {
		".read": false,
		".write": false
	}
}
```

## Speech recognition

The browser captures microphone audio and sends WAV audio to Python `SpeechRecognition` for transcription:
- Browser recording and WAV audio transcription via `/api/transcribe`.

## API overview

- `POST /api/transcribe` accepts a WAV upload in `audio` and returns its transcript via Python `SpeechRecognition`.
- `POST /api/grammar` accepts `{"transcript":"..."}` and returns correction JSON generated server-side.
- `/api/rooms/*` relays offer, answer, and ICE-candidate messages for exactly two room participants.
