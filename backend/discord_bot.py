# discord_bot.py - RinoxAuth Professional Admin Panel
import discord
import requests
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
BASE_URL = os.getenv("BASE_URL", "https://rinoxauth.onrender.com")
start_time = time.time()

# Color codes for embeds
COLORS = {
    "success": 0x00FF00,  # Green
    "error": 0xFF0000,    # Red
    "info": 0x3498DB,     # Blue
    "warning": 0xF1C40F,  # Yellow
    "purple": 0x9B59B6,   # Purple
    "dark": 0x2C3E50,     # Dark
}

class RinoxAdminBot(discord.Client):
    async def on_ready(self):
        print(f"""
╔══════════════════════════════════════╗
║  🤖 RinoxAuth Admin Panel           ║
║  ✅ Bot: {self.user.name:<26} ║
║  📡 API: {BASE_URL:<26} ║
║  ⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<30} ║
╚══════════════════════════════════════╝
        """)
    
    async def on_message(self, message):
        if message.author == self.user:
            return
        
        content = message.content.strip()
        parts = content.split()
        cmd = parts[0].lower() if parts else ""
        args = parts[1:] if len(parts) > 1 else []
        
        # ============================================================
        # 🏠 HELP - Main Menu
        # ============================================================
        if cmd == "!help" or cmd == "!menu":
            embed = discord.Embed(
                title="🏰 RinoxAuth Admin Control Panel",
                description="Professional License & User Management System",
                color=COLORS["purple"],
                timestamp=datetime.utcnow()
            )
            embed.add_field(name="👤 User Management", value="`!users` `!user @name` `!adduser` `!deluser @name` `!ban @name` `!unban @name` `!resetpass @name`", inline=False)
            embed.add_field(name="🔑 License Management", value="`!licenses` `!genkey @name app plan` `!revoke key` `!verify key`", inline=False)
            embed.add_field(name="📱 App Management", value="`!apps` `!app id` `!addapp name ver` `!delapp id` `!topapps`", inline=False)
            embed.add_field(name="📧 Email/Gmail Tracking", value="`!emails` `!email @name` `!gmails` `!gmail user@gmail.com`", inline=False)
            embed.add_field(name="📊 Analytics", value="`!stats` `!report` `!growth` `!topusers` `!daily` `!weekly`", inline=False)
            embed.add_field(name="📜 History & Logs", value="`!history @name` `!recent` `!audit @name` `!clearlogs`", inline=False)
            embed.add_field(name="⚙️ Admin Controls", value="`!limit @name 5` `!check @name` `!broadcast msg` `!backup` `!resellers`", inline=False)
            embed.add_field(name="🔧 Utility", value="`!ping` `!search keyword` `!export` `!compare @a @b`", inline=False)
            embed.set_footer(text="RinoxAuth v2.0 • Professional Edition")
            await message.channel.send(embed=embed)
            return
        
        # ============================================================
        # 🏓 PING
        # ============================================================
        if cmd == "!ping":
            uptime = int(time.time() - start_time)
            h, m, s = uptime // 3600, (uptime % 3600) // 60, uptime % 60
            embed = discord.Embed(title="🏓 System Status", color=COLORS["success"])
            embed.add_field(name="Bot Status", value="✅ Online", inline=True)
            embed.add_field(name="API Status", value=f"✅ Connected\n{BASE_URL}", inline=True)
            embed.add_field(name="Uptime", value=f"{h}h {m}m {s}s", inline=True)
            await message.channel.send(embed=embed)
            return
        
        # ============================================================
        # 👤 USER MANAGEMENT
        # ============================================================
        
        # !users - List all users with details
        if cmd == "!users":
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            
            if not users:
                await message.channel.send("❌ No users found")
                return
            
            embed = discord.Embed(title=f"👥 All Users ({len(users)})", color=COLORS["info"])
            
            active = sum(1 for u in users if u.get("status") == "active")
            banned = sum(1 for u in users if u.get("status") == "banned")
            embed.add_field(name="📊 Summary", value=f"✅ Active: {active}\n🚫 Banned: {banned}\n👥 Total: {len(users)}", inline=False)
            
            user_list = []
            for u in users[:20]:
                status_emoji = "✅" if u.get("status") == "active" else "🚫" if u.get("status") == "banned" else "⏸️"
                user_list.append(f"{status_emoji} **@{u['username']}** | {u.get('plan','free')} | 📧 {u.get('email','N/A')}")
            
            embed.add_field(name="📋 User List", value="\n".join(user_list) if user_list else "No users", inline=False)
            
            if len(users) > 20:
                embed.set_footer(text=f"Showing 20 of {len(users)} users • Use !search to find specific")
            
            await message.channel.send(embed=embed)
            return
        
        # !user @username - Detailed user info
        if cmd == "!user":
            if not args:
                await message.channel.send("❌ `!user @username`")
                return
            
            username = args[0].replace("@", "")
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            user = next((u for u in users if u["username"].lower() == username.lower()), None)
            
            if not user:
                await message.channel.send(f"❌ User @{username} not found")
                return
            
            # Get user's apps
            res2 = requests.get(f"{BASE_URL}/api/apps?created_by={username}")
            apps = res2.json().get("data", [])
            
            # Get user's licenses
            res3 = requests.get(f"{BASE_URL}/api/licenses")
            all_licenses = res3.json().get("data", [])
            user_licenses = [l for l in all_licenses if l.get("issued_to") == username]
            
            embed = discord.Embed(title=f"👤 User: @{user['username']}", color=COLORS["info"])
            embed.add_field(name="📋 Basic Info", value=f"🆔 ID: {user['id']}\n📧 Email: {user.get('email','N/A')}\n📊 Plan: {user.get('plan','free')}\n✅ Status: {user.get('status','N/A')}", inline=True)
            embed.add_field(name="📅 Dates", value=f"Created: {user.get('created_at','N/A')[:10]}\nExpires: {user.get('expires_at','N/A')[:10]}\nLast Login: {user.get('last_login','Never')[:19] if user.get('last_login') else 'Never'}", inline=True)
            embed.add_field(name="🔒 Security", value=f"HWID Lock: {'✅' if user.get('hwid_lock') else '❌'}\nDevices: {user.get('devices',0)}", inline=True)
            embed.add_field(name=f"📱 Apps ({len(apps)})", value="\n".join([f"• {a['name']} (v{a['version']})" for a in apps[:5]]) or "None", inline=False)
            embed.add_field(name=f"🔑 Licenses ({len(user_licenses)})", value="\n".join([f"• `{l['key'][:16]}...` ({l['plan']})" for l in user_licenses[:5]]) or "None", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # !adduser @name pass plan app_id
        if cmd == "!adduser":
            if len(args) < 4:
                await message.channel.send("❌ `!adduser @name password plan app_id`")
                return
            username, password, plan, app_id = args[0].replace("@",""), args[1], args[2], args[3]
            res = requests.post(f"{BASE_URL}/api/admin/users", json={
                "username": username, "password": password, "plan": plan, "app_id": int(app_id), "expires_in_days": 30
            })
            if res.status_code == 200:
                await message.channel.send(f"✅ User **@{username}** created!\n📊 Plan: {plan}\n🆔 App: {app_id}")
            else:
                await message.channel.send(f"❌ {res.json().get('message','Failed')}")
            return
        
        # !deluser @name
        if cmd == "!deluser":
            if not args:
                await message.channel.send("❌ `!deluser @username`")
                return
            username = args[0].replace("@", "")
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            user = next((u for u in users if u["username"].lower() == username.lower()), None)
            if user:
                requests.delete(f"{BASE_URL}/api/admin/users/{user['id']}")
                await message.channel.send(f"✅ @{username} deleted!")
            else:
                await message.channel.send(f"❌ User not found")
            return
        
        # !ban / !unban @name
        if cmd in ["!ban", "!unban"]:
            if not args:
                await message.channel.send(f"❌ `{cmd} @username`")
                return
            username = args[0].replace("@", "")
            status = "banned" if cmd == "!ban" else "active"
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            user = next((u for u in users if u["username"].lower() == username.lower()), None)
            if user:
                requests.patch(f"{BASE_URL}/api/admin/users/{user['id']}", json={"status": status})
                emoji = "🚫" if status == "banned" else "✅"
                await message.channel.send(f"{emoji} @{username} {status}!")
            return
        
        # !resetpass @name newpass
        if cmd == "!resetpass":
            if len(args) < 2:
                await message.channel.send("❌ `!resetpass @username newpassword`")
                return
            username, newpass = args[0].replace("@",""), args[1]
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            user = next((u for u in users if u["username"].lower() == username.lower()), None)
            if user:
                requests.patch(f"{BASE_URL}/api/admin/users/{user['id']}", json={"password": newpass})
                await message.channel.send(f"✅ Password reset for @{username}!\n🔑 New: ||{newpass}||")
            return
        
        # ============================================================
        # 📧 EMAIL / GMAIL TRACKING
        # ============================================================
        
        # !emails - List all emails
        if cmd == "!emails":
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            
            users_with_email = [u for u in users if u.get("email")]
            
            embed = discord.Embed(title=f"📧 Registered Emails ({len(users_with_email)})", color=COLORS["info"])
            
            # Group by domain
            gmail = [u for u in users_with_email if "gmail" in u.get("email","").lower()]
            yahoo = [u for u in users_with_email if "yahoo" in u.get("email","").lower()]
            outlook = [u for u in users_with_email if "outlook" in u.get("email","").lower()]
            other = [u for u in users_with_email if not any(d in u.get("email","").lower() for d in ["gmail","yahoo","outlook"])]
            
            embed.add_field(name=f"Gmail ({len(gmail)})", value="\n".join([f"• @{u['username']}: {u['email']}" for u in gmail[:10]]) or "None", inline=False)
            if yahoo:
                embed.add_field(name=f"Yahoo ({len(yahoo)})", value="\n".join([f"• @{u['username']}: {u['email']}" for u in yahoo[:5]]) or "None", inline=False)
            if outlook:
                embed.add_field(name=f"Outlook ({len(outlook)})", value="\n".join([f"• @{u['username']}: {u['email']}" for u in outlook[:5]]) or "None", inline=False)
            if other:
                embed.add_field(name=f"Other ({len(other)})", value="\n".join([f"• @{u['username']}: {u['email']}" for u in other[:5]]) or "None", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # !gmails - All Gmail users
        if cmd == "!gmails":
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            gmail_users = [u for u in users if "gmail" in u.get("email","").lower()]
            
            embed = discord.Embed(title=f"📧 Gmail Users ({len(gmail_users)})", color=COLORS["purple"])
            
            for u in gmail_users[:25]:
                apps_count = sum(1 for a in requests.get(f"{BASE_URL}/api/apps?created_by={u['username']}").json().get("data", []))
                embed.add_field(
                    name=f"@{u['username']}",
                    value=f"📧 {u['email']}\n📊 {u['plan']} | 📱 {apps_count} apps | ✅ {u['status']}",
                    inline=True
                )
            
            if len(gmail_users) > 25:
                embed.set_footer(text=f"Showing 25 of {len(gmail_users)} Gmail users")
            
            await message.channel.send(embed=embed)
            return
        
        # !gmail user@gmail.com - Find by email
        if cmd == "!gmail":
            if not args:
                await message.channel.send("❌ `!gmail user@gmail.com`")
                return
            
            email = args[0].lower()
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            found = [u for u in users if email in u.get("email","").lower()]
            
            if not found:
                await message.channel.send(f"❌ No user found with email: {email}")
                return
            
            embed = discord.Embed(title=f"🔍 Email Search: {email}", color=COLORS["info"])
            for u in found:
                apps = requests.get(f"{BASE_URL}/api/apps?created_by={u['username']}").json().get("data", [])
                embed.add_field(
                    name=f"@{u['username']}",
                    value=f"📧 {u['email']}\n📊 {u['plan']}\n📱 {len(apps)} apps\n📅 Expires: {u.get('expires_at','N/A')[:10]}",
                    inline=False
                )
            
            await message.channel.send(embed=embed)
            return
        
        # ============================================================
        # 📱 APPLICATION MANAGEMENT
        # ============================================================
        
        # !apps - All applications with details
        if cmd == "!apps":
            res = requests.get(f"{BASE_URL}/api/apps")
            apps = res.json().get("data", [])
            
            if not apps:
                await message.channel.send("❌ No apps found")
                return
            
            embed = discord.Embed(title=f"📱 All Applications ({len(apps)})", color=COLORS["info"])
            
            for a in apps[:15]:
                # Get users for this app
                res2 = requests.get(f"{BASE_URL}/api/users")
                all_users = res2.json().get("data", [])
                app_users = [u for u in all_users if u.get("application_id") == a["id"]]
                
                embed.add_field(
                    name=f"{a['name']} (v{a['version']})",
                    value=f"🆔 ID: {a['id']}\n👥 Users: {len(app_users)}\n📊 Status: {a.get('status','N/A')}\n🔑 Owner: {a.get('owner_id','N/A')[:8]}...",
                    inline=True
                )
            
            if len(apps) > 15:
                embed.set_footer(text=f"Showing 15 of {len(apps)} apps")
            
            await message.channel.send(embed=embed)
            return
        
        # !app id - Detailed app info
        if cmd == "!app":
            if not args:
                await message.channel.send("❌ `!app app_id`")
                return
            
            app_id = args[0]
            res = requests.get(f"{BASE_URL}/api/admin/apps/{app_id}/credentials")
            app = res.json().get("data", {})
            
            if not app:
                await message.channel.send("❌ App not found")
                return
            
            # Get users for this app
            res2 = requests.get(f"{BASE_URL}/api/users")
            users = [u for u in res2.json().get("data", []) if u.get("application_id") == int(app_id)]
            
            embed = discord.Embed(title=f"📱 {app['app_name']}", color=COLORS["purple"])
            embed.add_field(name="📋 Details", value=f"🆔 ID: {app_id}\n📦 Version: {app['version']}\n👥 Users: {len(users)}", inline=True)
            embed.add_field(name="🔑 Credentials", value=f"Owner ID: {app.get('owner_id','N/A')[:16]}...\nApp Key: {app.get('app_key','N/A')[:16]}...\nSecret: ||{app.get('app_secret','N/A')[:16]}...||", inline=True)
            
            if users:
                embed.add_field(name=f"👤 Users ({len(users)})", value="\n".join([f"• @{u['username']} ({u['plan']})" for u in users[:10]]) or "None", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # !addapp name version
        if cmd == "!addapp":
            if len(args) < 2:
                await message.channel.send("❌ `!addapp name version`")
                return
            name, version = args[0], args[1]
            res = requests.post(f"{BASE_URL}/api/admin/apps", json={"app_name": name, "version": version})
            if res.status_code == 200:
                data = res.json().get("data", {})
                await message.channel.send(f"✅ App **{name}** created!\n🔑 Secret: ||{data.get('app_secret','N/A')}||")
            else:
                await message.channel.send(f"❌ {res.json().get('message','Failed')}")
            return
        
        # !delapp id
        if cmd == "!delapp":
            if not args:
                await message.channel.send("❌ `!delapp app_id`")
                return
            requests.delete(f"{BASE_URL}/api/admin/apps/{args[0]}")
            await message.channel.send(f"✅ App deleted!")
            return
        
        # !topapps
        if cmd == "!topapps":
            res = requests.get(f"{BASE_URL}/api/apps")
            apps = res.json().get("data", [])
            sorted_apps = sorted(apps, key=lambda a: a.get("users", 0), reverse=True)
            
            embed = discord.Embed(title="🏆 Top Applications", color=COLORS["warning"])
            for i, a in enumerate(sorted_apps[:10], 1):
                embed.add_field(name=f"#{i} {a['name']}", value=f"👥 {a.get('users',0)} users | v{a['version']}", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # ============================================================
        # 📊 ANALYTICS
        # ============================================================
        
        # !stats - Dashboard stats
        if cmd == "!stats":
            res = requests.get(f"{BASE_URL}/api/dashboard/stats")
            s = res.json().get("data", {})
            
            embed = discord.Embed(title="📊 Dashboard Statistics", color=COLORS["success"])
            embed.add_field(name="👥 Users", value=f"Total: {s.get('total_users',0)}\nActive: {s.get('active_users',0)}", inline=True)
            embed.add_field(name="🔑 Licenses", value=f"Active: {s.get('active_licenses',0)}\nExpired: {s.get('expired_licenses',0)}", inline=True)
            embed.add_field(name="📈 Performance", value=f"Success Rate: {s.get('success_rate',0)}%\nRequests: {s.get('requests_today',0)}", inline=True)
            embed.add_field(name="🔐 Security", value=f"Failed Logins: {s.get('failed_logins',0)}\n24h Activity: {s.get('login_activity_24h',0)}", inline=True)
            
            await message.channel.send(embed=embed)
            return
        
        # !report - Full report
        if cmd == "!report":
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            
            res2 = requests.get(f"{BASE_URL}/api/licenses")
            licenses = res2.json().get("data", [])
            
            res3 = requests.get(f"{BASE_URL}/api/apps")
            apps = res3.json().get("data", [])
            
            total_users = len(users)
            active_users = sum(1 for u in users if u.get("status") == "active")
            total_licenses = len(licenses)
            active_licenses = sum(1 for l in licenses if l.get("status") == "active")
            total_apps = len(apps)
            
            # Plan distribution
            plans = {}
            for u in users:
                plan = u.get("plan", "free")
                plans[plan] = plans.get(plan, 0) + 1
            
            embed = discord.Embed(title="📊 Complete System Report", color=COLORS["dark"], timestamp=datetime.utcnow())
            embed.add_field(name="👥 Users", value=f"Total: {total_users}\nActive: {active_users}\nBanned: {sum(1 for u in users if u.get('status')=='banned')}", inline=True)
            embed.add_field(name="🔑 Licenses", value=f"Total: {total_licenses}\nActive: {active_licenses}\nRevoked: {sum(1 for l in licenses if l.get('status')=='revoked')}", inline=True)
            embed.add_field(name="📱 Apps", value=f"Total: {total_apps}", inline=True)
            
            plan_text = "\n".join([f"• {p}: {c} users" for p, c in sorted(plans.items())])
            embed.add_field(name="📊 Plans Distribution", value=plan_text or "No data", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # !growth
        if cmd == "!growth":
            res = requests.get(f"{BASE_URL}/api/analytics")
            data = res.json().get("data", {})
            growth = data.get("user_growth", [])
            
            if growth:
                embed = discord.Embed(title="📈 User Growth (Last 8 Days)", color=COLORS["success"])
                growth_text = "\n".join([f"• {g['label']}: {g['value']} users" for g in growth])
                embed.add_field(name="Daily Growth", value=growth_text, inline=False)
                await message.channel.send(embed=embed)
            return
        
        # !topusers
        if cmd == "!topusers":
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            
            sorted_users = sorted(users, key=lambda u: len([a for a in requests.get(f"{BASE_URL}/api/apps?created_by={u['username']}").json().get("data", [])]), reverse=True)
            
            embed = discord.Embed(title="🏆 Top Users by Apps Created", color=COLORS["warning"])
            for i, u in enumerate(sorted_users[:10], 1):
                apps_count = len(requests.get(f"{BASE_URL}/api/apps?created_by={u['username']}").json().get("data", []))
                embed.add_field(name=f"#{i} @{u['username']}", value=f"📱 {apps_count} apps | 📊 {u.get('plan','free')} | 📧 {u.get('email','N/A')}", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # !daily / !weekly
        if cmd in ["!daily", "!weekly"]:
            days = 1 if cmd == "!daily" else 7
            res = requests.get(f"{BASE_URL}/api/history/export?days={days}")
            data = res.json()
            await message.channel.send(f"📜 {cmd.capitalize()} Report: {data.get('message','')}\n📝 {data.get('data',{}).get('records',0)} records")
            return
        
        # ============================================================
        # 📜 HISTORY & LOGS
        # ============================================================
        
        # !history @name
        if cmd == "!history":
            param = args[0].replace("@", "") if args else ""
            requests.get(f"{BASE_URL}/api/discord/command?cmd=history&param={param}")
            await message.channel.send(f"📜 History exported for **{param or 'all users'}**! Check channel for file.")
            return
        
        # !recent
        if cmd == "!recent":
            requests.get(f"{BASE_URL}/api/discord/command?cmd=recent")
            return
        
        # !audit @name
        if cmd == "!audit":
            username = args[0].replace("@", "") if args else ""
            res = requests.get(f"{BASE_URL}/api/history?username={username}&limit=20")
            logs = res.json().get("data", [])
            
            embed = discord.Embed(title=f"📜 Audit Log: {username or 'ALL'}", color=COLORS["dark"])
            log_text = "\n".join([f"`[{l['created_at'][:19]}]` {l['message'][:80]}" for l in logs[:15]])
            embed.add_field(name="Recent Activity", value=log_text or "No logs", inline=False)
            await message.channel.send(embed=embed)
            return
        
        # !clearlogs
        if cmd == "!clearlogs":
            requests.delete(f"{BASE_URL}/api/admin/activity-logs")
            await message.channel.send("✅ Activity logs cleared!")
            return
        
        # ============================================================
        # ⚙️ ADMIN CONTROLS
        # ============================================================
        
        # !limit @name 5
        if cmd == "!limit":
            if len(args) < 2:
                await message.channel.send("❌ `!limit @username 5`")
                return
            username, limit = args[0].replace("@",""), args[1]
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            user = next((u for u in users if u["username"].lower() == username.lower()), None)
            if user:
                requests.patch(f"{BASE_URL}/api/admin/users/{user['id']}/app-limit", json={"app_limit": int(limit)})
                await message.channel.send(f"✅ @{username} app limit → **{limit}**")
            return
        
        # !check @name
        if cmd == "!check":
            if not args:
                await message.channel.send("❌ `!check @username`")
                return
            username = args[0].replace("@", "")
            res = requests.get(f"{BASE_URL}/api/user/app-limit?username={username}")
            data = res.json().get("data", {})
            if data:
                await message.channel.send(f"📊 **@{username}**: {data['created']}/{data['limit']} apps ({data['remaining']} remaining)")
            else:
                await message.channel.send(f"❌ User not found")
            return
        
        # !broadcast message
        if cmd == "!broadcast":
            msg = " ".join(args)
            if msg:
                requests.post(f"{BASE_URL}/api/discord/command?cmd=recent", json={"content": f"📢 **Broadcast:** {msg}"})
                await message.channel.send(f"✅ Broadcast sent!")
            return
        
        # !backup
        if cmd == "!backup":
            import shutil
            from pathlib import Path
            backup_dir = Path("backups")
            backup_dir.mkdir(exist_ok=True)
            backup_file = backup_dir / f"auth_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            shutil.copy("auth.db", backup_file)
            await message.channel.send(f"✅ Database backed up!\n📁 `{backup_file.name}`\n📦 Size: {backup_file.stat().st_size // 1024}KB")
            return
        
        # !resellers
        if cmd == "!resellers":
            res = requests.get(f"{BASE_URL}/api/resellers")
            resellers = res.json().get("data", [])
            if resellers:
                embed = discord.Embed(title=f"👥 Resellers ({len(resellers)})", color=COLORS["info"])
                for r in resellers[:15]:
                    embed.add_field(name=f"@{r['username']}", value=f"💰 {r.get('credits',0)} credits\n👤 {r.get('users_created',0)} users\n📧 {r.get('email','N/A')}", inline=True)
                await message.channel.send(embed=embed)
            return
        
        # ============================================================
        # 🔑 LICENSE MANAGEMENT
        # ============================================================
        
        # !licenses
        if cmd == "!licenses":
            res = requests.get(f"{BASE_URL}/api/licenses")
            licenses = res.json().get("data", [])
            
            if not licenses:
                await message.channel.send("❌ No licenses found")
                return
            
            active = sum(1 for l in licenses if l.get("status") == "active")
            
            embed = discord.Embed(title=f"🔑 Licenses ({len(licenses)})", color=COLORS["info"])
            embed.add_field(name="📊 Summary", value=f"✅ Active: {active}\n🚫 Revoked: {len(licenses)-active}", inline=False)
            
            for l in licenses[:15]:
                embed.add_field(name=f"{l['key'][:20]}...", value=f"📱 {l.get('application_name','N/A')}\n📊 {l.get('plan','standard')}\n✅ {l.get('status','N/A')}", inline=True)
            
            await message.channel.send(embed=embed)
            return
        
        # !genkey @name app_id plan
        if cmd == "!genkey":
            if len(args) < 3:
                await message.channel.send("❌ `!genkey @name app_id plan`")
                return
            username, app_id, plan = args[0].replace("@",""), args[1], args[2]
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            user = next((u for u in users if u["username"].lower() == username.lower()), None)
            if user:
                res2 = requests.post(f"{BASE_URL}/api/admin/licenses", json={
                    "app_id": int(app_id), "user_id": user["id"], "plan": plan, "expires_in_days": 30
                })
                if res2.status_code == 200:
                    key = res2.json().get("data", {}).get("key", "N/A")
                    await message.channel.send(f"✅ License generated!\n🔑 `{key}`\n👤 @{username}\n📊 {plan}")
            return
        
        # !revoke key
        if cmd == "!revoke":
            if not args:
                await message.channel.send("❌ `!revoke license_key`")
                return
            key = args[0]
            res = requests.get(f"{BASE_URL}/api/licenses")
            licenses = res.json().get("data", [])
            lic = next((l for l in licenses if l["key"] == key), None)
            if lic:
                requests.patch(f"{BASE_URL}/api/admin/licenses/{lic['id']}", json={"status": "revoked"})
                await message.channel.send(f"✅ License revoked!")
            return
        
        # !verify key
        if cmd == "!verify":
            if not args:
                await message.channel.send("❌ `!verify license_key`")
                return
            key = args[0]
            res = requests.get(f"{BASE_URL}/api/licenses")
            licenses = res.json().get("data", [])
            lic = next((l for l in licenses if l["key"] == key), None)
            if lic:
                await message.channel.send(f"🔑 **{key}**\n📱 {lic.get('application_name')}\n📊 {lic.get('plan')}\n✅ {lic.get('status')}\n📅 {lic.get('expires_at','N/A')}")
            else:
                await message.channel.send(f"❌ License not found")
            return
        
        # ============================================================
        # 🔍 SEARCH
        # ============================================================
        
        # !search keyword
        if cmd == "!search":
            if not args:
                await message.channel.send("❌ `!search keyword`")
                return
            keyword = " ".join(args).lower()
            
            # Search users
            res = requests.get(f"{BASE_URL}/api/users")
            users = [u for u in res.json().get("data", []) if keyword in u.get("username","").lower() or keyword in u.get("email","").lower()]
            
            # Search apps
            res2 = requests.get(f"{BASE_URL}/api/apps")
            apps = [a for a in res2.json().get("data", []) if keyword in a.get("name","").lower()]
            
            # Search licenses
            res3 = requests.get(f"{BASE_URL}/api/licenses")
            licenses = [l for l in res3.json().get("data", []) if keyword in l.get("key","").lower()]
            
            embed = discord.Embed(title=f"🔍 Search: '{keyword}'", color=COLORS["info"])
            embed.add_field(name=f"👤 Users ({len(users)})", value="\n".join([f"• @{u['username']}" for u in users[:10]]) or "None", inline=False)
            embed.add_field(name=f"📱 Apps ({len(apps)})", value="\n".join([f"• {a['name']}" for a in apps[:10]]) or "None", inline=False)
            embed.add_field(name=f"🔑 Licenses ({len(licenses)})", value="\n".join([f"• `{l['key'][:20]}...`" for l in licenses[:10]]) or "None", inline=False)
            
            await message.channel.send(embed=embed)
            return
        
        # !compare @user1 @user2
        if cmd == "!compare":
            if len(args) < 2:
                await message.channel.send("❌ `!compare @user1 @user2`")
                return
            
            u1_name = args[0].replace("@","")
            u2_name = args[1].replace("@","")
            
            res = requests.get(f"{BASE_URL}/api/users")
            users = res.json().get("data", [])
            u1 = next((u for u in users if u["username"].lower() == u1_name.lower()), None)
            u2 = next((u for u in users if u["username"].lower() == u2_name.lower()), None)
            
            if not u1 or not u2:
                await message.channel.send("❌ User not found")
                return
            
            embed = discord.Embed(title=f"⚖️ Compare", color=COLORS["purple"])
            embed.add_field(name=f"@{u1['username']}", value=f"📊 {u1.get('plan')}\n📧 {u1.get('email','N/A')}\n✅ {u1.get('status')}", inline=True)
            embed.add_field(name=f"@{u2['username']}", value=f"📊 {u2.get('plan')}\n📧 {u2.get('email','N/A')}\n✅ {u2.get('status')}", inline=True)
            
            await message.channel.send(embed=embed)
            return
        
        # !export
        if cmd == "!export":
            res = requests.get(f"{BASE_URL}/api/history/export?days=30")
            data = res.json()
            await message.channel.send(f"📦 Export: {data.get('data',{}).get('filename','done')}\n📝 {data.get('data',{}).get('records',0)} records")
            return


# ============================================
# RUN BOT
# ============================================
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════╗
║    RinoxAuth Admin Panel v2.0       ║
║    Professional Edition              ║
║    Starting bot...                   ║
╚══════════════════════════════════════╝
    """)
    
    intents = discord.Intents.all()
    bot = RinoxAdminBot(intents=intents)
    bot.run(TOKEN)