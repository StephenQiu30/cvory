"""Validate and normalize small content images; never accept remote image URLs."""
import base64
import io
from PIL import Image, UnidentifiedImageError
from app.core.errors import InvalidArgumentError


def normalize_image(value: str | None) -> str | None:
    if not value:
        return None
    if not value.startswith(("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")) or len(value) > 3_000_000:
        raise InvalidArgumentError("Image must be JPEG, PNG or WebP, up to 2 MB.")
    try:
        raw = base64.b64decode(value.split(",", 1)[1], validate=True)
        if len(raw) > 2_097_152:
            raise ValueError()
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError()
            image.load()
            if image.format == "JPEG" and image.mode == "RGB" and image.width <= 1200 and image.height <= 1600 and not image.info.get("exif") and not image.info.get("icc_profile"):
                return "data:image/jpeg;base64," + base64.b64encode(raw).decode()
            image = image.convert("RGB")
            image.thumbnail((1200, 1600))
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=90)
        return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise InvalidArgumentError("Image cannot be decoded.") from exc
