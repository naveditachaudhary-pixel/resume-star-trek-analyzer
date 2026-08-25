import express from 'express';
import multer from 'multer';
import { readPdfText } from 'pdf-text-reader';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize Google Gen AI SDK
const project = 'poetic-harmony-436119-q7';
const location = 'us-central1';
const ai = new GoogleGenAI({
  vertexai: true,
  project,
  location
});

app.post('/api/analyze', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload error.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    let resumeText = '';

    if (req.body && (req.body.demo === 'true' || req.body.demo === true)) {
      // Load sample resume PDF
      const fs = await import('fs/promises');
      let pdfBuffer;
      try {
        pdfBuffer = await fs.readFile(path.join(__dirname, 'sample_resume.pdf'));
      } catch (readErr) {
        console.error('Demo file read error:', readErr);
        return res.status(404).json({ error: 'Simulated telemetry file not found. Run create_sample_resume.js first.' });
      }

      try {
        resumeText = await readPdfText({ data: new Uint8Array(pdfBuffer) });
      } catch (parseError) {
        console.error('PDF Parse Error:', parseError);
        return res.status(400).json({ error: 'Failed to parse the simulated PDF.' });
      }
    } else {
      console.log('Received file upload:', req.file ? req.file.originalname : 'none', 'size:', req.file ? req.file.size : 0);
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please select a resume PDF.' });
      }

      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Invalid file format. Please upload a PDF resume.' });
      }

      // Extract text from the PDF buffer
      try {
        resumeText = await readPdfText({ data: new Uint8Array(req.file.buffer) });
      } catch (parseError) {
        console.error('PDF Parse Error:', parseError);
        return res.status(400).json({ error: 'Failed to parse the PDF. The file may be corrupt or security locked.' });
      }
    }

    console.log('Parsed resume text length:', resumeText.length, 'sample:', resumeText.substring(0, 100).replace(/\n/g, ' '));

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: 'The PDF resume appears to be empty or contains no extractable text.' });
    }

    // Call Gemini via Vertex AI using @google/genai SDK

    const prompt = `
You are the main computer core of the U.S.S. Enterprise (NCC-1701-D).
Analyze the following resume text and generate a structured JSON response.

Your analysis must do two things:
1. Parse the resume into a clean, professional JSON structure representing the candidate's real-world profile.
2. Fictional Star Trek Jobs: Determine between 3 and 6 fun, fictional, and creative jobs aboard the U.S.S. Enterprise that would match this candidate's real skills. The jobs must be highly immersive, humorous, and specific to the Star Trek universe (e.g. Chief Warp Core Harmonizer, Holodeck Safety Protocol Override Officer, Tribble Population Control Officer, Subspace Frequency Filterer, Quantum Chess Coach, Repli-mat Gastronomy Programmer). Explain how their real skills make them a perfect fit.

Output must be exactly in this JSON format:
{
  "resume_json": {
    "name": "Candidate Name",
    "contact": {
      "email": "...",
      "phone": "...",
      "location": "..."
    },
    "summary": "Professional summary...",
    "experience": [
      {
        "role": "Role Title",
        "company": "Company Name",
        "duration": "Duration",
        "description": "Short description of duties"
      }
    ],
    "education": [
      {
        "degree": "Degree",
        "school": "School Name",
        "year": "Year"
      }
    ],
    "skills": ["Skill 1", "Skill 2"]
  },
  "star_trek_jobs": [
    {
      "title": "Fictional Enterprise Job Title",
      "department": "Engineering / Operations / Sciences / Command / Medical / Tactical",
      "why_matched": "Humorous and detailed explanation connecting their real experience to this Star Trek role.",
      "compatibility_rating": "95%"
    }
  ]
}

Resume Text:
${resumeText}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from model.');
    }

    const result = JSON.parse(responseText);
    res.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Internal server error during analysis. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
