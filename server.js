const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CHANGE THIS TO YOUR PC LOCAL IP
const SERVER_URL = "https://ota-cloud.onrender.com";

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const upload = multer({ dest: "uploads/" });

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
// 2️⃣ Check Device Online Status (Web uses this)
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
// 3️⃣ Upload .bin for Specific Device
// ===============================
app.post("/upload/:deviceId", upload.single("firmware"), (req, res) => {

    const deviceId = req.params.deviceId;

    if (!req.file) {
        return res.status(400).send("No file uploaded");
    }

    const firmwareName = `firmware_${deviceId}.bin`;
    const targetPath = path.join(__dirname, firmwareName);

    fs.rename(req.file.path, targetPath, (err) => {

        if (err) return res.status(500).send("File move failed");

        deviceUpdates[deviceId] = {
            update: true,
            firmware: firmwareName
        };

        console.log(`Firmware uploaded for ${deviceId}`);
        res.send(`Firmware uploaded for ${deviceId}`);
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

        writer.on("finish", () => {

            deviceUpdates[deviceId] = {
                update: true,
                firmware: firmwareName
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
// 5️⃣ ESP32 Checks for Update
// ===============================
app.get("/trigger-update", (req, res) => {

    const deviceId = req.query.device;

    if (!deviceId) {
        return res.json({ update: false });
    }

    if (deviceUpdates[deviceId] && deviceUpdates[deviceId].update) {

        const firmwareURL = `${req.protocol}://${req.get("host")}/${deviceUpdates[deviceId].firmware}`;

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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`OTA Server running at ${SERVER_URL}`);
});
