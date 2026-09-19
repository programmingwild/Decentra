from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectOut(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

class MeetingCreate(BaseModel):
    title: str
    date: Optional[datetime] = None
    project_id: Optional[str] = None
    participant_emails: Optional[List[str]] = None
    participant_names: Optional[List[str]] = None

class MeetingOut(BaseModel):
    id: str
    org_id: str
    project_id: Optional[str] = None
    title: str
    date: Optional[datetime] = None
    duration_ms: Optional[int] = None
    status: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    participant_count: int = 0
    decisions_count: int = 0
    actions_count: int = 0

class DecisionOut(BaseModel):
    id: str
    meeting_id: str
    title: str
    description: Optional[str] = None
    status: str
    confidence: Optional[float] = None
    transcript_segment_ids: Optional[List[str]] = None

class ActionOut(BaseModel):
    id: str
    meeting_id: str
    task: str
    owner_name: Optional[str] = None
    deadline: Optional[datetime] = None
    deadline_raw: Optional[str] = None
    status: str
    transcript_segment_ids: Optional[List[str]] = None
