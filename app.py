"""Application Flask du piano virtuel pédagogique.

Sert la page principale et une route de contrôle de santé.
Lancement : python3 app.py puis ouverture de http://localhost:5002
"""

import os

from flask import Flask, jsonify, render_template

app = Flask(__name__)

APP_NAME = "Piano Virtuel Pédagogique"


@app.route("/")
def index():
    """Affiche la page principale du piano virtuel."""
    return render_template("index.html", app_name=APP_NAME)


@app.route("/health")
def health():
    """Endpoint de contrôle : retourne un JSON indiquant que le service est actif."""
    return jsonify(status="ok", service=APP_NAME, message="Le service fonctionne correctement.")


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "0").lower() in ("1", "true", "yes", "on")
    app.run(host="0.0.0.0", port=5002, debug=debug)