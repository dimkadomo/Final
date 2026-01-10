from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import hmac
import secrets
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import httpx
import json
from decimal import Decimal, ROUND_DOWN
from collections import defaultdict
import asyncio
import time

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easymoney')]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(32))
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'easymoney2025admin')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '8271361408:AAGzA--uL8Wrs4OJjcwYNUaYc7VkPqDHSlg')
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

MAX_BET = 1000000

# Rate Limiting Configuration
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMITS = {
    "default": 100,           # 100 requests per minute
    "auth": 10,               # 10 auth attempts per minute
    "games": 30,              # 30 game plays per minute
    "admin": 20,              # 20 admin requests per minute
    "payment": 5,             # 5 payment requests per minute
}

# In-memory rate limit storage
rate_limit_storage: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))

def get_client_ip(request: Request) -> str:
    """Get client IP address, handling proxies"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_rate_limit(ip: str, category: str = "default") -> bool:
    """Check if request is within rate limit"""
    current_time = time.time()
    limit = RATE_LIMITS.get(category, RATE_LIMITS["default"])
    
    # Clean old entries
    rate_limit_storage[ip][category] = [
        t for t in rate_limit_storage[ip][category] 
        if current_time - t < RATE_LIMIT_WINDOW
    ]
    
    # Check limit
    if len(rate_limit_storage[ip][category]) >= limit:
        return False
    
    # Add new request
    rate_limit_storage[ip][category].append(current_time)
    return True

def rate_limit(category: str = "default"):
    """Rate limiting decorator"""
    async def dependency(request: Request):
        ip = get_client_ip(request)
        if not check_rate_limit(ip, category):
            raise HTTPException(
                status_code=429, 
                detail=f"Слишком много запросов. Попробуйте через минуту."
            )
        return True
    return Depends(dependency)

app = FastAPI(title="EASY MONEY Gaming Platform")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ================== HELPERS ==================

def round_money(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_DOWN))

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def generate_api_token():
    return secrets.token_hex(30)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Неверный токен")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Пользователь не найден")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Токен истек")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")

async def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("admin"):
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        return True
    except:
        raise HTTPException(status_code=401, detail="Неверный токен")

async def get_settings():
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "main", "raceback_percent": 10, "ref_percent": 50, "min_withdraw": 100,
            "dice_rtp": 97, "mines_rtp": 97, "bubbles_rtp": 97, "wheel_rtp": 97, 
            "crash_rtp": 97, "x100_rtp": 97, "keno_rtp": 97,
            "dice_bank": 10000, "mines_bank": 10000, "bubbles_bank": 10000, "wheel_bank": 10000
        }
        await db.settings.insert_one(settings)
    return settings

async def update_bank(game: str, status: str, amount: float, user: dict):
    if user.get("is_youtuber"):
        return
    if status == "win":
        await db.settings.update_one({"id": "main"}, {"$inc": {f"{game}_bank": -amount}})
    else:
        await db.settings.update_one({"id": "main"}, {"$inc": {f"{game}_bank": amount * 0.75}})

async def calculate_raceback(user_id: str, bet: float):
    settings = await get_settings()
    percent = settings.get("raceback_percent", 10) / 100
    raceback_amount = round_money(bet * percent)
    await db.users.update_one({"id": user_id}, {"$inc": {"raceback": raceback_amount}})

async def add_ref_bonus(user: dict, deposit_amount: float):
    if not user.get("invited_by"):
        return
    settings = await get_settings()
    percent = settings.get("ref_percent", 50) / 100
    bonus = round_money(deposit_amount * percent)
    await db.users.update_one({"id": user["invited_by"]}, {"$inc": {"income": bonus, "income_all": bonus}})

def should_player_win(rtp: float, user: dict, multiplier: float = 2.0, game: str = "default") -> bool:
    """
    RTP (Return To Player) - процент возврата игроку на дистанции.
    Например: 95% RTP = на каждые 100₽ ставок, игрок в среднем получит 95₽ обратно.
    
    Формула: win_chance = (RTP / 100) / multiplier
    Примеры:
    - RTP 95%, множитель 2x: шанс выигрыша = 95/100/2 = 47.5%
    - RTP 95%, множитель 10x: шанс выигрыша = 95/100/10 = 9.5%
    - RTP 90%, множитель 2x: шанс выигрыша = 90/100/2 = 45%
    """
    # YouTube режим - всегда больше шансов
    if user.get("is_youtuber"):
        return random.random() < 0.75
    
    # Дрейн система - контроль больших выигрышей
    if user.get("is_drain"):
        drain_chance = user.get("is_drain_chance", 20)
        if random.randint(1, 100) <= drain_chance:
            return False
    
    # Рассчитываем шанс выигрыша на основе RTP и множителя
    # RTP напрямую влияет на шансы: чем выше RTP, тем выше шанс
    win_chance = (rtp / 100) / multiplier
    
    # Проверяем выигрыш
    return random.random() < win_chance

# ================== STARTUP ==================

@app.on_event("startup")
async def startup():
    await get_settings()
    logger.info("EASY MONEY Gaming Platform started")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ================== AUTH ==================

@api_router.post("/auth/telegram")
async def telegram_auth(request: Request):
    data = await request.json()
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    
    user = await db.users.find_one({"telegram_id": data.get("id")}, {"_id": 0})
    
    if user:
        await db.users.update_one({"telegram_id": data.get("id")}, {"$set": {
            "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            "username": data.get("username", ""),
            "img": data.get("photo_url", "/logo.png"),
            "last_login": datetime.now(timezone.utc).isoformat(),
            "last_ip": client_ip
        }})
        user = await db.users.find_one({"telegram_id": data.get("id")}, {"_id": 0})
    else:
        user_id = str(uuid.uuid4())
        ref_link = secrets.token_hex(5)
        invited_by = None
        ref_code = data.get("ref_code")
        if ref_code:
            inviter = await db.users.find_one({"ref_link": ref_code}, {"_id": 0})
            if inviter:
                invited_by = inviter["id"]
                await db.users.update_one({"id": inviter["id"]}, {"$inc": {"referalov": 1}})
        
        user = {
            "id": user_id, "telegram_id": data.get("id"), 
            "username": data.get("username", ""),
            "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            "img": data.get("photo_url", "/logo.png"),
            "balance": 0.0, "deposit": 0.0, "raceback": 0.0, "referalov": 0,
            "income": 0.0, "income_all": 0.0, "ref_link": ref_link, "invited_by": invited_by,
            "is_admin": False, "is_ban": False, "is_ban_comment": None,
            "is_youtuber": False, "is_drain": False, "is_drain_chance": 20.0, "wager": 0.0,
            "api_token": generate_api_token(), "game_token": generate_api_token(),
            "register_ip": client_ip, "last_ip": client_ip,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"telegram_id": data.get("id")}, {"_id": 0})
    
    return {"success": True, "token": create_token(user["id"]), "user": user}

@api_router.post("/auth/demo")
async def demo_auth(request: Request, username: str = "demo_user", ref_code: Optional[str] = None, _=rate_limit("auth")):
    client_ip = get_client_ip(request)
    user = await db.users.find_one({"username": username}, {"_id": 0})
    
    if not user:
        user_id = str(uuid.uuid4())
        ref_link = secrets.token_hex(5)
        # Demo users cannot have referrals or use ref codes
        
        user = {
            "id": user_id, "telegram_id": random.randint(100000000, 999999999),
            "username": username, "name": username, "img": "/logo.png",
            "balance": 1000.0, "deposit": 0.0, "raceback": 0.0, "referalov": 0,
            "income": 0.0, "income_all": 0.0, "ref_link": ref_link, "invited_by": None,
            "is_admin": False, "is_ban": False, "is_ban_comment": None,
            "is_youtuber": False, "is_drain": False, "is_drain_chance": 20.0, "wager": 0.0,
            "is_demo": True,  # Mark as demo user
            "api_token": generate_api_token(), "game_token": generate_api_token(),
            "register_ip": client_ip, "last_ip": client_ip,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    return {"success": True, "token": create_token(user["id"]), "user": user}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"success": True, "user": user}

# ================== GAMES - MINES ==================

def get_mines_coefficient(bombs: int, opened: int) -> float:
    coeff = 1.0
    for i in range(opened):
        coeff *= (25 - i) / (25 - bombs - i)
    return round(coeff, 2)

@api_router.post("/games/mines/play")
async def mines_play(request: Request, user: dict = Depends(get_current_user), _=rate_limit("games")):
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    active_game = await db.mines_games.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    if active_game:
        raise HTTPException(status_code=400, detail="У вас есть активная игра")
    
    bet = min(float(data.get("bet", 10)), user["balance"], MAX_BET)
    bombs = int(data.get("bombs", 5))
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -bet, "wager": -bet}})
    
    all_positions = list(range(1, 26))
    random.shuffle(all_positions)
    mines_positions = all_positions[:bombs]
    
    game = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "bet": bet, "bombs": bombs,
        "mines": mines_positions, "clicked": [], "win": 0.0, "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mines_games.insert_one(game)
    
    return {"success": True, "balance": round_money(user["balance"] - bet), "game_id": game["id"]}

@api_router.post("/games/mines/press")
async def mines_press(request: Request, user: dict = Depends(get_current_user), _=rate_limit("games")):
    data = await request.json()
    cell = int(data.get("cell", 1))
    
    game = await db.mines_games.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=400, detail="У вас нет активных игр")
    
    if cell in game["clicked"]:
        raise HTTPException(status_code=400, detail="Вы уже нажали на эту ячейку")
    
    settings = await get_settings()
    rtp = settings.get("mines_rtp", 97)
    clicked = game["clicked"] + [cell]
    
    current_coeff = get_mines_coefficient(game["bombs"], len(clicked))
    potential_win = round_money(game["bet"] * current_coeff)
    
    hit_mine = cell in game["mines"]
    
    if not hit_mine and not user.get("is_youtuber"):
        bank = settings.get("mines_bank", 10000)
        # Apply RTP with current coefficient
        if potential_win > bank or not should_player_win(rtp, user, current_coeff, "mines"):
            other_clicked = [c for c in clicked if c != cell]
            available = [i for i in range(1, 26) if i not in other_clicked]
            random.shuffle(available)
            new_mines = [cell] + [p for p in available if p != cell][:game["bombs"]-1]
            game["mines"] = new_mines
            hit_mine = True
            await db.mines_games.update_one({"id": game["id"]}, {"$set": {"mines": new_mines}})
    
    if hit_mine:
        await db.mines_games.update_one({"id": game["id"]}, {"$set": {"active": False, "clicked": clicked, "win": 0}})
        await update_bank("mines", "lose", game["bet"], user)
        await calculate_raceback(user["id"], game["bet"])
        return {"success": True, "status": "lose", "cell": cell, "mines": game["mines"]}
    else:
        coeff = get_mines_coefficient(game["bombs"], len(clicked))
        win = round_money(game["bet"] * coeff)
        await db.mines_games.update_one({"id": game["id"]}, {"$set": {"clicked": clicked, "win": win}})
        
        if len(clicked) == 25 - game["bombs"]:
            await db.mines_games.update_one({"id": game["id"]}, {"$set": {"active": False}})
            await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": win}})
            await update_bank("mines", "win", win - game["bet"], user)
            user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
            return {"success": True, "status": "finish", "win": win, "coefficient": coeff, "balance": user_data["balance"], "mines": game["mines"]}
        
        return {"success": True, "status": "continue", "win": win, "coefficient": coeff, "clicked": clicked}

@api_router.post("/games/mines/take")
async def mines_take(user: dict = Depends(get_current_user)):
    game = await db.mines_games.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=400, detail="У вас нет активных игр")
    if not game["clicked"]:
        raise HTTPException(status_code=400, detail="Сделайте хотя бы один клик")
    
    win = game["win"]
    if win <= 0:
        raise HTTPException(status_code=400, detail="Нечего забирать")
    
    await db.mines_games.update_one({"id": game["id"]}, {"$set": {"active": False}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": win}})
    await update_bank("mines", "win", win - game["bet"], user)
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"success": True, "win": win, "balance": user_data["balance"], "mines": game["mines"]}

@api_router.get("/games/mines/current")
async def mines_current(user: dict = Depends(get_current_user)):
    game = await db.mines_games.find_one({"user_id": user["id"], "active": True}, {"_id": 0})
    if game:
        return {"success": True, "active": True, "win": game["win"], "clicked": game["clicked"], "bet": game["bet"], "bombs": game["bombs"]}
    return {"success": True, "active": False}

# ================== GAMES - DICE ==================

@api_router.post("/games/dice/play")
async def dice_play(request: Request, user: dict = Depends(get_current_user), _=rate_limit("games")):
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    bet = min(float(data.get("bet", 10)), user["balance"], MAX_BET)
    chance = float(data.get("chance", 50))
    direction = data.get("direction", "down")
    
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    settings = await get_settings()
    rtp = settings.get("dice_rtp", 97)
    
    rand_num = random.randint(1, 1000000)
    threshold = int((chance / 100) * 999999)
    
    if direction == "down":
        is_win = rand_num < threshold
    else:
        is_win = rand_num > (999999 - threshold)
    
    coefficient = round(100 / chance, 2)
    potential_win = round_money(bet * coefficient)
    
    if is_win and not user.get("is_youtuber"):
        bank = settings.get("dice_bank", 10000)
        # Apply RTP with coefficient
        if potential_win - bet > bank or not should_player_win(rtp, user, coefficient, "dice"):
            is_win = False
            if direction == "down":
                rand_num = random.randint(threshold, 1000000)
            else:
                rand_num = random.randint(0, 999999 - threshold)
    
    if is_win:
        win = potential_win
        balance_change = win - bet
        await update_bank("dice", "win", win - bet, user)
    else:
        win = 0
        balance_change = -bet
        await update_bank("dice", "lose", bet, user)
        await calculate_raceback(user["id"], bet)
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": balance_change, "wager": -bet}})
    
    # Save game to history
    result_100 = int((rand_num / 1000000) * 100) + 1
    await db.dice_games.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "bet": bet,
        "chance": chance,
        "direction": direction,
        "result": result_100,
        "win": win,
        "coef": coefficient if is_win else 0,
        "status": "win" if is_win else "lose",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"success": True, "status": "win" if is_win else "lose", "result": result_100, "win": win, "balance": user_data["balance"], "coefficient": coefficient}

# ================== GAMES - BUBBLES ==================

@api_router.post("/games/bubbles/play")
async def bubbles_play(request: Request, user: dict = Depends(get_current_user), _=rate_limit("games")):
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    bet = min(float(data.get("bet", 10)), user["balance"], MAX_BET)
    target = float(data.get("target", 2))
    
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    if target < 1.05 or target > 100:
        raise HTTPException(status_code=400, detail="Цель должна быть от 1.05 до 100")
    
    settings = await get_settings()
    rtp = settings.get("bubbles_rtp", 97)
    
    # RTP-based result generation - lower multipliers are more common
    # Use exponential distribution for realistic bubble popping
    base_mult = 1.0
    
    # Check if player should win based on RTP
    # Target multiplier is what player aims for
    if user.get("is_youtuber") or should_player_win(rtp, user, target, "bubbles"):
        # Player wins - bubble grows past target
        max_mult = target + random.uniform(0.1, min(5, target * 0.5))
    else:
        # Player loses - bubble pops before target
        # More realistic distribution - lower values more likely
        r = random.random()
        if r < 0.5:
            max_mult = random.uniform(1.0, 1.5)  # 50% chance: 1.0-1.5x
        elif r < 0.8:
            max_mult = random.uniform(1.5, target * 0.5)  # 30% chance: 1.5-half of target
        else:
            max_mult = random.uniform(target * 0.5, target - 0.01)  # 20% chance: close to target
    
    is_win = max_mult >= target
    result_mult = round(max_mult, 2)
    
    if is_win:
        win = round_money(bet * target)
        balance_change = win - bet
        await update_bank("bubbles", "win", win - bet, user)
    else:
        win = 0
        balance_change = -bet
        await update_bank("bubbles", "lose", bet, user)
        await calculate_raceback(user["id"], bet)
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": balance_change, "wager": -bet}})
    
    # Save game to history
    await db.bubbles_games.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "bet": bet,
        "target": target,
        "result": result_mult,
        "win": win,
        "coef": target if is_win else result_mult,
        "status": "win" if is_win else "lose",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    return {"success": True, "status": "win" if is_win else "lose", "result": result_mult, "win": win, "balance": user_data["balance"]}

# ================== GAMES - WHEEL ==================

WHEEL_COEFFICIENTS = {1: {"blue": 1.2, "red": 1.5}, 2: {"blue": 1.2, "red": 1.5, "green": 3.0, "pink": 5.0}, 3: {"pink": 49.5}}
WHEEL_ITEMS = {
    1: ["lose"] * 11 + ["red"] * 6 + ["blue"] * 36,
    2: ["lose"] * 26 + ["blue"] * 14 + ["red"] * 9 + ["green"] * 4 + ["pink"] * 2,
    3: ["lose"] * 50 + ["pink"] * 2
}

@api_router.post("/games/wheel/play")
async def wheel_play(request: Request, user: dict = Depends(get_current_user), _=rate_limit("games")):
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    bet = min(float(data.get("bet", 10)), user["balance"], MAX_BET)
    level = int(data.get("level", 1))
    
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    settings = await get_settings()
    rtp = settings.get("wheel_rtp", 97)
    
    items = WHEEL_ITEMS.get(level, WHEEL_ITEMS[1]).copy()
    random.shuffle(items)
    color = random.choice(items)
    coef = WHEEL_COEFFICIENTS.get(level, {}).get(color, 0)
    total_win = round_money(bet * coef)
    
    if total_win > 0 and not user.get("is_youtuber"):
        bank = settings.get("wheel_bank", 10000)
        # Apply RTP with coefficient
        if total_win - bet > bank or not should_player_win(rtp, user, coef, "wheel"):
            color = "lose"
            coef = 0
            total_win = 0
    
    profit = total_win - bet
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": profit, "wager": -bet}})
    
    if coef > 0:
        await update_bank("wheel", "win", profit, user)
    else:
        await update_bank("wheel", "lose", bet, user)
        await calculate_raceback(user["id"], bet)
    
    # Save game to history
    await db.wheel_games.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "bet": bet,
        "level": level,
        "color": color,
        "win": total_win,
        "coef": coef,
        "status": "win" if coef > 0 else "lose",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    position = random.randint(360, 1440)
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"success": True, "color": color, "coef": coef, "win": total_win, "position": position, "balance": user_data["balance"]}

# ================== GAMES - CRASH ==================

@api_router.post("/games/crash/bet")
async def crash_bet(request: Request, user: dict = Depends(get_current_user)):
    """Place a bet for crash game with server-side crash point"""
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    bet = min(float(data.get("bet", 10)), user["balance"], 10000)
    auto_cashout = float(data.get("auto_cashout", 2.0))
    
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    # Deduct bet immediately
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -bet, "wager": bet}})
    
    settings = await get_settings()
    rtp = settings.get("crash_rtp", 97)
    
    # Generate crash point using House Edge formula
    r = random.random()
    # Exponential distribution: crash_point = 0.99 / (1 - r)
    # This creates realistic distribution: most crashes < 2x, rare high multipliers
    if r < 0.99:
        crash_point = 0.99 / (1 - r)
    else:
        crash_point = random.uniform(100, 1000)
    
    crash_point = round(min(crash_point, 1000), 2)
    
    # Apply RTP system
    if not user.get("is_youtuber") and not should_player_win(rtp, user, auto_cashout, "crash"):
        # Force crash before auto_cashout
        if auto_cashout <= 1.5:
            crash_point = round(random.uniform(1.0, max(1.01, auto_cashout - 0.05)), 2)
        else:
            crash_point = round(random.uniform(1.0, max(1.2, auto_cashout - 0.2)), 2)
    
    # Save bet to history (will be revealed when round completes)
    crash_bet_id = str(uuid.uuid4())
    await db.crash_bets.insert_one({
        "id": crash_bet_id,
        "user_id": user["id"],
        "bet": bet,
        "auto_cashout": auto_cashout,
        "crash_point": crash_point,
        "status": "pending",  # pending, win, lose
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "bet_id": crash_bet_id,
        "message": "Ставка принята! Ждите результат..."
    }

@api_router.post("/games/crash/result/{bet_id}")
async def get_crash_result(bet_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Get crash result after game completes"""
    crash_bet = await db.crash_bets.find_one({"id": bet_id, "user_id": user["id"]}, {"_id": 0})
    if not crash_bet:
        raise HTTPException(status_code=404, detail="Ставка не найдена")
    
    if crash_bet["status"] != "pending":
        return {
            "success": True,
            "status": crash_bet["status"],
            "crash_point": crash_bet["crash_point"],
            "win": crash_bet.get("win", 0)
        }
    
    # Simulate game completing (in reality, this would check round state)
    data = await request.json()
    final_multiplier = float(data.get("final_multiplier", 1.0))
    
    crash_point = crash_bet["crash_point"]
    auto_cashout = crash_bet["auto_cashout"]
    bet = crash_bet["bet"]
    
    # Determine if player won
    is_win = crash_point >= auto_cashout
    
    if is_win:
        win = round_money(bet * auto_cashout)
        await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": win}})
        await db.crash_bets.update_one({"id": bet_id}, {"$set": {"status": "win", "win": win}})
        await update_bank("crash", "win", win - bet, user)
        
        # Add to bets history
        await db.bets.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_name": user["name"],
            "game": "crash",
            "bet": bet,
            "multiplier": auto_cashout,
            "win": win,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        win = 0
        await db.crash_bets.update_one({"id": bet_id}, {"$set": {"status": "lose", "win": 0}})
        await update_bank("crash", "lose", bet, user)
        await calculate_raceback(user["id"], bet)
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
    
    return {
        "success": True,
        "status": "win" if is_win else "lose",
        "crash_point": crash_point,
        "auto_cashout": auto_cashout,
        "win": win,
        "balance": user_data["balance"]
    }

