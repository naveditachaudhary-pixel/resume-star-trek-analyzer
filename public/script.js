document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('resume-file');
  const fileInfoContainer = document.getElementById('file-info-container');
  const fileNameLabel = document.getElementById('file-name-label');
  const fileSizeLabel = document.getElementById('file-size-label');
  const removeFileBtn = document.getElementById('remove-file-btn');
  const analyzeBtn = document.getElementById('analyze-btn');
  const demoBtn = document.getElementById('demo-btn');
  
  const uploadView = document.getElementById('upload-view');
  const loadingView = document.getElementById('loading-view');
  const resultsView = document.getElementById('results-view');
  
  const loadingLog = document.getElementById('loading-log');
  const stardateDisplay = document.getElementById('stardate-display');
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const jsonCodeDisplay = document.getElementById('json-code-display');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const jobsGridContainer = document.getElementById('jobs-grid-container');
  
  const resetBtn = document.getElementById('reset-btn');

  let selectedFile = null;
  let analysisResult = null;
  let loadingInterval = null;

  // Set Stardate
  updateStardate();

  // Drag and Drop Event Listeners
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      handleFileSelection(fileInput.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedFile();
  });

  analyzeBtn.addEventListener('click', () => {
    if (selectedFile) {
      startAnalysis(false);
    }
  });

  demoBtn.addEventListener('click', () => {
    startAnalysis(true);
  });

  resetBtn.addEventListener('click', () => {
    resetConsole();
  });

  // Tab switching logic
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // Clipboard copy action
  copyJsonBtn.addEventListener('click', () => {
    if (analysisResult && analysisResult.resume_json) {
      const jsonText = JSON.stringify(analysisResult.resume_json, null, 2);
      navigator.clipboard.writeText(jsonText).then(() => {
        const originalText = copyJsonBtn.textContent;
        copyJsonBtn.textContent = 'COPIED!';
        copyJsonBtn.classList.add('disabled');
        copyJsonBtn.disabled = true;
        setTimeout(() => {
          copyJsonBtn.textContent = originalText;
          copyJsonBtn.classList.remove('disabled');
          copyJsonBtn.disabled = false;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    }
  });

  // Helper Functions
  function handleFileSelection(file) {
    if (file.type !== 'application/pdf') {
      alert('Invalid file format. Please upload a PDF resume.');
      clearSelectedFile();
      return;
    }

    selectedFile = file;
    fileNameLabel.textContent = file.name;
    fileSizeLabel.textContent = `(${formatBytes(file.size)})`;
    
    fileInfoContainer.classList.remove('hidden');
    analyzeBtn.classList.remove('disabled');
    analyzeBtn.disabled = false;
  }

  function clearSelectedFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfoContainer.classList.add('hidden');
    analyzeBtn.classList.add('disabled');
    analyzeBtn.disabled = true;
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function updateStardate() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = (now - startOfYear) / (1000 * 60 * 60 * 24);
    // Standard TNG Stardate math shifted to 21st century
    const stardate = ((now.getFullYear() - 1946) * 1000 + (dayOfYear / 365.25) * 1000).toFixed(1);
    stardateDisplay.textContent = `STARDATE: ${stardate}`;
  }

  function startAnalysis(isDemo = false) {
    uploadView.classList.remove('active');
    loadingView.classList.add('active');
    
    // Simulate active system logs
    const systemLogs = [
      'Establishing subspace carrier link to Main Frame...',
      'Routing data packets through Secondary Bio-Neural Gel Packs...',
      'Bypassing Command Security Protocols (read-only mode)...',
      'Scanning resume raw buffer for character arrays...',
      'Extracting professional credentials and service records...',
      'Correlating experience vectors with Starfleet requirements...',
      'Filtering compatibility matches via LCARS directory...',
      'Formulating Enterprise department reassignments...',
      'Generating localized stardate telemetry...',
      'Compiling personnel files. Diagnostics almost complete...'
    ];
    
    let logIndex = 0;
    loadingLog.textContent = systemLogs[logIndex];
    
    loadingInterval = setInterval(() => {
      logIndex = (logIndex + 1) % systemLogs.length;
      loadingLog.textContent = systemLogs[logIndex];
    }, 2500);

    let fetchOptions;
    if (isDemo) {
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ demo: true })
      };
    } else {
      const formData = new FormData();
      formData.append('resume', selectedFile);
      fetchOptions = {
        method: 'POST',
        body: formData
      };
    }

    fetch('/api/analyze', fetchOptions)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || 'Server encountered an error analyzing file.');
        });
      }
      return response.json();
    })
    .then(data => {
      clearInterval(loadingInterval);
      analysisResult = data;
      renderResults();
      loadingView.classList.remove('active');
      resultsView.classList.add('active');
    })
    .catch(error => {
      clearInterval(loadingInterval);
      alert(`Diagnostics Failed: ${error.message}`);
      loadingView.classList.remove('active');
      uploadView.classList.add('active');
    });
  }

  function renderResults() {
    if (!analysisResult) return;

    // Tab 1: Render JSON
    jsonCodeDisplay.textContent = JSON.stringify(analysisResult.resume_json, null, 2);

    // Tab 2: Render Job Cards
    jobsGridContainer.innerHTML = '';
    
    const jobs = analysisResult.star_trek_jobs || [];
    jobs.forEach(job => {
      const deptClass = getDeptClass(job.department);
      
      const card = document.createElement('div');
      card.className = `job-card ${deptClass}`;
      
      card.innerHTML = `
        <div class="job-card-header">
          <div class="job-title">${escapeHTML(job.title)}</div>
          <span class="dept-badge ${deptClass}">${escapeHTML(job.department)}</span>
        </div>
        <div class="compatibility-bar-container">
          <span class="compatibility-label">FIT RATING</span>
          <div class="compatibility-track">
            <div class="compatibility-fill" style="width: ${escapeHTML(job.compatibility_rating || '50%')}"></div>
          </div>
          <span class="compatibility-val">${escapeHTML(job.compatibility_rating || '50%')}</span>
        </div>
        <p class="job-explanation">${escapeHTML(job.why_matched)}</p>
      `;
      
      jobsGridContainer.appendChild(card);
    });
  }

  function getDeptClass(department) {
    if (!department) return 'other';
    const dept = department.toLowerCase();
    
    if (dept.includes('command')) return 'command';
    if (dept.includes('operations') || dept.includes('engineering') || dept.includes('tactical') || dept.includes('warp')) return 'operations';
    if (dept.includes('sciences') || dept.includes('medical') || dept.includes('research') || dept.includes('stellar')) return 'sciences';
    return 'other';
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  function resetConsole() {
    clearSelectedFile();
    analysisResult = null;
    jsonCodeDisplay.textContent = 'Loading personnel JSON data...';
    jobsGridContainer.innerHTML = '';
    
    // Reset tabs
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    tabButtons[0].classList.add('active');
    tabContents[0].classList.add('active');
    
    resultsView.classList.remove('active');
    uploadView.classList.add('active');
    
    updateStardate();
  }
});
