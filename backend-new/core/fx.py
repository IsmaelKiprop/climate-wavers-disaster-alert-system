"""
Live USD → KES market rate for tree checkout + funds recomputation.
Caches briefly so we do not hammer public FX APIs on every donation.
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Soft fallback only when every live source fails (should be rare).
FALLBACK_USD_KES = Decimal("130")
_CACHE: Dict[str, Any] = {"rate": None, "source": None, "fetched_at": 0.0}
_CACHE_TTL_SEC = 15 * 60


def _as_decimal(value) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        d = Decimal(str(value))
        if d > 0:
            return d
    except Exception:
        return None
    return None


def _http_json(url: str, timeout: int = 8) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ClimateWavers-API/1.0",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw or "{}")
    if not isinstance(data, dict):
        raise ValueError("FX payload is not an object")
    return data


def _sources() -> List[Tuple[str, str, callable]]:
    """Ordered live sources: (name, url, extractor)."""
    custom = (os.getenv("EXCHANGE_RATE_API_URL") or "").strip()
    rows: List[Tuple[str, str, callable]] = []
    if custom.startswith("http"):
        rows.append(
            (
                "env",
                custom,
                lambda d: _as_decimal(
                    (d.get("conversion_rates") or {}).get("KES")
                    or (d.get("rates") or {}).get("KES")
                    or d.get("kes")
                    or d.get("rate")
                ),
            )
        )
    key = (os.getenv("EXCHANGE_RATE_API_KEY") or "").strip()
    if key:
        rows.append(
            (
                "exchangerate-api",
                f"https://v6.exchangerate-api.com/v6/{key}/latest/USD",
                lambda d: _as_decimal((d.get("conversion_rates") or {}).get("KES"))
                if d.get("result") == "success"
                else None,
            )
        )
    rows.extend(
        [
            (
                "open-er-api",
                "https://open.er-api.com/v6/latest/USD",
                lambda d: _as_decimal((d.get("rates") or {}).get("KES"))
                if d.get("result") == "success"
                else None,
            ),
            (
                "frankfurter",
                "https://api.frankfurter.app/latest?from=USD&to=KES",
                lambda d: _as_decimal((d.get("rates") or {}).get("KES")),
            ),
            (
                "currency-api",
                "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
                lambda d: _as_decimal((d.get("usd") or {}).get("kes")),
            ),
        ]
    )
    return rows


def fetch_usd_kes_rate(*, force: bool = False) -> Tuple[Decimal, str, bool]:
    """
    Returns (rate, source, is_live).
    is_live=False only when every provider failed and fallback was used.
    """
    now = time.time()
    cached = _CACHE.get("rate")
    if (
        not force
        and cached is not None
        and (now - float(_CACHE.get("fetched_at") or 0)) < _CACHE_TTL_SEC
    ):
        return Decimal(str(cached)), str(_CACHE.get("source") or "cache"), True

    errors = []
    for name, url, extract in _sources():
        try:
            data = _http_json(url)
            rate = extract(data)
            if rate is None:
                raise ValueError(f"{name}: KES missing")
            # Sanity: KES per USD typically 50–300 in recent years
            if not (Decimal("50") <= rate <= Decimal("400")):
                raise ValueError(f"{name}: implausible rate {rate}")
            _CACHE["rate"] = rate
            _CACHE["source"] = name
            _CACHE["fetched_at"] = now
            return rate.quantize(Decimal("0.0001")), name, True
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            logger.warning("FX source failed (%s): %s", name, exc)

    logger.error("All FX sources failed; using fallback %s — %s", FALLBACK_USD_KES, errors)
    return FALLBACK_USD_KES, "fallback", False


def usd_to_kes(amount_usd, rate: Optional[Decimal] = None) -> Decimal:
    usd = _as_decimal(amount_usd) or Decimal("0")
    fx = rate or fetch_usd_kes_rate()[0]
    return (usd * fx).quantize(Decimal("0.01"))


def kes_to_usd(amount_kes, rate: Optional[Decimal] = None) -> Decimal:
    kes = _as_decimal(amount_kes) or Decimal("0")
    fx = rate or fetch_usd_kes_rate()[0]
    if fx <= 0:
        fx = FALLBACK_USD_KES
    return (kes / fx).quantize(Decimal("0.01"))


class UsdKesRateView:
    """Lazy DRF view class — imported from urls without circular imports."""

    @staticmethod
    def as_view():
        from rest_framework.permissions import AllowAny
        from rest_framework.response import Response
        from rest_framework.views import APIView

        class _View(APIView):
            permission_classes = [AllowAny]
            authentication_classes = []

            def get(self, request):
                force = str(request.query_params.get("refresh") or "").lower() in {
                    "1",
                    "true",
                    "yes",
                }
                rate, source, is_live = fetch_usd_kes_rate(force=force)
                return Response(
                    {
                        "base": "USD",
                        "quote": "KES",
                        "rate": float(rate),
                        "source": source,
                        "live": is_live,
                    }
                )

        return _View.as_view()