@api_router.get("/games/crash/history")
async def get_crash_history():
    """Get recent crash game results - REAL from database"""
    # Get last 20 completed crash rounds
    bets = await db.crash_bets.find(
        {"status": {"$in": ["win", "lose"]}},
        {"_id": 0, "crash_point": 1, "created_at": 1}
    ).sort("created_at", -1).limit(30).to_list(30)
    
    # Group by crash_point to get unique rounds (multiple players can play same round)
    seen_crashes = {}
    history = []
    
    for bet in bets:
        crash_point = bet["crash_point"]
        timestamp = bet.get("created_at", "")
        
        # Use crash_point + time window to identify unique rounds
        key = f"{crash_point}_{timestamp[:16]}"  # Group by minute
        
        if key not in seen_crashes:
            seen_crashes[key] = True
            history.append({"multiplier": crash_point})
            
            if len(history) >= 20:
                break
    
    # If not enough real data, add some generated history
    while len(history) < 20:
        r = random.random()
        if r < 0.3:
            mult = round(random.uniform(1.0, 1.9), 2)
        elif r < 0.6:
            mult = round(random.uniform(2.0, 5.0), 2)
        elif r < 0.85:
            mult = round(random.uniform(5.0, 10.0), 2)
        else:
            mult = round(random.uniform(10.0, 50.0), 2)
        history.append({"multiplier": mult})
    
    return {"success": True, "history": history[:20]}

