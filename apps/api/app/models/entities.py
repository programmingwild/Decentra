import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Boolean, Index
from sqlalchemy.orm import relationship
from app.database.base import Base

def utcnow():
    return datetime.now(timezone.utc)

def gen_id():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class RefreshToken(Base):
    """Single-use refresh token ledger for rotation + theft detection.

    Every issued refresh token gets a row. Using it revokes it (replaced_by
    points at the successor). Presenting an already-revoked token past the
    grace window means the token was stolen and replayed → the whole family
    (all of the user's refresh tokens) is revoked and the user must sign in.
    The grace window exists so two tabs refreshing at once don't nuke
    each other's sessions.
    """
    __tablename__ = "refresh_tokens"
    jti = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    replaced_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class OrganizationMember(Base):
    __tablename__ = "organization_members"
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String, nullable=False, default="ANALYST")  # ADMIN, ANALYST, MANAGER, VIEWER
    created_at = Column(DateTime, default=utcnow)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True, default=gen_id)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_type = Column(String, nullable=False, default="csv")
    storage_path = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="ready")
    uploaded_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    error_message = Column(Text, nullable=True)

class DatasetColumn(Base):
    __tablename__ = "dataset_columns"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    dtype = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    null_count = Column(Integer, default=0)
    unique_count = Column(Integer, default=0)
    stats = Column(JSON, nullable=True)

class DataQualityReport(Base):
    __tablename__ = "data_quality_reports"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    completeness = Column(Float, nullable=False)
    validity = Column(Float, nullable=False)
    uniqueness = Column(Float, nullable=False)
    consistency = Column(Float, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Metric(Base):
    __tablename__ = "metrics"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    previous_value = Column(Float, nullable=True)
    change_pct = Column(Float, nullable=True)
    target = Column(Float, nullable=True)
    status = Column(String, nullable=True)
    trend = Column(String, nullable=True)
    definition = Column(Text, nullable=True)
    is_auto = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

class Insight(Base):
    __tablename__ = "insights"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    severity = Column(String, nullable=False, default="medium")
    evidence = Column(JSON, nullable=True)
    explanation = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String, default="new")
    created_at = Column(DateTime, default=utcnow)

class Anomaly(Base):
    __tablename__ = "anomalies"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    method = Column(String, nullable=False)
    target_column = Column(String, nullable=False)
    record_index = Column(Integer, nullable=True)
    timestamp_value = Column(String, nullable=True)
    expected_min = Column(Float, nullable=True)
    expected_max = Column(Float, nullable=True)
    observed_value = Column(Float, nullable=False)
    deviation_pct = Column(Float, nullable=True)
    score = Column(Float, nullable=True)
    explanation = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    target_column = Column(String, nullable=False)
    features = Column(JSON, nullable=True)
    evaluation = Column(JSON, nullable=True)
    results = Column(JSON, nullable=True)
    horizon = Column(Integer, nullable=True)
    uncertainty_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(String, primary_key=True, default=gen_id)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    insight_id = Column(String, ForeignKey("insights.id"), nullable=True)
    observation = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=True)
    interpretation = Column(Text, nullable=True)
    action = Column(Text, nullable=False)
    priority = Column(String, default="medium")
    status = Column(String, default="open")
    created_at = Column(DateTime, default=utcnow)

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, default=gen_id)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=gen_id)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    structured_response = Column(JSON, nullable=True)
    evidence_refs = Column(JSON, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    provider = Column(String, nullable=True)
    model = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=gen_id)
    org_id = Column(String, nullable=True)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

# ── Meeting Intelligence ──
class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=gen_id)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(String, primary_key=True, default=gen_id)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=False)
    date = Column(DateTime, nullable=False, default=utcnow)
    duration_ms = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="draft")  # draft, recording, processing, ready, failed
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class Participant(Base):
    __tablename__ = "participants"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    display_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    role = Column(String, nullable=True)

class Recording(Base):
    __tablename__ = "recordings"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    storage_key = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Transcript(Base):
    __tablename__ = "transcripts"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    language = Column(String, nullable=True, default="en")
    created_at = Column(DateTime, default=utcnow)

