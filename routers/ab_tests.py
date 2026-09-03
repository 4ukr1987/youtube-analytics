"""
Thumbnail & Title A/B Testing Router.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ab_testing_service import ABTestingService
from services.db_service import DatabaseService

router = APIRouter(prefix="/api/ab-tests", tags=["A/B Testing"])

db_service = DatabaseService()
ab_service = ABTestingService(db_service)


class ABTestCreateRequest(BaseModel):
    video_id: str
    video_title: str
    original_thumbnail: str
    variant_a_title: str
    variant_a_thumbnail: str
    variant_b_title: str
    variant_b_thumbnail: str
    interval_hours: Optional[int] = 24


@router.get("")
async def list_ab_tests():
    """Lists all active and completed A/B experiments"""
    try:
        tests = ab_service.list_ab_tests()
        return {
            "status": "success",
            "tests": tests
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create")
async def create_ab_test(req: ABTestCreateRequest):
    """Creates a new thumbnail and title A/B experiment"""
    try:
        test = ab_service.create_ab_test(
            video_id=req.video_id,
            video_title=req.video_title,
            original_thumbnail=req.original_thumbnail,
            variant_a_title=req.variant_a_title,
            variant_a_thumbnail=req.variant_a_thumbnail,
            variant_b_title=req.variant_b_title,
            variant_b_thumbnail=req.variant_b_thumbnail,
            interval_hours=req.interval_hours or 24
        )
        return {
            "status": "success",
            "test": test
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
