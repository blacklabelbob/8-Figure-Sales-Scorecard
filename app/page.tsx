import ScorecardApp from '@/components/ScorecardApp';

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", justifyContent: "center" }}>
      <main style={{ width: "100%", maxWidth: 448, position: "relative" }}>
        <ScorecardApp />
      </main>
    </div>
  );
}
