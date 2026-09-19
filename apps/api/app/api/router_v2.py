from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.auth.security import get_current_user
from app.rate_limit import limiter
from app.utils.uploads import read_upload_capped
from app.models.entities import Dataset, DatasetColumn, DataQualityReport, Conversation, Message, OrganizationMember
from app.services.ingestion import process_upload
from app.services.quality import compute_quality, generate_quality_report
from app.services.answer_cache import (dataset_fingerprint, lookup as cache_lookup,
                                       store as cache_store)
from app.utils.storage import load_dataframe
from app.analytics.engine import describe_numeric, correlation_matrix, trends, segmentation, kpi_candidates
from app.ml.anomaly import detect_anomalies
from app.ml.forecast import forecast_series
from app.insights.engine import generate_insights
from app.recommendations.engine import build_recommendations
from app.ai.orchestrator import build_evidence, dataset_context
from app.ai.provider import get_provider
from app.config.settings import get_settings
import logging

logger = logging.getLogger("decentra")

router_v2 = APIRouter(prefix="/api/v1")

async def require_dataset_access(dataset_id: str, user, db: AsyncSession):
    ds = await db.get(Dataset, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    m = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == ds.org_id, OrganizationMember.user_id == user.id))
    if not m.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized for dataset")
    return ds

