require('dotenv').config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT;

// Environment-based Server URL
const SERVER_URL = process.env.SERVER_URL;

app.use(cors());
app.use(express.static(__dirname));

const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 50 * 1024 * 1024 }
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// ===============================
// In-memory storage
// ===============================
let deviceUpdates = {};
let deviceOnlineStatus = {};
let deviceMessages = {};   

// ===============================
// Device Ping (ESP32 sends this)
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
// Check Device Online Status (Web uses this)
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
// Upload .bin for Specific Device
// ===============================
app.post("/upload-bin/:deviceId", upload.single("firmware"), (req, res) => {

    const deviceId = req.params.deviceId;

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No BIN file was received. Please select a valid .bin firmware file and try again."
        });
    }

    // Validate file extension
    const originalName = req.file.originalname || '';
    if (!originalName.toLowerCase().endsWith('.bin')) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
            success: false,
            message: "Invalid file type. Only .bin firmware files are accepted."
        });
    }

    const firmwareName = `firmware_${deviceId}.bin`;
    const targetPath = path.join(__dirname, firmwareName);

    fs.rename(req.file.path, targetPath, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: "Server error: failed to save the firmware file. Please try again."
            });
        }

        const firmwareUrl = `${SERVER_URL}/${firmwareName}`;

        deviceUpdates[deviceId] = {
            update: true,
            firmwareUrl: firmwareUrl
        };

        console.log(`✅ BIN firmware uploaded for ${deviceId} → ${firmwareUrl}`);

        res.status(200).json({
            success: true,
            message: `BIN file uploaded successfully. Device "${deviceId}" is now queued for OTA firmware update.`,
            device: deviceId,
            firmware: firmwareName,
            firmwareUrl: firmwareUrl,
            timestamp: new Date().toISOString()
        });
    });
});

// ===============================
// Update via GitHub Link    
// ===============================
app.post("/update-link/:deviceId", async (req, res) => {

    const deviceId = req.params.deviceId;
    const firmwareUrl = req.body.url;

    if (!firmwareUrl) {
        return res.status(400).send("No URL provided");
    }

    const firmwareName = `firmware_${deviceId}.bin`;
    const filePath = path.join(__dirname, firmwareName);

    try {
        const response = await axios({
            method: "GET",
            url: firmwareUrl,
            responseType: "stream"
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on("finish", () => {

            deviceUpdates[deviceId] = {
                update: true,
                firmwareUrl: firmwareUrl
            };

            console.log(`Firmware downloaded for ${deviceId}`);
            res.send(`Firmware ready for ${deviceId}`);
        });

        writer.on("error", () => {
            res.status(500).send("Download failed");
        });

    } catch (error) {
        res.status(500).send("Invalid firmware URL");
    }
});


// ===============================
// ESP32 Checks for Update
// ===============================
app.get("/trigger-update", (req, res) => {

    const deviceId = req.query.device;

    if (!deviceId) {
        return res.json({ update: false });
    }

    if (deviceUpdates[deviceId] && deviceUpdates[deviceId].update) {

        // 🔥 Send GitHub RAW firmware link directly
        const firmwareURL = deviceUpdates[deviceId].firmwareUrl;

        deviceUpdates[deviceId].update = false;

        console.log(`Update triggered for ${deviceId}`);
        console.log("Firmware URL:", firmwareURL);

        return res.json({
            update: true,
            url: firmwareURL
        });
    }

    res.json({ update: false });
});

// ===============================
// Serve Firmware Files
// ===============================
app.get("/firmware_:deviceId.bin", (req, res) => {

    const deviceId = req.params.deviceId;
    const filePath = path.join(__dirname, `firmware_${deviceId}.bin`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Firmware not found");
    }

    res.download(filePath);
});
app.post("/view-device", (req, res) => {

    const deviceId = req.body.device;

    if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
    }

    if (deviceUpdates[deviceId]) {
        return res.json({
            device: deviceId,
            message: `Device "${deviceId}" has a pending firmware update queued.`
        });
    }

    res.json({
        device: deviceId,
        message: "No update stored"
    });
});
// ===============================
//  Receive Device Confirmation Message
// ===============================
app.post("/device-message", (req, res) => {

    const { device, message } = req.body;

    if (!device || !message) {
        return res.status(400).json({
            success: false,
            message: "Both 'device' and 'message' fields are required."
        });
    }

    deviceMessages[device] = {
        message: message,
        timestamp: new Date().toISOString()
    };

    console.log(`📩 Message received for ${device}: "${message}"`);

    res.status(200).json({
        success: true,
        message: `Message stored for device "${device}".`,
        device: device
    });
});

// ===============================
// Frontend Polls for Device Message
// ===============================
app.get("/device-message/:deviceId", (req, res) => {

    const deviceId = req.params.deviceId;
    const entry    = deviceMessages[deviceId];

    if (!entry) {
        return res.json({ received: false });
    }

    // Return and clear so the same message isn't returned twice
    delete deviceMessages[deviceId];

    res.json({
        received:  true,
        device:    deviceId,
        message:   entry.message,
        timestamp: entry.timestamp
    });
});

app.get("/all-data", (req, res) => {
    res.json({
        deviceUpdates,
        deviceOnlineStatus,
        deviceMessages
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OTA Server running at ${SERVER_URL}`);
});
