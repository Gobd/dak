#!/usr/bin/env python3
"""
Home Relay Service - Entry Point
Run with: python relay.py
Or: uvicorn app.main:app --host 0.0.0.0 --port 5111
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5111,
        reload=True,
        log_level="info",
        access_log=True,
    )
