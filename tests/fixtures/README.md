# Fixture-uri C2PA (SINTETICE)

Toate fișierele din acest director sunt **sintetice**, create la 2026-10-28 cu o unealtă reală, **dar nu provin de la aparate foto, de la Adobe, Leica, Google Pixel, Microsoft sau de la vreun alt furnizor/emitent real**, și nu au fost validate de terți. Certificatele sunt de TEST, generate local cu OpenSSL 3.0.13 (CA rădăcină + semnatar, ECDSA P-256, `emailProtection`); cheile private nu sunt păstrate în depozit.

## Cum au fost generate
- Unealtă: **c2pa-python 0.38.1** (leagă c2pa-rs 0.91.3), Pillow 13.0.0, Python 3.13.
- Comandă exactă:
  ```
  python3 -m venv v && v/bin/pip install c2pa-python==0.38.1 pillow==13.0.0
  v/bin/python tests/fixtures/generate_c2pa.py tests/fixtures
  ```
  (`generate_c2pa.py` creează certificatele, imaginea de bază 120x80 și semnează cu `Builder.sign`). Regenerarea produce alte semnături/certificate (nedeterminist); testele nu depind de octeți anume.
- Variantele corupte sunt derivate din `signed.jpg` / `signed.png` prin modificări de octeți descrise mai jos (nu s-a construit niciun manifest de mână).

## Fișiere
| Fișier | Conținut | Verificare independentă cu c2pa-rs (Reader) |
|---|---|---|
| `signed.jpg`, `signed.png` | manifest valid, `c2pa.created` cu `trainedAlgorithmicMedia`, `stds.schema-org.CreativeWork` | `Valid`, doar `signingCredential.untrusted` |
| `signed-human.jpg` | `digitalCapture` (fără AI) | `Valid` + `untrusted` |
| `plain.jpg`, `plain.png` | fără C2PA | `ManifestNotFound` |
| `corrupt-pixel-flip.jpg/.png` | un octet modificat în datele imaginii | `Invalid`: `assertion.dataHash.mismatch` |
| `corrupt-manifest-byte.jpg` | un octet modificat în interiorul manifestului (miniatură) | `Invalid`: `assertion.hashedURI.mismatch` |
| `corrupt-assertion-missing.jpg` | eticheta casetei de afirmație schimbată (revendicarea trimite la eticheta veche) | eroare `AssertionNotFound` |
| `corrupt-truncated-manifest.jpg` | segmentul APP11 tăiat la jumătate (JPEG rămâne decodabil) | eroare `invalid embedded file box` |
| `corrupt-stripped.jpg` | toate segmentele APP11 eliminate | `ManifestNotFound` |
| `test-root-ca.pem` | rădăcina de TEST (doar cheia publică) pentru testul listei de încredere | - |

Testul: `node tests/real-c2pa.test.mjs` (PW_ROOT, CHROMIUM_PATH ca la celelalte teste).

## Limite
- Doar JPEG și PNG; WebP/MP4/etc. nu au fost generate (c2pa-python le-ar putea semna, dar nu au fost adăugate).
- Un singur algoritm (ES256) și un singur lanț; fără ștampilă de timp (TSA), fără ingrediente/manifeste multiple, fără COSE `x5chain` neobișnuite.
- Nu s-a testat cu fișiere reale de la aparate/servicii; rezultatul „conform” nu este o certificare.
