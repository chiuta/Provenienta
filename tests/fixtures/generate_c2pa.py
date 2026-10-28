#!/usr/bin/env python3
"""Generează fixture-uri C2PA SINTETICE cu biblioteca reală c2pa-python (c2pa-rs).
Certificatele sunt generate local cu OpenSSL (CA și semnatar de TEST, auto-create).
Rulare:  python3 -m venv v && v/bin/pip install c2pa-python==0.38.1 pillow==13.0.0
         v/bin/python tests/fixtures/generate_c2pa.py tests/fixtures
Cheile private NU se salvează în depozit (se generează într-un director temporar)."""
import sys, os, json, subprocess, tempfile, struct, hashlib, io
import c2pa
from PIL import Image

out = sys.argv[1] if len(sys.argv) > 1 else 'tests/fixtures'
os.makedirs(out, exist_ok=True)
tmp = tempfile.mkdtemp()
def sh(*a): subprocess.run(a, cwd=tmp, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
open(tmp+'/ca.cnf','w').write("""[req]
distinguished_name=dn
prompt=no
x509_extensions=v3
[dn]
CN=Provenienta SYNTHETIC test root CA
O=Test only - not a real CA
[v3]
basicConstraints=critical,CA:true
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
""")
open(tmp+'/leaf.cnf','w').write("""[req]
distinguished_name=dn
prompt=no
[dn]
CN=Provenienta SYNTHETIC test signer
O=Test only - not a real signer
[v3]
basicConstraints=critical,CA:false
keyUsage=critical,digitalSignature
extendedKeyUsage=emailProtection
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid
""")
sh('openssl','ecparam','-name','prime256v1','-genkey','-noout','-out','ca.key')
sh('openssl','req','-new','-x509','-key','ca.key','-sha256','-days','3650','-config','ca.cnf','-out','ca.pem')
sh('openssl','ecparam','-name','prime256v1','-genkey','-noout','-out','leaf.tmp')
sh('openssl','pkcs8','-topk8','-nocrypt','-in','leaf.tmp','-out','leaf.key')
sh('openssl','req','-new','-key','leaf.key','-config','leaf.cnf','-out','leaf.csr')
sh('openssl','x509','-req','-in','leaf.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-sha256','-days','3650','-extfile','leaf.cnf','-extensions','v3','-out','leaf.pem')
chain = open(tmp+'/leaf.pem').read() + open(tmp+'/ca.pem').read()
key = open(tmp+'/leaf.key').read()
open(out+'/test-root-ca.pem','w').write(open(tmp+'/ca.pem').read())

# imagine de bază deterministă
im = Image.new('RGB', (120, 80))
for x in range(120):
    for y in range(80):
        im.putpixel((x, y), (20 + x, 40 + y * 2, (x * y) % 256))
im.save(tmp+'/base.jpg', quality=75); im.save(tmp+'/base.png')
im.save(out+'/plain.jpg', quality=75); im.save(out+'/plain.png')   # fără C2PA

info = c2pa.C2paSignerInfo(c2pa.C2paSigningAlg.ES256, chain.encode(), key.encode(), None)
def sign(src, mime, dst, manifest=None):
    mj = manifest or {"claim_generator_info": [{"name": "provenienta-fixture-generator", "version": "1.0"}],
        "title": "synthetic", "assertions": [
          {"label": "c2pa.actions", "data": {"actions": [{"action": "c2pa.created",
             "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"}]}},
          {"label": "stds.schema-org.CreativeWork", "data": {"@context": "http://schema.org/", "@type": "CreativeWork",
             "author": [{"@type": "Person", "name": "Autor sintetic de test"}]}}]}
    with c2pa.Signer.from_info(info) as signer, c2pa.Builder(json.dumps(mj)) as b:
        with open(src,'rb') as s, open(dst,'wb+') as d:
            b.sign(signer, mime, s, d)

sign(tmp+'/base.jpg', 'image/jpeg', out+'/signed.jpg')
sign(tmp+'/base.png', 'image/png', out+'/signed.png')
# manifest minim, fără afirmații de conținut în afară de c2pa.actions obligatorii (nu este o variantă „fără afirmații”: biblioteca refuză)
sign(tmp+'/base.jpg', 'image/jpeg', out+'/signed-human.jpg', {"claim_generator_info":[{"name":"provenienta-fixture-generator","version":"1.0"}],"title":"synthetic-human","assertions":[{"label":"c2pa.actions","data":{"actions":[{"action":"c2pa.created","digitalSourceType":"http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture"}]}}]})

# --- variante corupte (derivate din signed.jpg) ---
sj = open(out+'/signed.jpg','rb').read()
# localizare JUMBF/APP11: segmente JPEG marker 0xFFEB
def segs(b):
    i = 2; r = []
    while i < len(b) - 4 and b[i] == 0xFF:
        m = b[i+1]
        if m == 0xDA: break
        L = struct.unpack('>H', b[i+2:i+4])[0]; r.append((i, m, L)); i += 2 + L
    return r
app11 = [s for s in segs(sj) if s[1] == 0xEB]
assert app11, 'nu s-a găsit APP11'
# 1) manifest trunchiat: tăiem primul APP11 la jumătate și actualizăm lungimea segmentului (JPEG rămâne decodabil)
i, m, L = app11[0]
half = L // 2
trunc = sj[:i+2] + struct.pack('>H', half) + sj[i+4:i+2+half] + sj[i+2+L:]
open(out+'/corrupt-truncated-manifest.jpg','wb').write(trunc)
# 2) hash de date modificat: un octet în datele de imagine (după SOS), semnătura rămâne validă
b = bytearray(sj); b[len(b)-20] ^= 1
open(out+'/corrupt-pixel-flip.jpg','wb').write(bytes(b))
# 3) octet modificat în interiorul manifestului (zona JUMBF, aproape de mijloc)
b = bytearray(sj); k = app11[0][0] + 2 + app11[0][2] // 2; b[k] ^= 0x01
open(out+'/corrupt-manifest-byte.jpg','wb').write(bytes(b))
# 4) manifest eliminat complet (toate APP11) => fără C2PA, dar JPEG valid
b = bytearray(); pos = 0
for (i, m, L) in app11:
    b += sj[pos:i]; pos = i + 2 + L
b += sj[pos:]
open(out+'/corrupt-stripped.jpg','wb').write(bytes(b))
# 5) PNG: octet modificat în IDAT (CRC-ul PNG devine invalid; hash-ul de date nu se potrivește)
sp = bytearray(open(out+'/signed.png','rb').read())
k = sp.find(b'IDAT') + 10; sp[k] ^= 1
open(out+'/corrupt-pixel-flip.png','wb').write(bytes(sp))
# 6) afirmație lipsă: redenumim (aceeași lungime) eticheta casetei de afirmație; revendicarea trimite încă la eticheta originală
lab = b'stds.schema-org.CreativeWork'
k = sj.find(lab); assert k > 0
b = bytearray(sj); b[k+len(lab)-1] = ord('x')   # prima apariție = caseta de afirmație
open(out+'/corrupt-assertion-missing.jpg','wb').write(bytes(b))
print('ok', c2pa.sdk_version())
