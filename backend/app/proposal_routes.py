import json
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.area_merge_service import AreaMergeError, AreaMergeService
from backend.app.area_repository import AreaNotFoundError, AreaRepository, InvalidAreaDataError
from backend.app.auth import get_current_user, require_roles
from backend.app.database import get_db
from backend.app.proposal_model import MapProposal
from backend.app.proposal_models import ProposalChanges, ProposalCreate, ProposalPublic, ProposalReview
from backend.app.user_model import User, utc_now


router = APIRouter(prefix="/api/v1/proposals", tags=["map-proposals"])
approval_lock = Lock()


def get_merge_service() -> AreaMergeService:
    from backend.app.main import PROJECT_ROOT

    return AreaMergeService(AreaRepository(PROJECT_ROOT))


def proposal_public(proposal: MapProposal) -> ProposalPublic:
    return ProposalPublic(
        id=proposal.id,
        submitter_id=proposal.submitter_id,
        reviewer_id=proposal.reviewer_id,
        area_id=proposal.area_id,
        title=proposal.title,
        description=proposal.description,
        changes=ProposalChanges.model_validate_json(proposal.changes_json),
        status=proposal.status,
        review_note=proposal.review_note,
        merge_summary=proposal.merge_summary,
        created_at=proposal.created_at,
        reviewed_at=proposal.reviewed_at,
    )


@router.post("", response_model=ProposalPublic, status_code=status.HTTP_201_CREATED)
def create_proposal(
    payload: ProposalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    merge_service: AreaMergeService = Depends(get_merge_service),
) -> ProposalPublic:
    try:
        merge_service.preview(payload.area_id, payload.changes)
    except (AreaMergeError, AreaNotFoundError, InvalidAreaDataError) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    proposal = MapProposal(
        submitter_id=current_user.id,
        area_id=payload.area_id,
        title=payload.title,
        description=payload.description,
        changes_json=payload.changes.model_dump_json(by_alias=True),
        status="pending",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal_public(proposal)


@router.get("/mine", response_model=list[ProposalPublic])
def my_proposals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProposalPublic]:
    proposals = db.scalars(
        select(MapProposal)
        .where(MapProposal.submitter_id == current_user.id)
        .order_by(MapProposal.created_at.desc())
    ).all()
    return [proposal_public(proposal) for proposal in proposals]


@router.get("", response_model=list[ProposalPublic])
def review_queue(
    _: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
) -> list[ProposalPublic]:
    proposals = db.scalars(select(MapProposal).order_by(MapProposal.created_at.desc())).all()
    return [proposal_public(proposal) for proposal in proposals]


def pending_proposal(db: Session, proposal_id: int) -> MapProposal:
    proposal = db.get(MapProposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="修改申请不存在")
    if proposal.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="修改申请已经处理")
    return proposal


@router.post("/{proposal_id}/approve", response_model=ProposalPublic)
def approve_proposal(
    proposal_id: int,
    review: ProposalReview,
    reviewer: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
    merge_service: AreaMergeService = Depends(get_merge_service),
) -> ProposalPublic:
    with approval_lock:
        db.expire_all()
        proposal = pending_proposal(db, proposal_id)
        try:
            summary = merge_service.merge(
                proposal.area_id,
                ProposalChanges.model_validate_json(proposal.changes_json),
            )
        except (AreaMergeError, AreaNotFoundError, InvalidAreaDataError) as error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"无法合并：{error}") from error
        proposal.status = "approved"
        proposal.reviewer_id = reviewer.id
        proposal.review_note = review.note
        proposal.merge_summary = json.dumps(summary, ensure_ascii=False)
        proposal.reviewed_at = utc_now()
        db.commit()
        db.refresh(proposal)
        return proposal_public(proposal)


@router.post("/{proposal_id}/reject", response_model=ProposalPublic)
def reject_proposal(
    proposal_id: int,
    review: ProposalReview,
    reviewer: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
) -> ProposalPublic:
    proposal = pending_proposal(db, proposal_id)
    proposal.status = "rejected"
    proposal.reviewer_id = reviewer.id
    proposal.review_note = review.note
    proposal.reviewed_at = utc_now()
    db.commit()
    db.refresh(proposal)
    return proposal_public(proposal)
