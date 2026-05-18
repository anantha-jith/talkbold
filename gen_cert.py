"""
gen_cert.py — Generate a self-signed SSL certificate for local LAN HTTPS.
Run once: python gen_cert.py
Creates:  backend/certs/cert.pem  and  backend/certs/key.pem
"""
import ipaddress, datetime, os, sys

try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
except ImportError:
    print("Installing cryptography...")
    os.system(f"{sys.executable} -m pip install cryptography")
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

# ── Config ───────────────────────────────────────────────────
LAN_IP   = "172.29.19.130"          # your machine's LAN IP
OUT_DIR  = os.path.join(os.path.dirname(__file__), "backend", "certs")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Generate RSA key ─────────────────────────────────────────
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# ── Build certificate ─────────────────────────────────────────
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME,         LAN_IP),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME,   "Mock Viva Local"),
    x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Dev"),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=825))
    .add_extension(
        x509.SubjectAlternativeName([
            x509.IPAddress(ipaddress.IPv4Address(LAN_IP)),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            x509.DNSName("localhost"),
        ]),
        critical=False,
    )
    .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
    .sign(key, hashes.SHA256())
)

# ── Write files ───────────────────────────────────────────────
cert_path = os.path.join(OUT_DIR, "cert.pem")
key_path  = os.path.join(OUT_DIR, "key.pem")

with open(cert_path, "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

with open(key_path, "wb") as f:
    f.write(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))

print(f"\n✅  Certificate generated!")
print(f"    cert : {cert_path}")
print(f"    key  : {key_path}")
print(f"    valid: {LAN_IP}, 127.0.0.1, localhost  (825 days)\n")
print("Next steps:")
print("  1. Backend  → uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem")
print("  2. Frontend → npm run dev   (already configured for HTTPS)")
print("  3. Browser  → open https://172.29.19.130:5173")
print("  4. Click 'Advanced → Proceed' on the cert warning (once per browser)\n")
