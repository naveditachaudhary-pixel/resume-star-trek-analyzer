# Enterprise Computer Core: Resume Analyzer

A Star Trek–themed resume analyzer. Upload a PDF resume and the "computer core of the U.S.S. Enterprise" does two things:

1. **Parses the resume into structured JSON:** name, contact details, summary, experience, education and skills.
2. **Matches the candidate to 3–6 fictional jobs aboard the Enterprise**, such as Chief Warp Core Harmonizer or Holodeck Safety Protocol Officer. Each match comes with a department, a compatibility rating and an explanation of how the person's real experience fits.

Under the fun theme, it's a real document-parsing pipeline: PDF text extraction, an LLM call that must return a fixed JSON structure, and a rule-based fallback for when no model is available.

## How it works

```
PDF upload ──► Express + multer ──► pdf-text-reader ──► resume text
                                                        │
                       credentials set? ──yes──► Gemini 2.5 Flash (JSON output) ──┐
                                        └──no──► local rule-based parser ─────────┤
                                                                                  ▼
                                                     resume JSON + Starfleet job matches
```

- **Gemini mode:** the text goes to Gemini 2.5 Flash through the Google Gen AI SDK, using either a Gemini API key or Vertex AI on Google Cloud. The model is asked for JSON only (`responseMimeType: application/json`) in a fixed shape. If the call fails, the app falls back to offline mode.
- **Offline mode:** a rule-based parser pulls out the name, email, phone, sections and skills with patterns, then picks jobs from a built-in list. The app works with no credentials at all, and the response is marked `"mode": "Local Basic Parser (Offline Fallback)"`.

## Run it

Requires Node.js 18 or later.

```bash
npm install
npm start            # http://localhost:3000, offline mode
```

To use Gemini, set one of these before `npm start`:

```bash
export GEMINI_API_KEY=your-key               # Gemini API
# or
export GCP_PROJECT=your-project-id           # Vertex AI (uses your gcloud credentials)
export GCP_LOCATION=us-central1              # optional, default us-central1
```

Click **Run System Simulation** in the app to try it with `sample_resume.pdf`, a fictional resume for Miles O'Brien. You can also call the API directly:

```bash
curl -F "resume=@sample_resume.pdf" http://localhost:3000/api/analyze
```

## Files

```
server.js                 Express API: upload, PDF parsing, Gemini call, offline fallback
public/                   the LCARS-style front end (HTML, CSS, JavaScript)
create_sample_resume.js   generates sample_resume.pdf with pdfkit
sample_resume.pdf         fictional test resume
```

## Notes

- Uploaded resumes are kept in memory only and are never written to disk.
- Star Trek and the U.S.S. Enterprise belong to Paramount. This is a non-commercial fan project.