@api_router.post("/games/crash/round-complete")
async def crash_round_complete(request: Request):
    """Save crash round to history (called by frontend after each crash)"""
    data = await request.json()
    crash_point = float(data.get("crash_point", 1.0))
    
    # Save to database as a system bet (no user)
    round_id = str(uuid.uuid4())
    await db.crash_bets.insert_one({
        "id": round_id,
        "user_id": "system",
        "bet": 0,
        "auto_cashout": 0,
        "crash_point": crash_point,
        "status": "lose",  # System round
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "crash_point": crash_point}

# ================== FAKE ONLINE ==================

@api_router.get("/online")
async def get_online_count():
    """Get fake online players count - never below 200"""
    base = 200
    variation = random.randint(0, 100)
    return {"success": True, "online": base + variation}

# ================== SUPPORT CHAT ==================

class SupportMessage(BaseModel):
    user_id: str
    message: str
    is_admin: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@api_router.post("/support/message")
async def send_support_message(request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    message = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "message": data.get("message", ""),
        "is_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    await db.support_messages.insert_one(message)
    return {"success": True, "message_id": message["id"]}

@api_router.get("/support/messages")
async def get_support_messages(user: dict = Depends(get_current_user)):
    messages = await db.support_messages.find(
        {"user_id": user["id"]}, 
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return {"success": True, "messages": messages}

@api_router.get("/admin/support/chats")
async def get_support_chats(_ : bool = Depends(verify_admin_token)):
    # Get unique user conversations
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$user_id",
            "user_name": {"$first": "$user_name"},
            "last_message": {"$first": "$message"},
            "last_time": {"$first": "$created_at"},
            "unread_count": {"$sum": {"$cond": [{"$and": [{"$eq": ["$read", False]}, {"$eq": ["$is_admin", False]}]}, 1, 0]}}
        }}
    ]
    chats = await db.support_messages.aggregate(pipeline).to_list(100)
    return {"success": True, "chats": chats}