class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    id = Column(String, primary_key=True, default=gen_id)
    transcript_id = Column(String, ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker_label = Column(String, nullable=False)
    speaker_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    start_ms = Column(Integer, nullable=False)
    end_ms = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    position = Column(Integer, nullable=False)

class Decision(Base):
    __tablename__ = "decisions"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_segment_ids = Column(JSON, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="DETECTED")  # DETECTED, CONFIRMED, REVISED, REJECTED, SUPERSEDED
    confidence = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    confirmed_at = Column(DateTime, nullable=True)

class ActionItem(Base):
    __tablename__ = "action_items"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_segment_ids = Column(JSON, nullable=True)
    task = Column(String, nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    owner_name = Column(String, nullable=True)
    deadline = Column(DateTime, nullable=True)
    deadline_raw = Column(String, nullable=True)
    status = Column(String, nullable=False, default="NOT_STARTED")  # NOT_STARTED, IN_PROGRESS, BLOCKED, COMPLETED, OVERDUE, CANCELLED
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class Question(Base):
    __tablename__ = "questions"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_segment_ids = Column(JSON, nullable=True)
    text = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="OPEN")  # OPEN, RESOLVED, DISMISSED
    created_at = Column(DateTime, default=utcnow)

class Risk(Base):
    __tablename__ = "risks"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript_segment_ids = Column(JSON, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=False, default="medium")  # low, medium, high
    status = Column(String, nullable=False, default="OPEN")  # OPEN, MITIGATED, DISMISSED
    created_at = Column(DateTime, default=utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)  # transcribe, diarize, extract, embed
    status = Column(String, nullable=False, default="queued")  # queued, running, succeeded, failed
    progress = Column(Integer, nullable=True, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

# ── Phase 1: Meeting Understanding + Decision DNA + Review ──
class MeetingUnderstanding(Base):
    __tablename__ = "meeting_understandings"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    objective = Column(Text, nullable=True)
    primary_theme = Column(String, nullable=True)
    secondary_themes = Column(JSON, nullable=True)  # list[str]
    requirements = Column(JSON, nullable=True)
    constraints = Column(JSON, nullable=True)
    background = Column(Text, nullable=True)
    topics = Column(JSON, nullable=True)  # list[dict]
    key_discussion_points = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class ParticipantAnalysis(Base):
    __tablename__ = "participant_analyses"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker_label = Column(String, nullable=False)
    participant_id = Column(String, ForeignKey("participants.id", ondelete="SET NULL"), nullable=True)
    participation_level = Column(String, nullable=True)  # high/medium/low
    topics_discussed = Column(JSON, nullable=True)
    proposals_made = Column(JSON, nullable=True)
    stance = Column(String, nullable=True)  # agree/disagree/neutral
    role = Column(String, nullable=True, default="ROLE_UNKNOWN")
    created_at = Column(DateTime, default=utcnow)

class DecisionDNA(Base):
    __tablename__ = "decision_dnas"
    id = Column(String, primary_key=True, default=gen_id)
    decision_id = Column(String, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    decision_class = Column(String, nullable=False, default="PROPOSED_DECISION")  # CONFIRMED_DECISION/TENTATIVE/PROPOSED/DISCUSSION_ONLY/REJECTED_OPTION
    provenance = Column(String, nullable=False, default="TRANSCRIPT_DERIVED")  # TRANSCRIPT_DERIVED/AI_INFERRED/EXTERNAL_RESEARCH/AI_RECOMMENDATION/HUMAN_APPROVED
    requirements = Column(JSON, nullable=True)
    constraints = Column(JSON, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    risks = Column(JSON, nullable=True)
    dependencies = Column(JSON, nullable=True)
    affected_systems = Column(JSON, nullable=True)
    affected_teams = Column(JSON, nullable=True)
    alternatives = Column(JSON, nullable=True)
    follow_up_actions = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    related_decision_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class DecisionBranch(Base):
    __tablename__ = "decision_branches"
    id = Column(String, primary_key=True, default=gen_id)
    decision_id = Column(String, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_type = Column(String, nullable=False)  # Architecture/Migration/Security/Operations etc.
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    provenance = Column(String, nullable=False, default="AI_INFERRED")
    created_at = Column(DateTime, default=utcnow)

class ReviewItem(Base):
    __tablename__ = "review_items"
    id = Column(String, primary_key=True, default=gen_id)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(String, nullable=False)  # decision/branch/risk/recommendation
    item_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")  # pending/accepted/edited/rejected
    provenance = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=True)

class ExternalResearch(Base):
    __tablename__ = "external_research"
    id = Column(String, primary_key=True, default=gen_id)
    decision_id = Column(String, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    query = Column(Text, nullable=True)
    sources = Column(JSON, nullable=True)  # list[dict]
    summary = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="unavailable")  # success/unavailable/skipped/blocked/error
    created_at = Column(DateTime, default=utcnow)

class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(String, primary_key=True, default=gen_id)
    decision_id = Column(String, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    health = Column(String, nullable=False)  # supported/has_concerns/conditional/reconsider
    concerns = Column(JSON, nullable=True)  # list[str]
    questions = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class DecisionRecommendation(Base):
    __tablename__ = "decision_recommendations"
    id = Column(String, primary_key=True, default=gen_id)
    decision_id = Column(String, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    what = Column(Text, nullable=False)
    why = Column(Text, nullable=True)
    based_on = Column(Text, nullable=True)
    risks = Column(JSON, nullable=True)
    next_step = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    sources = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="AI_RECOMMENDATION")  # AI_RECOMMENDATION/HUMAN_APPROVED
    created_at = Column(DateTime, default=utcnow)

class Comment(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=gen_id)
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    author_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    author_name = Column(String, nullable=True)
    text = Column(Text, nullable=False)
    parent_id = Column(String, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    mentions = Column(JSON, nullable=True)  # list of user_ids
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class AssistantCache(Base):
    """Shared answer cache (works across uvicorn workers, unlike memory).

    scope: "dataset" (keyed by dataset fingerprint) or "meetings" (org
    fingerprint). key_hash = sha256(scope, subject id, normalized question,
    provider, model, fingerprint). TTL is a backstop; fingerprint changes
    (new upload, new decision, …) invalidate precisely.
    """
    __tablename__ = "assistant_cache"
    id = Column(String, primary_key=True, default=gen_id)
    scope = Column(String, nullable=False, index=True)
    subject_id = Column(String, nullable=False, index=True)  # dataset or org id
    key_hash = Column(String, nullable=False, unique=True, index=True)
    question_norm = Column(Text, nullable=False)
    fingerprint = Column(String, nullable=False)
    response = Column(JSON, nullable=False)
    hits = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=False)
