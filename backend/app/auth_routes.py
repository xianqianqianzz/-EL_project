from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.auth import authenticate_user, create_access_token, get_current_user, hash_password
from backend.app.auth_models import RegisterRequest, TokenResponse, UserPublic
from backend.app.database import get_db
from backend.app.user_model import User


router = APIRouter(prefix="/api/v1", tags=["auth"])


@router.post("/auth/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    email = str(payload.email).casefold()
    duplicate = db.scalar(
        select(User).where(or_(User.username == payload.username, User.email == email))
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名或邮箱已被使用")

    user = User(
        username=payload.username,
        email=email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名或邮箱已被使用",
        ) from error
    db.refresh(user)
    return user


@router.post("/auth/token", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token, expires_in = create_access_token(user)
    return TokenResponse(access_token=access_token, expires_in=expires_in)


@router.get("/users/me", response_model=UserPublic, tags=["users"])
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
