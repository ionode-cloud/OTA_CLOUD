import React, { useState } from 'react';
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
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

function App() {
  const [deviceId, setDeviceId] = useState('');
  const [deviceStatus, setDeviceStatus] = useState(null); // 'online', 'offline', or null
  const [gitLink, setGitLink] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState({
    check: false,
    link: false,
    upload: false
  });

  const handleCheckDevice = async () => {
    if (!deviceId) {
      Swal.fire({
        icon: 'warning',
        title: 'Oops...',
        text: 'Please enter a Device ID!',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    setLoading(prev => ({ ...prev, check: true }));

    try {
      const response = await axios.get(`${API_BASE_URL}/check-device?device=${deviceId}`);
      if (response.data.online) {
        setDeviceStatus('online');
        Toast.fire({
          icon: 'success',
          title: 'Device is Online'
        });
      } else {
        setDeviceStatus('offline');
        Toast.fire({
          icon: 'error',
          title: 'Device is Offline'
        });
      }
    } catch (error) {
      setDeviceStatus(null);
      Swal.fire({
        icon: 'error',
        title: 'Connection Error',
        text: 'Could not reach the server.',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setLoading(prev => ({ ...prev, check: false }));
    }
  };

  const handleUpdateViaLink = async () => {
    if (!gitLink) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Link',
        text: 'Please paste the firmware .bin URL.',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    setLoading(prev => ({ ...prev, link: true }));

    try {
      const response = await axios.post(`${API_BASE_URL}/update-link/${deviceId}`, { url: gitLink });
      Swal.fire({
        icon: 'success',
        title: 'Update Triggered',
        text: response.data,
        confirmButtonColor: '#10b981'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: 'Check the URL and try again.',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setLoading(prev => ({ ...prev, link: false }));
    }
  };

  const handleUploadFile = async () => {
    if (!file) {
      Swal.fire({
        icon: 'warning',
        title: 'No File',
        text: 'Please select a .bin firmware file.',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    setLoading(prev => ({ ...prev, upload: true }));

    const formData = new FormData();
    formData.append("firmware", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload/${deviceId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({
        icon: 'success',
        title: 'Upload Successful',
        text: response.data,
        confirmButtonColor: '#10b981'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: 'There was an error uploading the file.',
        confirmButtonColor: '#10b981'
      });
    } finally {
      setLoading(prev => ({ ...prev, upload: false }));
    }
  };

  const isOnline = deviceStatus === 'online';

  return (
    <div className="container">
      <h2>OTA Control Center</h2>
      
      <h3>Device Authentication</h3>
      <input 
        type="text" 
        placeholder="Enter device ID (e.g. DEVICE_001)"
        value={deviceId}
        onChange={(e) => setDeviceId(e.target.value)}
      />
      <button 
        onClick={handleCheckDevice} 
        disabled={loading.check}
      >
        {loading.check ? <div className="spinner"></div> : '🔍 Check Connectivity'}
      </button>

      <div style={{ textAlign: 'center', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {deviceStatus && (
          <div className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`}>
            <div className="ping-indicator"></div>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
        )}
      </div>

      <div style={{ transition: 'opacity 0.3s ease' }}>
        <h3>Update via GitHub Link</h3>
        <input 
          type="text" 
          placeholder="Paste firmware .bin URL here"
          value={gitLink}
          onChange={(e) => setGitLink(e.target.value)}
        />
        <button 
          onClick={handleUpdateViaLink} 
          disabled={loading.link}
        >
          {loading.link ? <div className="spinner"></div> : '🚀 Deploy from Link'}
        </button>

        <h3>Upload .bin File</h3>
        <input 
          type="file" 
          accept=".bin"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button 
          onClick={handleUploadFile} 
          disabled={loading.upload}
        >
          {loading.upload ? <div className="spinner"></div> : '📤 Upload & Deploy'}
        </button>
      </div>
    </div>
  );
}

export default App;
