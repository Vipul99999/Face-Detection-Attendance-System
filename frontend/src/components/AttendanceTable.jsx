import React from "react";

export default function AttendanceTable({ records = [] }) {
  return (
    <div className="bg-white shadow rounded p-4 mt-6 overflow-x-auto">
      <h2 className="text-lg font-semibold mb-2">Attendance Records</h2>

      {records.length === 0 ? (
        <p className="text-gray-500 text-sm">No attendance records yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="pb-2 pr-4">#</th>
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
          {records.map((r, i) => {
              let utcDate;

              // Parse the time string as UTC
              if (r.time.endsWith('Z') || r.time.includes('+')) {
                // Already offset-aware
                utcDate = new Date(r.time);
              } else {
                // Offset-naive, treat as UTC
                const [datePart, timePart] = r.time.split('T');
                const isoUTC = `${datePart}T${timePart}Z`; // Append Z to force UTC
                utcDate = new Date(isoUTC);
              }

              const indiaTime = utcDate.toLocaleString('en-IN', {
                dateStyle: 'short',
                timeStyle: 'medium',
                timeZone: 'Asia/Kolkata', // Converts UTC → IST
              });

              return (
    <tr
      key={i}
      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
    >
      <td className="py-2 pr-4">{i + 1}</td>
      <td className="py-2 pr-4">{r.name}</td>
      <td className="py-2">{indiaTime}</td>
    </tr>
  );
})}

          </tbody>
        </table>
      )}
    </div>
  );
}
