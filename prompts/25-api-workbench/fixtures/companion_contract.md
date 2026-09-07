# Companion HTTP laboratory

Actual local service, not a request mock. Base origin is selected from SERVICE_PORT at runtime.

| Route | Required behavior |
|---|---|
| GET /health | Ready response |
| GET or POST /echo | Echo method, query, headers, received body |
| GET /delay?ms=3000&label=A | Wait then respond with A |
| GET /status/503 | Real HTTP 503 and JSON body |
| GET /items?cursor=0 | IDs item-1/item-2; next_cursor=2 |
| GET /items?cursor=2 | IDs item-3/item-4; next_cursor=4 |
| GET /items?cursor=4 | ID item-5; next_cursor=null |
| GET /stream?count=5&interval_ms=150 | Five incremental JSON SSE events plus completion |

Provide a durable request log, visible in the app or via a documented read endpoint. Invalid cursor, count, interval, or delay values must receive validation responses. All waits/stream lengths are bounded.
