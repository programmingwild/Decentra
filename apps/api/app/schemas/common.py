from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    created_at: Optional[datetime] = None

class OrgCreate(BaseModel):
    name: str
    slug: Optional[str] = None

class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    created_at: Optional[datetime] = None

class DatasetOut(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    source_type: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None

class AIQuery(BaseModel):
    question: str
    conversation_id: Optional[str] = None

class AIResponse(BaseModel):
    answer: str
    insights: list = []
    evidence: list = []
    recommendations: list = []
    confidence: Optional[float] = None
    conversation_id: Optional[str] = None
