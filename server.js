const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize local storage database schema if not present
if (!fs.existsSync(DB_FILE)) {
    const defaultSchema = { APPROVED_UID_REGISTRY: { "9999": "APPROVED" }, PENDING_REQUESTS: [], BANNED_REGISTRY: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultSchema, null, 2));
}

function readDatabase() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDatabase(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// API Endpoints for User Validation Protocols
app.post('/api/auth/verify', (req, { json }) => {
    const { uid } = req.body;
    if (!uid) return json({ status: "ERROR", message: "UID stack node missing." });

    const db = readDatabase();
    if (db.BANNED_REGISTRY[uid]) return json({ status: "REJECTED", message: "Hardware node blacklisted." });
    if (db.APPROVED_UID_REGISTRY[uid]) return json({ status: "APPROVED" });
    
    if (!db.PENDING_REQUESTS.includes(uid)) {
        db.PENDING_REQUESTS.push(uid);
        writeDatabase(db);
    }
    return json({ status: "PENDING", message: "Enqueued into tracking buffer pipeline." });
});

app.get('/api/admin/fetch-records', (req, res) => res.json(readDatabase()));

app.post('/api/admin/modify-state', (req, res) => {
    const { uid, action } = req.body; // Actions: 'ALLOW', 'BAN', 'RESET', 'DELETE'
    const db = readDatabase();

    db.PENDING_REQUESTS = db.PENDING_REQUESTS.filter(id => id !== uid);
    delete db.APPROVED_UID_REGISTRY[uid];
    delete db.BANNED_REGISTRY[uid];

    if (action === 'ALLOW') db.APPROVED_UID_REGISTRY[uid] = "APPROVED";
    if (action === 'BAN') db.BANNED_REGISTRY[uid] = "BANNED";
    if (action === 'RESET') db.PENDING_REQUESTS.push(uid);

    writeDatabase(db);
    return res.json({ success: true, payload: db });
});

app.post('/api/admin/clear-all', (req, res) => {
    const wipedSchema = { APPROVED_UID_REGISTRY: {}, PENDING_REQUESTS: [], BANNED_REGISTRY: {} };
    writeDatabase(wipedSchema);
    return res.json({ success: true, payload: wipedSchema });
});

app.listen(PORT, () => console.log(`[SYSTEM] Core active on port: http://localhost:${PORT}`));
