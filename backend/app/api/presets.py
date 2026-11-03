"""Per-account style presets without live references from CV documents."""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.errors import NotFoundError, InvalidArgumentError
from app.core.security import get_current_owner
from app.models.account import PresetModel
from app.schemas.account import StylePreset

router = APIRouter(prefix="/presets", tags=["presets"])


@router.get("", response_model=list[StylePreset], operation_id="listPresets")
def list_presets(db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    return [StylePreset(id=p.id, display_name=p.display_name, settings=p.settings) for p in db.query(PresetModel).filter_by(owner_id=owner).all()]


@router.post("", response_model=StylePreset, operation_id="savePreset")
def save_preset(payload: StylePreset, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    preset = db.query(PresetModel).filter_by(id=payload.id, owner_id=owner).first() if payload.id else None
    if payload.id and not preset:
        raise NotFoundError()
    if not payload.display_name.strip():
        raise InvalidArgumentError("Preset name is required.")
    if not preset:
        preset = PresetModel(id=str(uuid.uuid4()), owner_id=owner)
        db.add(preset)
    preset.display_name = payload.display_name.strip()
    preset.settings = payload.settings.model_dump(by_alias=True)
    db.commit()
    return StylePreset(id=preset.id, display_name=preset.display_name, settings=preset.settings)


@router.delete("/{preset_id}", status_code=204, operation_id="deletePreset")
def delete_preset(preset_id: str, db: Session = Depends(get_db), owner: str = Depends(get_current_owner)):
    if not db.query(PresetModel).filter_by(id=preset_id, owner_id=owner).delete():
        raise NotFoundError()
    db.commit()
