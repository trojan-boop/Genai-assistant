from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
import os

from database import get_db, User

# In production, generate this once with `openssl rand -hex 32` and store
# it in .env as JWT_SECRET — never hardcode it or commit it to GitHub.
SECRET_KEY = os.getenv("JWT_SECRET", "dev-only-secret-change-this")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # tokens last 7 days

# Name of the httpOnly cookie that carries the JWT. Centralized here so
# main.py (set/clear) and this module (read) always agree on the name.
COOKIE_NAME = "access_token"


def hash_password(plain_password: str) -> str:
    # bcrypt works on bytes, and has a 72-byte input limit — encode + truncate defensively
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """FastAPI dependency — drop this into any route to require a valid login.

    Reads the JWT from the httpOnly cookie set by /login or /signup, rather
    than an Authorization header. The browser sends this cookie automatically
    on same-site requests as long as fetch() is called with credentials:
    'include' and CORS allows credentials from the frontend's origin.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    token = request.cookies.get(COOKIE_NAME)
    if token is None:
        raise credentials_error

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.get(User, user_id)
    if user is None:
        raise credentials_error

    return user
