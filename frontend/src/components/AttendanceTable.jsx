const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

export default function AttendanceTable({ records = [] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <p className="section-label">Live Log</p>
          <h3 className="text-lg font-semibold text-slate-900">
            Attendance Records
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {records.length} entries
        </span>
      </div>

      {records.length === 0 ? (
        <div className="px-5 py-10 text-sm text-slate-500">
          No attendance has been marked yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(255,251,235,0.88))] text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Captured At</th>
                <th className="px-5 py-3">Match Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-amber-50/40">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">{record.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      Student
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDateTime(record.time)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {typeof record.similarity === "number"
                        ? `${(record.similarity * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
