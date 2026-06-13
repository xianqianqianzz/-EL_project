import sys
from pathlib import Path

from sqlalchemy import select

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.auth import hash_password
from backend.app.config import get_settings
from backend.app.database import SessionLocal
from backend.app.user_model import User


EVALUATION_ACCOUNTS = (
    {
        "username": "evaluator_user",
        "email": "evaluator_user@example.com",
        "display_name": "评测普通用户",
        "password": "NjuMapUser2026!",
        "role": "user",
    },
    {
        "username": "evaluator_admin",
        "email": "evaluator_admin@example.com",
        "display_name": "评测管理员",
        "password": "NjuMapAdmin2026!",
        "role": "admin",
    },
)


def seed() -> None:
    if get_settings().environment.casefold() == "production":
        raise SystemExit("Refusing to create evaluation accounts in production.")

    with SessionLocal() as db:
        for account in EVALUATION_ACCOUNTS:
            user = db.scalar(select(User).where(User.username == account["username"]))
            if user is None:
                user = User(
                    username=account["username"],
                    email=account["email"],
                    display_name=account["display_name"],
                    password_hash=hash_password(account["password"]),
                    role=account["role"],
                    is_active=True,
                )
                db.add(user)
            else:
                user.email = account["email"]
                user.display_name = account["display_name"]
                user.password_hash = hash_password(account["password"])
                user.role = account["role"]
                user.is_active = True
        db.commit()

    print("Evaluation accounts are ready.")


if __name__ == "__main__":
    seed()
