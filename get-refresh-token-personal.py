"""
Gmail OAuth2 Refresh Token Generator — PERSONAL ACCOUNT (philippelobokung@gmail.com)

Run this once to mint a refresh token for the personal Gmail account.
Sister script to get-refresh-token.py (which is for the work account).

Differences vs. the work-account script:
  * Port 9877 (work uses 9876) — no collision if both running
  * Auto-loads GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET from .env.local
  * Outputs as GMAIL_REFRESH_TOKEN_PERSONAL (matches gmail.ts expectation)
  * Forces the Google account chooser so you don't accidentally re-auth the work account

Prereq (one-time):
  In Google Cloud Console for project "gen-lang-client-0970726892" (nano banan):
  OAuth consent screen → if app is in "Testing", add philippelobokung@gmail.com
  to the Test users list. If app is "In production", no action needed.

Run:
  python get-refresh-token-personal.py

When the browser opens:
  ↳ Pick "Use another account" if needed
  ↳ Sign in with philippelobokung@gmail.com (NOT the work account)
  ↳ Approve the gmail.modify scope

Output:
  GMAIL_REFRESH_TOKEN_PERSONAL=1//... (paste this into Vercel)
"""

import http.server
import urllib.parse
import webbrowser
import json
import sys
import os
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests


# ─────────────────────────── Load credentials ───────────────────────────

ENV_PATH = Path(__file__).parent / ".env.local"


def load_env(path: Path) -> dict:
    """Tiny .env parser — no python-dotenv dependency needed."""
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


env = load_env(ENV_PATH)
CLIENT_ID = env.get("GMAIL_CLIENT_ID") or os.environ.get("GMAIL_CLIENT_ID")
CLIENT_SECRET = env.get("GMAIL_CLIENT_SECRET") or os.environ.get("GMAIL_CLIENT_SECRET")

if not CLIENT_ID:
    CLIENT_ID = input("GMAIL_CLIENT_ID not found in .env.local — paste it: ").strip()
if not CLIENT_SECRET:
    CLIENT_SECRET = input("GMAIL_CLIENT_SECRET not found in .env.local — paste it: ").strip()

REDIRECT_URI = "http://localhost:9877"
SCOPE = "https://www.googleapis.com/auth/gmail.modify"
LOGIN_HINT = "philippelobokung@gmail.com"


# ─────────────────────────── IMPORTANT: redirect URI ───────────────────────────
# The OAuth client must allow http://localhost:9877 as an authorised redirect URI.
# In Google Cloud Console → APIs & Services → Credentials → (your OAuth 2.0 Client)
# add http://localhost:9877 to "Authorised redirect URIs" if it's not already there.
# (The work-account script uses :9876, which is already configured.)
# ────────────────────────────────────────────────────────────────────────────────


auth_url = (
    "https://accounts.google.com/o/oauth2/v2/auth?"
    + urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",
            "prompt": "consent select_account",
            "login_hint": LOGIN_HINT,
        }
    )
)

print("\n──────────────────────────────────────────────────────────────")
print(" Personal Gmail refresh token — OAuth flow")
print("──────────────────────────────────────────────────────────────")
print(f" Redirect URI : {REDIRECT_URI}")
print(f" Account hint : {LOGIN_HINT}")
print(f" Scope        : {SCOPE}")
print("──────────────────────────────────────────────────────────────")
print("\nOpening browser. SIGN IN WITH philippelobokung@gmail.com — not the work account.\n")

webbrowser.open(auth_url)


# ─────────────────────────── Catch the callback ───────────────────────────

auth_code = None
auth_error = None


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code, auth_error
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                b"<!doctype html><meta charset='utf-8'>"
                b"<h1 style='font-family:system-ui'>Authorization successful</h1>"
                b"<p style='font-family:system-ui'>You can close this tab and return to the terminal.</p>"
            )
        else:
            auth_error = params.get("error", ["unknown"])[0]
            self.send_response(400)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                f"<h1 style='font-family:system-ui'>Authorization failed: {auth_error}</h1>".encode()
            )

    def log_message(self, format, *args):
        pass  # silence the default access log


server = http.server.HTTPServer(("localhost", 9877), CallbackHandler)
print("Waiting for authorization callback on http://localhost:9877 ...")
server.handle_request()

if auth_error:
    print(f"\nERROR: Google returned error '{auth_error}'.")
    print("Common causes:")
    print("  • App is in 'Testing' mode and philippelobokung@gmail.com is not a test user")
    print("  • Redirect URI http://localhost:9877 is not registered on the OAuth client")
    sys.exit(1)

if not auth_code:
    print("ERROR: No authorization code received.")
    sys.exit(1)


# ─────────────────────────── Exchange for tokens ───────────────────────────

print("\nGot auth code. Exchanging for tokens...")

token_response = requests.post(
    "https://oauth2.googleapis.com/token",
    data={
        "code": auth_code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    },
    timeout=15,
)

tokens = token_response.json()

if "refresh_token" in tokens:
    refresh = tokens["refresh_token"]
    print("\n" + "=" * 64)
    print(" SUCCESS — copy the line below into Vercel env vars:")
    print("=" * 64)
    print(f"\nGMAIL_REFRESH_TOKEN_PERSONAL={refresh}\n")
    print("=" * 64)
    print(" Vercel: Project → Settings → Environment Variables → Add")
    print("   Name  = GMAIL_REFRESH_TOKEN_PERSONAL")
    print("   Value = (the token above)")
    print("   Envs  = Production, Preview, Development (tick all 3)")
    print(" Then redeploy or wait for next cron run (9 AM UTC).")
    print("=" * 64)

    # Also append to .env.local so local dev gets it (idempotent)
    if ENV_PATH.exists():
        existing = ENV_PATH.read_text(encoding="utf-8")
        if "GMAIL_REFRESH_TOKEN_PERSONAL" in existing:
            print("\n.env.local already has GMAIL_REFRESH_TOKEN_PERSONAL — leave manual replacement to you.")
        else:
            with ENV_PATH.open("a", encoding="utf-8") as f:
                if not existing.endswith("\n"):
                    f.write("\n")
                f.write(f"GMAIL_REFRESH_TOKEN_PERSONAL={refresh}\n")
            print(f"\n✓ Appended GMAIL_REFRESH_TOKEN_PERSONAL to {ENV_PATH}")
else:
    print("\nERROR: No refresh_token in Google's response:")
    print(json.dumps(tokens, indent=2))
    print(
        "\nIf you see 'invalid_grant', the auth code expired in the few seconds it took."
        "\nRe-run the script."
    )
    sys.exit(1)
