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

// Initialize local storage database schema with all registries
if (!fs.existsSync(DB_FILE)) {
    const defaultSchema = { 
        APPROVED_UID_REGISTRY: { "9999": "APPROVED" }, 
        PENDING_REQUESTS: [], 
        BANNED_REGISTRY: {},
        NO_RECHARGE_REGISTRY: {} 
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultSchema, null, 2));
}

function readDatabase() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDatabase(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

app.post('/api/auth/verify', (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.json({ status: "ERROR", message: "UID stack node missing." });

    const db = readDatabase();
    
    // Ensure nested object existence
    if (!db.NO_RECHARGE_REGISTRY) db.NO_RECHARGE_REGISTRY = {};
    
    // Priority sequence: BANNED > NO_RECHARGE > APPROVED
    if (db.BANNED_REGISTRY[uid]) 
        return res.json({ status: "REJECTED" });

    if (db.NO_RECHARGE_REGISTRY && db.NO_RECHARGE_REGISTRY[uid]) 
        return res.json({ status: "NO_RECHARGE" });

    if (db.APPROVED_UID_REGISTRY[uid]) 
        return res.json({ status: "APPROVED" });
    
    // Default: Pending logic
    if (!db.PENDING_REQUESTS.includes(uid)) {
        db.PENDING_REQUESTS.push(uid);
        writeDatabase(db);
    }
    return res.json({ status: "PENDING", message: "Enqueued into tracking buffer pipeline." });
});

app.get('/api/admin/fetch-records', (req, res) => res.json(readDatabase()));

app.post('/api/admin/modify-state', (req, res) => {
    const { uid, action } = req.body; // Actions: 'ALLOW', 'BAN', 'RESET', 'DELETE', 'NO_RECHARGE'
    const db = readDatabase();

    // Ensure registry exists before manipulation
    if (!db.NO_RECHARGE_REGISTRY) db.NO_RECHARGE_REGISTRY = {};

    // Clean up existing states
    db.PENDING_REQUESTS = db.PENDING_REQUESTS.filter(id => id !== uid);
    delete db.APPROVED_UID_REGISTRY[uid];
    delete db.BANNED_REGISTRY[uid];
    delete db.NO_RECHARGE_REGISTRY[uid];

    // Apply new action
    if (action === 'ALLOW') db.APPROVED_UID_REGISTRY[uid] = "APPROVED";
    if (action === 'BAN') db.BANNED_REGISTRY[uid] = "BANNED";
    if (action === 'RESET') db.PENDING_REQUESTS.push(uid);
    if (action === 'NO_RECHARGE') db.NO_RECHARGE_REGISTRY[uid] = "NO_RECHARGE";

    writeDatabase(db);
    return res.json({ success: true, payload: db });
});

app.post('/api/admin/clear-all', (req, res) => {
    const wipedSchema = { 
        APPROVED_UID_REGISTRY: {}, 
        PENDING_REQUESTS: [], 
        BANNED_REGISTRY: {}, 
        NO_RECHARGE_REGISTRY: {} 
    };
    writeDatabase(wipedSchema);
    return res.json({ success: true, payload: wipedSchema });
});

app.listen(PORT, () => console.log(`[SYSTEM] Core active on port: http://localhost:${PORT}`));
