# AI Customer Support Assistant + Ops Dashboard — MVP

**One-line:** Single-page demo that suggests customer-support replies (LLM or fake in demo), auto-tags tickets, and shows an ops dashboard with live metrics.

---

## Problem
Support agents spend time crafting repetitive responses and managers lack a simple KPI view for suggestion usefulness. This MVP demonstrates a lightweight AI assistant + small ops dashboard to speed replies and measure impact.

---

## Demo / Screenshots
- Live (local) demo: run locally (see How to run)
- Demo screenshot (local path): `/mnt/data/4288293b-55ce-4304-9b0a-d0a9d6c542c3.png`
- Place screenshots in `assets/` and reference them in README for GitHub.

![App screenshot](/mnt/data/4288293b-55ce-4304-9b0a-d0a9d6c542c3.png)

---

## What it does
- Load demo tickets from backend (Flask).
- Suggest replies (fake LLM by default; optionally hook up real LLMs).
- Accept / Edit suggestions and persist accept events.
- Dashboard: suggestions shown, accepted, acceptance rate, avg response time, top tags.
- Persistent accepted events stored in `backend/accepted_log.json`.

---

## Tech stack
- Frontend: React (Vite)
- Backend: Flask (Python)
- AI: placeholder LLM (fake) — option to add Ollama or HuggingFace later
- Storage: JSON file (`backend/accepted_log.json`) — easy-to-replace with SQLite
- Deploy: Vercel (frontend) + Render (backend) or single Render Flask app

---

## Repo Structure