@router_v2.post("/datasets/upload")
@limiter.limit("20/minute")
async def upload_dataset(request: Request, org_id: str = Form(...), name: str = Form(None), description: str = Form(None), file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    m = await db.execute(select(OrganizationMember).where(OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id))
    if not m.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")
    settings = get_settings()
    try:
        data = await read_upload_capped(file, settings.max_upload_mb * 1024 * 1024)
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))
    try:
        dataset, df = await process_upload(data, file.filename, org_id, user.id, name, description, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # generate quality report
    try:
        report = await generate_quality_report(dataset.id, df, db)
    except Exception:
        report = None
    return {"dataset": {"id": dataset.id, "name": dataset.name, "row_count": dataset.row_count, "column_count": dataset.column_count}, "quality": {"score": report.score if report else None, "completeness": report.completeness if report else None}}

@router_v2.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    cols = await db.execute(select(DatasetColumn).where(DatasetColumn.dataset_id == dataset_id).order_by(DatasetColumn.position))
    columns = [{"name": c.name, "dtype": c.dtype, "null_count": c.null_count, "unique_count": c.unique_count, "stats": c.stats} for c in cols.scalars().all()]
    # NOTE: storage_path is an internal server path — never expose it.
    import pathlib
    artifact = pathlib.Path(ds.storage_path or "").suffix.lstrip(".") or "artifact"
    return {"id": ds.id, "name": ds.name, "org_id": ds.org_id, "row_count": ds.row_count, "column_count": ds.column_count, "status": ds.status, "artifact": artifact, "columns": columns, "created_at": ds.created_at}

@router_v2.get("/datasets/{dataset_id}/quality")
async def get_quality(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    r = await db.execute(select(DataQualityReport).where(DataQualityReport.dataset_id == dataset_id).order_by(DataQualityReport.created_at.desc()))
    report = r.scalars().first()
    if not report:
        # compute on fly
        try:
            df = load_dataframe(ds.storage_path)
            q = compute_quality(df)
            return q
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Dataset artifact not found")
        except Exception:
            logger.exception(f"Quality compute failed for dataset {dataset_id}")
            raise HTTPException(status_code=500, detail="Failed to compute quality")
    return {"score": report.score, "completeness": report.completeness, "validity": report.validity, "uniqueness": report.uniqueness, "consistency": report.consistency, "details": report.details}

@router_v2.get("/datasets/{dataset_id}/kpis")
async def get_kpis(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    df = load_dataframe(ds.storage_path)
    return {"kpis": kpi_candidates(df)}

@router_v2.get("/datasets/{dataset_id}/analytics/overview")
async def analytics_overview(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    df = load_dataframe(ds.storage_path)
    return {"describe": describe_numeric(df), "trends": trends(df), "segmentation": segmentation(df), "correlation": correlation_matrix(df)}

@router_v2.get("/datasets/{dataset_id}/anomalies")
async def get_anomalies(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    df = load_dataframe(ds.storage_path)
    anomalies = detect_anomalies(df)
    return {"anomalies": anomalies, "count": len(anomalies)}

@router_v2.get("/datasets/{dataset_id}/predictions")
async def get_predictions(dataset_id: str, horizon: int = 6, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    df = load_dataframe(ds.storage_path)
    fc = forecast_series(df, horizon=horizon)
    if not fc:
        return {"forecast": None, "message": "Insufficient time-series data for forecasting"}
    return fc

@router_v2.get("/datasets/{dataset_id}/insights")
async def get_insights(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    df = load_dataframe(ds.storage_path)
    ins = generate_insights(df, dataset_id)
    anomalies = detect_anomalies(df)
    return {"insights": ins, "anomalies": anomalies[:5]}

@router_v2.get("/datasets/{dataset_id}/recommendations")
async def get_recommendations(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    df = load_dataframe(ds.storage_path)
    ins = generate_insights(df, dataset_id)
    anomalies = detect_anomalies(df)
    recs = build_recommendations(ins, anomalies)
    return {"recommendations": recs}

@router_v2.post("/datasets/{dataset_id}/assistant/query")
@limiter.limit("30/minute")
async def assistant_query(request: Request, dataset_id: str, body: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    question = body.get("question") or body.get("query")
    if not question:
        raise HTTPException(status_code=400, detail="question required")
    conversation_id = body.get("conversation_id")
    ds = await require_dataset_access(dataset_id, user, db)
    settings = get_settings()
    provider_name = (settings.ai_provider or "local").lower()
    model_name = settings.groq_model if provider_name == "groq" else settings.openai_model
    # cache first: fingerprint covers file bytes + shape, so repeats skip
    # the dataframe load, evidence compute, AND the LLM call entirely.
    fp = dataset_fingerprint(ds)
    hit = await cache_lookup(db, scope="dataset", subject_id=dataset_id, question=question,
                             provider=provider_name, model=model_name, fingerprint=fp,
                             ttl_seconds=settings.assistant_cache_ttl_seconds)
    # get or create conversation (history stays complete on hits too)
    conv = None
    if conversation_id:
        conv = await db.get(Conversation, conversation_id)
    if not conv:
        conv = Conversation(org_id=ds.org_id, dataset_id=dataset_id, user_id=user.id, title=question[:80])
        db.add(conv)
        await db.flush()
    if hit is not None:
        db.add(Message(conversation_id=conv.id, role="user", content=question))
        db.add(Message(conversation_id=conv.id, role="assistant", content=hit.get("answer", ""),
                       structured_response=hit, evidence_refs=hit.get("evidence", []),
                       latency_ms=0, provider=provider_name, model=model_name))
        await db.commit()
        return {**hit, "conversation_id": conv.id, "latency_ms": 0, "cached": True}
    df = load_dataframe(ds.storage_path)
    # build evidence
    intent, evidence = build_evidence(question, df, ds.name)
    ctx = dataset_context(df, ds.name, [c.name for c in (await db.execute(select(DatasetColumn).where(DatasetColumn.dataset_id == dataset_id))).scalars().all()])
    provider = get_provider(settings.ai_provider, settings)
    import time
    start = time.time()
    result = await provider.interpret(question, evidence, ctx)
    latency = int((time.time() - start) * 1000)
    # persist messages
    user_msg = Message(conversation_id=conv.id, role="user", content=question)
    db.add(user_msg)
    assistant_msg = Message(conversation_id=conv.id, role="assistant", content=result.get("answer",""), structured_response=result, evidence_refs=evidence.get("evidence_list", []), latency_ms=latency, provider=settings.ai_provider, model=getattr(settings, "openai_model", ""))
    db.add(assistant_msg)
    await db.commit()
    full = {**result, "conversation_id": conv.id, "intent": intent, "evidence": evidence.get("evidence_list", []), "latency_ms": latency}
    await cache_store(db, scope="dataset", subject_id=dataset_id, question=question,
                      provider=provider_name, model=model_name, fingerprint=fp,
                      response=full, ttl_seconds=settings.assistant_cache_ttl_seconds)
    return full


@router_v2.post("/datasets/{dataset_id}/assistant/query/stream")
@limiter.limit("30/minute")
async def assistant_query_stream(request: Request, dataset_id: str, body: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """SSE twin of dataset assistant/query. Events: evidence → token* → done | error."""
    from fastapi.responses import StreamingResponse
    from app.utils.sse import SSE_HEADERS, frame
    question = body.get("question") or body.get("query")
    if not question:
        raise HTTPException(status_code=400, detail="question required")
    ds = await require_dataset_access(dataset_id, user, db)
    settings = get_settings()
    provider_name = (settings.ai_provider or "local").lower()
    model_name = settings.groq_model if provider_name == "groq" else settings.openai_model
    fp = dataset_fingerprint(ds)
    hit = await cache_lookup(db, scope="dataset", subject_id=dataset_id, question=question,
                             provider=provider_name, model=model_name, fingerprint=fp,
                             ttl_seconds=settings.assistant_cache_ttl_seconds)

    async def gen():
        import time
        if hit is not None:
            yield frame("evidence", {"evidence": hit.get("evidence", []), "cached": True})
            yield frame("token", {"delta": hit.get("answer", "")})
            yield frame("done", {**hit, "latency_ms": 0, "cached": True})
            return
        df = load_dataframe(ds.storage_path)
        intent, evidence = build_evidence(question, df, ds.name)
        ctx = dataset_context(df, ds.name, [c.name for c in (await db.execute(select(DatasetColumn).where(DatasetColumn.dataset_id == dataset_id))).scalars().all()])
        yield frame("evidence", {"evidence": evidence.get("evidence_list", []), "intent": intent})
        provider = get_provider(settings.ai_provider, settings)
        start = time.time()
        buf: list[str] = []
        try:
            async for delta in provider.stream_answer(question, evidence, ctx):
                buf.append(delta)
                yield frame("token", {"delta": delta})
            import json as js
            try:
                parsed = js.loads("".join(buf))
                result = {
                    "answer": parsed.get("answer", "".join(buf)),
                    "insights": parsed.get("insights", []),
                    "evidence": parsed.get("evidence", evidence.get("evidence_list", [])),
                    "recommendations": parsed.get("recommendations", []),
                    "confidence": parsed.get("confidence"),
                }
            except Exception:
                result = await provider.interpret(question, evidence, ctx)
        except Exception as e:
            logger.warning("dataset stream failed: %s", type(e).__name__)
            result = await provider.interpret(question, evidence, ctx)
        latency = int((time.time() - start) * 1000)
        full = {**result, "intent": intent, "evidence": evidence.get("evidence_list", []), "latency_ms": latency}
        await cache_store(db, scope="dataset", subject_id=dataset_id, question=question,
                          provider=provider_name, model=model_name, fingerprint=fp,
                          response=full, ttl_seconds=settings.assistant_cache_ttl_seconds)
        yield frame("done", full)

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)

@router_v2.get("/conversations")
async def list_conversations(dataset_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    q = select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc())
    if dataset_id:
        q = q.where(Conversation.dataset_id == dataset_id)
    r = await db.execute(q.limit(20))
    convs = r.scalars().all()
    return [{"id": c.id, "title": c.title, "dataset_id": c.dataset_id, "created_at": c.created_at} for c in convs]

@router_v2.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    r = await db.execute(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at))
    msgs = r.scalars().all()
    return [{"role": m.role, "content": m.content, "structured": m.structured_response, "evidence": m.evidence_refs, "created_at": m.created_at} for m in msgs]

@router_v2.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ds = await require_dataset_access(dataset_id, user, db)
    await db.delete(ds)
    await db.commit()
    return {"deleted": True}
