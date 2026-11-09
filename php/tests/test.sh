#!/usr/bin/env bash
# Tests locaux : lance le serveur PHP intégré sur www/ puis vérifie les pages.
# Usage : bash tests/test.sh   (depuis le dossier du projet)
# NB : le serveur intégré de PHP ignore les .htaccess (ils seront actifs chez OVH).
set -u
cd "$(dirname "$0")/.."
WWW="${WWW:-www}"
PORT="${PORT:-18765}"
BASE="http://127.0.0.1:$PORT"
if curl -s --max-time 10 -o /dev/null "$BASE/"; then echo "Port $PORT déjà utilisé : relancer avec PORT=xxxx bash tests/test.sh"; exit 2; fi
php -S 127.0.0.1:$PORT -t "$WWW" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for _ in $(seq 50); do curl -s --max-time 10 -o /dev/null "$BASE/" && break; sleep 0.1; done
OK=0; KO=0
check() { # description, commande
    if eval "$2" >/dev/null 2>&1; then echo "  OK  $1"; OK=$((OK+1)); else echo "  KO  $1"; KO=$((KO+1)); fi
}
code() { curl -s --max-time 10 -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s --max-time 10 "$@"; }
echo "Piano (portage des tests unittest Flask)"
check "index 200"                     '[ "$(code $BASE/)" = 200 ]'
check "index contient le titre"       'body $BASE/ | grep -q "<title>Piano Virtuel Pédagogique</title>"'
check "h1 contient le titre"          'body $BASE/ | grep -q "<h1>Piano Virtuel Pédagogique</h1>"'
check "référence static/css/style.css" 'body $BASE/ | grep -q "static/css/style.css"'
check "référence static/js/piano.js"  'body $BASE/ | grep -q "static/js/piano.js"'
check "CSS servi (app-header)"        'body $BASE/static/css/style.css | grep -q app-header'
check "JS servi (Web Audio)"          'body $BASE/static/js/piano.js | grep -q "Web Audio"'
check "health.php 200"                '[ "$(code $BASE/health.php)" = 200 ]'
check "health.php JSON status=ok"     'body $BASE/health.php | php -r "\$j=json_decode(stream_get_contents(STDIN),true); exit(\$j[\"status\"]===\"ok\" && isset(\$j[\"message\"]) ? 0 : 1);"'
check "JS syntaxiquement valide"      'node --check www/static/js/piano.js'
echo "$OK réussi(s), $KO échec(s)"; [ $KO -eq 0 ]
