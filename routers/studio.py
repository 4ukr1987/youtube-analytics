"""
YouTube Studio Analytics & Google OAuth Router.
Handles Google OAuth 2.0 flow, token exchange, and YouTube Studio metrics.
"""

import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from services.oauth_studio_service import StudioAnalyticsService

router = APIRouter(tags=["YouTube Studio & Google OAuth"])

studio_service = StudioAnalyticsService()


class OAuthKeysRequest(BaseModel):
    client_id: str
    client_secret: str


@router.get("/api/oauth/status")
async def get_oauth_status():
    """Returns whether user is currently authenticated via Google and their channel details"""
    try:
        is_auth = studio_service.is_authenticated()
        channel_info = studio_service.get_my_channel_info() if is_auth else {"authenticated": False}
        is_configured = bool(studio_service.client_id and studio_service.client_secret)
        return {
            "status": "success",
            "is_authenticated": is_auth,
            "is_configured": is_configured,
            "client_id": studio_service.client_id[:12] + "..." if studio_service.client_id else "",
            "channel": channel_info
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/oauth/login-url")
async def get_oauth_login_url(redirect_uri: str = Query("http://127.0.0.1:8000/api/oauth/callback")):
    """Generates real Google OAuth consent URL"""
    try:
        auth_data = studio_service.get_auth_url(redirect_uri=redirect_uri)
        return {"status": "success", "data": auth_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/oauth/callback")
@router.get("/auth/callback")
async def oauth_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None):
    """Google OAuth redirect endpoint"""
    if error:
        return RedirectResponse(url="/?oauth_error=" + error)
    if not code:
        return RedirectResponse(url="/?oauth_error=no_code")

    try:
        # Determine current redirect URI based on request
        redirect_uri = str(request.url).split('?')[0]
        channel_info = studio_service.exchange_code_for_token(code=code, redirect_uri=redirect_uri)
        return RedirectResponse(url="/?oauth=success")
    except Exception as e:
        return RedirectResponse(url=f"/?oauth_error={str(e)}")


@router.post("/api/oauth/logout")
async def oauth_logout():
    """Logs out and clears saved Google tokens"""
    try:
        res = studio_service.logout()
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/oauth/save-keys")
async def save_oauth_keys(req: OAuthKeysRequest):
    """Saves Google OAuth Client ID & Secret to .env and updates service instance"""
    try:
        cid = req.client_id.strip()
        sec = req.client_secret.strip()

        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        env_lines = []
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                env_lines = f.readlines()

        new_lines = []
        has_cid = False
        has_sec = False

        for line in env_lines:
            if line.startswith("GOOGLE_CLIENT_ID="):
                new_lines.append(f"GOOGLE_CLIENT_ID={cid}\n")
                has_cid = True
            elif line.startswith("GOOGLE_CLIENT_SECRET="):
                new_lines.append(f"GOOGLE_CLIENT_SECRET={sec}\n")
                has_sec = True
            else:
                new_lines.append(line)

        if not has_cid:
            new_lines.append(f"GOOGLE_CLIENT_ID={cid}\n")
        if not has_sec:
            new_lines.append(f"GOOGLE_CLIENT_SECRET={sec}\n")

        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)

        os.environ['GOOGLE_CLIENT_ID'] = cid
        os.environ['GOOGLE_CLIENT_SECRET'] = sec
        studio_service.client_id = cid
        studio_service.client_secret = sec

        return {"status": "success", "message": "Google OAuth ключи успешно сохранены!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/studio/analytics")
async def get_studio_analytics(channel_id: Optional[str] = None, time_range: str = Query("28d")):
    """Returns rich private YouTube Studio metrics: Retention curve, CTR, Traffic, Geography, Devices, Top Videos"""
    try:
        analytics = studio_service.get_studio_deep_analytics(channel_id=channel_id, time_range=time_range)
        return {
            "status": "success",
            "studio": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
