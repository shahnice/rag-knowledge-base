from fastapi import APIRouter
from openai import AuthenticationError, OpenAI

from app.schemas import ValidateKeyRequest, ValidateKeyResponse

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post("/validate-key", response_model=ValidateKeyResponse)
def validate_key(request: ValidateKeyRequest):
    key = request.openai_api_key.strip()
    if not key:
        return ValidateKeyResponse(valid=False, detail="API key is empty")
    try:
        OpenAI(api_key=key).models.list()
    except AuthenticationError:
        return ValidateKeyResponse(valid=False, detail="Invalid API key")
    except Exception as err:
        return ValidateKeyResponse(valid=False, detail=str(err))
    return ValidateKeyResponse(valid=True)
