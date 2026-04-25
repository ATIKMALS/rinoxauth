import base64
import hashlib
import json
import os
import secrets
import sqlite3
import smtplib
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ============================================
# EMAIL CONFIG
# ============================================
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")
SMTP_PASS = os.getenv("SMTP_PASS", "").replace(" ", "")

def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email using SMTP"""
    if not SMTP_USER or not SMTP_PASS:
        print("⚠️ SMTP not configured. Email not sent.")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"✅ Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Email failed: {e}")
        return False

# ============================================
# ENVIRONMENT SETUP
# ============================================
load_dotenv()

DB_PATH = Path(os.getenv("DB_PATH", "auth.db"))
DEFAULT_ADMIN_USERNAME = os.getenv("DEMO_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEMO_PASSWORD", "admin123")
DEFAULT_LICENSE_KEY = os.getenv("DEMO_LICENSE_KEY", "XXXX-YYYY-ZZZZ")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000")

# ============================================
# FASTAPI APP SETUP
# ============================================
app = FastAPI(
    title="RinoxAuth API",
    version="2.0.0",
    description="Modern licensing + authentication platform for C#/C++/Python/HTML",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================
# CORS MIDDLEWARE
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ============================================
# PYDANTIC MODELS
# ============================================

class LoginPayload(BaseModel):
    username: str
    password: str

class UserCreatePayload(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    plan: str = "free"
    expires_in_days: int = 30
    expires_in_seconds: Optional[int] = None
    hwid_lock: bool = True
    app_id: Optional[int] = None

class UserUpdatePayload(BaseModel):
    password: Optional[str] = None
    email: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    hwid_lock: Optional[bool] = None
    device_limit: Optional[int] = None
    notes: Optional[str] = None
    expires_in_days: Optional[int] = None

class LicenseCreatePayload(BaseModel):
    key: Optional[str] = None
    user_id: Optional[int] = None
    expires_in_days: int = 30
    is_lifetime: bool = False
    plan: str = "standard"
    device_limit: int = 1
    issued_to: Optional[str] = None
    note: Optional[str] = None
    app_id: Optional[int] = None
    hwid_lock: bool = False

class OAuthSessionPayload(BaseModel):
    provider: str
    provider_account_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    image: Optional[str] = None

class ResellerCreatePayload(BaseModel):
    username: str
    email: str
    password: str
    credits: int = 100
    commission_rate: float = 20.0
    phone: Optional[str] = None
    notes: Optional[str] = None

class ApiKeyCreatePayload(BaseModel):
    name: str
    permissions: list = ["read"]
    expires_in_days: int = 90
    app_id: Optional[int] = None

class ApiKeyVerifyPayload(BaseModel):
    api_key: str
    api_secret: str

class ResellerLoginPayload(BaseModel):
    username: str
    password: str

class AppCreatePayload(BaseModel):
    app_name: str
    version: str = "1.0.0"
    owner_id: Optional[str] = None
    created_by: Optional[str] = None

class AuthPayload(BaseModel):
    type: str
    appname: str
    ownerid: str
    secret: str
    version: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    hwid: Optional[str] = None
    key: Optional[str] = None

# ============================================
# DATABASE HELPERS
# ============================================

def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return f"{base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_b64, digest_b64 = stored.split("$", 1)
        salt = base64.b64decode(salt_b64.encode())
        expected = base64.b64decode(digest_b64.encode())
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
        return secrets.compare_digest(digest, expected)
    except Exception:
        return False

def _success(message: str = "ok", data: any = None) -> dict:
    return {"success": True, "message": message, "data": data}

def _error(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse(content={"success": False, "message": message}, status_code=status)

def _normalize(value: Optional[str]) -> str:
    return (value or "").strip()

def _make_license_key() -> str:
    parts = [secrets.token_hex(2).upper() for _ in range(4)]
    return "-".join(parts)

def _make_api_key() -> str:
    return f"wa_live_{secrets.token_hex(16)}"

def _make_api_secret() -> str:
    return f"wa_secret_{secrets.token_hex(24)}"

def _make_hash() -> str:
    return hashlib.sha256(secrets.token_hex(32).encode("utf-8")).hexdigest()

def _user_to_dict(row: sqlite3.Row) -> dict:
    if not row:
        return None
    return {
        "id": row["id"],
        "application_id": row["application_id"] if "application_id" in row.keys() else None,
        "application_name": row["application_name"] if "application_name" in row.keys() else None,
        "username": row["username"],
        "email": row["email"] or "",
        "plan": row["plan"] or "free",
        "status": "active" if row["is_active"] else "inactive",
        "hwid": row["hwid"] or "",
        "hwid_lock": bool(row["hwid_lock"]) if "hwid_lock" in row.keys() else False,
        "expires_at": row["expires_at"],
        "created_at": row["created_at"],
        "last_login": row["last_login"] or None,
        "devices": row["devices"] if "devices" in row.keys() else 0,
    }

def _log_activity(conn: sqlite3.Connection, category: str, severity: str, message: str, user_id: Optional[int] = None) -> None:
    try:
        conn.execute(
            "INSERT INTO activity_logs (category, severity, message, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (category, severity, message, user_id, _now_iso()),
        )
    except Exception as e:
        print(f"⚠️ Failed to log activity: {e}")

# ============================================
# DATABASE INITIALIZATION
# ============================================

def _init_db() -> None:
    """Initialize database with all required tables"""
    conn = _db()

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            plan TEXT NOT NULL DEFAULT 'free',
            is_active INTEGER NOT NULL DEFAULT 1,
            hwid_lock INTEGER NOT NULL DEFAULT 1,
            hwid TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_login TEXT,
            devices INTEGER DEFAULT 0,
            notes TEXT,
            FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            license_key TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            issued_to TEXT,
            plan TEXT NOT NULL DEFAULT 'standard',
            device_limit INTEGER NOT NULL DEFAULT 1,
            expires_at TEXT,
            is_lifetime INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            hwid_lock INTEGER NOT NULL DEFAULT 0,
            note TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE SET NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS resellers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT,
            credits INTEGER NOT NULL DEFAULT 100,
            users_created INTEGER NOT NULL DEFAULT 0,
            commission_rate REAL DEFAULT 20.0,
            phone TEXT,
            notes TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER,
            name TEXT NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            api_secret TEXT NOT NULL,
            permissions TEXT DEFAULT '["read"]',
            is_active INTEGER NOT NULL DEFAULT 1,
            expires_at TEXT,
            last_used TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'info',
            message TEXT NOT NULL,
            user_id INTEGER,
            metadata TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            app_key TEXT UNIQUE NOT NULL,
            app_secret TEXT NOT NULL,
            version TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by TEXT,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()

    # ============================================
    # MIGRATIONS
    # ============================================
    try:
        user_cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "application_id" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN application_id INTEGER")
        if "last_login" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN last_login TEXT")
        if "devices" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN devices INTEGER DEFAULT 0")
        if "notes" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN notes TEXT")
        if "app_limit" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN app_limit INTEGER DEFAULT 2")
        if "total_apps_created" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN total_apps_created INTEGER DEFAULT 0")
    except Exception as e:
        print(f"⚠️ User migration: {e}")

    try:
        lic_cols = {r["name"] for r in conn.execute("PRAGMA table_info(licenses)").fetchall()}
        if "application_id" not in lic_cols:
            conn.execute("ALTER TABLE licenses ADD COLUMN application_id INTEGER")
        if "hwid_lock" not in lic_cols:
            conn.execute("ALTER TABLE licenses ADD COLUMN hwid_lock INTEGER NOT NULL DEFAULT 0")
        if "note" not in lic_cols:
            conn.execute("ALTER TABLE licenses ADD COLUMN note TEXT")
        if "plan" not in lic_cols:
            conn.execute("ALTER TABLE licenses ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard'")
        if "device_limit" not in lic_cols:
            conn.execute("ALTER TABLE licenses ADD COLUMN device_limit INTEGER NOT NULL DEFAULT 1")
        if "issued_to" not in lic_cols:
            conn.execute("ALTER TABLE licenses ADD COLUMN issued_to TEXT")
    except Exception as e:
        print(f"⚠️ License migration: {e}")

    try:
        api_key_cols = {r["name"] for r in conn.execute("PRAGMA table_info(api_keys)").fetchall()}
        if "application_id" not in api_key_cols:
            conn.execute("ALTER TABLE api_keys ADD COLUMN application_id INTEGER")
    except Exception as e:
        print(f"⚠️ API key migration: {e}")

    try:
        app_cols = {r["name"] for r in conn.execute("PRAGMA table_info(applications)").fetchall()}
        if "created_by" not in app_cols:
            conn.execute("ALTER TABLE applications ADD COLUMN created_by TEXT")
    except Exception as e:
        print(f"⚠️ Applications migration: {e}")

    try:
        reseller_cols = {r["name"] for r in conn.execute("PRAGMA table_info(resellers)").fetchall()}
        if "email" not in reseller_cols:
            conn.execute("ALTER TABLE resellers ADD COLUMN email TEXT")
        if "password_hash" not in reseller_cols:
            conn.execute("ALTER TABLE resellers ADD COLUMN password_hash TEXT")
        if "commission_rate" not in reseller_cols:
            conn.execute("ALTER TABLE resellers ADD COLUMN commission_rate REAL DEFAULT 20.0")
        if "phone" not in reseller_cols:
            conn.execute("ALTER TABLE resellers ADD COLUMN phone TEXT")
        if "notes" not in reseller_cols:
            conn.execute("ALTER TABLE resellers ADD COLUMN notes TEXT")
    except Exception as e:
        print(f"⚠️ Reseller migration: {e}")

    conn.commit()

    # Default settings
    default_settings = [
        ("app_name", "RinoxAuth"), ("theme", "dark"), ("language", "en"),
        ("timezone", "Asia/Dhaka"), ("date_format", "DD/MM/YYYY"),
        ("auth_mode", "jwt+session"), ("session_timeout", "1440"),
        ("notifications_enabled", "true"), ("two_factor_required", "false"),
    ]
    for key, value in default_settings:
        if not conn.execute("SELECT id FROM settings WHERE key = ?", (key,)).fetchone():
            conn.execute("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)", (key, value, _now_iso()))
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully!")
    print(f"   📁 DB Path: {DB_PATH}")
    print(f"   ⚠️  No default users/licenses - Register via /api/auth/register-admin")

# ============================================
# FORGOT PASSWORD
# ============================================
class ForgotPasswordPayload(BaseModel):
    email: str

@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordPayload):
    conn = _db()
    email = _normalize(payload.email).lower()
    user = conn.execute("SELECT * FROM users WHERE lower(email) = ? AND is_active = 1", (email,)).fetchone()
    if user:
        reset_token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        conn.execute("""CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0, created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id))""")
        conn.commit()
        conn.execute("INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user["id"], reset_token, expires_at, _now_iso()))
        conn.commit()
        reset_url = f"http://localhost:3000/reset-password?token={reset_token}"
        html_body = f"""<div style="font-family: Arial; max-width: 500px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
            <h1 style="color: #818cf8;">RinoxAuth</h1><p>Hello {user['username']},</p>
            <p>Click below to reset your password:</p>
            <a href="{reset_url}" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Reset Password</a>
            <p style="color: #64748b; font-size: 12px;">Link expires in 1 hour.</p></div>"""
        email_sent = send_email(to_email=email, subject="Reset Your RinoxAuth Password", body=html_body)
        if email_sent:
            _log_activity(conn, "auth", "info", f"Password reset email sent to {user['username']}")
    conn.close()
    return _success("If the email exists, a reset link has been sent.")

class ResetPasswordPayload(BaseModel):
    token: str
    password: str

@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordPayload):
    conn = _db()
    reset = conn.execute("SELECT * FROM password_resets WHERE token = ? AND used = 0 AND datetime(expires_at) > datetime(?)",
        (payload.token, _now_iso())).fetchone()
    if not reset:
        conn.close()
        return _error("Invalid or expired reset token", 400)
    new_hash = _hash_password(payload.password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, reset["user_id"]))
    conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset["id"],))
    _log_activity(conn, "auth", "info", f"Password reset completed for user ID: {reset['user_id']}")
    conn.commit()
    conn.close()
    return _success("Password reset successfully.")

# ============================================
# STARTUP EVENT
# ============================================
@app.on_event("startup")
def on_startup():
    print("🚀 Starting RinoxAuth Backend...")
    _init_db()
    print("✅ RinoxAuth Backend is ready!")

# ============================================
# MIDDLEWARE - Request Logging + Activity Tracking
# ============================================
@app.middleware("http")
async def log_and_track_requests(request: Request, call_next):
    start_time = datetime.now(timezone.utc)
    username = request.query_params.get("username") or "anonymous"
    action = f"{request.method} {request.url.path}"
    response = await call_next(request)
    duration = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
    status_code = response.status_code
    conn = _db()
    try:
        conn.execute(
            "INSERT INTO activity_logs (category, severity, message, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
            ("request", "info" if status_code < 400 else "warning", f"{username}: {action} → {status_code} ({duration:.1f}ms)", None, _now_iso()))
        conn.commit()
    except:
        pass
    finally:
        conn.close()
    print(f"📡 {request.method} {request.url.path} → {status_code} ({duration:.1f}ms)")
    return response

# ============================================
# HEALTH CHECK
# ============================================
@app.get("/health")
def health_check():
    return {"ok": True, "status": "healthy", "version": "2.0.0", "timestamp": _now_iso(), "uptime": "running"}

@app.get("/")
def root():
    return {"name": "RinoxAuth API", "version": "2.0.0", "docs": "/docs", "health": "/health"}

# ============================================
# SDK AUTH ENDPOINT (C# / C++ / Python / HTML)
# ============================================
@app.post("/api/auth")
def sdk_auth(payload: AuthPayload):
    conn = _db()
    print(f"🔐 SDK Auth Request: type={payload.type}, app={payload.appname}")
    
    app = conn.execute(
        """SELECT * FROM applications WHERE lower(name) = lower(?) AND lower(owner_id) = lower(?) AND app_secret = ? AND is_active = 1""",
        (_normalize(payload.appname), _normalize(payload.ownerid), _normalize(payload.secret)),
    ).fetchone()
    
    if not app:
        conn.close()
        return _error("Invalid app credentials. Check your appName, ownerId, and secret.", 403)
    
    if payload.version and _normalize(payload.version) != _normalize(app["version"]):
        conn.close()
        return _error(f"Invalid app version. Expected: {app['version']}", 403)
    
    req_type = payload.type.lower().strip()
    print(f"   Request type: {req_type}")
    
    # INIT
    if req_type == "init":
        conn.close()
        return _success("Initialized successfully", {"app_name": app["name"], "version": app["version"]})
    
    # LOGIN
    if req_type == "login":
        if not payload.username or not payload.password:
            conn.close()
            return _error("Username and password are required", 400)
        
        user = conn.execute(
            "SELECT * FROM users WHERE username = ? AND application_id = ? AND is_active = 1",
            (payload.username, app["id"]),
        ).fetchone()
        
        if not user:
            conn.close()
            return _error("Invalid credentials. User not found or inactive.", 401)
        
        if not _verify_password(payload.password, user["password_hash"]):
            conn.close()
            return _error("Invalid credentials. Please check your password.", 401)
        
        expires_at = datetime.fromisoformat(user["expires_at"])
        if expires_at < datetime.now(timezone.utc):
            conn.close()
            return _error("Your account has expired. Please renew your subscription.", 403)
        
        incoming_hwid = _normalize(payload.hwid) or "unknown-device"
        stored_hwid = _normalize(user["hwid"]) if user["hwid"] else None
        hwid_locked = bool(user["hwid_lock"])
        
        if hwid_locked and stored_hwid and stored_hwid != incoming_hwid:
            conn.close()
            return _error("HWID mismatch. Please contact support to reset your HWID.", 403)
        
        if not stored_hwid:
            conn.execute("UPDATE users SET hwid = ? WHERE id = ?", (incoming_hwid, user["id"]))
        
        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (_now_iso(), user["id"]))
        _log_activity(conn, "login", "info", f"SDK Login successful: {user['username']}", user["id"])
        conn.commit()
        conn.close()
        
        return {
            "success": True, "message": "Login successful", "token": secrets.token_hex(32),
            "user": {"username": user["username"], "expiry": user["expires_at"][:10], "hwid": incoming_hwid, "plan": user["plan"]},
        }
    
    # LICENSE
    if req_type == "license":
        if not payload.key:
            conn.close()
            return _error("License key is required", 400)
        
        search_key = _normalize(payload.key)
        if search_key.startswith("RinoxAuth-"):
            search_key = search_key[10:]
        
        license_row = conn.execute(
            "SELECT * FROM licenses WHERE license_key = ? AND application_id = ? AND is_active = 1",
            (search_key, app["id"]),
        ).fetchone()
        
        if not license_row:
            conn.close()
            return _error("Invalid license key. Please check and try again.", 401)
        
        if not license_row["is_lifetime"] and license_row["expires_at"]:
            if datetime.fromisoformat(license_row["expires_at"]) < datetime.now(timezone.utc):
                conn.close()
                return _error("This license has expired. Please renew.", 403)
        
        conn.close()
        return {
            "success": True, "message": "License is valid", "token": secrets.token_hex(32),
            "data": {"plan": license_row["plan"], "expires_at": license_row["expires_at"] or "Never", "is_lifetime": bool(license_row["is_lifetime"])},
        }
    
    # LICENSE-LOGIN
    if req_type == "license-login":
        if not payload.key:
            conn.close()
            return _error("License key is required", 400)
        
        search_key = _normalize(payload.key)
        if search_key.startswith("RinoxAuth-"):
            search_key = search_key[10:]
        
        lic = conn.execute(
            "SELECT * FROM licenses WHERE license_key=? AND application_id = ? AND is_active=1",
            (search_key, app["id"]),
        ).fetchone()
        
        if not lic:
            conn.close()
            return _error("Invalid license", 401)
        
        if not lic["is_lifetime"] and lic["expires_at"] and datetime.fromisoformat(lic["expires_at"]) < datetime.now(timezone.utc):
            conn.close()
            return _error("License expired", 403)
        
        username = f"user_{search_key[:8].replace('-','')}"
        user = conn.execute("SELECT * FROM users WHERE username=? AND application_id = ?", (username, app["id"])).fetchone()
        
        if not user:
            expires = lic["expires_at"] or (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat()
            conn.execute(
                "INSERT INTO users (application_id, username,password_hash,plan,is_active,hwid_lock,expires_at,created_at) VALUES (?,?,?,?,1,0,?,?)",
                (app["id"], username, _hash_password(search_key), lic["plan"] or "free", expires, _now_iso()),
            )
            conn.execute("UPDATE licenses SET user_id=last_insert_rowid() WHERE id=?", (lic["id"],))
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE username=? AND application_id = ?", (username, app["id"])).fetchone()
            _log_activity(conn, "register", "info", f"Auto-created user from license: {username}")
        
        conn.execute("UPDATE users SET last_login=? WHERE id=?", (_now_iso(), user["id"]))
        _log_activity(conn, "login", "info", f"License login: {username}", user["id"])
        conn.commit()
        conn.close()
        
        return {
            "success": True, "message": "License login successful", "token": secrets.token_hex(32),
            "user": {"username": user["username"], "expiry": user["expires_at"][:10], "plan": user["plan"], "hwid": _normalize(payload.hwid) or "unknown"},
        }
    
    # REGISTER
    if req_type == "register":
        if not payload.username or not payload.password:
            conn.close()
            return _error("Username and password required", 400)
        
        if conn.execute("SELECT id FROM users WHERE username=? AND application_id = ?", (payload.username, app["id"])).fetchone():
            conn.close()
            return _error("Username already exists", 409)
        
        plan = "free"
        if payload.key:
            search_key = _normalize(payload.key)
            if search_key.startswith("RinoxAuth-"):
                search_key = search_key[10:]
            lic = conn.execute("SELECT * FROM licenses WHERE license_key=? AND application_id = ? AND is_active=1", (search_key, app["id"])).fetchone()
            if not lic:
                conn.close()
                return _error("Invalid license key", 400)
            plan = lic["plan"] or "free"
        
        expires_at = (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat()
        conn.execute("INSERT INTO users (application_id, username,password_hash,plan,is_active,hwid_lock,expires_at,created_at) VALUES (?,?,?,?,1,1,?,?)",
            (app["id"], payload.username, _hash_password(payload.password), plan, expires_at, _now_iso()))
        
        if payload.key:
            search_key = _normalize(payload.key)
            if search_key.startswith("RinoxAuth-"):
                search_key = search_key[10:]
            user = conn.execute("SELECT id FROM users WHERE username=? AND application_id = ?", (payload.username, app["id"])).fetchone()
            if user:
                conn.execute("UPDATE licenses SET user_id=? WHERE license_key=? AND application_id = ?", (user["id"], search_key, app["id"]))
        
        _log_activity(conn, "register", "info", f"SDK Registration: {payload.username}")
        conn.commit()
        conn.close()
        return {"success": True, "message": "Registration successful! You can now login.", "token": secrets.token_hex(32)}
    
    conn.close()
    return _error("Unknown request type", 400)

# ============================================
# WEB AUTH ENDPOINTS
# ============================================
@app.post("/api/auth/login")
def web_login(payload: LoginPayload):
    conn = _db()
    user = conn.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (payload.username,)).fetchone()
    if not user or not _verify_password(payload.password, user["password_hash"]):
        conn.close()
        return _error("Invalid credentials", 401)
    if datetime.fromisoformat(user["expires_at"]) < datetime.now(timezone.utc):
        conn.close()
        return _error("Account expired", 403)
    conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (_now_iso(), user["id"]))
    _log_activity(conn, "auth", "info", f"LOGIN: {user['username']} logged in (plan: {user['plan']}, email: {user['email'] or 'N/A'})", user["id"])
    if user["email"]:
        _log_activity(conn, "auth", "info", f"EMAIL_LOGIN: {user['username']} used email {user['email']}", user["id"])
    conn.commit()
    user_data = _user_to_dict(user)
    conn.close()
    return _success("Login successful", user_data)

@app.post("/api/auth/oauth-session")
def oauth_session(payload: OAuthSessionPayload):
    provider = payload.provider.strip().lower()
    provider_account_id = payload.provider_account_id.strip()
    if not provider or not provider_account_id:
        return _error("Provider and provider account ID are required", 400)
    base_username = (payload.username or "").strip() or (payload.email or "").split("@")[0].strip() or f"{provider}_{provider_account_id[:8]}"
    email = (payload.email or "").strip().lower()
    conn = _db()
    user = None
    if email:
        user = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
    if not user:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (base_username,)).fetchone()
    if not user:
        username = base_username
        suffix = 1
        while conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone():
            suffix += 1
            username = f"{base_username}-{suffix}"
        conn.execute("INSERT INTO users (username, password_hash, email, plan, is_active, hwid_lock, expires_at, created_at) VALUES (?, ?, ?, 'free', 1, 0, ?, ?)",
            (username, _hash_password(secrets.token_urlsafe(24)), email, (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(), _now_iso()))
        _log_activity(conn, "user", "info", f"OAuth user created: {username} via {provider}")
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    _log_activity(conn, "login", "info", f"OAuth login: {user['username']} via {provider}", user["id"])
    conn.commit()
    conn.close()
    return _success("OAuth session synced", {"username": user["username"], "role": "admin", "plan": user["plan"], "id": str(user["id"])})

# ============================================
# DASHBOARD ENDPOINTS
# ============================================
@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    conn = _db()
    total_users = conn.execute("SELECT COUNT(*) as c FROM users WHERE is_active = 1").fetchone()["c"]
    active_users = conn.execute("SELECT COUNT(*) as c FROM users WHERE is_active = 1 AND datetime(expires_at) > datetime(?)", (_now_iso(),)).fetchone()["c"]
    total_licenses = conn.execute("SELECT COUNT(*) as c FROM licenses WHERE is_active = 1").fetchone()["c"]
    failed_logins = conn.execute("SELECT COUNT(*) as c FROM activity_logs WHERE severity = 'error' AND datetime(created_at) >= datetime(?, '-1 day')", (_now_iso(),)).fetchone()["c"]
    login_activity_24h = conn.execute("SELECT COUNT(*) as c FROM activity_logs WHERE category = 'login' AND datetime(created_at) >= datetime(?, '-1 day')", (_now_iso(),)).fetchone()["c"]
    total_requests = max(total_licenses * 40 + total_users * 12, 1)
    success_rate = round(((total_requests - failed_logins) / total_requests) * 100, 2) if total_requests > 0 else 100
    conn.close()
    return _success("ok", {
        "requests_today": total_requests, "active_users": active_users, "total_users": total_users,
        "failed_logins": failed_logins, "success_rate": success_rate, "active_licenses": total_licenses,
        "expired_licenses": 0, "login_activity_24h": login_activity_24h,
    })

# ============================================
# USERS CRUD
# ============================================
@app.get("/api/users")
def get_users():
    conn = _db()
    rows = conn.execute("SELECT u.*, a.name AS application_name FROM users u LEFT JOIN applications a ON a.id = u.application_id ORDER BY u.id DESC").fetchall()
    conn.close()
    return _success("ok", [_user_to_dict(r) for r in rows])

@app.post("/api/admin/users")
def create_user(payload: UserCreatePayload):
    conn = _db()
    if payload.app_id is None:
        conn.close()
        return _error("Application is required", 400)
    if not conn.execute("SELECT id FROM applications WHERE id = ?", (payload.app_id,)).fetchone():
        conn.close()
        return _error("Application not found", 404)
    existing = conn.execute("SELECT id FROM users WHERE username = ? AND application_id = ?", (payload.username, payload.app_id)).fetchone()
    if existing:
        conn.close()
        return _error("Username already exists in this application", 409)
    if payload.expires_in_seconds and payload.expires_in_seconds > 0:
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=payload.expires_in_seconds)).isoformat()
    else:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=max(payload.expires_in_days, 1))).isoformat()
    conn.execute("INSERT INTO users (application_id, username, password_hash, email, plan, is_active, hwid_lock, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)",
        (payload.app_id, payload.username, _hash_password(payload.password), payload.email or "", payload.plan.lower(), 1 if payload.hwid_lock else 0, expires_at, _now_iso()))
    _log_activity(conn, "admin", "info", f"User created: {payload.username}")
    conn.commit()
    conn.close()
    return _success("User created successfully")

@app.patch("/api/admin/users/{user_id}")
def update_user(user_id: int, payload: UserUpdatePayload):
    conn = _db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return _error("User not found", 404)
    updates = {}
    if payload.password:
        updates["password_hash"] = _hash_password(payload.password)
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.plan is not None:
        updates["plan"] = payload.plan.lower()
    if payload.status is not None:
        updates["is_active"] = 1 if payload.status == "active" else 0
    if payload.is_active is not None:
        updates["is_active"] = 1 if payload.is_active else 0
    if payload.hwid_lock is not None:
        updates["hwid_lock"] = 1 if payload.hwid_lock else 0
    if payload.expires_in_days is not None:
        updates["expires_at"] = (datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)).isoformat()
    if payload.notes is not None:
        updates["notes"] = payload.notes
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", list(updates.values()) + [user_id])
        _log_activity(conn, "admin", "info", f"User updated: {user['username']} (ID: {user_id})")
        conn.commit()
    conn.close()
    return _success("User updated successfully")

@app.post("/api/admin/users/{user_id}/reset-hwid")
def reset_user_hwid(user_id: int):
    conn = _db()
    user = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return _error("User not found", 404)
    conn.execute("UPDATE users SET hwid = NULL WHERE id = ?", (user_id,))
    _log_activity(conn, "admin", "info", f"HWID reset for user: {user['username']}", user_id)
    conn.commit()
    conn.close()
    return _success("HWID reset successful")

@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int):
    conn = _db()
    user = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return _error("User not found", 404)
    conn.execute("UPDATE licenses SET user_id = NULL WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    _log_activity(conn, "admin", "warning", f"User deleted: {user['username']}")
    conn.commit()
    conn.close()
    return _success("User deleted successfully")

# ============================================
# LICENSES CRUD
# ============================================
@app.get("/api/licenses")
def get_licenses():
    conn = _db()
    rows = conn.execute("SELECT l.*, u.username as uname, a.name as application_name FROM licenses l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN applications a ON a.id = l.application_id ORDER BY l.id DESC").fetchall()
    conn.close()
    return _success("ok", [
        {"id": row["id"], "application_id": row["application_id"], "application_name": row["application_name"] or "Unknown",
         "key": row["license_key"], "plan": row["plan"] or "standard", "issued_to": row["issued_to"] or row["uname"] or "",
         "device_limit": row["device_limit"] or 1, "issued_date": row["created_at"][:10] if row["created_at"] else "",
         "expires_at": "Never" if row["is_lifetime"] else (row["expires_at"] or "N/A"),
         "status": "active" if row["is_active"] else "revoked", "is_lifetime": bool(row["is_lifetime"]),
         "note": row["note"] or "", "hwid_lock": bool(row["hwid_lock"]) if "hwid_lock" in row.keys() else False}
        for row in rows
    ])

@app.post("/api/admin/licenses")
def create_license(payload: LicenseCreatePayload):
    conn = _db()
    if payload.app_id is None:
        conn.close()
        return _error("Application is required", 400)
    if not conn.execute("SELECT id FROM applications WHERE id = ?", (payload.app_id,)).fetchone():
        conn.close()
        return _error("Application not found", 404)
    key_value = _normalize(payload.key) if payload.key else None
    if not key_value:
        key_value = _make_license_key()
        while conn.execute("SELECT id FROM licenses WHERE license_key = ?", (key_value,)).fetchone():
            key_value = _make_license_key()
    else:
        if conn.execute("SELECT id FROM licenses WHERE license_key = ?", (key_value,)).fetchone():
            conn.close()
            return _error("License key already exists", 409)
    expires_at = None
    if not payload.is_lifetime:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=max(payload.expires_in_days, 1))).isoformat()
    conn.execute("INSERT INTO licenses (application_id, license_key, user_id, issued_to, plan, device_limit, expires_at, is_lifetime, is_active, hwid_lock, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)",
        (payload.app_id, key_value, payload.user_id, _normalize(payload.issued_to), payload.plan or "standard", max(payload.device_limit, 1), expires_at, 1 if payload.is_lifetime else 0, 1 if payload.hwid_lock else 0, _normalize(payload.note), _now_iso()))
    _log_activity(conn, "admin", "info", f"License created: {key_value}")
    conn.commit()
    conn.close()
    return _success("License created successfully", {"key": key_value})

@app.post("/api/admin/licenses/{license_id}/reset-hwid")
def reset_license_hwid(license_id: int):
    conn = _db()
    lic = conn.execute("SELECT id, user_id FROM licenses WHERE id = ?", (license_id,)).fetchone()
    if not lic:
        conn.close()
        return _error("License not found", 404)
    if lic["user_id"]:
        conn.execute("UPDATE users SET hwid = NULL WHERE id = ?", (lic["user_id"],))
        _log_activity(conn, "admin", "info", f"HWID reset for license ID: {license_id}", lic["user_id"])
    conn.commit()
    conn.close()
    return _success("HWID reset successful")

@app.patch("/api/admin/licenses/{license_id}")
def update_license(license_id: int, payload: dict):
    conn = _db()
    lic = conn.execute("SELECT * FROM licenses WHERE id = ?", (license_id,)).fetchone()
    if not lic:
        conn.close()
        return _error("License not found", 404)
    if "status" in payload:
        is_active = 1 if payload["status"] == "active" else 0
        conn.execute("UPDATE licenses SET is_active = ? WHERE id = ?", (is_active, license_id))
        _log_activity(conn, "admin", "info", f"License status changed to {'active' if is_active else 'revoked'}: ID {license_id}")
    if "hwid_lock" in payload:
        hwid_lock = 1 if payload["hwid_lock"] else 0
        conn.execute("UPDATE licenses SET hwid_lock = ? WHERE id = ?", (hwid_lock, license_id))
    conn.commit()
    conn.close()
    return _success("License updated successfully")

@app.delete("/api/admin/licenses/{license_id}")
def delete_license(license_id: int):
    conn = _db()
    result = conn.execute("DELETE FROM licenses WHERE id = ?", (license_id,))
    conn.commit()
    conn.close()
    if not result.rowcount:
        return _error("License not found", 404)
    return _success("License deleted successfully")

# ============================================
# APPLICATIONS CRUD
# ============================================
@app.get("/api/apps")
def get_apps(created_by: Optional[str] = None):
    conn = _db()
    if created_by:
        rows = conn.execute("SELECT a.*, (SELECT COUNT(*) FROM users u WHERE u.application_id = a.id AND u.is_active = 1) AS user_count FROM applications a WHERE a.created_by = ? ORDER BY a.id DESC", (created_by,)).fetchall()
    else:
        rows = conn.execute("SELECT a.*, (SELECT COUNT(*) FROM users u WHERE u.application_id = a.id AND u.is_active = 1) AS user_count FROM applications a ORDER BY a.id DESC").fetchall()
    conn.close()
    return _success("ok", [{"id": row["id"], "name": row["name"], "owner_id": row["owner_id"], "status": "active" if row["is_active"] else "inactive", "users": row["user_count"], "version": row["version"]} for row in rows])

@app.post("/api/admin/apps")
def create_app(payload: AppCreatePayload):
    conn = _db()
    name = _normalize(payload.app_name)
    created_by = _normalize(payload.created_by) or None
    if not name:
        conn.close()
        return _error("Application name is required", 400)
    
    # APP LIMIT CHECK
    if created_by:
        user = conn.execute("SELECT id, app_limit, total_apps_created FROM users WHERE username = ?", (created_by,)).fetchone()
        if user and user["total_apps_created"] >= user["app_limit"]:
            conn.close()
            return _error(f"❌ App limit reached! You have created {user['total_apps_created']}/{user['app_limit']} apps. Contact admin to increase.", 403)
    
    if conn.execute("SELECT id FROM applications WHERE lower(name) = lower(?) AND (created_by = ? OR (created_by IS NULL AND ? IS NULL))", (name, created_by, created_by)).fetchone():
        conn.close()
        return _error("You already have an application with this name", 409)
    
    app_id = f"app_{secrets.token_hex(4)}"
    owner_id = secrets.token_hex(4)
    app_key = _make_hash()
    app_secret = _make_hash()
    conn.execute("INSERT INTO applications (app_id, name, owner_id, app_key, app_secret, version, is_active, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        (app_id, name, owner_id, app_key, app_secret, payload.version or "1.0.0", created_by, _now_iso()))
    
    if created_by:
        conn.execute("UPDATE users SET total_apps_created = total_apps_created + 1 WHERE username = ?", (created_by,))
    
    _log_activity(conn, "app", "info", f"APP_CREATED: {name} (v{payload.version}) by {created_by or 'unknown'}")
    conn.commit()
    conn.close()
    return _success("Application created successfully", {"app_id": app_id, "owner_id": owner_id, "app_secret": app_secret, "remaining": max(0, (user["app_limit"] - user["total_apps_created"] - 1)) if created_by and user else "unlimited"})

@app.get("/api/admin/apps/{app_id}/credentials")
def get_app_credentials(app_id: str):
    conn = _db()
    row = conn.execute("SELECT * FROM applications WHERE app_id = ? OR CAST(id AS TEXT) = ?", (app_id, app_id)).fetchone()
    conn.close()
    if not row:
        return _error("Application not found", 404)
    return _success("ok", {"app_name": row["name"], "owner_id": row["owner_id"], "app_key": row["app_key"], "app_secret": row["app_secret"], "version": row["version"], "client_portal": "http://127.0.0.1:8000"})

@app.delete("/api/admin/apps/{app_id}")
def delete_app(app_id: str):
    conn = _db()
    result = conn.execute("DELETE FROM applications WHERE app_id = ? OR CAST(id AS TEXT) = ?", (app_id, app_id))
    conn.commit()
    conn.close()
    if not result.rowcount:
        return _error("Application not found", 404)
    return _success("Application deleted successfully")

# ============================================
# ANALYTICS
# ============================================
@app.get("/api/analytics")
def get_analytics():
    conn = _db()
    total_users = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    active_licenses = conn.execute("SELECT COUNT(*) as c FROM licenses WHERE is_active = 1").fetchone()["c"]
    expired_licenses = conn.execute("SELECT COUNT(*) as c FROM licenses WHERE is_lifetime = 0 AND datetime(expires_at) < datetime(?)", (_now_iso(),)).fetchone()["c"]
    login_activity_24h = conn.execute("SELECT COUNT(*) as c FROM activity_logs WHERE category = 'login' AND datetime(created_at) >= datetime(?, '-1 day')", (_now_iso(),)).fetchone()["c"]
    growth_rows = conn.execute("SELECT substr(created_at, 1, 10) as day, COUNT(*) as count FROM users GROUP BY day ORDER BY day DESC LIMIT 8").fetchall()
    conn.close()
    return _success("ok", {"total_users": total_users, "active_licenses": active_licenses, "expired_licenses": expired_licenses, "login_activity_24h": login_activity_24h, "user_growth": [{"label": row["day"], "value": row["count"]} for row in reversed(growth_rows)]})

# ============================================
# ACTIVITY LOGS
# ============================================
@app.get("/api/activity-logs")
def get_activity_logs():
    conn = _db()
    rows = conn.execute("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 200").fetchall()
    conn.close()
    return _success("ok", [{"id": row["id"], "category": row["category"], "severity": row["severity"], "message": row["message"], "created_at": row["created_at"]} for row in rows])

@app.delete("/api/admin/activity-logs")
def clear_activity_logs():
    conn = _db()
    conn.execute("DELETE FROM activity_logs")
    _log_activity(conn, "admin", "warning", "All activity logs cleared")
    conn.commit()
    conn.close()
    return _success("Activity logs cleared successfully")

# ============================================
# RESELLERS
# ============================================
@app.get("/api/resellers")
def get_resellers():
    conn = _db()
    rows = conn.execute("SELECT * FROM resellers ORDER BY id DESC").fetchall()
    conn.close()
    return _success("ok", [{"id": row["id"], "username": row["username"], "email": row["email"] or "", "credits": row["credits"], "users_created": row["users_created"], "commission_rate": row["commission_rate"] or 20.0, "phone": row["phone"] or "", "notes": row["notes"] or "", "status": "active" if row["is_active"] else "inactive", "created_at": row["created_at"]} for row in rows])

@app.post("/api/admin/resellers")
def create_reseller(payload: ResellerCreatePayload):
    conn = _db()
    if conn.execute("SELECT id FROM resellers WHERE username = ?", (payload.username,)).fetchone():
        conn.close()
        return _error("Reseller username already exists", 409)
    conn.execute("INSERT INTO resellers (username, email, password_hash, credits, commission_rate, phone, notes, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
        (payload.username, payload.email, _hash_password(payload.password), payload.credits, payload.commission_rate, payload.phone or "", payload.notes or "", _now_iso()))
    _log_activity(conn, "admin", "info", f"Reseller created: {payload.username}")
    conn.commit()
    conn.close()
    return _success("Reseller created successfully")

@app.delete("/api/admin/resellers/{reseller_id}")
def delete_reseller(reseller_id: int):
    conn = _db()
    result = conn.execute("DELETE FROM resellers WHERE id = ?", (reseller_id,))
    conn.commit()
    conn.close()
    if not result.rowcount:
        return _error("Reseller not found", 404)
    return _success("Reseller deleted successfully")

# ============================================
# API KEYS
# ============================================
@app.get("/api/api-keys")
def get_api_keys():
    conn = _db()
    rows = conn.execute("SELECT * FROM api_keys WHERE is_active = 1 ORDER BY id DESC").fetchall()
    conn.close()
    if not rows:
        return _success("ok", [])
    return _success("ok", [{"id": row["id"], "name": row["name"], "prefix": row["api_key"][:8] + "****", "permissions": row["permissions"], "created_at": row["created_at"], "last_used": row["last_used"] or "Never", "status": "active" if row["is_active"] else "revoked"} for row in rows])

@app.post("/api/admin/api-keys")
def create_api_key(payload: ApiKeyCreatePayload):
    conn = _db()
    api_key = _make_api_key()
    api_secret = _make_api_secret()
    expires_at = None
    if payload.expires_in_days > 0:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)).isoformat()
    conn.execute("INSERT INTO api_keys (name, api_key, api_secret, permissions, is_active, expires_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
        (payload.name, api_key, api_secret, json.dumps(payload.permissions), expires_at, _now_iso()))
    _log_activity(conn, "admin", "info", f"API key created: {payload.name}")
    conn.commit()
    conn.close()
    return _success("API key created successfully", {"name": payload.name, "key": api_key, "secret": api_secret, "prefix": api_key[:8] + "..."})

@app.post("/api/auth/verify-api-key")
def verify_api_key_route(payload: ApiKeyVerifyPayload):
    conn = _db()
    row = conn.execute("SELECT id, name, permissions, expires_at, is_active FROM api_keys WHERE api_key = ? AND api_secret = ?", (payload.api_key.strip(), payload.api_secret.strip())).fetchone()
    conn.close()
    if not row:
        return _error("Invalid API key or secret", 401)
    if not row["is_active"]:
        return _error("API key is revoked", 403)
    if row["expires_at"]:
        try:
            exp_dt = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt < datetime.now(timezone.utc):
                return _error("API key has expired", 403)
        except:
            pass
    perms_raw = row["permissions"] or "[]"
    try:
        parsed_perms = json.loads(perms_raw) if isinstance(perms_raw, str) else perms_raw
    except:
        parsed_perms = ["read"]
    return _success("Credentials are valid", {"id": row["id"], "name": row["name"], "permissions": parsed_perms})

@app.post("/api/auth/reseller-login")
def reseller_login(payload: ResellerLoginPayload):
    conn = _db()
    row = conn.execute("SELECT id, username, email, credits, users_created, commission_rate, password_hash, is_active FROM resellers WHERE lower(username) = lower(?)", (payload.username.strip(),)).fetchone()
    conn.close()
    if not row or not row["is_active"]:
        return _error("Invalid credentials", 401)
    if not row["password_hash"] or not _verify_password(payload.password, row["password_hash"]):
        return _error("Invalid credentials", 401)
    return _success("ok", {"id": row["id"], "username": row["username"], "email": row["email"] or "", "credits": row["credits"], "users_created": row["users_created"], "commission_rate": row["commission_rate"] or 20.0})

# ============================================
# USER HISTORY SYSTEM
# ============================================
@app.get("/api/history")
def get_user_history(username: Optional[str] = None, limit: int = 100):
    conn = _db()
    if username:
        rows = conn.execute("SELECT * FROM activity_logs WHERE message LIKE ? ORDER BY id DESC LIMIT ?", (f"%{username}%", limit)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return _success("ok", [{"id": row["id"], "category": row["category"], "severity": row["severity"], "message": row["message"], "created_at": row["created_at"]} for row in rows])

@app.get("/api/history/export")
def export_history(username: Optional[str] = None, days: int = 30):
    conn = _db()
    if username:
        rows = conn.execute("SELECT * FROM activity_logs WHERE message LIKE ? AND datetime(created_at) >= datetime(?, ?) ORDER BY id DESC", (f"%{username}%", _now_iso(), f"-{days} days")).fetchall()
    else:
        rows = conn.execute("SELECT * FROM activity_logs WHERE datetime(created_at) >= datetime(?, ?) ORDER BY id DESC", (_now_iso(), f"-{days} days")).fetchall()
    conn.close()
    
    lines = ["=" * 70, f"RINOXAUTH ACTIVITY LOG - EXPORTED: {_now_iso()}", f"USER: {username or 'ALL USERS'}", f"PERIOD: Last {days} days", "=" * 70, "", f"{'TIME':<22} {'SEVERITY':<10} {'ACTION'}", "-" * 70]
    for row in rows:
        time_str = row["created_at"][:19].replace("T", " ") if row["created_at"] else "N/A"
        lines.append(f"{time_str:<22} {row['severity'].upper():<10} {row['message']}")
    lines.extend(["-" * 70, f"TOTAL RECORDS: {len(rows)}", "=" * 70])
    
    text_content = "\n".join(lines)
    filename = f"history_{username or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    filepath = Path("exports") / filename
    filepath.parent.mkdir(exist_ok=True)
    filepath.write_text(text_content, encoding="utf-8")
    return _success("History exported", {"filename": filename, "path": str(filepath), "records": len(rows)})

# ============================================
# APP LIMIT SYSTEM
# ============================================
@app.get("/api/user/app-limit")
def get_app_limit(username: str):
    conn = _db()
    user = conn.execute("SELECT app_limit, total_apps_created FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not user:
        return _error("User not found", 404)
    remaining = user["app_limit"] - user["total_apps_created"]
    return _success("ok", {"limit": user["app_limit"], "created": user["total_apps_created"], "remaining": max(remaining, 0), "can_create": remaining > 0})

@app.patch("/api/admin/users/{user_id}/app-limit")
def update_app_limit(user_id: int, payload: dict):
    conn = _db()
    new_limit = payload.get("app_limit")
    if new_limit is None or new_limit < 0:
        conn.close()
        return _error("Valid app_limit required", 400)
    conn.execute("UPDATE users SET app_limit = ? WHERE id = ?", (new_limit, user_id))
    _log_activity(conn, "admin", "info", f"App limit updated to {new_limit} for user ID: {user_id}")
    conn.commit()
    conn.close()
    return _success(f"App limit updated to {new_limit}")

# ============================================
# SETTINGS
# ============================================
@app.get("/api/settings")
def get_settings():
    conn = _db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    settings_dict = {row["key"]: row["value"] for row in rows}
    return _success("ok", {"app_name": settings_dict.get("app_name", "RinoxAuth"), "owner_id": settings_dict.get("owner_id", "admin"), "theme": settings_dict.get("theme", "dark"), "language": settings_dict.get("language", "en"), "timezone": settings_dict.get("timezone", "Asia/Dhaka (GMT+6)"), "date_format": settings_dict.get("date_format", "DD/MM/YYYY"), "auth_mode": settings_dict.get("auth_mode", "jwt+session"), "session_cookie_name": "auth_session", "session_timeout": int(settings_dict.get("session_timeout", "1440")), "email_notifications": settings_dict.get("email_notifications", "true"), "push_notifications": settings_dict.get("push_notifications", "false"), "login_alerts": settings_dict.get("login_alerts", "true"), "license_expiry_alerts": settings_dict.get("license_expiry_alerts", "true"), "weekly_report": settings_dict.get("weekly_report", "false")})

@app.patch("/api/settings")
def update_settings(settings_update: dict):
    conn = _db()
    for key, value in settings_update.items():
        conn.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)", (key, str(value), _now_iso()))
    _log_activity(conn, "admin", "info", "Settings updated")
    conn.commit()
    conn.close()
    return _success("Settings updated successfully")

# ============================================
# DISCORD WEBHOOK SYSTEM
# ============================================
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1497639178220077339/EEdGLjR6ZnM36AIn14tEnjgGvTDBUymxY7RtmytOxfm3DPz1iTdODTQAYdRoIl9nQWkA"

def generate_history_file(username: str = None, days: int = 7) -> str:
    conn = _db()
    if username:
        rows = conn.execute("SELECT * FROM activity_logs WHERE message LIKE ? AND datetime(created_at) >= datetime(?, ?) ORDER BY id DESC", (f"%{username}%", _now_iso(), f"-{days} days")).fetchall()
    else:
        rows = conn.execute("SELECT * FROM activity_logs WHERE datetime(created_at) >= datetime(?, ?) ORDER BY id DESC", (_now_iso(), f"-{days} days")).fetchall()
    conn.close()
    lines = ["=" * 70, f"RINOXAUTH ACTIVITY LOG - {_now_iso()}", f"User: {username or 'ALL USERS'} | Period: Last {days} days", "=" * 70, f"{'TIME':<22} {'TYPE':<15} {'DETAILS'}", "-" * 70]
    for row in rows:
        time_str = row["created_at"][:19].replace("T", " ") if row["created_at"] else "N/A"
        lines.append(f"{time_str:<22} {row['category'].upper():<15} {row['message']}")
    lines.extend(["-" * 70, f"TOTAL: {len(rows)} records", "=" * 70])
    text_content = "\n".join(lines)
    export_dir = Path("exports")
    export_dir.mkdir(exist_ok=True)
    filename = f"history_{username or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    filepath = export_dir / filename
    filepath.write_text(text_content, encoding="utf-8")
    return str(filepath)

def send_file_to_discord(filepath: str, message: str = ""):
    if not DISCORD_WEBHOOK_URL:
        return False
    try:
        with open(filepath, "rb") as f:
            files = {"file": (os.path.basename(filepath), f, "text/plain")}
            data = {"content": message} if message else {}
            return requests.post(DISCORD_WEBHOOK_URL, data=data, files=files).status_code == 200
    except Exception as e:
        print(f"❌ Discord send failed: {e}")
        return False

def send_discord_message(content: str):
    if not DISCORD_WEBHOOK_URL:
        return
    try:
        requests.post(DISCORD_WEBHOOK_URL, json={"content": content[:2000]})
    except:
        pass

@app.get("/api/discord/command")
def discord_command(cmd: str, param: Optional[str] = None):
    if cmd == "history":
        filepath = generate_history_file(param, days=7)
        if filepath:
            send_file_to_discord(filepath, f"📜 History for {param or 'all users'} (7 days)")
            return _success("History sent to Discord")
        return _error("Failed")
    elif cmd == "historyall":
        days = int(param) if param else 30
        filepath = generate_history_file(days=days)
        if filepath:
            send_file_to_discord(filepath, f"📜 Complete history ({days} days)")
            return _success("History sent to Discord")
        return _error("Failed")
    elif cmd == "recent":
        conn = _db()
        rows = conn.execute("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 10").fetchall()
        conn.close()
        lines = ["**Recent 10 Activities:**"]
        for row in rows:
            time_str = row["created_at"][:19].replace("T", " ") if row["created_at"] else "N/A"
            lines.append(f"`[{time_str}]` {row['message']}")
        send_discord_message("\n".join(lines))
        return _success("Sent to Discord")
    elif cmd == "addlimit":
        if param:
            parts = param.split()
            if len(parts) >= 2:
                username, limit = parts[0], int(parts[1])
                conn = _db()
                conn.execute("UPDATE users SET app_limit = ? WHERE username = ?", (limit, username))
                conn.commit()
                conn.close()
                send_discord_message(f"✅ @{username}'s app limit set to {limit}")
                return _success(f"Limit updated for {username}")
        return _error("Usage: addlimit username 5")
    elif cmd == "checklimit":
        if param:
            conn = _db()
            user = conn.execute("SELECT username, app_limit, total_apps_created, plan FROM users WHERE username = ?", (param,)).fetchone()
            conn.close()
            if user:
                remaining = max(0, user["app_limit"] - user["total_apps_created"])
                send_discord_message(f"📊 **@{user['username']}**: {user['total_apps_created']}/{user['app_limit']} apps ({remaining} remaining) | {user['plan']}")
                return _success("ok")
        return _error("User not found")
    elif cmd == "listusers":
        conn = _db()
        users = conn.execute("SELECT username, app_limit, total_apps_created, plan, email FROM users ORDER BY username").fetchall()
        conn.close()
        lines = ["**👥 ALL USERS:**"]
        for i, u in enumerate(users, 1):
            remaining = max(0, u["app_limit"] - u["total_apps_created"])
            email_info = f" ({u['email']})" if u['email'] else ""
            lines.append(f"{i}. **@{u['username']}**{email_info}: {u['total_apps_created']}/{u['app_limit']} apps ({u['plan']})")
        send_discord_message("\n".join(lines))
        return _success("User list sent to Discord")
    elif cmd == "help":
        return _success("ok", {"help": "!history, !historyall, !recent, !addlimit, !checklimit, !listusers"})
    return _error("Unknown command")

# ============================================
# RUN
# ============================================
if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 RinoxAuth Backend v2.0.0")
    print("=" * 60)
    print(f"   📁 Database: {DB_PATH}")
    print(f"   🌐 CORS: {CORS_ORIGINS}")
    print(f"   📡 Server: http://0.0.0.0:8000")
    print(f"   📚 Docs: http://0.0.0.0:8000/docs")
    print(f"   ⚠️  No default data - First user must register")
    print("=" * 60)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")