# piano — version PHP (OVH)

Piano virtuel pédagogique (Web Audio). `index.php` affiche la page, `health.php` renvoie un JSON d'état.

Portage de https://github.com/yann-leschevin/Appli_Musique_Piano (Flask → PHP).

## Arborescence
- `www/` : **seul dossier à envoyer** sur OVH (son contenu va dans `www/projets/piano/` chez OVH).
- `tests/test.sh` : tests locaux (`bash tests/test.sh`, PHP + curl requis). Ne pas envoyer.
- `www/config.php` : nom de l'application (accès web direct bloqué par `.htaccess`).

## Tester en local
```bash
php -S 127.0.0.1:18765 -t www     # puis http://127.0.0.1:18765/
bash tests/test.sh
```
Le serveur intégré de PHP ignore les `.htaccess` : ils ne s'appliqueront que chez OVH.
