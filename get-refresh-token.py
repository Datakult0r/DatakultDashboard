"""
Gmail OAuth2 Refresh Token Generator
Run this script, authorize in the browser, and it will print your refresh token.

Client ID: 111380151572-pslt7mo9bsv74gg2i1uru5ms6n278s0p.apps.googleusercontent.com
Project: gen-lang-client-0970726892 ("nano banan")
Redirect URI: http://localhost:9876
Scopes: gmail.modify
"""

import http.server
import urllib.parse
import webbrowser
import json
import sys

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

CLIENT_ID = "111380151572-pslt7mo9bsv74gg2i1uru5ms6n278s0p.apps.googleusercontent.com"
REDIRECT_URI = "http://localhost:9876"
SCOPE = "https://www.googleapis.com/auth/gmail.modify"

# You'll need to provide your client secret
CLIENT_SECRET = input("Paste your GMAIL_CLIENT_SECRET (from Google Cloud Console): ").strip()

auth_url = (
    f"https://accounts.google.com/o/oauth2/v2/auth?"
    f"client_id={CLIENT_ID}&"
    f"redirect_uri={REDIRECT_URI}&"
    f"response_type=code&"
    f"scope={SCOPE}&"
    f"access_type=offline&"
    f"prompt=consent"
)

print(f"\nOpening browser for authorization...")
webbrowser.open(auth_url)

# Start a simple HTTP server to catch the callback
auth_code = None

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>Authorization successful!</h1><p>You can close this tab.</p>")
        else:
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>Authorization failed</h1>")

    def log_message(self, format, *args):
        pass  # Suppress server logs

server = http.server.HTTPServer(("localhost", 9876), CallbackHandler)
print("Waiting for authorization callback on http://localhost:9876 ...")
server.handle_request()

if not auth_code:
    print("ERROR: No authorization code received.")
    sys.exit(1)

print(f"\nGot auth code. Exchanging for tokens...")

token_response = requests.post("https://oauth2.googleapis.com/token", data={
    "code": auth_code,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT_URI,
    "grant_type": "authorization_code",
})

tokens = token_response.json()

if "refresh_token" in tokens:
    print(f"\n{'='*60}")
    print(f"SUCCESS! Here are your tokens:")
    print(f"{'='*60}")
    print(f"\nGMAIL_REFRESH_TOKEN={tokens['refresh_token']}")
    print(f"\nAccess token (expires): {tokens.get('access_token', 'N/A')[:20]}...")
    print(f"\n{'='*60}")
    print(f"Copy the GMAIL_REFRESH_TOKEN above and paste it into Vercel.")
else:
    print(f"\nERROR: No refresh token in response:")
    print(json.dumps(tokens, indent=2))
    print("\nIf you see 'invalid_grant', the auth code may have expired. Run again.")
