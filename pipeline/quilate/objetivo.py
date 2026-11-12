"""Lo que `quilate run` llama para correr un caso contra Zarza: hace la pregunta del caso en «Preguntar» y devuelve lo que
respondió la IA y lo que consultó.

    ZARZA_URL=https://… ZARZA_LLAVE=… QUILATE_KEY=… QUILATE_URL=… python -m quilate run --set preguntar --version 1 --target objetivo:responder

ZARZA_URL es la app contra la que se corre (la vista previa del PR, nunca producción si se puede evitar) y ZARZA_LLAVE
la llave de una cuenta de pruebas. Cada caso es una pregunta real a la IA: cuesta dinero y gasta la lámpara de esa cuenta.
Los casos se escriben en casos.json y se aprueban en Quilate.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

# Lo que la IA puede consultar, como lo anuncia /api/estudiar en sus eventos «paso» (pasoDe en api/_investigar.ts).
PASOS = ("leer", "buscar", "referencias", "comentarios", "original", "teologia", "diccionario", "temas", "personajes", "concordancia", "web")
ESPERA_S = 300


def responder(caso: dict) -> dict:
    pregunta = caso["turns"][-1]["content"]
    pedido = urllib.request.Request(
        os.environ["ZARZA_URL"].rstrip("/") + "/api/estudiar",
        data=json.dumps({"pregunta": {"texto": pregunta, "nivel": "sencillo"}}).encode(),
        headers={"content-type": "application/json", "authorization": "Bearer " + os.environ["ZARZA_LLAVE"]},
        method="POST",
    )
    try:
        with urllib.request.urlopen(pedido, timeout=ESPERA_S) as respuesta:
            lineas = respuesta.read().decode().splitlines()
    except urllib.error.HTTPError as error:
        cuerpo = error.read().decode()
        try:
            motivo = json.loads(cuerpo)["error"]
        except (ValueError, KeyError, TypeError):
            motivo = cuerpo[:300]
        raise RuntimeError(f"Zarza respondió {error.code}: {motivo}") from None

    texto, pasos, termino = "", [], False
    for evento in (json.loads(linea) for linea in lineas if linea.strip()):
        if evento["type"] == "text":
            texto += evento["text"]
        elif evento["type"] == "correccion":
            # Zarza corrige las citas que no cuadran y manda el texto entero otra vez: eso es lo que lee la persona.
            texto = evento["text"]
        elif evento["type"] == "paso":
            pasos.append({"name": evento["tipo"], "args": {"texto": evento["texto"]}})
        elif evento["type"] == "error":
            raise RuntimeError(evento["message"])
        elif evento["type"] == "done":
            termino = True
    if not termino:
        raise RuntimeError("La respuesta de Zarza no terminó: se cortó antes del final.")
    return {"response": texto, "tools": pasos, "effects": []}
