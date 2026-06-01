# OTA Server — API Documentation

**Base URL (local):** `http://localhost:3000`  
**Base URL (production):** set in `.env` as `SERVER_URL`

---

## Workflow

```
Step 1 — Find Device          →    GET  /check-device
Step 2 — Send Firmware        →    POST /upload-bin/:deviceId
Step 3 — Wait for UI Polling  →    GET  /device-message/:deviceId   (frontend polls this)
Step 4 — Push Confirmation    →    POST /device-message              (Postman / ESP32 sends this)
Step 5 — Verify Status        →    POST /view-device
```

---

## Step 1 — Find Device

Check if a device is online before sending anything.

```
GET /check-device?device={deviceId}
```

**Postman:**
| | |
|---|---|
| Method | `GET` |
| URL | `http://localhost:3000/check-device?device=DEVICE_001` |
| Body | none |

**Response — Online:**
```json
{ "online": true }
```

**Response — Offline:**
```json
{ "online": false }
```

> A device is considered **online** only if it has pinged the server in the last **10 seconds**.

---

## Step 2 — Send Firmware (Upload BIN File)

Once the device is confirmed online, upload the `.bin` firmware file.

```
POST /upload-bin/:deviceId
Content-Type: multipart/form-data
```

**Postman:**
| | |
|---|---|
| Method | `POST` |
| URL | `http://localhost:3000/upload-bin/DEVICE_001` |
| Body | `form-data` |
| Key | `firmware` (type → **File**) |
| Value | _(select your `.bin` file)_ |

> ⚠️ In Postman: Body → **form-data** → key = `firmware` → hover the key, change type from **Text** to **File** → select file.

**Success Response `200`:**
```json
{
  "success": true,
  "message": "BIN file uploaded successfully. Device \"DEVICE_001\" is now queued for OTA firmware update.",
  "device": "DEVICE_001",
  "firmware": "firmware_DEVICE_001.bin",
  "firmwareUrl": "http://localhost:3000/firmware_DEVICE_001.bin",
  "timestamp": "2026-06-01T06:45:00.000Z"
}
```

**Error — no file `400`:**
```json
{
  "success": false,
  "message": "No BIN file was received. Please select a valid .bin firmware file and try again."
}
```

**Error — wrong type `400`:**
```json
{
  "success": false,
  "message": "Invalid file type. Only .bin firmware files are accepted."
}
```

**Error — server `500`:**
```json
{
  "success": false,
  "message": "Server error: failed to save the firmware file. Please try again."
}
```

---

## Step 3 — Verify Device Status

Confirm the firmware was received and is queued for the device.

```
POST /view-device
Content-Type: application/json
```

**Postman:**
| | |
|---|---|
| Method | `POST` |
| URL | `http://localhost:3000/view-device` |
| Body | `raw → JSON` |

**Body to send:**
```json
{
  "device": "DEVICE_001"
}
```

**Response — update queued:**
```json
{
  "device": "DEVICE_001",
  "message": "Device \"DEVICE_001\" has a pending firmware update queued."
}
```

**Response — nothing stored:**
```json
{
  "device": "DEVICE_001",
  "message": "No update stored"
}
```

---

## Step 4 — Push Device Confirmation Message

After the device flashes the firmware, it (or Postman during testing) sends a confirmation message to the server. The frontend is polling and will automatically display this.

```
POST /device-message
Content-Type: application/json
```

**Postman:**
| | |
|---|---|
| Method | `POST` |
| URL | `http://localhost:3000/device-message` |
| Body | `raw → JSON` |

**Body to send:**
```json
{
  "device": "DEVICE_001",
  "message": "Firmware flashed successfully"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Message stored for device \"DEVICE_001\".",
  "device": "DEVICE_001"
}
```

**Error — missing fields `400`:**
```json
{
  "success": false,
  "message": "Both 'device' and 'message' fields are required."
}
```

> 💡 **How to test the full flow with Postman:**  
> 1. Upload a BIN file from the web UI → UI shows amber "Waiting for device confirmation…"  
> 2. In Postman, `POST /device-message` with `{ "device": "DEVICE_001", "message": "Firmware flashed successfully" }`  
> 3. Within 2–3 seconds the UI automatically updates to ✅ success state.

---

## Step 5 — Frontend Polls for Confirmation _(internal, called by browser)_

The frontend automatically calls this every 2.5 seconds after a successful BIN upload.

```
GET /device-message/:deviceId
```

**Response — message waiting:**
```json
{
  "received": true,
  "device": "DEVICE_001",
  "message": "Firmware flashed successfully",
  "timestamp": "2026-06-01T07:00:00.000Z"
}
```

**Response — no message yet:**
```json
{ "received": false }
```

> ⚠️ Once a message is returned as `received: true`, it is cleared from the server — a second poll returns `false`.

---

## Other Endpoints

### Device Ping _(ESP32 only)_
```
GET /device-ping?device=DEVICE_001
```
The ESP32 calls this automatically to signal it is alive. Returns `OK`.

---

### Update via GitHub Link
```
POST /update-link/:deviceId
Content-Type: application/json
```
**Body:**
```json
{
  "url": "https://raw.githubusercontent.com/user/repo/main/firmware.bin"
}
```

---

### ESP32 — Poll for Update _(ESP32 only)_
```
GET /trigger-update?device=DEVICE_001
```
The ESP32 calls this to check if a firmware update is waiting.  
Returns `{ "update": true, "url": "..." }` or `{ "update": false }`.  
> Once consumed, the flag clears — will return `false` on the next call.

---

### Debug — All Data
```
GET /all-data
```
Returns all stored device updates and online timestamps. No body needed.

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `3000` |
| `SERVER_URL` | Public base URL (no trailing `/`) | `https://your-server.com` |

---

_Last updated: 2026-06-01_
