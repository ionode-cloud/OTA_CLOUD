const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===============================
// In-memory storage
// ===============================
let deviceUpdates = {};
let deviceOnlineStatus = {};

// ===============================
// 1️⃣ Device Ping (ESP32 sends this)
// ===============================
app.get("/device-ping", (req, res) => {

    const deviceId = req.query.device;

    if (deviceId) {
        deviceOnlineStatus[deviceId] = Date.now();
        console.log(`${deviceId} is alive`);
    }

    res.send("OK");
});

// ===============================
// 2️⃣ Check Device Online Status
// ===============================
app.get("/check-device", (req, res) => {

    const deviceId = req.query.device;

    if (!deviceId) {
        return res.json({ online: false });
    }

    const lastSeen = deviceOnlineStatus[deviceId];

    if (lastSeen && (Date.now() - lastSeen < 10000)) {
        return res.json({ online: true });
    }

    res.json({ online: false });
});

// ===============================
// 3️⃣ Send GitHub RAW Link for Update
// ===============================
app.post("/update-link/:deviceId", (req, res) => {

    const deviceId = req.params.deviceId;
    const firmwareUrl = req.body.url;

    if (!firmwareUrl) {
        return res.status(400).json({ error: "No URL provided" });
    }

    deviceUpdates[deviceId] = {
        update: true,
        firmwareUrl: firmwareUrl
    };

    console.log(`Update stored for ${deviceId}`);
    console.log("Firmware URL:", firmwareUrl);

    res.json({ message: "Firmware URL saved successfully" });
});

// ===============================
// 4️⃣ ESP32 Checks for Update
// ===============================
app.get("/trigger-update", (req, res) => {

    const deviceId = req.query.device;

    if (!deviceId) {
        return res.json({ update: false });
    }

    if (deviceUpdates[deviceId] && deviceUpdates[deviceId].update) {

        const firmwareURL = deviceUpdates[deviceId].firmwareUrl;

        // Reset flag after sending
        deviceUpdates[deviceId].update = false;

        console.log(`Update triggered for ${deviceId}`);

        return res.json({
            update: true,
            url: firmwareURL
        });
    }

    res.json({ update: false });
});

// ===============================
// 5️⃣ Debug Route (Optional)
// ===============================
app.get("/all-updates", (req, res) => {
    res.json(deviceUpdates);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OTA Server running on port ${PORT}`);
});