@api_router.get("/admin/support/messages/{user_id}")
async def get_user_support_messages(user_id: str, _ : bool = Depends(verify_admin_token)):
    messages = await db.support_messages.find(
        {"user_id": user_id}, 
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    # Mark as read
    await db.support_messages.update_many(
        {"user_id": user_id, "is_admin": False},
        {"$set": {"read": True}}
    )
    return {"success": True, "messages": messages}

@api_router.post("/admin/support/reply/{user_id}")
async def admin_reply_support(user_id: str, request: Request, _ : bool = Depends(verify_admin_token)):
    data = await request.json()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    message = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user["name"],
        "message": data.get("message", ""),
        "is_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    await db.support_messages.insert_one(message)
    return {"success": True, "message_id": message["id"]}

# ================== GAMES - X100 ==================

X100_WHEEL = [
    2, 3, 2, 15, 2, 3, 2, 20, 2, 15, 2, 3, 2, 3, 2, 15, 2, 3, 10, 3, 2, 10, 2, 3, 2,
    100,  # Jackpot position
    2, 3, 2, 10, 2, 3, 2, 3, 2, 15, 2, 3, 2, 3, 2, 20, 2, 3, 2, 10, 2, 3, 2, 10,
    2, 3, 2, 15, 2, 3, 2, 3, 2, 10, 20, 3, 2, 3, 2, 15, 2, 10, 2, 3, 2, 20, 2, 3, 2,
    15, 2, 3, 2, 10, 2, 3, 2, 3, 2, 10, 2, 3, 2, 3, 2, 10, 2, 3, 2, 3, 2, 3, 2
]

@api_router.post("/games/x100/play")
async def x100_play(request: Request, user: dict = Depends(get_current_user), _=rate_limit("games")):
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    bet = min(float(data.get("bet", 10)), user["balance"], MAX_BET)
    selected_coef = int(data.get("coef", 2))  # Player selects coefficient: 2, 3, 10, 15, 20, or 100
    
    valid_coefs = [2, 3, 10, 15, 20, 100]
    if selected_coef not in valid_coefs:
        raise HTTPException(status_code=400, detail="Неверный множитель")
    
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    settings = await get_settings()
    rtp = settings.get("x100_rtp", 97)
    
    # First determine if player should win based on RTP
    # Use selected coefficient as multiplier for RTP calculation
    player_wins = user.get("is_youtuber") or should_player_win(rtp, user, selected_coef, "x100")
    
    if player_wins:
        # Find all positions with player's selected coefficient
        winning_positions = [i for i, c in enumerate(X100_WHEEL) if c == selected_coef]
        if winning_positions:
            position = random.choice(winning_positions)
        else:
            position = random.randint(0, len(X100_WHEEL) - 1)
    else:
        # Find all positions WITHOUT player's selected coefficient
        losing_positions = [i for i, c in enumerate(X100_WHEEL) if c != selected_coef]
        position = random.choice(losing_positions)
    
    result_coef = X100_WHEEL[position]
    is_win = result_coef == selected_coef
    
    if is_win:
        win = round_money(bet * selected_coef)
        balance_change = win - bet
    else:
        win = 0
        balance_change = -bet
        await calculate_raceback(user["id"], bet)
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": balance_change, "wager": -bet}})
    
    # Save game to history
    await db.x100_games.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "bet": bet,
        "selected_coef": selected_coef,
        "result_coef": result_coef,
        "win": win,
        "coef": result_coef if is_win else 0,
        "status": "win" if is_win else "lose",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Calculate rotation angle for animation
    segment_angle = 360 / len(X100_WHEEL)
    rotation = position * segment_angle + (360 * 5)  # 5 full rotations + final position
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "success": True, "status": "win" if is_win else "lose",
        "selected_coef": selected_coef, "result_coef": result_coef,
        "position": position, "rotation": rotation,
        "win": win, "balance": user_data["balance"]
    }

# ================== GAMES - KENO ==================

@api_router.post("/games/keno/play")
async def keno_play(request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    if user.get("is_ban"):
        raise HTTPException(status_code=403, detail="Ваш аккаунт заблокирован")
    
    bet = min(float(data.get("bet", 10)), user["balance"], MAX_BET)
    selected_numbers = data.get("numbers", [])  # Player selects 1-10 numbers from 1-40
    
    if not selected_numbers or len(selected_numbers) < 1 or len(selected_numbers) > 10:
        raise HTTPException(status_code=400, detail="Выберите от 1 до 10 чисел")
    
    if any(n < 1 or n > 40 for n in selected_numbers):
        raise HTTPException(status_code=400, detail="Числа должны быть от 1 до 40")
    
    if bet < 1:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    
    settings = await get_settings()
    rtp = settings.get("keno_rtp", 97)
    
    # Draw 10 random numbers
    drawn_numbers = random.sample(range(1, 41), 10)
    
    # Count matches
    matches = len(set(selected_numbers) & set(drawn_numbers))
    
    # Keno payout table based on selections and matches
    payouts = {
        1: {1: 3},
        2: {2: 9},
        3: {2: 2, 3: 25},
        4: {2: 1, 3: 5, 4: 50},
        5: {3: 3, 4: 15, 5: 100},
        6: {3: 2, 4: 5, 5: 30, 6: 200},
        7: {4: 3, 5: 10, 6: 50, 7: 500},
        8: {4: 2, 5: 5, 6: 20, 7: 100, 8: 1000},
        9: {5: 3, 6: 10, 7: 30, 8: 300, 9: 2000},
        10: {5: 2, 6: 5, 7: 15, 8: 100, 9: 500, 10: 5000}
    }
    
    multiplier = payouts.get(len(selected_numbers), {}).get(matches, 0)
    win = round_money(bet * multiplier) if multiplier > 0 else 0
    
    # Apply RTP adjustment with multiplier
    if win > 0 and not user.get("is_youtuber") and not should_player_win(rtp, user, multiplier if multiplier > 0 else 2.0, "keno"):
        # Reduce matches to lose
        drawn_numbers = [n for n in range(1, 41) if n not in selected_numbers][:10]
        matches = 0
        win = 0
    
    balance_change = win - bet if win > 0 else -bet
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": balance_change, "wager": -bet}})
    
    if win == 0:
        await calculate_raceback(user["id"], bet)
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "success": True, "status": "win" if win > 0 else "lose",
        "selected": selected_numbers, "drawn": drawn_numbers,
        "matches": matches, "multiplier": multiplier,
        "win": win, "balance": user_data["balance"]
    }

