# Piano Virtuel Pédagogique

Application web de **piano virtuel** écrite en Python (Flask) côté serveur et en
HTML/CSS/JavaScript natif côté navigateur. Elle fonctionne **100 % localement**,
sans ressource externe, et produit les sons grâce à l'**API Web Audio** du navigateur.

> 🤖 **Application réalisée par une intelligence artificielle.**
> L'intégralité du code (serveur Flask, interface HTML/CSS, moteur audio
> JavaScript, tests) et de la documentation a été générée par
> **Claude Opus 5.5** (modèle d'IA d'**Anthropic**), piloté via **Claude Code**,
> l'assistant de développement en ligne de commande d'Anthropic.
> Le rôle humain (Yann Leschevin) a consisté à formuler le besoin, guider,
> tester et valider le résultat. Voir la section
> [« Réalisation par l'IA »](#réalisation-par-lia).

## Description

Un piano de deux octaves (affichées, décalables de l'octave 2 à l'octave 6)
jouable à la souris, au toucher ou au clavier de l'ordinateur. L'application
affiche le nom des notes (notations internationale et française), leur
fréquence, les notes maintenues, détecte les accords simples, et dessine les
dernières notes jouées sur une **portée musicale SVG** en clé de sol.

## Fonctionnalités

- Piano interactif : touches blanches et noires, noms des notes, polyphonie.
- Saisie à la souris, au toucher (multi-tactile) et au clavier AZERTY/QWERTY.
- Trois timbres : *Piano doux*, *Piano brillant*, *Synthétiseur* (Web Audio).
- Enveloppe sonore anti-clic, relâchement propre, verrou anti-notes bloquées,
  arrêt d'urgence (`Échap` ou bouton « Couper tous les sons »).
- Réglage du volume général, choix de l'octave, affichage des noms masquable.
- Zone pédagogique : dernière note en grand, nom international, nom français,
  octave, fréquence en hertz, notes maintenues, accord détecté.
- Portée musicale SVG : 5 lignes, clé de sol, dièses, lignes supplémentaires,
  regroupement vertical des accords.
- Enregistrement d'une séquence (note, timing, durée, vélocité), relecture et
  effacement, le tout en mémoire dans le navigateur.

## Structure du projet

```
.
├── app.py               Serveur Flask (page principale + /health)
├── requirements.txt     Dépendance : Flask
├── source.sh            Script de lancement (venv + Flask, port 5003)
├── README.md
├── docs/
│   └── ARCHITECTURE.md  Documentation technique détaillée
├── templates/
│   └── index.html       Interface HTML
├── static/
│   ├── css/
│   │   └── style.css    Thème sombre responsive
│   └── js/
│       └── piano.js     Moteur Web Audio, piano, portée, enregistrement
└── tests/
    └── test_app.py      Tests avec unittest + client de test Flask
```

## Prérequis

- Python 3.10 ou plus récent.
- `pip` (pour installer Flask).
- Flask n'est **pas** installé automatiquement : suivez les étapes ci-dessous.
- Les sons utilisent l'API Web Audio : servez la page en HTTP avec Flask
  (cette application) pour que le navigateur autorise l'audio.

## Installation manuelle (WSL / Linux)

Dans un terminal, à la racine du projet `Appli_Musique_Piano` :

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

## Lancement rapide (script `source.sh`)

Le script crée/répare l'environnement virtuel, installe Flask si besoin et
lance le serveur sur le port **5003** :

```bash
bash source.sh
```

Puis ouvrez `http://localhost:5003`.

## Lancement sous WSL

Depuis le dossier du projet, avec l'environnement virtuel activé :

```bash
python3 app.py
```

Le serveur écoute sur `0.0.0.0`, port `5002`. Ouvrez ensuite dans le
navigateur Windows :

```
http://localhost:5002
```

Le débogage Flask est désactivé par défaut. Pour l'activer :
`FLASK_DEBUG=1 python3 app.py`.

## Contrôles du clavier (AZERTY et QWERTY)

Le mapping suit l'ordre des **touches physiques**, identique sur les deux
dispositions. Il est affiché dans l'application (bouton « Aide — touches du clavier »).

| Note            | Octave inférieure | Octave supérieure |
|-----------------|-------------------|-------------------|
| Do (C)          | `A`               | `Q`               |
| Do♯ (C♯)        | `Z`               | `S`               |
| Ré (D)          | `E`               | `D`               |
| Ré♯ (D♯)        | `R`               | `F`               |
| Mi (E)          | `T`               | `G`               |
| Fa (F)          | `Y`               | `H`               |
| Fa♯ (F♯)        | `U`               | `J`               |
| Sol (G)         | `I`               | `K`               |
| Sol♯ (G♯)       | `O`               | `L`               |
| La (A)          | `P`               | `M`               |
| La♯ (A♯)        | `^`               | `ù`               |
| Si (B)          | `$`               | `*`               |

Raccourcis supplémentaires :

- `+` / `-` : monter / descendre d'octave.
- `V` : afficher ou masquer les noms des notes.
- `Échap` : couper tous les sons immédiatement (arrêt d'urgence).

Maintenir une touche appuyée ne redéclenche pas la note (répétition désactivée).

## Tests

Dans un terminal, à la racine du projet :

```bash
python3 -m py_compile app.py tests/test_app.py
python3 -m unittest discover -s tests -v
```

Les tests vérifient que `/` répond 200 et référence les styles et scripts,
que la page contient le titre de l'application, et que `/health` répond 200
avec un JSON « service en fonctionnement ».

> Si Flask n'est pas installé, les tests Flask ne peuvent pas s'exécuter.
> Installez d'abord les dépendances (voir « Installation manuelle »).

## Solutions aux problèmes courants

- **Flask introuvable (`ModuleNotFoundError`)** : activez l'environnement
  virtuel puis exécutez `python3 -m pip install -r requirements.txt`.
- **Aucun son** : cliquez une fois dans la page avant de jouer (les navigateurs
  exigent une interaction utilisateur pour démarrer l'audio). Vérifiez le
  volume et cliquetez sur « Couper tous les sons » pour un redémarrage propre.
- **La page ne charge pas / connexion refusée** : vérifiez que `python3 app.py`
  tourne bien et que l'URL `http://localhost:5002` est utilisée (pas `https`).
- **Port déjà utilisé** : fermez l'instance précédente ou changez le port dans
  `app.py`.
- **Aucun son sous WSL2** : les sons sont émis par le navigateur Windows via
  Web Audio ; ils ne dépendent pas de la sortie audio de WSL.
- **L'audio reste « en attente »** : c'est normal tant que l'utilisateur n'a
  pas interagi avec la page (restriction des navigateurs).

## Sécurité

- Aucune donnée utilisateur n'est injectée dans le HTML sans échappement.
- Pas d'utilisation de `eval`.
- Débogage Flask désactivé par défaut.
- L'application est autonome et peut fonctionner **hors ligne**.

## Technologies utilisées

| Domaine            | Technologie                                                        |
|--------------------|--------------------------------------------------------------------|
| Langage serveur    | **Python 3.10+**                                                   |
| Framework web      | **Flask 3** (routage, moteur de templates **Jinja2**, JSON)        |
| Interface          | **HTML5** sémantique, **CSS3** (variables, Flexbox/Grid, responsive) |
| Logique client     | **JavaScript** natif (ES5 strict, sans framework ni bundler)       |
| Synthèse sonore    | **Web Audio API** (oscillateurs, filtres biquad, enveloppes ADSR, compresseur) |
| Saisie             | **Pointer Events** (souris + multi-tactile), **KeyboardEvent.code** |
| Notation musicale  | **SVG** généré dynamiquement (portée, clé de sol, notes)           |
| Tests              | **unittest** (bibliothèque standard) + client de test Flask        |
| Environnement      | **WSL2 / Linux**, `venv`, `pip`, script **Bash**                   |
| Gestion de version | **Git** / **GitHub**                                               |

Aucune bibliothèque JavaScript externe, aucun CDN : l'application fonctionne hors ligne.

Pour le détail du fonctionnement interne (moteur audio, détection d'accords,
portée SVG, enregistrement), voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Réalisation par l'IA

Ce projet est une démonstration de développement logiciel assisté par
intelligence artificielle : **le code et la documentation ont été écrits par
une IA**, et non à la main.

| IA / outil        | Éditeur    | Rôle dans le projet                                                       |
|-------------------|------------|---------------------------------------------------------------------------|
| **Claude Opus 5.5** (`claude-opus-5-5`) | Anthropic | Modèle d'IA ayant conçu l'architecture et écrit tout le code (Python, HTML, CSS, JavaScript), les tests, le script de lancement et cette documentation. |
| **Claude Code**   | Anthropic  | Agent de développement en ligne de commande utilisé pour piloter Claude : lecture/écriture des fichiers, exécution des tests, commits Git et publication sur GitHub. |

Rôle de l'humain (**Yann Leschevin**) : expression du besoin (piano virtuel
pédagogique, local, sans dépendance externe), orientation, tests dans le
navigateur et validation.

Les commits produits par l'IA portent la mention
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

> Comme pour tout code généré par IA, une relecture humaine reste recommandée
> avant toute réutilisation dans un autre contexte.

