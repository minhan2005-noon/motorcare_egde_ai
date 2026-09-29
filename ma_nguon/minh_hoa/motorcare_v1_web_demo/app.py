"""Tiny local MotorCare dashboard server; uses Python standard library only."""
from collections import deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from math import isfinite
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit
import json


ROOT = Path(__file__).resolve().parent
events = deque(maxlen=50)
events_lock = Lock()
ALLOWED_STATES = {
    "normal", "jam", "vibration", "sag", "jam+sag",
    "vibration+sag", "jam+vibration", "jam+vibration+sag",
}
PROBABILITY_FIELDS = (
    "jam_probability", "vibration_probability", "sag_probability"
)
MEASUREMENT_FIELDS = ("voltage_v", "current_ma", "vibration_rms_g")


class MotorCareHandler(BaseHTTPRequestHandler):
    def send_bytes(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_bytes(body, "application/json; charset=utf-8", status)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/":
            html = (ROOT / "templates" / "index.html").read_bytes()
            self.send_bytes(html, "text/html; charset=utf-8")
        elif path == "/api/latest":
            with events_lock:
                item = events[0] if events else None
            self.send_json({"received": item is not None, "data": item})
        elif path == "/api/history":
            with events_lock:
                items = list(events)
            self.send_json(items)
        else:
            self.send_json({"ok": False, "error": "Not found"}, 404)

    def do_POST(self):
        if urlsplit(self.path).path != "/api/prediction":
            self.send_json({"ok": False, "error": "Not found"}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                raise ValueError("Invalid body size")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json({"ok": False, "error": "Expected a valid JSON object"}, 400)
            return

        if not isinstance(body, dict):
            self.send_json({"ok": False, "error": "Expected a JSON object"}, 400)
            return
        state = body.get("state")
        if state not in ALLOWED_STATES:
            self.send_json({"ok": False, "error": "Unknown state"}, 400)
            return

        item = {"state": state, "received_at": datetime.now(timezone.utc).isoformat()}
        for field in PROBABILITY_FIELDS + MEASUREMENT_FIELDS:
            try:
                number = float(body[field])
            except (KeyError, TypeError, ValueError):
                self.send_json({"ok": False, "error": f"Missing or invalid {field}"}, 400)
                return
            if not isfinite(number):
                self.send_json({"ok": False, "error": f"Invalid {field}"}, 400)
                return
            if field in PROBABILITY_FIELDS and not 0.0 <= number <= 1.0:
                self.send_json({"ok": False, "error": f"{field} must be 0..1"}, 400)
                return
            item[field] = number

        try:
            item["uptime_ms"] = int(body.get("uptime_ms", 0))
        except (TypeError, ValueError):
            item["uptime_ms"] = 0
        with events_lock:
            events.appendleft(item)
        self.send_json({"ok": True, "received_at": item["received_at"]}, 201)

    def log_message(self, format_string, *args):
        # Keep the demo console quiet except for connection issues and POSTs.
        if self.command == "POST":
            super().log_message(format_string, *args)


if __name__ == "__main__":
    # Local-network V1 demo. Do not expose port 5000 to the public Internet.
    server = ThreadingHTTPServer(("0.0.0.0", 5000), MotorCareHandler)
    print("MotorCare dashboard server: http://127.0.0.1:5000")
    print("Keep this window open while the ESP32 is sending data. Ctrl+C stops it.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping MotorCare dashboard.")
    finally:
        server.server_close()

