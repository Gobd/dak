#!/usr/bin/env python3
"""Export OpenAPI schema from FastAPI app to stdout."""

import json

from app.main import app

print(json.dumps(app.openapi()))
