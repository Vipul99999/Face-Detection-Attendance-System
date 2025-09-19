import React, { useEffect, useState, useRef } from 'react';
import CameraFeed from '../components/CameraFeed';
import AttendanceTable from '../components/AttendanceTable';
import { captureImage, getAttendance } from '../services/api';

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const messageTimeout = useRef();

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const res = await getAttendance();
      setRecords(res.records || []);
    } catch (err) {
      console.error(err);
      setMessage('Error loading attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (!cameraOn) return; // ⛔ Skip polling if camera is off

  loadAttendance(); // Initial load when camera turns on

  const interval = setInterval(() => {
    if (cameraOn) loadAttendance(); // ✅ Only poll if camera is active
  }, 5000);

  return () => clearInterval(interval);
}, [cameraOn]); // 🔁 Re-run effect when cameraOn changes

  const onCapture = async (blob) => {
    setMessage('Sending...');
    if (messageTimeout.current) clearTimeout(messageTimeout.current);

    try {
      const file = new File([blob], 'capture.jpg', { type: blob.type });
      const res = await captureImage(file);

      if (res.status === 'success' || res.attendance_marked) {
        setMessage(`Marked attendance for ${res.user}`);
        loadAttendance();
      } else {
        setMessage(res.message || 'Face not recognized');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error capturing image');
    }

    messageTimeout.current = setTimeout(() => setMessage(''), 2500);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Camera & capture */}
        <div>
          <CameraFeed onCapture={onCapture} setCameraOn={setCameraOn} />
          <p className="mt-2 text-sm text-gray-700">
            {cameraOn ? '✅ Camera is active' : '❌ Camera is off — click Start'}
          </p>
          {loading && <p className="text-gray-500 text-sm">Loading attendance...</p>}
          <p className="mt-1 text-sm text-gray-700">{message}</p>
        </div>

        {/* Attendance table */}
        <div>
          {records.length > 0 ? (
            <AttendanceTable records={records} />
          ) : (
            <p className="text-gray-500">No attendance records yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
