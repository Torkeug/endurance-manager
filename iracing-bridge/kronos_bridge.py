"""
Kronos iRacing Bridge
Reads live iRacing telemetry and POSTs one payload per lap to the Kronos API.
Runs as a system tray application.

Connection management adapted from iracing_coach/telemetry_reader.py.
"""

import enum
import queue
import time
import threading
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Optional

import irsdk
import requests
import pystray
from PIL import Image, ImageDraw


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

KRONOS_API_URL = "https://planner.kronos-simsports.com/api/iracing/lap"
KRONOS_API_KEY = "BGmzJnh1hdh-YssdLqDfa69forQLLma8rWoagkQ5FGs"
POLL_HZ = 10          # 10Hz is enough — we only need lap crossings
RETRY_INTERVAL = 30   # seconds between retry attempts
RETRY_QUEUE_MAX = 20  # keep last 20 laps in memory if server is unreachable
MIN_LAP_TIME = 10.0   # seconds — guard against false lap crossings

SESSION_TYPE_MAP: dict[str, int] = {
    "practice": 1,
    "open practice": 1,
    "lone qualify": 2,
    "open qualify": 2,
    "qualify": 2,
    "race": 3,
    "race time trial": 3,
    "time trial": 3,
}


# ---------------------------------------------------------------------------
# Tray icon helpers
# ---------------------------------------------------------------------------

class State(enum.Enum):
    WAITING = "waiting"    # iRacing not running  → red
    CONNECTED = "connected"  # iRacing connected, posts OK → green
    ERROR = "error"        # iRacing connected, Kronos unreachable → amber

ICON_COLORS = {
    State.WAITING: "#F44336",   # red   — iRacing not running
    State.CONNECTED: "#4CAF50", # green — all good
    State.ERROR: "#F5A623",     # amber — upload issue
}


def _make_icon(state: State) -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, 60, 60), fill=ICON_COLORS[state])
    return img


# ---------------------------------------------------------------------------
# Payload
# ---------------------------------------------------------------------------

@dataclass
class LapPayload:
    # Session identity (from YAML — static per session)
    iracing_cust_id: int
    track_id: int
    car_id: int
    session_type: int        # 1=Practice  2=Qualify  3=Race

    # Performance (per lap)
    lap_time: float          # LapLastLapTime, seconds
    fuel_level: float        # FuelLevel, litres remaining at lap end
    fuel_used: float         # FuelLevel delta this lap, litres (computed)

    # Conditions (snapshot at lap crossing)
    track_wetness_raw: int   # TrackWetness enum 0–7
    weather_declared_wet: bool  # WeatherDeclaredWet — marshals allow rain tyres
    track_temp: float        # TrackTempCrew, °C
    air_temp: float          # AirTemp, °C
    precipitation: float     # Precipitation, %
    solar_altitude: float    # SolarAltitude, radians (>0 = day, ≤0 = night)
    session_time_of_day: float  # SessionTimeOfDay, seconds since midnight (in-game)
    is_night: bool           # derived: solar_altitude <= 0

    # IRL timestamp for stint matching
    recorded_at: str         # UTC ISO-8601


# ---------------------------------------------------------------------------
# Bridge
# ---------------------------------------------------------------------------