# ================== REFERRAL ==================

@api_router.get("/ref/stats")
async def get_ref_stats(user: dict = Depends(get_current_user)):
    # Demo users cannot use referral system
    if user.get("is_demo"):
        return {"success": True, "ref_link": "", "referalov": 0, "income": 0, "income_all": 0, "is_demo": True}
    return {"success": True, "ref_link": user["ref_link"], "referalov": user["referalov"], "income": user["income"], "income_all": user["income_all"]}

@api_router.post("/ref/withdraw")
async def ref_withdraw(user: dict = Depends(get_current_user)):
    # Demo users cannot withdraw referral income
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Реферальная система недоступна в демо-режиме. Авторизуйтесь через Telegram.")
    if user["income"] < 10:
        raise HTTPException(status_code=400, detail="Минимум для вывода - 10 рублей")
    income = user["income"]
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": income}, "$set": {"income": 0}})
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"success": True, "withdrawn": income, "balance": user_data["balance"]}

# ================== RACEBACK ==================

@api_router.get("/bonus/raceback")
async def get_raceback(user: dict = Depends(get_current_user)):
    return {"success": True, "raceback": user["raceback"]}

@api_router.post("/bonus/raceback/claim")
async def claim_raceback(user: dict = Depends(get_current_user)):
    # Demo users cannot claim cashback
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Кешбэк недоступен в демо-режиме. Авторизуйтесь через Telegram.")
    if user["balance"] > 0:
        raise HTTPException(status_code=400, detail="Кешбэк доступен только при нулевом балансе")
    if user["raceback"] < 1:
        raise HTTPException(status_code=400, detail="Недостаточно кешбэка")
    raceback = user["raceback"]
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": raceback}, "$set": {"raceback": 0}})
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"success": True, "claimed": raceback, "balance": user_data["balance"]}

# ================== DAILY BONUS ==================

# Daily bonus rewards (day streak -> bonus amount)
DAILY_BONUS_REWARDS = {
    1: 5,     # Day 1: 5₽
    2: 8,     # Day 2: 8₽
    3: 12,    # Day 3: 12₽
    4: 20,    # Day 4: 20₽
    5: 30,    # Day 5: 30₽
    6: 40,    # Day 6: 40₽
    7: 75,    # Day 7: 75₽ (weekly bonus!)
}

@api_router.get("/bonus/daily")
async def get_daily_bonus(user: dict = Depends(get_current_user)):
    """Get daily bonus status"""
    if user.get("is_demo"):
        return {
            "success": True, "is_demo": True,
            "can_claim": False, "streak": 0, "next_bonus": 10,
            "message": "Ежедневный бонус недоступен в демо-режиме"
        }
    
    last_claim = user.get("last_daily_claim")
    streak = user.get("daily_streak", 0)
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    can_claim = False
    if not last_claim:
        can_claim = True
        streak = 0
    else:
        last_claim_date = datetime.fromisoformat(last_claim.replace('Z', '+00:00')).replace(tzinfo=timezone.utc)
        last_claim_day = last_claim_date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        days_since_claim = (today - last_claim_day).days
        
        if days_since_claim >= 1:
            can_claim = True
            if days_since_claim > 1:
                # Streak broken - reset to 0
                streak = 0
    
    next_day = (streak % 7) + 1 if streak > 0 else 1
    next_bonus = DAILY_BONUS_REWARDS.get(next_day, 10)
    
    return {
        "success": True,
        "can_claim": can_claim,
        "streak": streak,
        "next_day": next_day,
        "next_bonus": next_bonus,
        "rewards": DAILY_BONUS_REWARDS
    }

@api_router.post("/bonus/daily/claim")
async def claim_daily_bonus(user: dict = Depends(get_current_user)):
    """Claim daily bonus"""
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Ежедневный бонус недоступен в демо-режиме. Авторизуйтесь через Telegram.")
    
    last_claim = user.get("last_daily_claim")
    streak = user.get("daily_streak", 0)
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if already claimed today
    if last_claim:
        last_claim_date = datetime.fromisoformat(last_claim.replace('Z', '+00:00')).replace(tzinfo=timezone.utc)
        last_claim_day = last_claim_date.replace(hour=0, minute=0, second=0, microsecond=0)
        days_since_claim = (today - last_claim_day).days
        
        if days_since_claim < 1:
            raise HTTPException(status_code=400, detail="Вы уже получили бонус сегодня. Приходите завтра!")
        
        if days_since_claim > 1:
            streak = 0  # Reset streak if missed a day
    
    # Calculate new streak and bonus
    new_streak = streak + 1
    day_in_week = ((new_streak - 1) % 7) + 1  # 1-7 cycling
    bonus = DAILY_BONUS_REWARDS.get(day_in_week, 10)
    
    # Add wager requirement (1x bonus)
    wager_increase = bonus
    
    await db.users.update_one(
        {"id": user["id"]}, 
        {
            "$inc": {"balance": bonus, "wager": wager_increase},
            "$set": {
                "last_daily_claim": now.isoformat(),
                "daily_streak": new_streak
            }
        }
    )
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    return {
        "success": True,
        "bonus": bonus,
        "streak": new_streak,
        "day": day_in_week,
        "balance": user_data["balance"],
        "wager": user_data["wager"],
        "message": f"Бонус {bonus}₽ получен! День {day_in_week}/7"
    }

# ================== ACHIEVEMENTS ==================

ACHIEVEMENTS = {
    "first_win": {"name": "Первая победа", "desc": "Выиграйте первую игру", "reward": 10, "icon": "fa-trophy", "type": "first_win"},
    "high_roller": {"name": "Хайроллер", "desc": "Сделайте ставку 500₽+", "reward": 25, "icon": "fa-coins", "type": "high_bet", "target": 500},
    "lucky_streak": {"name": "Удачная серия", "desc": "Выиграйте 5 игр подряд", "reward": 50, "icon": "fa-fire", "type": "win_streak", "target": 5},
    "big_win": {"name": "Большой выигрыш", "desc": "Выиграйте 500₽ за раз", "reward": 35, "icon": "fa-star", "type": "big_win", "target": 500},
    "explorer": {"name": "Исследователь", "desc": "Сыграйте во все игры", "reward": 15, "icon": "fa-compass", "type": "all_games"},
    "veteran": {"name": "Ветеран", "desc": "Сделайте 100 ставок", "reward": 75, "icon": "fa-medal", "type": "total_bets", "target": 100},
    "week_streak": {"name": "Недельная серия", "desc": "Заходите 7 дней подряд", "reward": 100, "icon": "fa-calendar-check", "type": "daily_streak", "target": 7},
}

