---
type: llm
focus: trace
weight: 1
---

Las rutas leen el cuerpo con json_body() (app/http.py), no con request.get_json/request.json
