import { useEffect, useState } from "react";
import axios from "axios";

/**
 * Modern hybrid UI (light main + dark sidebars)
 * Works with your existing backend endpoints:
 *  - GET  /tickets
 *  - POST /suggest   { ticket_id }
 *  - POST /accept    { ticket_id, action, tags, response_time_min, final_reply }
 *  - GET  /metrics   ?total_shown=...
 *
 * Make sure VITE_BACKEND_URL is set for production or local fallback is used.
 */

const BACKEND = import.meta.env.VITE_BACKEND_URL || "/api";

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [editedReply, setEditedReply] = useState("");
  const [loading, setLoading] = useState(false);

  const [metrics, setMetrics] = useState({
    suggestionsShown: 0,
    suggestionsAccepted: 0,
    tagCounts: {},
    responseTimes: []
  });

  // load tickets
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${BACKEND}/tickets`);
        setTickets(res.data || []);
      } catch (err) {
        console.error("Failed to load tickets:", err);
      }
    })();
  }, []);

  // periodic metrics refresh
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await axios.get(`${BACKEND}/metrics`, {
          params: { total_shown: metrics.suggestionsShown }
        });
        const data = res.data || {};
        setMetrics(prev => ({
          ...prev,
          suggestionsAccepted: Number(data.suggestions_accepted ?? prev.suggestionsAccepted),
          tagCounts: data.tag_counts ?? prev.tagCounts,
        }));
      } catch (err) {
        // ignore polling errors
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

  // Suggest handler
  const handleSuggest = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    setSuggestion(null);
    setEditedReply("");
    try {
      const res = await axios.post(`${BACKEND}/suggest`, { ticket_id: selectedTicket.ticket_id });
      const payload = res.data || null;
      setSuggestion(payload);
      setEditedReply(payload?.suggestion || "");
      setMetrics(prev => ({ ...prev, suggestionsShown: (prev.suggestionsShown || 0) + 1 }));
    } catch (err) {
      console.error("Error getting suggestion:", err);
      alert("Error getting suggestion (see console)");
    } finally {
      setLoading(false);
    }
  };

  // shared accept poster
  const postAccept = async (actionType, finalText) => {
    if (!suggestion || !selectedTicket) return;
    const simulatedResponseMinutes = Math.round(5 + Math.random() * 55);
    const payload = {
      ticket_id: selectedTicket.ticket_id,
      action: actionType,
      tags: suggestion.tags || [],
      response_time_min: simulatedResponseMinutes,
      final_reply: finalText
    };

    try {
      await axios.post(`${BACKEND}/accept`, payload);

      // update local response times
      setMetrics(prev => ({
        ...prev,
        responseTimes: [...(prev.responseTimes || []), simulatedResponseMinutes]
      }));

      // refresh server metrics
      const server = await axios.get(`${BACKEND}/metrics`, { params: { total_shown: metrics.suggestionsShown }});
      const d = server.data || {};
      setMetrics(prev => ({
        ...prev,
        suggestionsAccepted: Number(d.suggestions_accepted ?? prev.suggestionsAccepted),
        tagCounts: d.tag_counts ?? prev.tagCounts
      }));

      // clear suggestion to mimic moving on
      setSuggestion(null);
      setEditedReply("");
    } catch (err) {
      console.error("accept error", err);
      alert("Failed to record accept (see console).");
    }
  };

  // helper top tags
  const topTags = Object.entries(metrics.tagCounts || {})
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)
    .map(([tag, count]) => `${tag} (${count})`)
    .join(", ");

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Left - Dark Sidebar */}
      <aside className="w-80 bg-slate-900 text-slate-100 shadow-lg flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-semibold">TAD Assist</h1>
          <p className="text-xs text-slate-400 mt-1">AI Customer Assistant · MVP</p>
        </div>

        <div className="p-4">
          <div className="text-xs uppercase text-slate-400 mb-3">Tickets</div>
          <div className="space-y-3 max-h-[62vh] overflow-auto pr-2">
            {tickets.map(t => (
              <div
                key={t.ticket_id}
                onClick={() => { setSelectedTicket(t); setSuggestion(null); setEditedReply(""); }}
                className={`cursor-pointer p-3 rounded-xl transition-colors border ${
                  selectedTicket?.ticket_id === t.ticket_id
                    ? "bg-slate-800 border-slate-700 shadow-inner"
                    : "bg-slate-900 border-slate-800 hover:bg-slate-800/60"
                }`}
              >
                <div className="font-medium text-sm text-slate-100">{t.subject}</div>
                <div className="text-xs text-slate-400 line-clamp-2 mt-1">{t.body}</div>
              </div>
            ))}

            {tickets.length === 0 && <div className="text-sm text-slate-400">No tickets</div>}
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">Status</div>
          <div className="mt-2 text-sm">
            <span className="inline-block bg-emerald-500 text-slate-900 px-2 py-0.5 rounded-full text-xs mr-2">Live</span>
            <span className="text-xs text-slate-400">Local demo</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">
          {/* Center column */}
          <section className="col-span-8 bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">AI Assistant</h2>
                <p className="text-sm text-slate-500">Generate a suggested reply, edit it, and accept.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSuggest}
                  disabled={!selectedTicket || loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {loading ? "Thinking..." : "Suggest response"}
                </button>
              </div>
            </div>

            {!selectedTicket ? (
              <div className="mt-8 text-slate-500">Select a ticket from the left to start.</div>
            ) : (
              <>
                <div className="mt-6">
                  <div className="text-sm text-slate-600">Ticket</div>
                  <div className="mt-2 p-4 border rounded-lg bg-slate-50 text-slate-800">{selectedTicket.body}</div>
                </div>

                {suggestion ? (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium">Suggested Reply</h3>
                        <p className="text-xs text-slate-500 mt-1">Model explanation: <span className="text-slate-600">{suggestion.explanation}</span></p>
                      </div>
                      <div className="text-xs text-slate-500">Confidence: <span className="font-medium text-slate-700">{Math.round((suggestion.confidence||0)*100)}%</span></div>
                    </div>

                    <textarea
                      value={editedReply}
                      onChange={e => setEditedReply(e.target.value)}
                      className="w-full min-h-[140px] p-4 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-200 text-slate-800"
                    />

                    <div className="flex items-center gap-3">
                      <button onClick={() => postAccept("accepted", suggestion.suggestion)}
                              className="px-3 py-2 bg-slate-800 text-white rounded-md hover:opacity-95">Accept Unchanged</button>
                      <button onClick={() => postAccept("edited", editedReply)}
                              className="px-3 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-500">Accept Edited</button>

                      <div className="ml-auto text-sm text-slate-500">
                        Tags: <span className="text-slate-700 font-medium">{(suggestion.tags||[]).map(t => (t.tag||t)).join(", ") || "-"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 text-slate-500">No suggestion yet. Click “Suggest response”.</div>
                )}
              </>
            )}
          </section>

          {/* Right - Dark KPI column */}
          <aside className="col-span-4 bg-slate-800 text-slate-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Ops Dashboard</h3>

            <div className="mt-4 grid gap-3">
              <div className="p-3 bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-300">Suggestions shown</div>
                <div className="text-xl font-semibold">{metrics.suggestionsShown}</div>
              </div>

              <div className="p-3 bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-300">Accepted (incl. edited)</div>
                <div className="text-xl font-semibold">{metrics.suggestionsAccepted ?? 0}</div>
              </div>

              <div className="p-3 bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-300">Acceptance rate</div>
                <div className="text-xl font-semibold">{acceptanceRate}%</div>
              </div>

              <div className="p-3 bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-300">Avg response time</div>
                <div className="text-xl font-semibold">{avgResponseTime} mins</div>
              </div>

              <div className="p-3 bg-slate-700 rounded-lg">
                <div className="text-xs text-slate-300">Top tags</div>
                <div className="text-sm font-medium text-slate-100">{topTags || "-"}</div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-400">
              Metrics persisted in <code className="text-slate-300">backend/accepted_log.json</code>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
