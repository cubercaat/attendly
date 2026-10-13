"""WebAuthn (passkey) o'rami — py_webauthn ustida yupqa qatlam."""
import base64
import json
from typing import Any, Optional

from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.config import settings


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64u(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _origin() -> str:
    return settings.base_url.rstrip("/")


def registration_options(user_id: int, user_name: str, display_name: str) -> dict:
    opts = generate_registration_options(
        rp_id=settings.rp_id,
        rp_name=settings.app_name,
        user_id=str(user_id).encode(),
        user_name=user_name,
        user_display_name=display_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    return json.loads(options_to_json(opts))


def authentication_options(credential_ids: list[bytes]) -> dict:
    opts = generate_authentication_options(
        rp_id=settings.rp_id,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=cid) for cid in credential_ids
        ],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    return json.loads(options_to_json(opts))


class PasskeyError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def verify_registration(credential: dict[str, Any], challenge_b64: str) -> dict:
    try:
        res = verify_registration_response(
            credential=credential,
            expected_challenge=unb64u(challenge_b64),
            expected_origin=_origin(),
            expected_rp_id=settings.rp_id,
            require_user_verification=True,
        )
    except Exception as e:  # noqa: BLE001
        raise PasskeyError(f"registration_failed: {e}") from e
    return {
        "credential_id": res.credential_id,
        "public_key": res.credential_public_key,
        "sign_count": res.sign_count,
    }


def verify_authentication(
    credential: dict[str, Any],
    challenge_b64: str,
    public_key: bytes,
    current_sign_count: int,
) -> int:
    try:
        res = verify_authentication_response(
            credential=credential,
            expected_challenge=unb64u(challenge_b64),
            expected_origin=_origin(),
            expected_rp_id=settings.rp_id,
            credential_public_key=public_key,
            credential_current_sign_count=current_sign_count,
            require_user_verification=True,
        )
    except Exception as e:  # noqa: BLE001
        raise PasskeyError(f"authentication_failed: {e}") from e
    return res.new_sign_count


def credential_id_from_response(credential: dict[str, Any]) -> Optional[bytes]:
    raw = credential.get("rawId") or credential.get("id")
    if not raw:
        return None
    try:
        return unb64u(raw)
    except Exception:  # noqa: BLE001
        return None
