require('dotenv').config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ota_db")
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

// Device Schema
const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    lastSeen: { type: Date, default: Date.now },
    updateAvailable: { type: Boolean, default: false },
    firmwareUrl: { type: String, default: "" }
});
const Device = mongoose.model("Device", deviceSchema);

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// ===============================
// 1️⃣ Device Ping (ESP32 sends this)
// ===============================
app.get("/device-ping", async (req, res) => {
    const deviceId = req.query.device;
    if (deviceId) {
        try {
            await Device.findOneAndUpdate(
                { deviceId },
                { lastSeen: Date.now() },
                { upsert: true, new: true }
            );
            console.log(`${deviceId} is alive`);
        } catch (error) {
            console.error("Error updating device status:", error);
        }
    }
    res.send("OK");
});

// ===============================
// 2️⃣ Check Device Online Status (Web uses this)
// ===============================
app.get("/check-device", async (req, res) => {
    const deviceId = req.query.device;
    if (!deviceId) {
        return res.json({ online: false });
    }

    try {
        const device = await Device.findOne({ deviceId });
        if (device && device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime() < 10000)) {
            return res.json({ online: true });
        }
    } catch (error) {
        console.error("Error checking device:", error);
    }
    res.json({ online: false });
});

// ===============================
// 3️⃣ Upload .bin for Specific Device
// ===============================
app.post("/upload/:deviceId", upload.single("firmware"), async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!req.file) {
        return res.status(400).send("No file uploaded");
    }

    const firmwareName = `firmware_${deviceId}.bin`;
    const targetPath = path.join(__dirname, firmwareName);

    fs.rename(req.file.path, targetPath, async (err) => {
        if (err) return res.status(500).send("File move failed");

        try {
            await Device.findOneAndUpdate(
                { deviceId },
                { 
                    updateAvailable: true, 
                    firmwareUrl: `${SERVER_URL}/${firmwareName}` 
                },
                { upsert: true }
            );
            console.log(`Firmware uploaded for ${deviceId}`);
            res.send(`Firmware uploaded for ${deviceId}`);
        } catch (error) {
            res.status(500).send("Database update failed");
        }
    });
});

// ===============================
// 4️⃣ Update via GitHub Link    
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

        writer.on("finish", async () => {
            try {
                await Device.findOneAndUpdate(
                    { deviceId },
                    { 
                        updateAvailable: true, 
                        firmwareUrl: firmwareUrl 
                    },
                    { upsert: true }
                );
                console.log(`Firmware downloaded for ${deviceId}`);
                res.send(`Firmware ready for ${deviceId}`);
            } catch (error) {
                res.status(500).send("Database update failed");
            }
        });

        writer.on("error", () => {
            res.status(500).send("Download failed");
        });

    } catch (error) {
        res.status(500).send("Invalid firmware URL");
    }
});

// ===============================
// 5️⃣ ESP32 Checks for Update
// ===============================
app.get("/trigger-update", async (req, res) => {
    const deviceId = req.query.device;
    if (!deviceId) {
        return res.json({ update: false });
    }

    try {
        const device = await Device.findOne({ deviceId });
        if (device && device.updateAvailable) {
            const firmwareURL = device.firmwareUrl;
            
            // Mark update as processed
            device.updateAvailable = false;
            await device.save();

            console.log(`Update triggered for ${deviceId}`);
            return res.json({
                update: true,
                url: firmwareURL
            });
        }
    } catch (error) {
        console.error("Error triggering update:", error);
    }
    res.json({ update: false });
});

// ===============================
// 6️⃣ Serve Firmware Files
// ===============================
app.get("/firmware_:deviceId.bin", (req, res) => {
    const deviceId = req.params.deviceId;
    const filePath = path.join(__dirname, `firmware_${deviceId}.bin`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Firmware not found");
    }

    res.download(filePath);
});

// ===============================
// 7️⃣ View Device Data
// ===============================
app.post("/view-device", async (req, res) => {
    const deviceId = req.body.device;
    if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
    }

    try {
        const device = await Device.findOne({ deviceId });
        if (device) {
            return res.json({
                device: deviceId,
                data: device
            });
        }
    } catch (error) {
        console.error("Error viewing device:", error);
    }

    res.json({
        device: deviceId,
        message: "No device data found"
    });
});

// ===============================
// 8️⃣ All Data
// ===============================
app.get("/all-data", async (req, res) => {
    try {
        const devices = await Device.find();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: "Could not fetch data" });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OTA Server running at ${SERVER_URL}`);
});
