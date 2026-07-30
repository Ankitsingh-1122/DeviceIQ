const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const si = require('systeminformation');
const log = require('electron-log');

const LARGE_FILE_THRESHOLD_BYTES = 500 * 1024 * 1024; // 500MB
const MAX_FILES_TO_HASH = 20000; // safety cap so a huge drive doesn't hang the scan

const CATEGORY_EXT = {
  Photos: ['.jpg', '.jpeg', '.png', '.heic', '.gif', '.bmp', '.webp', '.raw'],
  Videos: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv'],
  Documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
  Audio: ['.mp3', '.wav', '.flac', '.aac', '.m4a'],
  Archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  Executables: ['.exe', '.msi', '.dll'],
};

function categoryFor(ext) {
  ext = ext.toLowerCase();
  for (const [cat, exts] of Object.entries(CATEGORY_EXT)) {
    if (exts.includes(ext)) return cat;
  }
  return 'Other';
}

function fileSha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Recursively walks a directory, collecting per-file metadata.
 * Skips system/hidden/junction points to avoid infinite loops and permission errors.
 */
async function walk(dir, out, filesScanned = { n: 0 }) {
  if (filesScanned.n > MAX_FILES_TO_HASH) return;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return; // permission denied / not accessible — skip silently
  }
  for (const entry of entries) {
    if (filesScanned.n > MAX_FILES_TO_HASH) return;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (['node_modules', '$Recycle.Bin', 'System Volume Information'].includes(entry.name)) continue;
      await walk(full, out, filesScanned);
    } else if (entry.isFile()) {
      try {
        const stat = await fs.promises.stat(full);
        out.push({ path: full, size: stat.size, ext: path.extname(entry.name) });
        filesScanned.n++;
      } catch (_) { /* skip unreadable file */ }
    }
  }
}

function getUserFolders() {
  const home = os.homedir();
  return {
    Downloads: path.join(home, 'Downloads'),
    Documents: path.join(home, 'Documents'),
    Pictures: path.join(home, 'Pictures'),
    Videos: path.join(home, 'Videos'),
    Desktop: path.join(home, 'Desktop'),
  };
}

/**
 * Scans the user's profile folders (not the entire drive, which would take
 * far too long from a UI thread). Returns real totals, real large files,
 * and real duplicate groups found by content hash.
 */
async function scanUserStorage(onProgress) {
  const folders = getUserFolders();
  const files = [];
  let done = 0;
  const names = Object.keys(folders);
  for (const name of names) {
    const dir = folders[name];
    if (fs.existsSync(dir)) {
      await walk(dir, files);
    }
    done++;
    if (onProgress) onProgress({ folder: name, done, total: names.length });
  }

  // category breakdown (bytes)
  const breakdown = {};
  for (const f of files) {
    const cat = categoryFor(f.ext);
    breakdown[cat] = (breakdown[cat] || 0) + f.size;
  }

  // largest files
  const largeFiles = files
    .filter((f) => f.size >= LARGE_FILE_THRESHOLD_BYTES / 5) // 100MB+ shown, flagged if >500MB
    .sort((a, b) => b.size - a.size)
    .slice(0, 25)
    .map((f) => ({ name: path.basename(f.path), path: f.path, sizeBytes: f.size }));

  // duplicate detection: group by size first (cheap), then hash only same-size groups
  const bySize = new Map();
  for (const f of files) {
    if (f.size < 1024) continue; // ignore tiny files
    if (!bySize.has(f.size)) bySize.set(f.size, []);
    bySize.get(f.size).push(f);
  }
  const duplicateCandidates = [...bySize.values()].filter((g) => g.length > 1);

  const duplicateGroups = [];
  for (const group of duplicateCandidates.slice(0, 300)) { // cap hashing work
    const byHash = new Map();
    for (const f of group) {
      try {
        const h = await fileSha1(f.path);
        if (!byHash.has(h)) byHash.set(h, []);
        byHash.get(h).push(f);
      } catch (_) { /* unreadable, skip */ }
    }
    for (const dupFiles of byHash.values()) {
      if (dupFiles.length > 1) {
        duplicateGroups.push({
          name: path.basename(dupFiles[0].path),
          count: dupFiles.length,
          sizeBytesEach: dupFiles[0].size,
          totalReclaimableBytes: dupFiles[0].size * (dupFiles.length - 1),
          paths: dupFiles.map((f) => f.path),
        });
      }
    }
  }
  duplicateGroups.sort((a, b) => b.totalReclaimableBytes - a.totalReclaimableBytes);

  return {
    filesScanned: files.length,
    breakdown, // { Photos: bytes, ... }
    largeFiles,
    duplicates: duplicateGroups.slice(0, 20),
  };
}

async function getDriveUsage() {
  const fsSize = await si.fsSize();
  // primary volume = the one mounted at the OS drive (C:\ on Windows)
  const primary = fsSize.find((v) => v.mount?.toLowerCase().startsWith('c:')) || fsSize[0];
  if (!primary) return null;
  return {
    drive: primary.mount,
    totalBytes: primary.size,
    usedBytes: primary.used,
    freeBytes: primary.size - primary.used,
    usePercent: primary.use,
  };
}

module.exports = { scanUserStorage, getDriveUsage, getUserFolders };