async def check_achievements(user_id: str) -> list:
    """Check and unlock achievements for user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return []
    
    unlocked = user.get("achievements", [])
    new_achievements = []
    
    # Get all games from all collections
    game_collections = ["mines_games", "dice_games", "bubbles_games", "wheel_games", "crash_games", "x100_games"]
    
    total_games = 0
    total_wins = 0
    max_win = 0
    max_bet = 0
    games_played_set = set()
    current_win_streak = 0
    max_win_streak = 0
    
    for collection_name in game_collections:
        collection = db[collection_name]
        games = await collection.find({"user_id": user_id}).sort("created_at", 1).to_list(10000)
        
        game_type = collection_name.replace("_games", "")
        
        for game in games:
            total_games += 1
            bet = game.get("bet", 0)
            win = game.get("win", 0)
            status = game.get("status", "")
            
            if bet > max_bet:
                max_bet = bet
            
            if win > max_win:
                max_win = win
                
            games_played_set.add(game_type)
            
            if status == "win":
                total_wins += 1
                current_win_streak += 1
                if current_win_streak > max_win_streak:
                    max_win_streak = current_win_streak
            else:
                current_win_streak = 0
    
    # Check each achievement
    # first_win - выиграйте первую игру
    if "first_win" not in unlocked and total_wins >= 1:
        new_achievements.append("first_win")
    
    # high_roller - ставка 500₽+
    if "high_roller" not in unlocked and max_bet >= 500:
        new_achievements.append("high_roller")
    
    # lucky_streak - 5 побед подряд
    if "lucky_streak" not in unlocked and max_win_streak >= 5:
        new_achievements.append("lucky_streak")
    
    # big_win - выигрыш 500₽ за раз
    if "big_win" not in unlocked and max_win >= 500:
        new_achievements.append("big_win")
    
    # explorer - сыграть во все игры (6 игр)
    if "explorer" not in unlocked and len(games_played_set) >= 6:
        new_achievements.append("explorer")
    
    # veteran - 100 ставок
    if "veteran" not in unlocked and total_games >= 100:
        new_achievements.append("veteran")
    
    # week_streak - 7 дней подряд (проверяем daily_streak пользователя)
    if "week_streak" not in unlocked and user.get("daily_streak", 0) >= 7:
        new_achievements.append("week_streak")
    
    # Save new achievements
    if new_achievements:
        await db.users.update_one(
            {"id": user_id},
            {"$push": {"achievements": {"$each": new_achievements}}}
        )
    
    return new_achievements

@api_router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    """Get user achievements with real-time check"""
    if user.get("is_demo"):
        # For demo users, return empty achievements
        achievements_list = []
        for key, data in ACHIEVEMENTS.items():
            achievements_list.append({
                "id": key,
                "name": data["name"],
                "desc": data["desc"],
                "reward": data["reward"],
                "icon": data["icon"],
                "unlocked": False,
                "claimed": False
            })
        return {"success": True, "achievements": achievements_list, "is_demo": True}
    
    # Check for new achievements
    await check_achievements(user["id"])
    
    # Refresh user data
    user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    user_achievements = user.get("achievements", [])
    claimed_achievements = user.get("claimed_achievements", [])
    
    achievements_list = []
    for key, data in ACHIEVEMENTS.items():
        achievements_list.append({
            "id": key,
            "name": data["name"],
            "desc": data["desc"],
            "reward": data["reward"],
            "icon": data["icon"],
            "unlocked": key in user_achievements,
            "claimed": key in claimed_achievements
        })
    
    return {"success": True, "achievements": achievements_list}

@api_router.post("/achievements/{achievement_id}/claim")
async def claim_achievement(achievement_id: str, user: dict = Depends(get_current_user)):
    """Claim achievement reward"""
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Достижения недоступны в демо-режиме.")
    
    if achievement_id not in ACHIEVEMENTS:
        raise HTTPException(status_code=404, detail="Достижение не найдено")
    
    user_achievements = user.get("achievements", [])
    claimed_achievements = user.get("claimed_achievements", [])
    
    if achievement_id not in user_achievements:
        raise HTTPException(status_code=400, detail="Достижение не разблокировано")
    
    if achievement_id in claimed_achievements:
        raise HTTPException(status_code=400, detail="Награда уже получена")
    
    reward = ACHIEVEMENTS[achievement_id]["reward"]
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {"balance": reward},
            "$push": {"claimed_achievements": achievement_id}
        }
    )
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    return {
        "success": True,
        "achievement": ACHIEVEMENTS[achievement_id]["name"],
        "reward": reward,
        "balance": user_data["balance"]
    }

# ================== DAILY TASKS ==================

DAILY_TASKS = {
    "play_3_games": {
        "name": "Активный игрок",
        "desc": "Сыграйте 3 игры сегодня",
        "reward": 7,
        "icon": "fa-gamepad",
        "target": 3,
        "type": "games_played"
    },
    "win_any_game": {
        "name": "Победитель",
        "desc": "Выиграйте хотя бы 1 игру",
        "reward": 5,
        "icon": "fa-trophy",
        "target": 1,
        "type": "games_won"
    },
    "bet_100": {
        "name": "Ставочник",
        "desc": "Сделайте ставки на сумму 100₽",
        "reward": 10,
        "icon": "fa-coins",
        "target": 100,
        "type": "total_bet"
    },
    "play_2_different": {
        "name": "Разнообразие",
        "desc": "Сыграйте в 2 разные игры",
        "reward": 7,
        "icon": "fa-dice",
        "target": 2,
        "type": "different_games"
    },
    "win_50": {
        "name": "Профит",
        "desc": "Выиграйте 50₽ за день",
        "reward": 12,
        "icon": "fa-money-bill-wave",
        "target": 50,
        "type": "total_win"
    }
}

async def get_daily_task_progress(user_id: str):
    """Get user's progress on daily tasks"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today.isoformat()
    
    # Get all games played today from all game collections
    game_collections = ["mines_games", "dice_games", "bubbles_games", "wheel_games", "crash_games", "x100_games"]
    
    games_played = 0
    games_won = 0
    total_bet = 0
    total_win = 0
    games_set = set()
    
    for collection_name in game_collections:
        collection = db[collection_name]
        games = await collection.find({
            "user_id": user_id,
            "created_at": {"$gte": today_str}
        }).to_list(1000)
        
        game_type = collection_name.replace("_games", "")
        
        for game in games:
            games_played += 1
            total_bet += game.get("bet", 0)
            games_set.add(game_type)
            
            if game.get("status") == "win":
                games_won += 1
                total_win += game.get("win", 0)
    
    return {
        "games_played": games_played,
        "games_won": games_won,
        "total_bet": total_bet,
        "total_win": total_win,
        "different_games": len(games_set)
    }

@api_router.get("/tasks/daily")
async def get_daily_tasks(user: dict = Depends(get_current_user)):
    """Get daily tasks and their progress"""
    if user.get("is_demo"):
        return {
            "success": True,
            "is_demo": True,
            "tasks": [],
            "message": "Задания недоступны в демо-режиме"
        }
    
    # Get today's claimed tasks
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    claimed_today = user.get("daily_tasks_claimed", {}).get(today, [])
    
    # Get progress
    progress = await get_daily_task_progress(user["id"])
    
    tasks_list = []
    for task_id, task_data in DAILY_TASKS.items():
        task_type = task_data["type"]
        current = progress.get(task_type, 0)
        target = task_data["target"]
        completed = current >= target
        claimed = task_id in claimed_today
        
        tasks_list.append({
            "id": task_id,
            "name": task_data["name"],
            "desc": task_data["desc"],
            "reward": task_data["reward"],
            "icon": task_data["icon"],
            "current": min(current, target),
            "target": target,
            "completed": completed,
            "claimed": claimed
        })
    
    return {"success": True, "tasks": tasks_list}

