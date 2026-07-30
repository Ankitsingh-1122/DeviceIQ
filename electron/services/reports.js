const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const dbRepo = require('../db/database');

function outputPath(name) {
  const dir = path.join(app.getPath('documents'), 'DeviceIQ Reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}-${Date.now()}.pdf`);
}

function header(doc, title, subtitle) {
  doc.fontSize(22).fillColor('#111214').text('DeviceIQ', { continued: false });
  doc.fontSize(14).fillColor('#4C8DFF').text(title);
  if (subtitle) doc.fontSize(10).fillColor('#63646d').text(subtitle);
  doc.moveDown();
  doc.strokeColor('#e5e5e5').moveTo(doc.x, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown();
}

async function generateBatteryReport(deviceId, deviceMeta) {
  const dest = outputPath('battery-report');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(dest));

  header(doc, 'Battery Report', deviceMeta?.name);

  const latest = dbRepo.getLatestBatterySample(deviceId);
  const history = dbRepo.getBatteryHistory(deviceId, 24 * 30);

  doc.fontSize(12).fillColor('#111').text('Current Status', { underline: true });
  doc.moveDown(0.3);
  if (latest) {
    const health = latest.design_capacity ? ((latest.max_capacity / latest.design_capacity) * 100).toFixed(1) : 'N/A';
    doc.fontSize(10).fillColor('#333').list([
      `Charge level: ${latest.percent ?? 'N/A'}%`,
      `Charging: ${latest.is_charging ? 'Yes' : 'No'}`,
      `Health: ${health}%`,
      `Cycle count: ${latest.cycle_count ?? 'N/A'}`,
      `Design capacity: ${latest.design_capacity ?? 'N/A'} mWh`,
      `Current max capacity: ${latest.max_capacity ?? 'N/A'} mWh`,
      `Last recorded: ${latest.timestamp}`,
    ]);
  } else {
    doc.fontSize(10).fillColor('#333').text('No battery samples recorded yet.');
  }

  doc.moveDown();
  doc.fontSize(12).fillColor('#111').text(`History (last 30 days, ${history.length} samples)`, { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#555');
  history.slice(-40).forEach((h) => {
    doc.text(`${h.timestamp}  —  ${h.percent}%  —  ${h.is_charging ? 'charging' : 'discharging'}`);
  });

  doc.end();
  return dest;
}

async function generateStorageReport(deviceId, scan) {
  const dest = outputPath('storage-report');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(dest));
  header(doc, 'Storage Report');

  if (!scan) {
    doc.fontSize(10).text('No storage scan has been run yet.');
  } else {
    doc.fontSize(12).text('Breakdown', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#333').list(
      Object.entries(scan.breakdown).map(([k, v]) => `${k}: ${(v / 1024 ** 3).toFixed(2)} GB`)
    );
    doc.moveDown();
    doc.fontSize(12).fillColor('#111').text('Duplicate files', { underline: true });
    doc.fontSize(10).fillColor('#333').list(
      scan.duplicates.slice(0, 15).map((d) => `${d.name} — ${d.count} copies — ${(d.totalReclaimableBytes / 1024 ** 2).toFixed(0)} MB reclaimable`)
    );
  }
  doc.end();
  return dest;
}

async function generateWarrantyReport(deviceId) {
  const dest = outputPath('warranty-report');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(dest));
  header(doc, 'Warranty Report');
  const rows = dbRepo.getWarranty(deviceId);
  if (!rows.length) doc.fontSize(10).text('No warranty records on file.');
  rows.forEach((w) => {
    doc.fontSize(10).fillColor('#333').text(`${w.provider || 'Coverage'} — expires ${w.expires_date || 'unknown'} (purchased ${w.purchase_date || 'unknown'})`);
  });
  doc.end();
  return dest;
}

async function generateRepairReport(deviceId) {
  const dest = outputPath('repair-report');
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(dest));
  header(doc, 'Repair History Report');
  const rows = dbRepo.getRepairs(deviceId);
  const total = rows.reduce((a, r) => a + (r.cost || 0), 0);
  doc.fontSize(10).fillColor('#333').text(`Total spend: $${total.toFixed(2)}`);
  doc.moveDown();
  rows.forEach((r) => {
    doc.text(`${r.date} — ${r.part} — $${r.cost} — ${r.service_center || ''}`);
  });
  doc.end();
  return dest;
}

module.exports = {
  generateBatteryReport,
  generateStorageReport,
  generateWarrantyReport,
  generateRepairReport,
};
