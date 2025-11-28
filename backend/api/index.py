# backend/api/index.py
# Vercel Python Serverless wrapper for existing Flask app in backend/app.py

import os
import sys

# Ensure parent backend folder is importable
ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT)

# Import your Flask app (app.py must define `app = Flask(...)`)
from app import app as flask_app

# If behind proxies, optional:
from werkzeug.middleware.proxy_fix import ProxyFix
flask_app.wsgi_app = ProxyFix(flask_app.wsgi_app)

# Vercel expects a callable named `app`
app = flask_app
