export default function About() {
  const sections = [
    {
      title: "What it does",
      points: [
        "Captures attendance through face verification from a live camera feed.",
        "Supports anti-spoof checks and optional liveness challenges.",
        "Provides an admin workspace for registration, monitoring, and exports.",
      ],
    },
    {
      title: "Architecture",
      points: [
        "Frontend: React + Vite + Tailwind CSS.",
        "Backend: FastAPI with InsightFace-based matching.",
        "Storage: SQLite with encrypted biometric embeddings.",
      ],
    },
    {
      title: "Operational notes",
      points: [
        "Public scanner flow does not require student sign-in.",
        "Admin actions are protected with token-based authentication.",
        "Designed for local demos and cloud deployment via container hosts.",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="section-label">Project Overview</p>
        <h2 className="mt-2 font-['Sora'] text-3xl font-bold text-slate-950 md:text-4xl">
          Face Attendance Platform
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          A full-stack attendance system focused on fast scanning, secure biometric processing, and clear
          administration workflows.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <article key={section.title} className="panel p-5">
            <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {section.points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
