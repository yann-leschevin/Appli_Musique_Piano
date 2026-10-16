# Piano Virtuel Pédagogique

Application web de **piano virtuel** écrite en Python (Flask) côté serveur et en
HTML/CSS/JavaScript natif côté navigateur. Elle fonctionne **100 % localement**,
sans ressource externe, et produit les sons grâce à l'**API Web Audio** du navigateur.

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
├── README.md
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

Dans un terminal, à la racine du projet `Appli_Musique_Piano2` :

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

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