import { useEffect, useState } from "react";
import axios from "axios";

/**
 * App.jsx
 * Full frontend for the MVP:
 * - Loads tickets from Flask backend (/tickets)
 * - Calls /suggest to get a suggested reply
 * - Posts accepts to /accept and fetches metrics from /metrics
 * - Shows a small ops dashboard (suggestions shown, accepted, acceptance rate, avg response time, top tags)
 *
 * Notes:
 * - Backend assumed at http://127.0.0.1:5000
 * - This is a simple demo; in production you'd handle auth, errors, retries, and input validation.
 */

const BACKEND = "http://127.0.0.1:5000";

function App() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  // Dashboard state tracked locally and also fetched from backend
  const [metrics, setMetrics] = useState({
    suggestionsShown: 0,
    suggestionsAccepted: 0,
    tagCounts: {},       // { tagName: count }
    responseTimes: []    // list of minutes (simulated or from backend)
  });

  // -- Load tickets on mount
  useEffect(() => {
    async function loadTickets() {
      try {
        const res = await axios.get(`${BACKEND}/tickets`);
        setTickets(res.data || []);
      } catch (err) {
        console.error("Failed to load tickets:", err);
      }
    }
    loadTickets();
  }, []);

  // -- Fetch metrics from backend (used after accepts and periodically)
  const fetchMetricsFromServer = async (totalShown = metrics.suggestionsShown) => {
    try {
      const res = await axios.get(`${BACKEND}/metrics`, {
        params: { total_shown: totalShown }
      });
      const data = res.data || {};
      setMetrics(prev => ({
        ...prev,
        // prefer server values for accepted counts and tagCounts
        suggestionsAccepted: Number(data.suggestions_accepted ?? prev.suggestionsAccepted ?? 0),
        // server tag_counts is an object {tag: count}
        tagCounts: data.tag_counts ?? prev.tagCounts,
        // keep responseTimes locally (we append simulated times on accept),
        // but update avg/time info when available from server (we store responseTimes to compute avg locally)
        // If server provides avg_response_time_min we won't replace the array, but UI reads computed avg.
        // Keep suggestionsShown as local count (frontend increments when suggestion shown)
      }));
      return data;
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      return null;
    }
  };

  // Periodically poll metrics (so dashboard shows recent backend state)
  useEffect(() => {
    const id = setInterval(() => {
      fetchMetricsFromServer();
    }, 8000); // every 8s
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // Compute acceptance rate and average response time for UI display
  const acceptanceRate = metrics.suggestionsShown === 0
    ? 0
    : Math.round((Number(metrics.suggestionsAccepted || 0) / metrics.suggestionsShown) * 100);

  const avgResponseTime = metrics.responseTimes && metrics.responseTimes.length > 0
    ? Math.round(metrics.responseTimes.reduce((a,b) => a + b, 0) / metrics.responseTimes.length)
    : 0;

  // Suggest handler -> calls backend /suggest and updates UI and suggestionsShown
  const handleSuggest = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    setSuggestion(null);

    try {
      const res = await axios.post(`${BACKEND}/suggest`, {
        ticket_id: selectedTicket.ticket_id
      });
      const payload = res.data;
      setSuggestion(payload || null);

      // increment local suggestionsShown
      setMetrics(prev => ({ ...prev, suggestionsShown: (prev.suggestionsShown || 0) + 1 }));
    } catch (err) {
      console.error("Error getting suggestion:", err);
      alert("Error getting suggestion (see console).");
    } finally {
      setLoading(false);
    }
  };

  // Accept handler -> POST to backend /accept, then refresh metrics from backend
  const handleAccept = async () => {
    if (!suggestion || !selectedTicket) return;

    // simulate a response time in minutes (5-60)
    const simulatedResponseMinutes = Math.round(5 + Math.random() * 55);

    const payload = {
      ticket_id: selectedTicket.ticket_id,
      action: "accepted",
      tags: suggestion.tags || [],
      response_time_min: simulatedResponseMinutes
    };

    try {
      await axios.post(`${BACKEND}/accept`, payload);

      // Update local responseTimes with the simulated time
      setMetrics(prev => ({
        ...prev,
        responseTimes: [...(prev.responseTimes || []), simulatedResponseMinutes]
      }));

      // After accept, fetch server metrics (pass current suggestionsShown so server can compute acceptance rate)
      const serverData = await fetchMetricsFromServer(metrics.suggestionsShown);

      // merge server tag counts into local tagCounts for display if returned
      if (serverData && serverData.tag_counts) {
        setMetrics(prev => ({
          ...prev,
          tagCounts: serverData.tag_counts
        }));
      }

      // clear suggestion (move to next ticket)
      setSuggestion(null);
    } catch (err) {
      console.error("Failed to send accept:", err);
      alert("Failed to record accept. See console for details.");
    }
  };

  // Small helper to show top tags from metrics.tagCounts
  const topTags = Object.entries(metrics.tagCounts || {})
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => `${tag} (${count})`)
    .join(", ");

  return (
    <div style={{ display: "flex", padding: "20px", gap: "20px", fontFamily: "sans-serif" }}>
      {/* Left: Ticket list */}
      <div style={{ width: "30%", borderRight: "1px solid #ddd", paddingRight: "20px" }}>
        <h2>Tickets</h2>
        {tickets.length === 0 && <p>Loading tickets...</p>}
        {tickets.map(t => (
          <div
            key={t.ticket_id}
            style={{
              padding: "10px",
              marginBottom: "10px",
              border: "1px solid #ccc",
              cursor: "pointer",
              background: selectedTicket?.ticket_id === t.ticket_id ? "#e8f4ff" : "#ffffff",
              color: "#222"
            }}
            onClick={() => { setSelectedTicket(t); setSuggestion(null); }}
          >
            <strong>{t.subject}</strong>
            <p style={{ fontSize: "0.9rem" }}>{t.body}</p>
          </div>
        ))}
      </div>

      {/* Middle: Ticket + Suggest button */}
      <div style={{ width: "40%" }}>
        <h2>AI Assistant</h2>

        {selectedTicket ? (
          <>
            <h3>{selectedTicket.subject}</h3>
            <p>{selectedTicket.body}</p>

            <div style={{ marginBottom: 12 }}>
              <button
                onClick={handleSuggest}
                disabled={loading}
                style={{ padding: "8px 14px", borderRadius: 8 }}
              >
                {loading ? "Thinking..." : "Suggest response"}
              </button>

              {suggestion && (
                <button
                  onClick={handleAccept}
                  style={{ marginLeft: 10, padding: "8px 14px", borderRadius: 8 }}
                >
                  Accept
                </button>
              )}
            </div>
          </>
        ) : (
          <p>Select a ticket on the left to get a suggestion.</p>
        )}

        {suggestion && (
          <div style={{
            marginTop: "20px",
            padding: "10px",
            border: "1px solid #ccc",
            background: "#ffffff",
            color: "#222"
          }}>
            <h3>Suggested Reply</h3>
            <p>{suggestion.suggestion}</p>
            <p><strong>Explanation:</strong> {suggestion.explanation}</p>
            <p><strong>Confidence:</strong> {Math.round((suggestion.confidence || 0) * 100)}%</p>
            <p><strong>Tags:</strong> {(suggestion.tags || []).map(t => (t.tag || t)).join(", ")}</p>
          </div>
        )}
      </div>

      {/* Right: Dashboard */}
      <div style={{ width: "30%" }}>
        <h2>Ops Dashboard</h2>

        <div style={{ marginBottom: 10 }}>
          <strong>Suggestions shown:</strong> {metrics.suggestionsShown}
        </div>

        <div style={{ marginBottom: 10 }}>
          <strong>Accepted:</strong> {metrics.suggestionsAccepted ?? 0}
        </div>

        <div style={{ marginBottom: 10 }}>
          <strong>Acceptance rate:</strong> {acceptanceRate}%
        </div>

        <div style={{ marginBottom: 10 }}>
          <strong>Avg response time:</strong> {avgResponseTime} mins
        </div>

        <div style={{ marginBottom: 10 }}>
          <strong>Top tags:</strong> {topTags || "-"}
        </div>

        <hr />

        <div style={{ fontSize: 12, color: "#666" }}>
          (Metrics are persisted in backend accepted_log.json)
        </div>
      </div>
    </div>
  );
}

export default App;