@api_router.post("/tasks/daily/{task_id}/claim")
async def claim_daily_task(task_id: str, user: dict = Depends(get_current_user)):
    """Claim daily task reward"""
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Задания недоступны в демо-режиме")
    
    if task_id not in DAILY_TASKS:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    
    # Get today's claimed tasks
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    claimed_today = user.get("daily_tasks_claimed", {}).get(today, [])
    
    if task_id in claimed_today:
        raise HTTPException(status_code=400, detail="Награда уже получена сегодня")
    
    # Check if task is completed
    progress = await get_daily_task_progress(user["id"])
    task_data = DAILY_TASKS[task_id]
    current = progress.get(task_data["type"], 0)
    
    if current < task_data["target"]:
        raise HTTPException(status_code=400, detail=f"Задание не выполнено: {current}/{task_data['target']}")
    
    reward = task_data["reward"]
    
    # Update user - add reward and mark task as claimed
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {"balance": reward},
            "$set": {f"daily_tasks_claimed.{today}": claimed_today + [task_id]}
        }
    )
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    return {
        "success": True,
        "task": task_data["name"],
        "reward": reward,
        "balance": user_data["balance"],
        "message": f"Получено {reward}₽ за задание «{task_data['name']}»"
    }

# ================== PAYMENTS ==================

@api_router.post("/payment/create")
async def create_payment(request: Request, user: dict = Depends(get_current_user), _=rate_limit("payment")):
    data = await request.json()
    
    # Demo users cannot deposit
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Пополнение недоступно в демо-режиме. Авторизуйтесь через Telegram.")
    
    payment = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "amount": float(data.get("amount", 100)),
        "system": data.get("system", "mock"), "promo_code": data.get("promo_code"), "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(payment)
    return {"success": True, "payment_id": payment["id"], "link": f"/payment/mock/{payment['id']}", "message": "Платежная система в тестовом режиме"}

@api_router.post("/payment/mock/complete/{payment_id}")
async def complete_mock_payment(payment_id: str):
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Платеж не найден")
    if payment["status"] != "pending":
        raise HTTPException(status_code=400, detail="Платеж уже обработан")
    
    user = await db.users.find_one({"id": payment["user_id"]}, {"_id": 0})
    
    bonus = 0
    wager_mult = 3
    if payment.get("promo_code"):
        promo = await db.promos.find_one({"name": payment["promo_code"], "status": False}, {"_id": 0})
        if promo and promo.get("limited", 0) < promo.get("limit", 0):
            if promo.get("type") == 1:
                bonus = payment["amount"] * (promo.get("bonus_percent", 0) / 100)
            else:
                bonus = promo.get("reward", 0)
            wager_mult = promo.get("wager_multiplier", 3)
            await db.promos.update_one({"id": promo["id"]}, {"$inc": {"limited": 1}})
    
    total_amount = payment["amount"] + bonus
    wager = payment["amount"] * wager_mult
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": total_amount, "deposit": payment["amount"], "wager": wager}})
    await db.payments.update_one({"id": payment_id}, {"$set": {"status": "completed", "bonus": bonus}})
    await add_ref_bonus(user, payment["amount"])
    
    return {"success": True, "amount": total_amount, "bonus": bonus}

@api_router.get("/payment/history")
async def payment_history(user: dict = Depends(get_current_user)):
    payments = await db.payments.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"success": True, "payments": payments}

# ================== WITHDRAWALS ==================

@api_router.post("/withdraw/create")
async def create_withdraw(request: Request, user: dict = Depends(get_current_user), _=rate_limit("payment")):
    data = await request.json()
    settings = await get_settings()
    min_withdraw = settings.get("min_withdraw", 100)
    amount = float(data.get("amount", 100))
    
    # Demo users cannot withdraw
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Вывод недоступен в демо-режиме. Авторизуйтесь через Telegram для вывода средств.")
    
    if amount < min_withdraw:
        raise HTTPException(status_code=400, detail=f"Минимальная сумма вывода: {min_withdraw}")
    if user["balance"] < amount:
        raise HTTPException(status_code=400, detail="Недостаточно средств")
    if user["wager"] > 0:
        raise HTTPException(status_code=400, detail=f"Необходимо отыграть вейджер: {user['wager']:.2f}")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -amount}})
    
    withdraw = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "amount": amount,
        "wallet": data.get("wallet", ""), "system": data.get("system", ""), "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.withdraws.insert_one(withdraw)
    return {"success": True, "withdraw_id": withdraw["id"]}

@api_router.get("/withdraw/history")
async def withdraw_history(user: dict = Depends(get_current_user)):
    withdraws = await db.withdraws.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"success": True, "withdraws": withdraws}

# ================== PROMO ==================

