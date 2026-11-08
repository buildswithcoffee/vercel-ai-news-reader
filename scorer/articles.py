"""Read untrusted article links without granting access to the daemon's network."""

import asyncio
import ipaddress
import socket

import httpx
import trafilatura

ARTICLE_CHARS = 40_000  # the whole story for nearly every article; caps the rare giant page, and its cost
USER_AGENT = "Mozilla/5.0 (compatible; Signal/1.0)"
MAX_REDIRECTS = 10
# Translation/tunneling can turn an apparently public IPv6 address into a private IPv4
# destination. Do not support these mechanisms for article fetching.
IPV6_TRANSITION_NETWORKS = tuple(
    map(
        ipaddress.ip_network,
        (
            "64:ff9b::/96",
            "64:ff9b:1::/48",
            "2002::/16",
            "2001::/32",
        ),
    )
)


def is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if not ip.is_global or ip.is_multicast or ip.is_unspecified or ip.is_reserved:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        if (
            ip.scope_id
            or ip.ipv4_mapped
            or any(ip in network for network in IPV6_TRANSITION_NETWORKS)
        ):
            return False
    return True


async def pinned_url(url: httpx.URL) -> httpx.URL:
    if url.scheme not in ("http", "https") or not url.host or url.userinfo:
        raise ValueError("article URL must be HTTP(S), with a host and no credentials")
    # Bound resolution as well as the HTTP request. Reject mixed public/private DNS
    # answers, empty results, and non-public literals (including unusual IPv4 syntax).
    addresses = await asyncio.wait_for(
        asyncio.get_running_loop().getaddrinfo(
            url.host,
            url.port or (443 if url.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        ),
        timeout=10,
    )
    if not addresses or not all(is_public(address[4][0]) for address in addresses):
        raise ValueError("article destination is not public")
    # Connect only to this validated numeric address, never re-resolve the hostname.
    return url.copy_with(host=addresses[0][4][0])


async def fetch_article(url: str) -> httpx.Response:
    original = httpx.URL(url)
    async with httpx.AsyncClient(
        timeout=10,
        follow_redirects=False,
        trust_env=False,
        # Different hostnames may share an IP. Never reuse a connection with another
        # hostname's TLS session; also do not route untrusted reads via env proxies.
        limits=httpx.Limits(max_keepalive_connections=0),
    ) as client:
        for hop in range(MAX_REDIRECTS + 1):
            pinned = await pinned_url(original)
            # Construct requests explicitly: a cookie jar keyed by the pinned IP
            # must not forward cookies between unrelated sites sharing that IP.
            request = httpx.Request(
                "GET",
                pinned,
                headers={
                    "host": original.netloc.decode("ascii"),
                    "user-agent": USER_AGENT,
                },
                # HTTPcore uses this name for both SNI and certificate validation;
                # TLS verification stays enabled while TCP connects to the pinned IP.
                extensions={"sni_hostname": original.raw_host.decode("ascii")},
            )
            response = await client.send(request)
            if (
                response.status_code in (301, 302, 303, 307, 308)
                and "location" in response.headers
            ):
                if hop == MAX_REDIRECTS:
                    raise ValueError("too many article redirects")
                # Resolve relative redirects against the real URL, not the pinned IP.
                original = original.join(response.headers["location"])
                continue
            response.raise_for_status()
            return response
    raise ValueError("too many article redirects")


async def read_article(url: str) -> dict | None:
    """Return extracted content only after every destination has passed validation."""
    try:
        response = await fetch_article(url)
    except (httpx.HTTPError, httpx.InvalidURL, OSError, ValueError, TimeoutError):
        return None
    page = trafilatura.bare_extraction(response.text, with_metadata=True)
    if not page or not page.text:
        return None
    return {
        "text": page.text[:ARTICLE_CHARS],
        "image": page.image if (page.image or "").startswith("https://") else None,
        "description": page.description,
        "author": page.author,
    }
