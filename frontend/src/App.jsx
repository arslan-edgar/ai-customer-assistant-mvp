import { useEffect, useState } from "react";
import axios from "axios";

const BACKEND = "http://127.0.0.1:5000";

function App() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [suggestion, setSuggestion] = useState(null); // raw suggestion object from backend
  const [editedReply, setEditedReply] = useState("");   // editable textarea content
  const [loading, setLoading] = useState(false);

  // Dashboard state
  const [metrics, setMetrics] = useState({
    suggestionsShown: 0,
    suggestionsAccepted: 0,
    tagCounts: {},
    responseTimes: []
  });

  // Load tickets on mount
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

  // Periodically refresh server metrics (so dashboard stays consistent)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND}/metrics`, { params: { total_shown: metrics.suggestionsShown }});
        const data = res.data || {};
        setMetrics(prev => ({
          ...prev,
          suggestionsAccepted: Number(data.suggestions_accepted ?? prev.suggestionsAccepted ?? 0),
          tagCounts: data.tag_counts ?? prev.tagCounts,
        }));
      } catch (err) {
        // silent
      }
    }, 8000);
    return () => clearInterval(id);
  }, [metrics.suggestionsShown]);

  const acceptanceRate = metrics.suggestionsShown === 0
    ? 0
    : Math.round((Number(metrics.suggestionsAccepted || 0) / metrics.suggestionsShown) * 100);

  const avgResponseTime = metrics.responseTimes && metrics.responseTimes.length > 0
    ? Math.round(metrics.responseTimes.reduce((a,b)=>a+b,0) / metrics.responseTimes.length)
    : 0;

  // Request an AI suggestion for the selected ticket
  const handleSuggest = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    setSuggestion(null);
    setEditedReply("");

    try {
      const res = await axios.post(`${BACKEND}/suggest`, { ticket_id: selectedTicket.ticket_id });
      const payload = res.data || null;
      setSuggestion(payload);
      // prefill editable textarea with the returned suggestion text
      setEditedReply(payload?.suggestion || "");
      // increment suggestionsShown locally
      setMetrics(prev => ({ ...prev, suggestionsShown: (prev.suggestionsShown || 0) + 1 }));
    } catch (err) {
      console.error("Error getting suggestion:", err);
      alert("Error getting suggestion (see console)");
    } finally {
      setLoading(false);
    }
  };

  // Accept unchanged suggestion (final_reply = suggestion.suggestion)
  const handleAcceptUnchanged = async () => {
    if (!suggestion || !selectedTicket) return;
    const simulatedResponseMinutes = Math.round(5 + Math.random() * 55);

    const payload = {
      ticket_id: selectedTicket.ticket_id,
      action: "accepted",
      tags: suggestion.tags || [],
      response_time_min: simulatedResponseMinutes,
      final_reply: suggestion.suggestion
    };

    try {
      await axios.post(`${BACKEND}/accept`, payload);

      // update local responseTimes
      setMetrics(prev => ({
        ...prev,
        responseTimes: [...(prev.responseTimes || []), simulatedResponseMinutes]
      }));

      // fetch updated metrics from server
      const serverData = await axios.get(`${BACKEND}/metrics`, { params: { total_shown: metrics.suggestionsShown }});
      const d = serverData.data || {};
      setMetrics(prev => ({
        ...prev,
        suggestionsAccepted: Number(d.suggestions_accepted ?? prev.suggestionsAccepted),
        tagCounts: d.tag_counts ?? prev.tagCounts
      }));

      setSuggestion(null);
      setEditedReply("");
    } catch (err) {
      console.error("Error accepting suggestion:", err);
      alert("Failed to record accept. See console.");
    }
  };

  // Accept edited reply (final_reply = editedReply)
  const handleAcceptEdited = async () => {
    if (!suggestion || !selectedTicket) return;
    const simulatedResponseMinutes = Math.round(5 + Math.random() * 55);

    const payload = {
      ticket_id: selectedTicket.ticket_id,
      action: "edited",
      tags: suggestion.tags || [],
      response_time_min: simulatedResponseMinutes,
      final_reply: editedReply
    };

    try {
      await axios.post(`${BACKEND}/accept`, payload);

      setMetrics(prev => ({
        ...prev,
        responseTimes: [...(prev.responseTimes || []), simulatedResponseMinutes]
      }));

      const serverData = await axios.get(`${BACKEND}/metrics`, { params: { total_shown: metrics.suggestionsShown }});
      const d = serverData.data || {};
      setMetrics(prev => ({
        ...prev,
        suggestionsAccepted: Number(d.suggestions_accepted ?? prev.suggestionsAccepted),
        tagCounts: d.tag_counts ?? prev.tagCounts
      }));

      setSuggestion(null);
      setEditedReply("");
    } catch (err) {
      console.error("Error accepting edited reply:", err);
      alert("Failed to record edited accept. See console.");
    }
  };

  // Utility: top tags display
  const topTags = Object.entries(metrics.tagCounts || {})
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)
    .map(([tag, count]) => `${tag} (${count})`)
    .join(", ");

  return (
    <div style={{ display: "flex", padding: "20px", gap: "20px", fontFamily: "sans-serif" }}>
      {/* Ticket list */}
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
            onClick={() => { setSelectedTicket(t); setSuggestion(null); setEditedReply(""); }}
          >
            <strong>{t.subject}</strong>
            <p style={{ fontSize: "0.9rem" }}>{t.body}</p>
          </div>
        ))}
      </div>

      {/* Middle: AI Assistant + edit area */}
      <div style={{ width: "40%" }}>
        <h2>AI Assistant</h2>

        {selectedTicket ? (
          <>
            <h3>{selectedTicket.subject}</h3>
            <p>{selectedTicket.body}</p>

            <div style={{ marginBottom: 12 }}>
              <button onClick={handleSuggest} disabled={loading} style={{ padding: "8px 14px", borderRadius: 8 }}>
                {loading ? "Thinking..." : "Suggest response"}
              </button>

              {suggestion && (
                <>
                  <button onClick={handleAcceptUnchanged} style={{ marginLeft: 10, padding: "8px 10px", borderRadius: 8 }}>
                    Accept Unchanged
                  </button>
                  <button onClick={handleAcceptEdited} style={{ marginLeft: 8, padding: "8px 10px", borderRadius: 8 }}>
                    Accept Edited
                  </button>
                </>
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
            <h3>Suggested Reply (editable)</h3>

            <div style={{ marginBottom: 8 }}>
              <em>Model explanation:</em> <span>{suggestion.explanation}</span>
            </div>

            <textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              style={{
                width: "100%",
                height: "120px",
                padding: "10px",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "6px",
                boxSizing: "border-box"
              }}
            />

            <div style={{ marginTop: 10 }}>
              <div><strong>Confidence:</strong> {Math.round((suggestion.confidence || 0) * 100)}%</div>
              <div><strong>Tags:</strong> {(suggestion.tags || []).map(t => (t.tag || t)).join(", ")}</div>
            </div>
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
          <strong>Accepted (incl. edited):</strong> {metrics.suggestionsAccepted ?? 0}
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
          (Metrics persisted in backend/accepted_log.json)
        </div>
      </div>
    </div>
  );
}

export default App;