class KronosBridge:

    def __init__(self, api_url: str):
        self._api_url = api_url
        self._ir = irsdk.IRSDK()
        self._running = False
        self._poll_thread: Optional[threading.Thread] = None
        self._retry_thread: Optional[threading.Thread] = None
        self._ir_connected = False
        self._last_session_num = -1

        # Session fields — populated from YAML on connect / session change
        self._cust_id = 0
        self._track_id = 0
        self._car_id = 0
        self._session_type = 0

        # Lap tracking
        self._last_lap = -1
        self._fuel_at_lap_start: Optional[float] = None

        # In-memory retry queue
        self._retry_queue: queue.Queue[LapPayload] = queue.Queue(maxsize=RETRY_QUEUE_MAX)

        # Tray-visible state (read by tray thread)
        self.state = State.WAITING
        self.status_text = "Waiting for iRacing..."
        self._last_lap_info = ""

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def start(self) -> None:
        self._running = True
        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()
        self._retry_thread = threading.Thread(target=self._retry_loop, daemon=True)
        self._retry_thread.start()

    def stop(self) -> None:
        self._running = False
        if self._poll_thread:
            self._poll_thread.join(timeout=2)
        if self._retry_thread:
            self._retry_thread.join(timeout=2)

    # ------------------------------------------------------------------
    # Poll loop — mirrors telemetry_reader.py _loop / _check_connection / _tick
    # ------------------------------------------------------------------

    def _poll_loop(self) -> None:
        interval = 1.0 / POLL_HZ
        while self._running:
            t0 = time.monotonic()
            self._check_connection()
            if self._ir_connected:
                self._tick()
            elapsed = time.monotonic() - t0
            remaining = interval - elapsed
            if remaining > 0:
                time.sleep(remaining)

    def _check_connection(self) -> None:
        if self._ir_connected and not (self._ir.is_initialized and self._ir.is_connected):
            self._ir_connected = False
            self._ir.shutdown()
            self._last_session_num = -1
            self._last_lap = -1
            self._fuel_at_lap_start = None
            self.state = State.WAITING
            self.status_text = "Waiting for iRacing..."
            print("[bridge] iRacing disconnected")

        elif (
            not self._ir_connected
            and self._ir.startup()
            and self._ir.is_initialized
            and self._ir.is_connected
        ):
            self._ir_connected = True
            self.state = State.CONNECTED
            self.status_text = "Connected — waiting for lap..."
            print("[bridge] iRacing connected")
            self._read_session()

    def _tick(self) -> None:
        self._ir.freeze_var_buffer_latest()
        sess_num = int(self._v("SessionNum") or 0)
        if sess_num != self._last_session_num:
            self._last_session_num = sess_num
            self._read_session()
        self._check_lap_crossing()

    # ------------------------------------------------------------------
    # Session info — read from YAML on connect or session change
    # ------------------------------------------------------------------

    def _read_session(self) -> None:
        wi = self._ir["WeekendInfo"]
        di = self._ir["DriverInfo"]
        si = self._ir["SessionInfo"]
        if not wi or not di:
            print("[bridge] session YAML not ready yet")
            return

        drivers: list = di["Drivers"]
        car_idx: int = di["DriverCarIdx"]
        if not drivers or car_idx >= len(drivers):
            print("[bridge] driver list invalid")
            return

        driver: dict = drivers[car_idx]
        self._cust_id = int(driver.get("UserID", 0))
        self._track_id = int(wi.get("TrackID", 0))
        self._car_id = int(driver.get("CarID", 0))

        sessions: list = si.get("Sessions", []) if si else []
        sess_num = int(self._v("SessionNum") or 0)
        if sessions and sess_num < len(sessions):
            raw_type = str(sessions[sess_num].get("SessionType", "")).lower()
            self._session_type = SESSION_TYPE_MAP.get(raw_type, 0)
        else:
            self._session_type = 0

        self._last_lap = -1
        self._fuel_at_lap_start = None
        print(
            f"[bridge] session ready — cust_id={self._cust_id} "
            f"track={self._track_id} car_id={self._car_id} "
            f"type={self._session_type}"
        )

    # ------------------------------------------------------------------
    # Lap crossing detection
    # ------------------------------------------------------------------

    def _check_lap_crossing(self) -> None:
        try:
            current_lap = int(self._v("Lap") or 0)
            fuel_level = float(self._v("FuelLevel") or 0.0)

            if self._last_lap == -1:
                self._last_lap = current_lap
                self._fuel_at_lap_start = fuel_level
                return

            if current_lap == self._last_lap:
                return

            # Lap just completed
            fuel_used = max(0.0, (self._fuel_at_lap_start or fuel_level) - fuel_level)
            lap_time = float(self._v("LapLastLapTime") or 0.0)

            self._fuel_at_lap_start = fuel_level
            self._last_lap = current_lap

            if lap_time < MIN_LAP_TIME:
                print(f"[bridge] skipping implausible lap time {lap_time:.3f}s")
                return

            solar_altitude = float(self._v("SolarAltitude") or 0.0)

            payload = LapPayload(
                iracing_cust_id=self._cust_id,
                track_id=self._track_id,
                car_id=self._car_id,
                session_type=self._session_type,
                lap_time=round(lap_time, 3),
                fuel_level=round(fuel_level, 3),
                fuel_used=round(fuel_used, 3),
                track_wetness_raw=int(self._v("TrackWetness") or 0),
                weather_declared_wet=bool(self._v("WeatherDeclaredWet")),
                track_temp=float(self._v("TrackTempCrew") or 0.0),
                air_temp=float(self._v("AirTemp") or 0.0),
                precipitation=float(self._v("Precipitation") or 0.0),
                solar_altitude=round(solar_altitude, 4),
                session_time_of_day=float(self._v("SessionTimeOfDay") or 0.0),
                is_night=solar_altitude <= 0,
                recorded_at=datetime.now(timezone.utc).isoformat(),
            )
            self._upload(payload)

        except (KeyError, TypeError, ValueError) as exc:
            print(f"[bridge] frame read error: {exc}")

    # ------------------------------------------------------------------
    # Upload + retry
    # ------------------------------------------------------------------

    def _upload(self, payload: LapPayload) -> None:
        try:
            resp = requests.post(
                self._api_url,
                json=asdict(payload),
                headers={"Authorization": f"Bearer {KRONOS_API_KEY}"},
                timeout=5,
            )
            if resp.ok:
                mins = int(payload.lap_time // 60)
                secs = payload.lap_time % 60
                self._last_lap_info = f"Last lap: {mins}:{secs:06.3f}  fuel: {payload.fuel_used:.2f}L"
                self.status_text = self._last_lap_info
                self.state = State.CONNECTED
                print(f"[bridge] uploaded — {self._last_lap_info}")
            else:
                self.state = State.ERROR
                self.status_text = f"Kronos unreachable ({resp.status_code})"
                print(f"[bridge] server returned {resp.status_code} — queuing for retry")
                self._enqueue(payload)
        except requests.exceptions.RequestException as exc:
            self.state = State.ERROR
            self.status_text = "Kronos unreachable — retrying..."
            print(f"[bridge] upload failed ({exc}) — queuing for retry")
            self._enqueue(payload)

    def _enqueue(self, payload: LapPayload) -> None:
        try:
            self._retry_queue.put_nowait(payload)
        except queue.Full:
            try:
                self._retry_queue.get_nowait()
                self._retry_queue.put_nowait(payload)
            except queue.Empty:
                pass

    def _retry_loop(self) -> None:
        while self._running:
            time.sleep(RETRY_INTERVAL)
            pending: list[LapPayload] = []
            while not self._retry_queue.empty():
                try:
                    pending.append(self._retry_queue.get_nowait())
                except queue.Empty:
                    break
            if not pending:
                continue
            print(f"[bridge] retrying {len(pending)} queued lap(s)...")
            for payload in pending:
                try:
                    resp = requests.post(
                        self._api_url,
                        json=asdict(payload),
                        headers={"Authorization": f"Bearer {KRONOS_API_KEY}"},
                        timeout=5,
                    )
                    if resp.ok:
                        print(f"[bridge] retry ok — {payload.recorded_at}")
                        if self.state == State.ERROR:
                            self.state = State.CONNECTED
                            self.status_text = self._last_lap_info or "Connected"
                    else:
                        self._enqueue(payload)
                except requests.exceptions.RequestException:
                    self._enqueue(payload)

    # ------------------------------------------------------------------
    # pyirsdk helper — typed Any so cast calls don't raise Pylance errors
    # ------------------------------------------------------------------

    def _v(self, key: str) -> Any:
        return self._ir[key]  # type: ignore[index]


# ---------------------------------------------------------------------------
# Tray
# ---------------------------------------------------------------------------

def run_tray(bridge: KronosBridge) -> None:
    current_state = State.WAITING
    icon = pystray.Icon(
        "kronos_bridge",
        _make_icon(State.WAITING),
        "Kronos Bridge",
    )

    def get_status_text(item) -> str:
        return bridge.status_text

    def quit_action(icon, item) -> None:
        bridge.stop()
        icon.stop()

    icon.menu = pystray.Menu(
        pystray.MenuItem(get_status_text, None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_action),
    )

    def update_loop() -> None:
        nonlocal current_state
        while icon.visible:
            if bridge.state != current_state:
                current_state = bridge.state
                icon.icon = _make_icon(current_state)
                icon.title = f"Kronos Bridge — {bridge.status_text}"
            time.sleep(1)

    threading.Thread(target=update_loop, daemon=True).start()
    icon.run()  # blocks main thread (required by pystray on Windows)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    bridge = KronosBridge(api_url=KRONOS_API_URL)
    bridge.start()
    run_tray(bridge)  # blocks until user quits from tray
