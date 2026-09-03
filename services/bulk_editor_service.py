"""
Bulk Editor Service - Allows mass search & replace in video descriptions,
bulk tag manipulation, and disclaimer insertion across all channel videos with diff preview.
"""

import re
from typing import Dict, List, Any, Optional
from .youtube_service import YouTubeService


class BulkEditorService:
    def __init__(self, yt_service: Optional[YouTubeService] = None):
        self.yt = yt_service or YouTubeService()

    def preview_search_and_replace(
        self,
        channel_id: str,
        search_text: str,
        replace_text: str,
        case_sensitive: bool = False
    ) -> Dict[str, Any]:
        """
        Scans channel videos and produces a dry-run diff preview
        of what will be replaced in descriptions.
        """
        search_text = search_text.strip()
        if not search_text:
            raise ValueError("Поисковый текст не может быть пустым")

        videos = self.yt.get_channel_videos_rich(channel_id, limit=50)
        
        matched_videos = []
        flags = 0 if case_sensitive else re.IGNORECASE
        pattern = re.escape(search_text)

        for v in videos:
            desc = v.get('description', '')
            if re.search(pattern, desc, flags):
                # Calculate new description
                new_desc = re.sub(pattern, replace_text, desc, flags=flags)
                
                # Extract surrounding context snippet for preview
                match = re.search(pattern, desc, flags)
                start_idx = max(match.start() - 40, 0)
                end_idx = min(match.end() + 40, len(desc))
                snippet_before = desc[start_idx:end_idx]
                snippet_after = new_desc[start_idx:end_idx + (len(replace_text) - len(search_text))]

                matched_videos.append({
                    "id": v['id'],
                    "title": v['title'],
                    "thumbnail": v['thumbnail'],
                    "snippet_before": f"...{snippet_before}...",
                    "snippet_after": f"...{snippet_after}...",
                    "full_before": desc,
                    "full_after": new_desc
                })

        return {
            "channel_id": channel_id,
            "search_text": search_text,
            "replace_text": replace_text,
            "total_scanned": len(videos),
            "total_matched": len(matched_videos),
            "matched_videos": matched_videos
        }

    def preview_bulk_tag_addition(
        self,
        channel_id: str,
        tag_to_add: str
    ) -> Dict[str, Any]:
        """Scans channel videos and previews adding a new tag to all videos"""
        tag_to_add = tag_to_add.strip().lower()
        if not tag_to_add:
            raise ValueError("Введите тег для добавления")

        videos = self.yt.get_channel_videos_rich(channel_id, limit=50)
        modified_videos = []

        for v in videos:
            current_tags = v.get('tags', [])
            if isinstance(current_tags, str):
                current_tags = [t.strip() for t in current_tags.split(',') if t.strip()]

            if tag_to_add not in [t.lower() for t in current_tags]:
                new_tags = list(current_tags) + [tag_to_add]
                modified_videos.append({
                    "id": v['id'],
                    "title": v['title'],
                    "thumbnail": v['thumbnail'],
                    "tags_before": current_tags,
                    "tags_after": new_tags
                })

        return {
            "channel_id": channel_id,
            "tag_to_add": tag_to_add,
            "total_scanned": len(videos),
            "total_modified": len(modified_videos),
            "modified_videos": modified_videos
        }
