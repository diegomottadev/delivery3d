"""Utilidades HTTP compartidas por los blueprints."""

from flask import request


class InvalidJsonBody(Exception):
    """El cuerpo de la request no es un objeto JSON. Se traduce a 422 en app/__init__.py."""


def json_body() -> dict:
    """Devuelve el cuerpo JSON como dict. Cuerpo vacío o no-JSON -> {}; lista/escalar -> 422."""
    payload = request.get_json(silent=True)
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        raise InvalidJsonBody()
    return payload
