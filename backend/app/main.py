"""HTTP API for Soil Intelligence."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app.auth import SESSION_SECONDS, AuthStore, EmailTaken, TooManyAttempts
from app.engine import Engine

logger = logging.getLogger("uvicorn.error")
SESSION_COOKIE = "si_session"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8


class SoilSample(BaseModel):
    pH: float = Field(ge=0, le=14, description="Soil reaction")
    EC: float = Field(ge=0, le=20, description="Electrical conductivity, dS/m")
    N: float = Field(ge=0, le=1500, description="Available nitrogen, kg/ha")
    P: float = Field(ge=0, le=500, description="Available phosphorus, kg/ha")
    K: float = Field(ge=0, le=2000, description="Available potassium, kg/ha")
    temperature: float = Field(ge=-10, le=60, description="Mean air temperature, °C")
    humidity: float = Field(ge=0, le=100, description="Mean relative humidity, %")
    rainfall: float = Field(ge=0, le=5000, description="Seasonal rainfall, mm")


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_PATTERN.match(email):
            raise ValueError("Enter a valid email address")
        return email


class SignUp(Credentials):
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Enter your name")
        return name


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.engine = Engine()
    app.state.auth = AuthStore()
    yield


app = FastAPI(title="Soil Intelligence API", version="0.2.0", lifespan=lifespan)


def start_session(request: Request, response: Response, user: dict) -> dict:
    token = request.app.state.auth.create_session(user["id"])
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_SECONDS,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("COOKIE_SECURE", "").lower() == "true",
        path="/",
    )
    return user


def current_user(
    request: Request,
    si_session: Annotated[str | None, Cookie()] = None,
) -> dict:
    user = request.app.state.auth.user_for_session(si_session) if si_session else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")
    return user


CurrentUser = Annotated[dict, Depends(current_user)]


@app.exception_handler(Exception)
async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
    # The full error goes to the server log, and never to the browser.
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=error)
    return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)


@app.get("/api/health")
def health(request: Request, response: Response) -> dict[str, str]:
    """Reports whether the service can really handle requests, not just that it is up."""
    database = "ok" if request.app.state.auth.is_healthy() else "unavailable"
    if database != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if database == "ok" else "degraded", "database": database, "models": "ok"}


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignUp, request: Request, response: Response) -> dict:
    try:
        user = request.app.state.auth.create_user(body.name, body.email, body.password)
    except EmailTaken as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists."
        ) from error
    return start_session(request, response, user)


@app.post("/api/auth/login")
def login(body: Credentials, request: Request, response: Response) -> dict:
    auth = request.app.state.auth
    # An email with no account starts a new one, so people can sign in straight away.
    if not auth.email_exists(body.email):
        if len(body.password) < MIN_PASSWORD_LENGTH:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Use at least {MIN_PASSWORD_LENGTH} characters to start a new account.",
            )
        try:
            name = body.email.split("@")[0].replace(".", " ").replace("_", " ").title()[:80]
            return start_session(request, response, auth.create_user(name, body.email, body.password))
        except EmailTaken:
            pass  # Created by a simultaneous request, so treat it as an existing account.

    try:
        user = auth.authenticate(body.email, body.password)
    except TooManyAttempts as error:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many failed attempts. Try again in 15 minutes.",
        ) from error
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    return start_session(request, response, user)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    si_session: Annotated[str | None, Cookie()] = None,
) -> None:
    if si_session:
        request.app.state.auth.delete_session(si_session)
    response.delete_cookie(SESSION_COOKIE, path="/")


@app.get("/api/auth/me")
def me(user: CurrentUser) -> dict:
    return user


@app.get("/api/model-card")
def model_card(request: Request, _: CurrentUser) -> dict:
    return request.app.state.engine.card


@app.post("/api/analyze")
def analyze(sample: SoilSample, request: Request, _: CurrentUser) -> dict:
    return request.app.state.engine.analyze(sample.model_dump())
