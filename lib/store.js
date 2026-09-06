const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY = 'kpk_cricket_data';
const KV_ENABLED = !!(KV_URL && KV_TOKEN);

let cachedData = null;
let cachedMtime = 0;

async function kv(args) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + KV_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  const json = await res.json();
  return Array.isArray(json) ? json[0] : json;
}

function readFile() {
  const stat = fs.statSync(DATA_FILE);
  if (cachedData && stat.mtimeMs === cachedMtime) return cachedData;
  cachedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  cachedMtime = stat.mtimeMs;
  return cachedData;
}

async function loadData() {
  if (KV_ENABLED) {
    try {
      const result = await kv(['GET', KV_KEY]);
      if (result) {
        cachedData = JSON.parse(result);
        return cachedData;
      }
    } catch (err) {
      console.error('KV read failed, using local data:', err.message);
    }
  }
  return readFile();
}

async function saveData(data) {
  cachedData = data;
  if (KV_ENABLED) {
    try {
      await kv(['SET', KV_KEY, JSON.stringify(data)]);
      return;
    } catch (err) {
      console.error('KV write failed:', err.message);
    }
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { loadData, saveData, KV_ENABLED };