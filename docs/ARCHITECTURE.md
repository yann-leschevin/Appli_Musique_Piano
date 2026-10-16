# Documentation technique — Piano Virtuel Pédagogique

> Ce document, comme l'ensemble du code, a été rédigé par l'IA
> **Claude Opus 5.5** (Anthropic) via l'outil **Claude Code**, à partir d'un
> cahier des charges rédigé avec l'aide de **ChatGPT** (OpenAI).

## 1. Vue d'ensemble

```
┌──────────────── Navigateur ────────────────┐        ┌──── Serveur (WSL/Linux) ────┐
│ index.html  ← rendu Jinja2                 │  HTTP  │ app.py (Flask)              │
│ style.css   thème sombre responsive        │ ◄────► │  GET /        → index.html  │
│ piano.js    audio, clavier, portée, enreg. │        │  GET /health  → JSON         │
│   └─ Web Audio API → haut-parleurs         │        │  /static/*    → CSS, JS      │
└────────────────────────────────────────────┘        └─────────────────────────────┘
```

Le serveur est volontairement minimal : il ne fait que livrer la page et les
fichiers statiques. **Toute la logique musicale s'exécute dans le navigateur**,
ce qui garantit une latence minimale à l'appui d'une touche et un
fonctionnement hors ligne.

## 2. Serveur — `app.py`

| Route     | Méthode | Réponse                                                                 |
|-----------|---------|-------------------------------------------------------------------------|
| `/`       | GET     | Page HTML rendue par Jinja2 (`templates/index.html`, variable `app_name`) |
| `/health` | GET     | `{"status": "ok", "service": "...", "message": "..."}`                  |

- Écoute sur `0.0.0.0:5002` (accessible depuis Windows quand il tourne sous WSL).
- `FLASK_DEBUG=1` active le mode débogage (désactivé par défaut).
- `source.sh` lance l'application via `flask run` sur le port **5003**,
  après avoir vérifié / recréé le `venv` et installé Flask si nécessaire.

## 3. Client — `static/js/piano.js`

Le script est encapsulé dans une IIFE en mode strict (aucune variable globale
exposée). Un objet `app` centralise l'état : contexte audio, voix actives,
touches enfoncées, octave courante, événements de la portée et enregistrement.

### 3.1 Conversion des notes

- Numérotation **MIDI** (La4 = 69).
- Fréquence : `f = 440 × 2^((midi − 69) / 12)` (tempérament égal).
- Noms en notation internationale (C, D…) et française (Do, Ré…).
- Position diatonique calculée pour placer la note sur la portée.

### 3.2 Moteur audio (Web Audio API)

Chaîne de signal :

```
Oscillateurs (×3) → Gain par oscillateur → Filtre passe-bas (Biquad)
  → Enveloppe (Gain ADSR) → Gain maître (volume²) → Compresseur → Sortie
```

- Le `AudioContext` est créé paresseusement au premier geste de
  l'utilisateur (contrainte des navigateurs).
- **Trois timbres**, obtenus par mélange d'oscillateurs et de filtres :

| Timbre          | Oscillateurs                                  | Filtre                         | Attaque / Sustain |
|-----------------|-----------------------------------------------|--------------------------------|-------------------|
| Piano doux      | sinus f, triangle 2f, sinus ≈3f               | passe-bas 2400 Hz              | 7 ms / 0,20       |
| Piano brillant  | dent de scie f, triangle 2f, sinus 3f         | passe-bas 6500 Hz              | 4 ms / 0,14       |
| Synthétiseur    | 2 dents de scie légèrement désaccordées + carré f/2 | balayage 700 → 3200 Hz, Q = 6 | 20 ms / 0,72      |

- Enveloppes à rampes exponentielles (anti-clic) et relâchement propre.
- Sécurités : polyphonie limitée à **32 voix** (la plus ancienne est coupée),
  arrêt automatique d'une voix au bout de 9 s (anti-note bloquée),
  fonction `panic()` (touche `Échap`) qui coupe tout immédiatement.
- Volume appliqué au carré pour une courbe perçue plus naturelle ;
  le compresseur évite la saturation lors des accords.

### 3.3 Saisie

- **Pointer Events** : souris, stylet et multi-tactile (un doigt = une note,
  suivi par `pointerId`) ; la vélocité dépend de la pression du pointeur
  quand le périphérique la fournit (stylet, écran tactile), sinon elle vaut 1.
- **Clavier** : mapping par `KeyboardEvent.code` (touches physiques), donc
  identique en AZERTY et QWERTY ; l'auto-répétition est ignorée.

### 3.4 Pédagogie : détection d'accords

`detectChord()` réduit les notes maintenues à leurs classes de hauteur
(modulo 12), puis compare les intervalles à partir de la fondamentale à une
table : majeur, mineur, diminué, augmenté, sus2, sus4, et accords de septième.
Avec deux notes, l'intervalle est nommé (tierce, quinte…).

### 3.5 Portée musicale SVG

- Portée à 5 lignes avec clé de sol, générée en SVG.
- Les 16 dernières notes sont affichées ; les notes jouées à moins de
  60 ms d'écart sont regroupées verticalement en accord.
- Gestion des dièses et des lignes supplémentaires.

### 3.6 Enregistrement

- Chaque note est stockée en mémoire : `{midi, vel, start, dur}`
  (temps relatifs en secondes, durée bornée entre 0,05 et 8 s).
- Relecture planifiée par `setTimeout`, annulable ; rien n'est envoyé au serveur.

## 4. Interface — `templates/index.html` et `static/css/style.css`

- Structure HTML sémantique avec attributs d'accessibilité (ARIA).
- Thème sombre défini par variables CSS, mise en page responsive.
- Panneau d'aide listant le mapping clavier.

## 5. Tests — `tests/test_app.py`

Tests `unittest` avec le client de test Flask :

- `/` répond 200, contient le titre et référence `style.css` et `piano.js` ;
- `/health` répond 200 avec un JSON indiquant un service actif.

```bash
python3 -m unittest discover -s tests -v
```

## 6. Pistes d'évolution

- Échantillons de piano réels (SoundFont) en complément de la synthèse.
- Export de l'enregistrement au format MIDI.
- Prise en charge des claviers MIDI physiques (Web MIDI API).
- Exercices de reconnaissance de notes et d'accords.
- Tests automatisés côté JavaScript.
