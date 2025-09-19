import React, { useState } from 'react';
import CameraFeed from '../components/CameraFeed';
import { registerUser } from '../services/api';

export default function Register() {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [cameraOn, setCameraOn] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name || !file) {
      setMsg('Please provide name and photo');
      return;
    }

    try {
      const res = await registerUser(name, file);
      setMsg(res.message || 'User registered successfully');
      setName('');
      setFile(null);
    } catch (err) {
      setMsg('Error: ' + (err.message || 'Failed to register user'));
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Register User</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Manual file upload */}
        <div>
          <form onSubmit={submit} className="bg-white p-4 rounded shadow">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full p-2 border mb-2 rounded"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
              className="mb-2 w-full"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Register
            </button>
            <p className="mt-2 text-sm text-gray-700">{msg}</p>
          </form>
        </div>

        {/* Camera capture */}
        <div>
          <h3 className="font-medium mb-2">Or capture from camera</h3>
          <CameraFeed
            setCameraOn={setCameraOn}
            onCapture={async (blob) => {
              const fileObj = new File([blob], 'capture.jpg', { type: blob.type });
              setFile(fileObj);
              setMsg('Captured photo ready — click Register to save');
            }}
          />
          <p className="mt-2 text-sm text-gray-700">
            {cameraOn
              ? '✅ Camera is on. Capture a photo when ready.'
              : '❌ Camera is off — click Start Camera to begin.'}
          </p>
        </div>
      </div>
    </div>
  );
}
