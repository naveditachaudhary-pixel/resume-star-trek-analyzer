import PDFDocument from 'pdfkit';
import fs from 'fs';

function generatePDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream('sample_resume.pdf');
    doc.pipe(stream);

    doc.fontSize(24).text("Miles O'Brien", { align: 'center' });
    doc.fontSize(14).text("Transporter Chief & Chief Operations Officer", { align: 'center' });
    doc.moveDown();

    doc.fontSize(16).text("Summary", { underline: true });
    doc.fontSize(12).text("Highly experienced Starfleet tactical and operations engineer with over 15 years of service. Expert in transporter systems operations, Cardassian phase-converters, sub-space field stabilization, and general warp core maintenance. Known for maintaining operational efficiency under extreme combat and anomaly conditions.");
    doc.moveDown();

    doc.fontSize(16).text("Experience", { underline: true });
    doc.fontSize(12).text("Chief Operations Officer - Deep Space Nine (2369 - 2375)");
    doc.text("Managed all station operational subsystems, rebuilt Cardassian hardware interfaces to integrate with Federation standard technology, and coordinated docking protocols for Bajoran sector fleets.");
    doc.moveDown(0.5);
    doc.text("Transporter Chief - U.S.S. Enterprise NCC-1701-D (2364 - 2369)");
    doc.text("Responsible for primary and auxiliary transporter system operations. Performed complex bio-filter calibrations and handled emergency pattern buffer diagnostics during hostile encounters.");
    doc.moveDown();

    doc.fontSize(16).text("Skills", { underline: true });
    doc.fontSize(12).text("Transporter Operations, Deflector Shield Modification, Subspace Field Mechanics, Cardassian System Integration, Replicator Re-programming, Phaser Calibration, Stress Management under fire.");

    doc.end();

    stream.on('finish', () => {
      resolve();
    });
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

generatePDF()
  .then(() => {
    console.log("sample_resume.pdf created successfully.");
  })
  .catch(err => {
    console.error("Failed to create PDF:", err);
  });
