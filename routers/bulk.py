"""
Bulk Video Editor (Descriptions, Tags, Templates) Router.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.bulk_editor_service import BulkEditorService
from services.youtube_service import YouTubeService

router = APIRouter(prefix="/api/bulk", tags=["Bulk Tools"])

yt_service = YouTubeService()
bulk_service = BulkEditorService(yt_service)


class BulkReplaceRequest(BaseModel):
    channel_id: str
    search_text: str
    replace_text: str
    case_sensitive: Optional[bool] = False

class BulkTagRequest(BaseModel):
    channel_id: str
    tag_to_add: str


@router.post("/replace-preview")
async def preview_bulk_replace(req: BulkReplaceRequest):
    """Scans all channel videos and generates a diff preview of search & replace in descriptions"""
    try:
        chan_id = yt_service.resolve_channel_id(req.channel_id) or req.channel_id
        preview = bulk_service.preview_search_and_replace(
            channel_id=chan_id,
            search_text=req.search_text,
            replace_text=req.replace_text,
            case_sensitive=req.case_sensitive or False
        )
        return {
            "status": "success",
            "preview": preview
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tags-preview")
async def preview_bulk_tags(req: BulkTagRequest):
    """Previews adding a tag across all channel videos"""
    try:
        chan_id = yt_service.resolve_channel_id(req.channel_id) or req.channel_id
        preview = bulk_service.preview_bulk_tag_addition(
            channel_id=chan_id,
            tag_to_add=req.tag_to_add
        )
        return {
            "status": "success",
            "preview": preview
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
