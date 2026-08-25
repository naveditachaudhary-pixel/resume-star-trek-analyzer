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

// Initialize Google Gen AI SDK safely
const project = process.env.GCP_PROJECT;
const location = process.env.GCP_LOCATION || 'us-central1';
const apiKey = process.env.GEMINI_API_KEY;

let ai = null;
try {
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    console.log('Initialized Google Gen AI SDK with API Key');
  } else if (project) {
    ai = new GoogleGenAI({
      vertexai: true,
      project,
      location
    });
    console.log(`Initialized Vertex AI SDK with project: ${project}, location: ${location}`);
  } else {
    console.log('No Google Gen AI credentials provided in environment variables. Defaulting to Local Telemetry Mode (Offline Fallback).');
  }
} catch (initError) {
  console.warn('Google Gen AI SDK initialization failed. Will default to local diagnostics core:', initError.message);
}

// Local Diagnostics Core: Rule-based fallback parser
function generateLocalMock(resumeText) {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Extract Name (first non-empty line)
  let name = "Unknown Candidate";
  if (lines.length > 0) {
    const candidateName = lines[0];
    if (candidateName.length < 50 && !candidateName.includes(':') && !candidateName.includes('@')) {
      name = candidateName;
    }
  }
  
  // Extract Email
  let email = null;
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0];
  }
  
  // Extract Phone
  let phone = null;
  const phoneMatch = resumeText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    phone = phoneMatch[0];
  }
  
  // Extract Location (search for common state patterns or city, state)
  let locationVal = null;
  const locationMatch = resumeText.match(/[a-zA-Z\s]{2,20},\s[A-Z]{2}/);
  if (locationMatch) {
    locationVal = locationMatch[0];
  }

  // Parse Sections
  let summary = "";
  const experience = [];
  const education = [];
  const skills = [];

  // Segment sections
  let currentSection = "header";
  let sectionText = {
    summary: [],
    experience: [],
    education: [],
    skills: []
  };

  lines.forEach(line => {
    const cleanLine = line.trim().toLowerCase();
    
    // Strict section header matching
    if (/^(summary|objective|profile|professional summary|about me)$/i.test(cleanLine)) {
      currentSection = "summary";
    } else if (/^(experience|employment|work history|professional history|professional experience|experience history)$/i.test(cleanLine)) {
      currentSection = "experience";
    } else if (/^(education|academic history|academic credentials|education history|credentials)$/i.test(cleanLine)) {
      currentSection = "education";
    } else if (/^(skills|technologies|competencies|technical skills|skills & expertise)$/i.test(cleanLine)) {
      currentSection = "skills";
    } else {
      if (currentSection !== "header") {
        sectionText[currentSection].push(line);
      }
    }
  });

  // 1. Process Summary
  if (sectionText.summary.length > 0) {
    summary = sectionText.summary.slice(0, 3).join(' ');
  } else {
    summary = "Career telemetry scanned and registered locally.";
  }

  // 2. Process Skills (Faithfully join wrapped lines first, then split on commas)
  if (sectionText.skills.length > 0) {
    const fullSkillsText = sectionText.skills.join(' ');
    // Split by commas or bullet marks (•, ·, |)
    const parts = fullSkillsText.split(/[•·|,\t]/).map(p => p.trim()).filter(p => p.length > 1);
    parts.forEach(part => {
      const cleanPart = part.replace(/\.$/, '').trim();
      if (cleanPart.length < 50 && cleanPart.length > 0) {
        skills.push(cleanPart);
      }
    });
  }
  // Fallback: search for keywords if skills block was empty or not parsed well
  if (skills.length === 0) {
    const commonSkills = [
      'javascript', 'python', 'java', 'react', 'node', 'sql', 'docker', 'aws', 'gcp', 'kubernetes',
      'management', 'leadership', 'communication', 'sales', 'marketing', 'design', 'research',
      'c++', 'c#', 'git', 'excel'
    ];
    commonSkills.forEach(s => {
      if (resumeText.toLowerCase().includes(s)) {
        skills.push(s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    });
  }

  // 3. Process Experience (faithful extraction)
  if (sectionText.experience.length > 0) {
    let currentJob = null;
    
    sectionText.experience.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.length === 0) return;
      
      const dateMatch = cleanLine.match(/(\d{4}\s*-\s*\d{4})|(\d{4}\s*-\s*Present)/i);
      
      // Strict header checks:
      // A line is a header if it contains a date range OR if it is a short line containing a strong divider ( - , | , – , — ) and does NOT look like a bullet description
      const hasStrongDivider = cleanLine.includes(' - ') || cleanLine.includes(' | ') || cleanLine.includes(' – ') || cleanLine.includes(' — ');
      const isHeader = dateMatch || (hasStrongDivider && cleanLine.length < 80 && !cleanLine.startsWith('•') && !cleanLine.startsWith('-') && !cleanLine.startsWith('*'));
      
      if (isHeader) {
        if (currentJob) {
          experience.push(currentJob);
        }
        
        let role = cleanLine;
        let company = "Not specified";
        let duration = "Telemetry record";
        
        if (dateMatch) {
          duration = dateMatch[0];
          role = cleanLine.replace(dateMatch[0], '').replace(/[()]/g, '').trim();
        }
        
        // Split role and company using strong dividers
        let divider = ' - ';
        if (role.includes(' | ')) divider = ' | ';
        else if (role.includes(' – ')) divider = ' – ';
        else if (role.includes(' — ')) divider = ' — ';
        
        const parts = role.split(divider);
        if (parts.length > 1) {
          role = parts[0].trim();
          company = parts.slice(1).join(divider).trim();
        }
        
        currentJob = {
          role: role,
          company: company,
          duration: duration,
          description: ""
        };
      } else {
        if (currentJob) {
          if (currentJob.description) {
            currentJob.description += " " + cleanLine;
          } else {
            currentJob.description = cleanLine;
          }
        } else {
          currentJob = {
            role: "Experience Entry",
            company: "Starfleet Registry",
            duration: "Telemetry record",
            description: cleanLine
          };
        }
      }
    });
    
    if (currentJob) {
      experience.push(currentJob);
    }
  }

  // 4. Process Education (faithful extraction)
  if (sectionText.education.length > 0) {
    let currentEdu = null;
    sectionText.education.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.length === 0) return;
      
      const dateMatch = cleanLine.match(/(\d{4}\s*-\s*\d{4})/);
      
      if (dateMatch || cleanLine.length < 100) {
        if (currentEdu) {
          education.push(currentEdu);
        }
        
        let degree = cleanLine;
        let year = "Academic telemetry";
        
        if (dateMatch) {
          year = dateMatch[0];
          degree = cleanLine.replace(dateMatch[0], '').replace(/[()]/g, '').trim();
        }
        
        currentEdu = {
          degree: degree,
          school: "Not specified",
          year: year
        };
      } else {
        if (currentEdu) {
          currentEdu.school = cleanLine;
        }
      }
    });
    if (currentEdu) {
      education.push(currentEdu);
    }
  }

  // Detect domain for Star Trek matching
  const textLower = resumeText.toLowerCase();
  let domain = "operations";
  if (textLower.includes('security') || textLower.includes('defense') || textLower.includes('military') || textLower.includes('police') || textLower.includes('cyber')) {
    domain = "tactical";
  } else if (textLower.includes('science') || textLower.includes('research') || textLower.includes('doctor') || textLower.includes('medical') || textLower.includes('physics') || textLower.includes('biology')) {
    domain = "sciences";
  } else if (textLower.includes('code') || textLower.includes('software') || textLower.includes('developer') || textLower.includes('engineer') || textLower.includes('programming')) {
    domain = "engineering";
  } else if (textLower.includes('manage') || textLower.includes('lead') || textLower.includes('director') || textLower.includes('executive') || textLower.includes('president')) {
    domain = "command";
  }

  // Fictional Job recommendations bank based on domain
  let jobs = [];
  const topSkillsStr = skills.slice(0, 3).join(', ') || "Systems Management";
  if (domain === "engineering") {
    jobs = [
      {
        title: "Chief Replicator Culinary Subroutine Programmer",
        department: "Engineering",
        why_matched: `Based on your technical background and software experience (${topSkillsStr}), the ship needs you to program the food replicators. Specifically, we require someone to debug the Earl Grey tea formulation and ensure the chocolate sundaes match Counselor Troi's exact specifications.`,
        compatibility_rating: "96%"
      },
      {
        title: "Holodeck Safety Protocol Override Technician",
        department: "Operations",
        why_matched: "Your systems development expertise makes you uniquely qualified to bypass safety limits when anomalies inevitably trap the senior staff. Must be comfortable troubleshooting holodeck characters who have achieved self-awareness.",
        compatibility_rating: "89%"
      },
      {
        title: "Subspace Bandwidth Relay Tuner",
        department: "Engineering",
        why_matched: "You will optimize data transmission through warp fields, ensuring real-time subspace communications stay clear when communicating with Starfleet Command. Prevents static lags during critical combat calls.",
        compatibility_rating: "85%"
      }
    ];
  } else if (domain === "sciences") {
    jobs = [
      {
        title: "Astrophysical Anomaly Data Cartographer",
        department: "Sciences",
        why_matched: `With your analytical skills (${topSkillsStr}), you will parse telemetry from stellar nurseries, black holes, and spatial rifts. Your maps will ensure the Enterprise doesn't get pulled into a temporal loop.`,
        compatibility_rating: "94%"
      },
      {
        title: "Tribble Population Growth Modeling Analyst",
        department: "Sciences",
        why_matched: "Uses advanced statistical modeling to predict tribble reproduction rates relative to local food supply. Crucial for prevention of ship-wide ventilation blockage.",
        compatibility_rating: "91%"
      },
      {
        title: "Quantum Chess Coach",
        department: "Sciences",
        why_matched: "Teaches three-dimensional quantum chess algorithms to officers. Your background in complex research and systems theory will help beat Commander Data's neural net.",
        compatibility_rating: "78%"
      }
    ];
  } else if (domain === "tactical") {
    jobs = [
      {
        title: "Deflector Shield Frequency Modulator",
        department: "Tactical",
        why_matched: `Your experience in defense and systems security matches the requirements for modulating our shield frequencies. When facing Borg tractor beams or Romulan plasma torpedos, you will keep the Enterprise shields running.`,
        compatibility_rating: "95%"
      },
      {
        title: "Intruder Alert Klaxon Decibel Calibrator",
        department: "Tactical",
        why_matched: "Ensures the Red Alert sirens are perfectly pitched to induce optimal urgency without causing ear damage. Requires constant volume adjustments depending on current ship alert level.",
        compatibility_rating: "87%"
      },
      {
        title: "Phaser Range Target Simulator Instructor",
        department: "Tactical",
        why_matched: "Leverages your tactical training to configure holo-target courses. Helps ensigns improve their accuracy against simulated Cardassian and Jem'Hadar target models.",
        compatibility_rating: "83%"
      }
    ];
  } else if (domain === "command") {
    jobs = [
      {
        title: "Diplomatic Protocol Subspace Liaison",
        department: "Command",
        why_matched: `Your leadership and management credentials (${topSkillsStr}) are ideal for coordinating communications during delicate peace treaties. You will brief Captain Picard on cultural customs to avoid starting intergalactic wars.`,
        compatibility_rating: "93%"
      },
      {
        title: "Ten-Forward Lounge Seating Logistics Coordinator",
        department: "Command",
        why_matched: "Manages guest flow and table priorities in Ten-Forward. Must mediate diplomatic seating disputes between Klingons and Vulcans while keeping Guinan updated on inventory.",
        compatibility_rating: "86%"
      },
      {
        title: "Junior Warp Core Diagnostics Log Reviewer",
        department: "Command",
        why_matched: "Reviews daily routine maintenance logs. A critical stepping stone for officers wishing to learn command-level starship diagnostics protocols.",
        compatibility_rating: "81%"
      }
    ];
  } else {
    jobs = [
      {
        title: "Chief Holodeck Anomaly Wrangler",
        department: "Operations",
        why_matched: "Your general troubleshooting experience is highly needed to handle malfunctions where Holodeck characters escape their simulations. Requires patience and a phaser set to stun.",
        compatibility_rating: "92%"
      },
      {
        title: "Tribble Population Control Specialist",
        department: "Operations",
        why_matched: "Responsible for sweeping the cargo bays and scanning for signs of unauthorized tribble smuggling. Must be quick with a containment bag.",
        compatibility_rating: "85%"
      },
      {
        title: "Repli-mat Maintenance Engineer",
        department: "Engineering",
        why_matched: "Clears burnt circuit boards and blocked matter pipelines in the crew quarters' food dispensers. A vital operations role to keep crew morale high.",
        compatibility_rating: "88%"
      }
    ];
  }

  return {
    telemetry_meta: {
      mode: "Local Basic Parser (Offline Fallback)",
      notice: "Google Gen AI API is not configured or offline. Running basic keyword heuristics diagnostics."
    },
    resume_json: {
      name: name,
      contact: {
        email: email,
        phone: phone,
        location: locationVal
      },
      summary: summary,
      experience: experience,
      education: education,
      skills: skills
    },
    star_trek_jobs: jobs
  };
}

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

    if (!ai) {
      console.warn('AI SDK client is not initialized. Falling back to local offline analysis mode.');
      const mockResult = generateLocalMock(resumeText);
      return res.json(mockResult);
    }

    try {
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
    } catch (apiError) {
      console.warn('Google Gen AI API call failed. Falling back to local offline analysis mode:', apiError.message);
      const mockResult = generateLocalMock(resumeText);
      res.json(mockResult);
    }
  } catch (error) {
    console.error('Fatal endpoint error:', error);
    res.status(500).json({ error: 'Internal server error during analysis. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
