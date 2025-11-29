@"
# api/index.py
# Vercel serverless wrapper (placed at repo root /api/)
import os
import sys

# Add the backend folder to path so we can import backend.app
ROOT = os.path.dirname(os.path.dirname(__file__))  # repo root
BACKEND_PATH = os.path.join(ROOT, "backend")
if BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

# import your Flask app (backend/app.py must define `app = Flask(__name__)`)
try:
    from app import app as flask_app
except Exception as e:
    # If import fails, raise for logs (helps debugging on Vercel)
    raise RuntimeError(f"Failed to import backend.app: {e}")

# Optional proxy fix
from werkzeug.middleware.proxy_fix import ProxyFix
flask_app.wsgi_app = ProxyFix(flask_app.wsgi_app)

# Vercel expects callable named `app`
app = flask_app
"@ > api\index.py
