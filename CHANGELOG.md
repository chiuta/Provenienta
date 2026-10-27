# Jurnal de modificări — Provenienta

## 2.1.0 — 2026-10-27 (anterior: 2.0.1)
- NOU: secțiunea „Verificare strictă (listă de condiții)” în rezultat și în raportul JSON (`strictChecklist`) / Markdown: 8 condiții evaluate local din rezultatele existente (semnătură, legare la fișier, hash-uri de afirmații, lanț până la certificat autosemnat, emitent în lista importată de utilizator, certificat valabil azi, algoritm nu slab, fără avertismente de structură) + notă informativă despre marcajul temporal (prezent/absent; în/în afara valabilității certificatului; nevalidat, nu intră în verdict). Verdictul spune explicit că NU este conformitate C2PA.
- Nu s-a schimbat nicio verificare existentă și nu s-au adăugat reguli noi despre specificația C2PA (nu am putut verifica textul specificației din sandbox).
- Texte noi în toate cele 8 limbi (17 chei); traducerile fr/it/es/pt/hu/de sunt automate, neverificate de vorbitori nativi.
- Teste noi: `tests/strict.test.mjs` (fișiere sintetice: fără listă, cu rădăcină importată, fișier modificat, certificat expirat, raport JSON, fără manifest, engleză). `tests/test.mjs` 27/29 și `tests/trust.mjs` 10/11: singurele eșecuri sunt de mediu (axe-core și fff-kit lipsesc din sandbox).
- Tot nefăcut: testare pe fișiere reale Adobe/Leica/Google Pixel (nu există fișiere în sandbox) și verificarea față de lista oficială C2PA (aplicația nu o include).

## 2.0.1 — 2026-10-27 (anterior: 2.0.0)
Doar texte/documentare; codul de verificare nu s-a schimbat.
- README (EN, RO): secțiune nouă „Starea testării”: ce s-a testat (doar fișiere sintetice scrise de autor), ce NU s-a testat (nicio verificare pe fișiere reale Adobe, Leica, Google Pixel sau alte aparate/servicii; nu se pretinde compatibilitate), ce este planificat (testare pe fișiere reale; colecția publică de la c2pa.org/public-testfiles indicată ca sursă posibilă, conținut de verificat).
- README EN adus la zi: importul opțional al listei proprii de încredere (existent din 2.0.0 în aplicație) era documentat doar în RO; confidențialitatea menționează acum și cheia `fff.provenienta.trust` din `localStorage`.
- „Stare: experimental” și „Offline: complet” în toate cele 8 README.
- Neimplementat: verificarea față de lista oficială C2PA (aplicația nu o include; planificat).
