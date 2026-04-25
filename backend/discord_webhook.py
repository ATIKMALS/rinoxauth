import os
from datetime import datetime, timezone
from pathlib import Path
import requests
import sqlite3
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ✅ CORRECT: Variable name, not URL
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")


def generate_history_file(username: str = None, days: int = 7) -> str:
    """Generate history text file"""
    DB_PATH = Path(os.getenv("DB_PATH", "auth.db"))
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    if username:
        rows = conn.execute(
            """
            SELECT * FROM activity_logs 
            WHERE message LIKE ? 
            AND datetime(created_at) >= datetime(?, ?)
            ORDER BY id DESC
            """,
            (f"%{username}%", datetime.now(timezone.utc).isoformat(), f"-{days} days")
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM activity_logs 
            WHERE datetime(created_at) >= datetime(?, ?)
            ORDER BY id DESC
            """,
            (datetime.now(timezone.utc).isoformat(), f"-{days} days")
        ).fetchall()
    
    conn.close()
    
    lines = []
    lines.append("=" * 70)
    lines.append(f"RINOXAUTH ACTIVITY LOG")
    lines.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    lines.append(f"User: {username or 'ALL USERS'}")
    lines.append(f"Period: Last {days} days")
    lines.append("=" * 70)
    lines.append("")
    
    login_count = sum(1 for r in rows if "LOGIN" in r["message"])
    app_count = sum(1 for r in rows if "APP_CREATED" in r["message"])
    user_count = sum(1 for r in rows if "USER_CREATED" in r["message"])
    license_count = sum(1 for r in rows if "LICENSE" in r["message"])
    
    lines.append(f"📊 STATISTICS:")
    lines.append(f"   • Logins: {login_count}")
    lines.append(f"   • Apps Created: {app_count}")
    lines.append(f"   • Users Created: {user_count}")
    lines.append(f"   • Licenses Generated: {license_count}")
    lines.append(f"   • Total Actions: {len(rows)}")
    lines.append("")
    lines.append(f"{'TIME':<22} {'TYPE':<15} {'DETAILS'}")
    lines.append("-" * 70)
    
    for row in rows:
        time_str = row["created_at"][:19].replace("T", " ") if row["created_at"] else "N/A"
        category = row["category"].upper()
        message = row["message"]
        lines.append(f"{time_str:<22} {category:<15} {message}")
    
    lines.append("-" * 70)
    lines.append(f"TOTAL RECORDS: {len(rows)}")
    lines.append("=" * 70)
    
    text_content = "\n".join(lines)
    
    export_dir = Path("exports")
    export_dir.mkdir(exist_ok=True)
    
    filename = f"history_{username or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    filepath = export_dir / filename
    filepath.write_text(text_content, encoding="utf-8")
    
    return str(filepath)


def get_recent_activities(limit: int = 10) -> str:
    """Get recent activities"""
    DB_PATH = Path(os.getenv("DB_PATH", "auth.db"))
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    rows = conn.execute(
        "SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    
    lines = [f"**Recent {limit} Activities:**"]
    for row in rows:
        time_str = row["created_at"][:19].replace("T", " ") if row["created_at"] else "N/A"
        lines.append(f"`[{time_str}]` {row['message']}")
    
    return "\n".join(lines)


def handle_discord_command(user_message: str):
    """Handle commands from Discord"""
    message = user_message.strip().lower()
    
    if message.startswith("!history"):
        parts = message.split()
        if len(parts) >= 2:
            username = parts[1].replace("@", "")
            filepath = generate_history_file(username, days=7)
            if filepath:
                send_file_to_discord(filepath, f"📜 History for @{username} (Last 7 days)")
                return f"✅ History exported for @{username}! Check Discord."
            return "❌ Failed to generate history"
        else:
            filepath = generate_history_file(days=7)
            if filepath:
                send_file_to_discord(filepath, "📜 All users history (Last 7 days)")
                return "✅ Full history exported! Check Discord."
            return "❌ Failed to generate history"
    
    elif message.startswith("!historyall"):
        parts = message.split()
        days = int(parts[1]) if len(parts) > 1 else 30
        filepath = generate_history_file(days=days)
        if filepath:
            send_file_to_discord(filepath, f"📜 Complete history (Last {days} days)")
            return f"✅ Complete history ({days} days) exported! Check Discord."
        return "❌ Failed to generate history"
    
    elif message == "!recent":
        return get_recent_activities(10)
    
    elif message.startswith("!addlimit"):
        parts = message.split()
        if len(parts) >= 3:
            username = parts[1].replace("@", "")
            try:
                new_limit = int(parts[2])
                return update_user_limit(username, new_limit)
            except:
                return "❌ Invalid limit number. Use: !addlimit @username 5"
        return "❌ Usage: !addlimit @username <number>"
    
    elif message.startswith("!checklimit"):
        parts = message.split()
        if len(parts) >= 2:
            username = parts[1].replace("@", "")
            return check_user_limit(username)
        return "❌ Usage: !checklimit @username"
    
    elif message == "!listusers":
        return list_all_users()
    
    elif message == "!help":
        return """
**📜 RINOXAUTH COMMANDS:**
`!history @username` - Export user history (7 days)
`!historyall 30` - Export all history (30 days)
`!recent` - Show last 10 activities
`!addlimit @username 5` - Set user's app limit
`!checklimit @username` - Check user's limit
`!listusers` - List all users with limits
"""
    
    return None


def update_user_limit(username: str, limit: int):
    """Update user's app limit"""
    DB_PATH = Path(os.getenv("DB_PATH", "auth.db"))
    conn = sqlite3.connect(str(DB_PATH))
    
    user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if not user:
        conn.close()
        return f"❌ User @{username} not found"
    
    conn.execute("UPDATE users SET app_limit = ? WHERE username = ?", (limit, username))
    conn.commit()
    conn.close()
    
    return f"✅ @{username}'s app limit set to {limit}"


def check_user_limit(username: str):
    """Check user's limit"""
    DB_PATH = Path(os.getenv("DB_PATH", "auth.db"))
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    user = conn.execute(
        "SELECT username, app_limit, total_apps_created, plan FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    conn.close()
    
    if not user:
        return f"❌ User @{username} not found"
    
    remaining = max(0, user["app_limit"] - user["total_apps_created"])
    return f"📊 **@{user['username']}**: {user['total_apps_created']}/{user['app_limit']} apps ({remaining} remaining) | Plan: {user['plan']}"


def list_all_users():
    """List all users with limits"""
    DB_PATH = Path(os.getenv("DB_PATH", "auth.db"))
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    users = conn.execute(
        "SELECT username, app_limit, total_apps_created, plan, email FROM users ORDER BY username"
    ).fetchall()
    conn.close()
    
    lines = ["**👥 ALL USERS:**"]
    for i, u in enumerate(users, 1):
        remaining = max(0, u["app_limit"] - u["total_apps_created"])
        email_info = f" ({u['email']})" if u['email'] else ""
        lines.append(f"{i}. **@{u['username']}**{email_info}: {u['total_apps_created']}/{u['app_limit']} apps ({u['plan']})")
    
    return "\n".join(lines)


def send_file_to_discord(filepath: str, message: str = ""):
    """Send file to Discord via webhook"""
    if not DISCORD_WEBHOOK_URL:
        print("⚠️ DISCORD_WEBHOOK_URL not set in .env file")
        return False
    
    try:
        with open(filepath, "rb") as f:
            files = {"file": (os.path.basename(filepath), f, "text/plain")}
            data = {"content": message} if message else {}
            response = requests.post(DISCORD_WEBHOOK_URL, data=data, files=files)
            if response.status_code == 200:
                print(f"✅ File sent to Discord: {filepath}")
                return True
            else:
                print(f"❌ Discord error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"❌ Failed to send file: {e}")
        return False