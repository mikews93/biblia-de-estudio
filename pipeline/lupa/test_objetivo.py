"""Pruebas de objetivo.py con un Zarza de mentira: `python3 -m unittest discover -s pipeline/lupa`."""
import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import objetivo


class ZarzaDeMentira(BaseHTTPRequestHandler):
    eventos: list = []
    estado = 200
    pedidos: list = []

    def do_POST(self):  # noqa: N802
        cuerpo = json.loads(self.rfile.read(int(self.headers["content-length"])))
        type(self).pedidos.append({"ruta": self.path, "llave": self.headers.get("authorization"), "cuerpo": cuerpo})
        self.send_response(type(self).estado)
        self.end_headers()
        if type(self).estado == 200:
            self.wfile.write("".join(json.dumps(evento) + "\n" for evento in type(self).eventos).encode())
        else:
            self.wfile.write(json.dumps({"error": "Hoy ya gastaste tu lámpara."}).encode())

    def log_message(self, *_):
        pass


class Objetivo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.servidor = HTTPServer(("127.0.0.1", 0), ZarzaDeMentira)
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()
        os.environ["ZARZA_URL"] = f"http://127.0.0.1:{cls.servidor.server_port}/"
        os.environ["ZARZA_LLAVE"] = "llave-de-prueba"

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()

    def setUp(self):
        ZarzaDeMentira.estado = 200
        ZarzaDeMentira.pedidos.clear()

    def test_pregunta_y_devuelve_respuesta_y_pasos(self):
        ZarzaDeMentira.eventos = [
            {"type": "paso", "tipo": "leer", "texto": "Filipenses 4:4-9"},
            {"type": "paso", "tipo": "comentarios", "texto": "Filipenses 4:6"},
            {"type": "text", "text": "## En corto\nNo se afanen"},
            {"type": "source", "n": 1, "label": "Filipenses 4:6", "ref": "php.4.6"},
            {"type": "text", "text": ".⟦1⟧"},
            {"type": "done"},
        ]
        visto = objetivo.responder({"turns": [{"role": "user", "content": "¿Qué dice la Biblia de la ansiedad?"}]})
        self.assertEqual(visto["response"], "## En corto\nNo se afanen.⟦1⟧")
        self.assertEqual(visto["tools"], [{"name": "leer", "args": {"texto": "Filipenses 4:4-9"}}, {"name": "comentarios", "args": {"texto": "Filipenses 4:6"}}])
        self.assertEqual(ZarzaDeMentira.pedidos, [{
            "ruta": "/api/estudiar", "llave": "Bearer llave-de-prueba",
            "cuerpo": {"pregunta": {"texto": "¿Qué dice la Biblia de la ansiedad?", "nivel": "sencillo"}},
        }])

    def test_la_correccion_de_citas_sustituye_el_texto(self):
        ZarzaDeMentira.eventos = [{"type": "text", "text": "Juan 3:61"}, {"type": "correccion", "text": "Juan 3:16"}, {"type": "done"}]
        self.assertEqual(objetivo.responder({"turns": [{"role": "user", "content": "¿Dónde dice que Dios amó al mundo?"}]})["response"], "Juan 3:16")

    def test_un_error_de_zarza_falla_en_voz_alta(self):
        ZarzaDeMentira.eventos = [{"type": "error", "message": "No se pudo generar el estudio. Inténtalo de nuevo."}]
        with self.assertRaisesRegex(RuntimeError, "No se pudo generar el estudio"):
            objetivo.responder({"turns": [{"role": "user", "content": "¿Quién fue Melquisedec?"}]})
        ZarzaDeMentira.estado = 429
        with self.assertRaisesRegex(RuntimeError, "429.*lámpara"):
            objetivo.responder({"turns": [{"role": "user", "content": "¿Quién fue Melquisedec?"}]})

    def test_una_respuesta_cortada_sin_done_tambien_falla(self):
        ZarzaDeMentira.eventos = [{"type": "text", "text": "A medias"}]
        with self.assertRaisesRegex(RuntimeError, "no terminó"):
            objetivo.responder({"turns": [{"role": "user", "content": "¿Quién fue Melquisedec?"}]})

    def test_los_primeros_casos_son_preguntas_de_un_turno_que_esperan_algo(self):
        casos = json.loads((Path(__file__).parent / "casos.json").read_text(encoding="utf-8"))["casos"]
        self.assertGreaterEqual(len(casos), 8)
        self.assertEqual(len({caso["title"] for caso in casos}), len(casos))
        for caso in casos:
            self.assertEqual((caso["form"], caso["origin"], len(caso["turns"]), caso["turns"][0]["role"]), ("single", "written", 1, "user"), caso["title"])
            self.assertIn(caso["kind"], ("normal", "edge", "attack"))
            self.assertTrue(6 <= len(caso["turns"][0]["content"]) <= 300, caso["title"])
            self.assertTrue(caso["expected"].get("response") or caso["expected"].get("tools"), caso["title"])
            for herramienta in caso["expected"].get("tools", []):
                self.assertIn(herramienta["name"], objetivo.PASOS, caso["title"])


if __name__ == "__main__":
    unittest.main()
