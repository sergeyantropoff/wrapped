from __future__ import annotations

import ipaddress
import re

from fastapi import Request

from app.config import get_settings

_FORWARDED_FOR_RE = re.compile(r"for=(?:\"?\[?)([^;\"\\]\S*)", re.IGNORECASE)


def _parse_ip(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip().strip('"').strip()
    if not raw or raw.lower() == "unknown":
        return None
    # [IPv6]:port or IPv4:port
    if raw.startswith("["):
        end = raw.find("]")
        if end != -1:
            raw = raw[1:end]
    elif raw.count(":") == 1 and "." in raw:
        raw = raw.rsplit(":", 1)[0]
    try:
        addr = ipaddress.ip_address(raw)
    except ValueError:
        return None
    # Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        return str(addr.ipv4_mapped)
    return str(addr)


def _peer_ip(request: Request) -> str | None:
    if request.client and request.client.host:
        return _parse_ip(request.client.host) or request.client.host
    return None


def _trusted_proxy_nets() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network] | None:
    """None means trust any peer (TRUSTED_PROXIES=*)."""
    raw = (get_settings().trusted_proxies or "").strip()
    if not raw or raw == "*":
        return None
    nets: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            if "/" in part:
                nets.append(ipaddress.ip_network(part, strict=False))
            else:
                ip = ipaddress.ip_address(part)
                nets.append(ipaddress.ip_network(f"{ip}/{ip.max_prefixlen}"))
        except ValueError:
            continue
    return nets


def _is_trusted_peer(peer: str | None) -> bool:
    if not peer:
        return False
    nets = _trusted_proxy_nets()
    if nets is None:
        return True
    try:
        addr = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return any(addr in net for net in nets)


def _ips_from_forwarded_for(header: str | None) -> list[str]:
    if not header:
        return []
    out: list[str] = []
    for part in header.split(","):
        ip = _parse_ip(part)
        if ip:
            out.append(ip)
    return out


def _ips_from_forwarded(header: str | None) -> list[str]:
    if not header:
        return []
    out: list[str] = []
    for match in _FORWARDED_FOR_RE.finditer(header):
        ip = _parse_ip(match.group(1))
        if ip:
            out.append(ip)
    return out


def client_ip(request: Request) -> str | None:
    """
    Resolve the original client IP.

    When the immediate peer is a trusted proxy, prefer (in order):
    CF-Connecting-IP, True-Client-IP, X-Real-IP, left-most X-Forwarded-For,
    RFC 7239 Forwarded. Otherwise use the TCP peer address.
    """
    peer = _peer_ip(request)
    if _is_trusted_peer(peer):
        for header in ("cf-connecting-ip", "true-client-ip", "x-real-ip"):
            ip = _parse_ip(request.headers.get(header))
            if ip:
                return ip
        chain = _ips_from_forwarded_for(request.headers.get("x-forwarded-for"))
        if chain:
            return chain[0]
        chain = _ips_from_forwarded(request.headers.get("forwarded"))
        if chain:
            return chain[0]
    return peer


def request_meta(request: Request) -> dict[str, str | None]:
    forwarded = request.headers.get("x-forwarded-for")
    real_ip = request.headers.get("x-real-ip")
    cf_ip = request.headers.get("cf-connecting-ip")
    forwarded_store = forwarded or real_ip or cf_ip
    return {
        "ip": client_ip(request),
        "user_agent": request.headers.get("user-agent"),
        "accept_language": request.headers.get("accept-language"),
        "forwarded_for": (forwarded_store or "")[:256] or None,
    }


def uvicorn_forwarded_allow_ips() -> str:
    """Value for uvicorn --forwarded-allow-ips (CIDRs not supported → * or IP list)."""
    raw = (get_settings().trusted_proxies or "").strip()
    if not raw or raw == "*" or "/" in raw:
        return "*"
    return raw
