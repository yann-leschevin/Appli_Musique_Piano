"""Tests Flask de l'application Piano Virtuel Pédagogique.

Utilise unittest (bibliothèque standard) et le client de test Flask.
"""

import unittest

from app import app


class PianoAppTestCase(unittest.TestCase):
    """Tests de base du serveur Flask."""

    def setUp(self):
        self.app = app.test_client()

    def test_index_returns_200(self):
        response = self.app.get("/")
        self.assertEqual(response.status_code, 200)

    def test_index_contains_title(self):
        response = self.app.get("/")
        self.assertIn("Piano Virtuel Pédagogique".encode(), response.data)

    def test_index_references_static_files(self):
        response = self.app.get("/")
        body = response.get_data(as_text=True)
        self.assertIn("/static/css/style.css", body)
        self.assertIn("/static/js/piano.js", body)

    def test_static_files_served(self):
        css = self.app.get("/static/css/style.css")
        self.assertEqual(css.status_code, 200)
        self.assertIn(b"app-header", css.data)
        js = self.app.get("/static/js/piano.js")
        self.assertEqual(js.status_code, 200)
        self.assertIn(b"Web Audio", js.data)

    def test_health_returns_200(self):
        response = self.app.get("/health")
        self.assertEqual(response.status_code, 200)

    def test_health_returns_json_ok(self):
        response = self.app.get("/health")
        payload = response.get_json()
        self.assertIsInstance(payload, dict)
        self.assertEqual(payload.get("status"), "ok")
        self.assertIn("message", payload)


if __name__ == "__main__":
    unittest.main()