const fs = require('fs');
const path = require('path');

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, 'data');
}

async function ensureDataDir() {
  const dir = getDataDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.mkdir(path.join(dir, 'uploads'), { recursive: true });
}

async function read(filename) {
  const filePath = path.join(getDataDir(), filename);
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function write(filename, data) {
  const dir = getDataDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  const tmpPath = filePath + '.tmp';
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmpPath, filePath);
}

async function readConfig() {
  const filePath = path.join(getDataDir(), 'config.json');
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const defaults = {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
        allowSignup: true,
        maintenanceMode: false,
        staleThresholds: {
          todo: 43200,
          'in-progress': 43200,
          'on-hold': 43200,
          'needs-info': 43200,
          'in-review': 43200
        },
        reminderHours: [24, 48]
      };
      await write('config.json', defaults);
      return defaults;
    }
    throw err;
  }
}

module.exports = { getDataDir, ensureDataDir, read, write, readConfig };
