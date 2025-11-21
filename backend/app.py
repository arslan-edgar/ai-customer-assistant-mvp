# backend/app.py
import json
import os
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

ROOT = os.path.dirname(__file__)
LOG_PATH = os.path.join(ROOT, "accepted_log.json")

app = Flask(__name__)
CORS(app)

# In-memory demo tickets (same as before)
tickets = [
    {
        "ticket_id": "tkt_001",
        "subject": "Internet not working",
        "body": "My internet has been down since 7am. Please help.",
        "status": "open"
    },
    {
        "ticket_id": "tkt_002",
        "subject": "Double charged on my bill",
        "body": "I think I was billed twice for last month.",
        "status": "open"
    }
]

def load_log():
    if not os.path.exists(LOG_PATH):
        return []
    try:
        with open(LOG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_log(entries):
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

@app.route("/", methods=["GET"])
def index():
    return jsonify({"message": "Flask backend is alive. Use /tickets, /suggest, /accept, /metrics endpoints."})

@app.route("/tickets", methods=["GET"])
def get_tickets():
    return jsonify(tickets)

@app.route("/suggest", methods=["POST"])
def suggest_reply():
    data = request.json or {}
    ticket_id = data.get("ticket_id")
    ticket = next((t for t in tickets if t["ticket_id"] == ticket_id), None)

    if not ticket:
        return jsonify({"error": "Ticket not found"}), 404

    # FAKE suggestion for now
    suggestion = f"Hi — we're looking into your issue: '{ticket['subject']}'. We'll update you shortly."
    explanation = "Sample suggestion (replace with real LLM later)."
    confidence = 0.75
    tags = [
        {"tag": "support", "score": 0.9},
        {"tag": "billing", "score": 0.4}
    ]

    return jsonify({
        "ticket_id": ticket_id,
        "suggestion": suggestion,
        "explanation": explanation,
        "confidence": confidence,
        "tags": tags
    })

@app.route("/accept", methods=["POST"])
def accept():
    """
    Expected body:
    { "ticket_id": "...", "action": "accepted" | "edited", "tags": [{"tag":"x","score":0.8}, ...], "response_time_min": 12 }
    """
    payload = request.json or {}
    ticket_id = payload.get("ticket_id")
    action = payload.get("action", "accepted")
    tags = payload.get("tags", [])
    response_time = payload.get("response_time_min")  # optional

    entry = {
        "ticket_id": ticket_id,
        "action": action,
        "tags": tags,
        "response_time_min": response_time,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    log = load_log()
    log.append(entry)
    save_log(log)

    return jsonify({"ok": True, "entry": entry})

@app.route("/metrics", methods=["GET"])
def metrics():
    """
    Returns computed metrics from the accepted_log.json plus in-memory tickets/suggestions counts.
    """
    log = load_log()

    total_shown = int(request.args.get("total_shown", 0))  # frontend can pass suggestionsShown so remote can combine
    suggestions_accepted = sum(1 for e in log if e.get("action") == "accepted")
    # compute tag counts
    tag_counts = {}
    for e in log:
        for t in e.get("tags", []):
            tag_name = t.get("tag") if isinstance(t, dict) else str(t)
            tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1

    # average response time (ignore None)
    times = [e.get("response_time_min") for e in log if isinstance(e.get("response_time_min"), (int, float))]
    avg_response_time = round(sum(times)/len(times), 1) if times else 0

    acceptance_rate = round((suggestions_accepted / total_shown) * 100, 1) if total_shown > 0 else 0

    return jsonify({
        "suggestions_shown": total_shown,
        "suggestions_accepted": suggestions_accepted,
        "acceptance_rate_percent": acceptance_rate,
        "avg_response_time_min": avg_response_time,
        "tag_counts": tag_counts,
        "log_length": len(log)
    })

if __name__ == "__main__":
    # Ensure log file exists
    if not os.path.exists(LOG_PATH):
        save_log([])
    app.run(debug=True, host="127.0.0.1", port=5000)
