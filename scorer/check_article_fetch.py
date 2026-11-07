"""Offline security regression: python scorer/check_article_fetch.py.

Exercises HTTPX/HTTPcore's real HTTP/1.1 and TLS setup with a fake TCP peer.
No embedding model, database, credentials, or external network are required.
"""

import asyncio
import socket
import ssl
from unittest.mock import AsyncMock, patch

import httpcore

import articles


def answer(*ips):
    return [
        (
            socket.AF_INET6 if ":" in ip else socket.AF_INET,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
            "",
            (ip, 443),
        )
        for ip in ips
    ]


class Peer(httpcore.AsyncNetworkStream):
    def __init__(self, status=200, headers="", body="public article"):
        self.response = (
            f"HTTP/1.1 {status} Test\r\nContent-Length: {len(body.encode())}\r\n{headers}\r\n{body}"
        ).encode()
        self.sent = b""
        self.tls = []
        self.closed = False

    async def read(self, max_bytes, timeout=None):
        data, self.response = self.response[:max_bytes], self.response[max_bytes:]
        return data

    async def write(self, buffer, timeout=None):
        self.sent += buffer

    async def aclose(self):
        self.closed = True

    async def start_tls(self, ssl_context, server_hostname=None, timeout=None):
        assert ssl_context.check_hostname
        assert ssl_context.verify_mode == ssl.CERT_REQUIRED
        self.tls.append(server_hostname)
        return self

    def get_extra_info(self, info):
        return None


