import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

function App() {
  const [deviceId, setDeviceId] = useState('');
  const [deviceList, setDeviceList] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState(null); // 'online', 'offline', or null
  const [gitLink, setGitLink] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState({
    check: false,
    link: false,
    upload: false
  });
  const fileInputRef = useRef(null);

  // Fetch all devices on load
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/all-data`);
      setDeviceList(response.data);
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const handleCheckDevice = async () => {
    if (!deviceId) {
      Swal.fire({ icon: 'warning', title: 'Select Node', text: 'Please select a hardware node first.', confirmButtonColor: '#3b82f6' });
      return;
    }

    setLoading(prev => ({ ...prev, check: true }));
    try {
      const response = await axios.get(`${API_BASE_URL}/check-device?device=${deviceId}`);
      if (response.data.online) {
        setDeviceStatus('online');
        Swal.fire({ icon: 'success', title: 'State Verified', text: `${deviceId} is online and ready.`, confirmButtonColor: '#3b82f6' });
      } else {
        setDeviceStatus('offline');
        Swal.fire({ icon: 'error', title: 'State Offline', text: `${deviceId} is currently offline.`, confirmButtonColor: '#3b82f6' });
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to verify node state.', confirmButtonColor: '#3b82f6' });
    } finally {
      setLoading(prev => ({ ...prev, check: false }));
    }
  };

  const handleUpdateViaLink = async () => {
    if (!deviceId || !gitLink) {
      Swal.fire({ icon: 'warning', title: 'Incomplete Info', text: 'Select a node and provide a firmware URL.', confirmButtonColor: '#3b82f6' });
      return;
    }

    setLoading(prev => ({ ...prev, link: true }));
    try {
      const response = await axios.post(`${API_BASE_URL}/update-link/${deviceId}`, { url: gitLink });
      Swal.fire({ icon: 'success', title: 'Push Success', text: response.data, confirmButtonColor: '#3b82f6' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Push Failed', text: 'Check the URL and try again.', confirmButtonColor: '#3b82f6' });
    } finally {
      setLoading(prev => ({ ...prev, link: false }));
    }
  };

  const handleUploadFile = async () => {
    if (!deviceId || !file) {
      Swal.fire({ icon: 'warning', title: 'No Binary', text: 'Select a node and drop a firmware file.', confirmButtonColor: '#3b82f6' });
      return;
    }

    setLoading(prev => ({ ...prev, upload: true }));
    const formData = new FormData();
    formData.append("firmware", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload/${deviceId}`, formData);
      Swal.fire({ icon: 'success', title: 'Flash Success', text: response.data, confirmButtonColor: '#3b82f6' });
      setFile(null);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Flash Failed', text: 'Upload error.', confirmButtonColor: '#3b82f6' });
    } finally {
      setLoading(prev => ({ ...prev, upload: false }));
    }
  };

  const isOnline = deviceStatus === 'online';

  return (
    <div>
      <div className="dashboard-card">
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '2rem', color: '#1e293b', textAlign: 'center' }}>
          OTA Control Center
        </h2>
        
        {/* Panel 1: Target Hardware Node */}
        <div className="section">
          <div className="label-container">
            <span className="section-label">Enter Device ID</span>
          </div>
          <div className="input-row">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Enter device ID (e.g. DEVICE_001)"
                value={deviceId}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  setDeviceStatus(null); // Reset status on change
                }}
              />
              {deviceStatus && (
                <div className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`} style={{ width: 'fit-content', marginTop: '0' }}>
                  <div className="ping-indicator"></div>
                  {isOnline ? 'DEVICE IS ONLINE' : 'DEVICE IS OFFLINE'}
                </div>
              )}
            </div>
            <button 
              className={`btn-primary ${loading.check ? 'loading' : ''}`} 
              onClick={handleCheckDevice} 
              disabled={loading.check}
              style={{ marginBottom: deviceStatus ? '24px' : '0' }}
            >
              {loading.check ? (
                <div className="dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              ) : '🔍 Verify State'}
            </button>
          </div>
        </div>

        {/* Panel 2: Remote Flash */}
        <div className="section">
          <div className="label-container">
            <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="icon">🌐</span> Update via GitHub Link
            </span>
          </div>
          <div className="input-row">
            <input 
              type="text" 
              placeholder="https://raw.githubusercontent.com/.../firmware.bin"
              value={gitLink}
              onChange={(e) => setGitLink(e.target.value)}
              disabled={!isOnline}
            />
            <button 
              className={`btn-secondary ${loading.link ? 'loading' : ''}`} 
              onClick={handleUpdateViaLink} 
              disabled={loading.link || !isOnline}
            >
              {loading.link ? (
                <div className="dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              ) : '🚀 Push Link'}
            </button>
          </div>
        </div>

        {/* Panel 3: Direct Binary Uplink */}
        <div className="section">
          <div className="label-container">
            <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="icon">💾</span> Upload .bin File
            </span>
          </div>
          <div 
            className={`dropzone ${file ? 'active' : ''} ${!isOnline ? 'disabled' : ''}`}
            onClick={() => isOnline && fileInputRef.current.click()}
            onDragOver={(e) => { 
                if (!isOnline) return;
                e.preventDefault(); 
                e.currentTarget.classList.add('active'); 
            }}
            onDragLeave={(e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.remove('active'); 
            }}
            onDrop={(e) => {
              if (!isOnline) return;
              e.preventDefault();
              e.currentTarget.classList.remove('active');
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setFile(e.dataTransfer.files[0]);
              }
            }}
            style={{ opacity: isOnline ? 1 : 0.5, cursor: isOnline ? 'pointer' : 'not-allowed' }}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".bin"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <div className="dropzone-icon">📤</div>
            <div className="dropzone-text">
              {file ? file.name : (isOnline ? 'Drop Firmware Binary' : 'Verify State First')}
            </div>
            <div className="dropzone-subtext">Accepts raw .bin files up to 4MB</div>
          </div>

          <button 
            className={`btn-flash ${loading.upload ? 'loading' : ''}`} 
            onClick={handleUploadFile} 
            disabled={!file || loading.upload || !isOnline}
          >
            {loading.upload ? <div className="bounce-ball"></div> : (
              <>
                <span className="icon">📤</span> Initiate Binary Flash <span style={{ marginLeft: '5px' }}>›</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