@api_router.post("/promo/activate")
async def activate_promo(request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    code = data.get("code", "")
    
    promo = await db.promos.find_one({"name": code, "status": False}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Промокод не найден")
    if promo.get("limited", 0) >= promo.get("limit", 0):
        raise HTTPException(status_code=400, detail="Промокод исчерпан")
    
    used = await db.promo_logs.find_one({"user_id": user["id"], "promo_id": promo["id"]})
    if used:
        raise HTTPException(status_code=400, detail="Вы уже использовали этот промокод")
    
    if promo.get("deposit_required") and user["deposit"] == 0:
        raise HTTPException(status_code=400, detail="Промокод доступен только после депозита")
    
    reward = promo.get("reward", 0)
    wager = reward * promo.get("wager_multiplier", 3) if promo.get("type") != 3 else 0
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": reward, "wager": wager}})
    await db.promos.update_one({"id": promo["id"]}, {"$inc": {"limited": 1}})
    await db.promo_logs.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "promo_id": promo["id"],
        "reward": reward, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"success": True, "reward": reward, "balance": user_data["balance"], "wager": wager}

# ================== HISTORY ==================

# Bot names for fake history
BOT_NAMES = [
    "Александр", "Михаил", "Дмитрий", "Артём", "Максим", "Иван", "Андрей", "Сергей",
    "Алексей", "Никита", "Владимир", "Кирилл", "Егор", "Павел", "Денис", "Роман",
    "Анна", "Мария", "Екатерина", "Елена", "Ольга", "Наталья", "Юлия", "Татьяна",
    "Lucky777", "WinMaster", "CasinoKing", "BigPlayer", "GoldHunter", "DiamondAce"
]

def generate_bot_history_item(game: str) -> dict:
    """Generate a fake history item for a bot player"""
    bot_name = random.choice(BOT_NAMES)
    
    if game == "mines":
        bet = random.choice([10, 25, 50, 100, 200, 500])
        coef = round(random.uniform(1.1, 5.0), 2)
        is_win = random.random() < 0.4
    elif game == "dice":
        bet = random.choice([10, 20, 50, 100, 250])
        coef = round(random.uniform(1.5, 5.0), 2)
        is_win = random.random() < 0.45
    elif game == "wheel":
        bet = random.choice([10, 25, 50, 100])
        coef = random.choice([0, 1.2, 1.5, 3.0, 5.0])
        is_win = coef > 0 and random.random() < 0.35
    elif game == "x100":
        bet = random.choice([10, 20, 50, 100, 200])
        coef = random.choice([2, 3, 10, 15, 20])
        is_win = random.random() < 0.3
    elif game == "crash":
        bet = random.choice([10, 25, 50, 100, 250])
        coef = round(random.uniform(1.2, 10.0), 2)
        is_win = random.random() < 0.4
    elif game == "bubbles":
        bet = random.choice([10, 25, 50, 100])
        coef = round(random.uniform(1.5, 5.0), 2)
        is_win = random.random() < 0.35
    else:
        bet = random.choice([10, 50, 100])
        coef = round(random.uniform(1.5, 3.0), 2)
        is_win = random.random() < 0.4
    
    win = round(bet * coef, 2) if is_win else 0
    
    return {
        "game": game,
        "name": bot_name,
        "bet": bet,
        "coefficient": coef if is_win else 0,
        "win": win,
        "status": "win" if is_win else "lose",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/history/recent")
async def get_recent_history(limit: int = Query(default=15, le=50)):
    history = []
    
    # Collect real history from all games
    game_collections = [
        ("mines_games", "mines", {"active": False}),
        ("dice_games", "dice", {}),
        ("wheel_games", "wheel", {}),
        ("x100_games", "x100", {}),
        ("crash_bets", "crash", {"status": {"$ne": "pending"}}),
        ("bubbles_games", "bubbles", {})
    ]
    
    for coll, game_name, query in game_collections:
        try:
            games = await db[coll].find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
            for g in games:
                user = await db.users.find_one({"id": g.get("user_id")}, {"_id": 0, "name": 1})
                if user:
                    coef = g.get("coef", g.get("coefficient", g.get("target", g.get("crash_point", 0))))
                    if not coef and g.get("bet") and g.get("win"):
                        coef = round(g.get("win", 0) / g.get("bet", 1), 2)
                    history.append({
                        "game": game_name, 
                        "name": user["name"], 
                        "bet": g.get("bet", 0), 
                        "coefficient": coef or 0,
                        "win": g.get("win", 0), 
                        "status": "win" if g.get("win", 0) > 0 else "lose", 
                        "created_at": g.get("created_at", datetime.now(timezone.utc).isoformat())
                    })
        except Exception:
            pass
    
    # Add bot history to mix in with real data (30-50% bots)
    bot_count = max(3, int(limit * 0.4))
    bot_games = ["mines", "dice", "wheel", "x100", "crash", "bubbles"]
    for _ in range(bot_count):
        game = random.choice(bot_games)
        history.append(generate_bot_history_item(game))
    
    # Sort by created_at and return
    history.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {"success": True, "history": history[:limit]}

# ================== SOCIAL ==================

@api_router.get("/social")
async def get_social():
    return {"success": True, "social": {"telegram": "https://t.me/easymoneycaspro", "bot": "https://t.me/Irjeukdnr_bot"}}

# ================== ADMIN ==================

@api_router.post("/admin/login")
async def admin_login(request: Request, _=rate_limit("auth")):
    data = await request.json()
    if data.get("password") != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")
    admin_token = jwt.encode({"admin": True, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"success": True, "token": admin_token}

@api_router.get("/admin/stats")
async def admin_stats(_: bool = Depends(verify_admin_token), __=rate_limit("admin")):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    all_payments = await db.payments.find({"status": "completed"}, {"_id": 0}).to_list(10000)
    payment_today = sum(p["amount"] for p in all_payments if p["created_at"] >= today.isoformat())
    payment_week = sum(p["amount"] for p in all_payments if p["created_at"] >= week_ago.isoformat())
    payment_all = sum(p["amount"] for p in all_payments)
    
    pending_withdraws = await db.withdraws.find({"status": "pending"}, {"_id": 0}).to_list(1000)
    
    users_all = await db.users.count_documents({})
    users_today = await db.users.count_documents({"created_at": {"$gte": today.isoformat()}})
    
    settings = await get_settings()
    
    return {
        "success": True,
        "payments": {"today": payment_today, "week": payment_week, "all": payment_all},
        "withdrawals": {"pending_count": len(pending_withdraws), "pending_sum": sum(w["amount"] for w in pending_withdraws)},
        "users": {"today": users_today, "all": users_all},
        "settings": settings
    }

@api_router.get("/admin/users")
async def admin_users(search: Optional[str] = None, page: int = 1, limit: int = 20, _: bool = Depends(verify_admin_token)):
    query = {}
    if search:
        query = {"$or": [{"name": {"$regex": search, "$options": "i"}}, {"username": {"$regex": search, "$options": "i"}}]}
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"success": True, "users": users, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.put("/admin/user")
async def admin_update_user(request: Request, _: bool = Depends(verify_admin_token)):
    data = await request.json()
    user_id = data.pop("user_id", None)
    if user_id and data:
        await db.users.update_one({"id": user_id}, {"$set": data})
    return {"success": True}

@api_router.put("/admin/rtp")
async def admin_update_rtp(request: Request, _: bool = Depends(verify_admin_token)):
    data = await request.json()
    update_data = {k: v for k, v in data.items() if v is not None and k.endswith("_rtp")}
    if update_data:
        await db.settings.update_one({"id": "main"}, {"$set": update_data})
    return {"success": True}

@api_router.get("/admin/settings")
async def admin_get_settings(_: bool = Depends(verify_admin_token)):
    settings = await get_settings()
    return {"success": True, "settings": settings}

@api_router.put("/admin/settings")
async def admin_update_settings(request: Request, _: bool = Depends(verify_admin_token)):
    data = await request.json()
    update_data = {k: v for k, v in data.items() if v is not None}
    if update_data:
        await db.settings.update_one({"id": "main"}, {"$set": update_data})
    return {"success": True}

@api_router.get("/admin/promos")
async def admin_promos(page: int = 1, limit: int = 20, _: bool = Depends(verify_admin_token)):
    skip = (page - 1) * limit
    promos = await db.promos.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.promos.count_documents({})
    return {"success": True, "promos": promos, "total": total}

@api_router.post("/admin/promo")
async def admin_create_promo(request: Request, _: bool = Depends(verify_admin_token)):
    data = await request.json()
    existing = await db.promos.find_one({"name": data.get("name")})
    if existing:
        raise HTTPException(status_code=400, detail="Промокод уже существует")
    
    promo = {
        "id": str(uuid.uuid4()), "name": data.get("name"), "reward": float(data.get("reward", 0)),
        "limit": int(data.get("limit", 100)), "limited": 0, "type": int(data.get("type", 0)),
        "deposit_required": data.get("deposit_required", False),
        "wager_multiplier": float(data.get("wager_multiplier", 3)),
        "bonus_percent": float(data.get("bonus_percent", 0)), "status": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.promos.insert_one(promo)
    return {"success": True, "promo": promo}

@api_router.get("/admin/withdraws")
async def admin_withdraws(status: str = "pending", page: int = 1, limit: int = 20, _: bool = Depends(verify_admin_token)):
    skip = (page - 1) * limit
    withdraws = await db.withdraws.find({"status": status}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for w in withdraws:
        user = await db.users.find_one({"id": w["user_id"]}, {"_id": 0, "name": 1, "balance": 1})
        if user:
            w["user_name"] = user["name"]
            w["user_balance"] = user["balance"]
    total = await db.withdraws.count_documents({"status": status})
    return {"success": True, "withdraws": withdraws, "total": total}

@api_router.put("/admin/withdraw/{withdraw_id}")
async def admin_update_withdraw(withdraw_id: str, request: Request, _: bool = Depends(verify_admin_token)):
    data = await request.json()
    status = data.get("status", "")
    withdraw = await db.withdraws.find_one({"id": withdraw_id}, {"_id": 0})
    if not withdraw:
        raise HTTPException(status_code=404, detail="Вывод не найден")
    if status == "rejected":
        await db.users.update_one({"id": withdraw["user_id"]}, {"$inc": {"balance": withdraw["amount"]}})
    await db.withdraws.update_one({"id": withdraw_id}, {"$set": {"status": status, "comment": data.get("comment")}})
    return {"success": True}

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Enable XSS filter
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Cache control for sensitive data
    if "/api/admin" in request.url.path or "/api/auth" in request.url.path:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