async def main():
    loop = asyncio.get_running_loop()
    blocked = [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "0.0.0.0",
        "100.64.0.1",
        "192.0.0.8",
        "192.0.2.1",
        "224.0.0.1",
        "240.0.0.1",
        "::",
        "::1",
        "fc00::1",
        "fe80::1",
        "ff02::1",
        "::ffff:127.0.0.1",
        "64:ff9b::7f00:1",
        "64:ff9b:1::a00:1",
        "2002:7f00:1::",
        "2001::1",
    ]
    for ip in blocked:
        assert not articles.is_public(ip), ip
    assert articles.is_public("93.184.216.34")
    assert articles.is_public("2606:4700:4700::1111")

    # A second DNS answer is private: only the checked numeric IP may reach TCP.
    peer = Peer()
    dns = AsyncMock(side_effect=[answer("93.184.216.34"), answer("127.0.0.1")])
    connect = AsyncMock(return_value=peer)
    with (
        patch.object(loop, "getaddrinfo", dns),
        patch.object(httpcore.AnyIOBackend, "connect_tcp", connect),
    ):
        response = await articles.fetch_article("https://news.example:8443/story")
    assert response.text == "public article"
    assert dns.await_count == 1
    assert connect.call_args.args[0] == "93.184.216.34"
    assert connect.call_args.args[1] == 8443
    assert b"host: news.example:8443\r\n" in peer.sent.lower()
    assert peer.tls == ["news.example"] and peer.closed

    # Validate every redirect, including relative ones; never share IP-keyed cookies.
    peers = [
        Peer(302, "Location: /next\r\nSet-Cookie: secret=one\r\n"),
        Peer(307, "Location: https://other.example/final\r\n"),
        Peer(),
    ]
    connect = AsyncMock(side_effect=peers)
    with (
        patch.object(
            loop, "getaddrinfo", AsyncMock(return_value=answer("93.184.216.34"))
        ) as dns,
        patch.object(httpcore.AnyIOBackend, "connect_tcp", connect),
        patch.dict("os.environ", {"HTTPS_PROXY": "http://127.0.0.1:9999"}),
    ):
        await articles.fetch_article("https://news.example/start")
    assert dns.await_count == 3
    assert [call.args[0] for call in dns.call_args_list] == [
        "news.example",
        "news.example",
        "other.example",
    ]
    assert b"GET /next HTTP/1.1" in peers[1].sent
    assert b"host: other.example" in peers[2].sent.lower()
    assert peers[2].tls == ["other.example"]
    assert all(b"cookie:" not in peer.sent.lower() for peer in peers)
    assert all(peer.closed for peer in peers)
    assert all(call.args[0] == "93.184.216.34" for call in connect.call_args_list)

    # Fail closed before extraction/persistence can see any blocked response.
    for answers in [answer(ip) for ip in blocked] + [
        [],
        answer("93.184.216.34", "10.0.0.1"),
    ]:
        with (
            patch.object(loop, "getaddrinfo", AsyncMock(return_value=answers)),
            patch.object(httpcore.AnyIOBackend, "connect_tcp", AsyncMock()) as connect,
            patch.object(articles.trafilatura, "bare_extraction") as extract,
        ):
            assert await articles.read_article("http://attacker.example") is None
            connect.assert_not_called()
            extract.assert_not_called()

    for target in [
        "http://127.0.0.1/private",
        "http://169.254.169.254/metadata",
        "https://rebind.example",
        "ftp://news.example/a",
        "http://user:pass@news.example",
    ]:
        with (
            patch.object(
                loop,
                "getaddrinfo",
                AsyncMock(side_effect=[answer("93.184.216.34"), answer("127.0.0.1")]),
            ),
            patch.object(
                httpcore.AnyIOBackend,
                "connect_tcp",
                AsyncMock(return_value=Peer(302, f"Location: {target}\r\n")),
            ) as connect,
            patch.object(articles.trafilatura, "bare_extraction") as extract,
        ):
            assert await articles.read_article("https://news.example") is None
            assert connect.await_count == 1
            extract.assert_not_called()

    for url in [
        "file:///etc/passwd",
        "ftp://news.example/a",
        "http://user:pass@news.example",
        "http://",
        "http://[broken",
    ]:
        with patch.object(httpcore.AnyIOBackend, "connect_tcp", AsyncMock()) as connect:
            assert await articles.read_article(url) is None
            connect.assert_not_called()

    # The system resolver interprets historical numeric IPv4 notations too.
    # These are numeric-only local resolutions; no external DNS or TCP is used.
    for host in [
        "127.1",
        "2130706433",
        "0177.0.0.1",
        "0x7f000001",
        "[::ffff:127.0.0.1]",
    ]:
        with patch.object(httpcore.AnyIOBackend, "connect_tcp", AsyncMock()) as connect:
            assert await articles.read_article(f"http://{host}/private") is None
            connect.assert_not_called()

    # A TLS/network failure must never reach extraction either.
    with (
        patch.object(
            loop, "getaddrinfo", AsyncMock(return_value=answer("93.184.216.34"))
        ),
        patch.object(
            httpcore.AnyIOBackend,
            "connect_tcp",
            AsyncMock(side_effect=httpcore.ConnectError("TLS verification failed")),
        ),
        patch.object(articles.trafilatura, "bare_extraction") as extract,
    ):
        assert await articles.read_article("https://news.example") is None
        extract.assert_not_called()

    for error in [socket.gaierror("not found"), TimeoutError()]:
        with patch.object(loop, "getaddrinfo", AsyncMock(side_effect=error)):
            assert await articles.read_article("http://news.example") is None

    with (
        patch.object(
            loop, "getaddrinfo", AsyncMock(return_value=answer("93.184.216.34"))
        ),
        patch.object(
            httpcore.AnyIOBackend,
            "connect_tcp",
            AsyncMock(side_effect=lambda *args, **kw: Peer(302, "Location: /loop\r\n")),
        ) as connect,
    ):
        assert await articles.read_article("https://news.example") is None
        assert connect.await_count == articles.MAX_REDIRECTS + 1

    # Public IPv6 and real HTML extraction still work through the pinned transport.
    html = (
        "<html><head><title>Public news</title></head><body><article>"
        + (
            "<p>This public article explains recent advances in artificial intelligence and technology.</p>"
            * 30
        )
        + "</article></body></html>"
    )
    with (
        patch.object(
            loop, "getaddrinfo", AsyncMock(return_value=answer("2606:4700:4700::1111"))
        ),
        patch.object(
            httpcore.AnyIOBackend,
            "connect_tcp",
            AsyncMock(return_value=Peer(body=html)),
        ) as connect,
    ):
        page = await articles.read_article("https://news.example/story")
    assert page and "artificial intelligence" in page["text"]
    assert len(page["text"]) <= articles.ARTICLE_CHARS
    assert connect.call_args.args[0] == "2606:4700:4700::1111"
    print(
        "PASS: non-public addresses, redirects, DNS rebinding, TLS identity, cookies, proxies, failures, and public extraction"
    )


if __name__ == "__main__":
    asyncio.run(main())
