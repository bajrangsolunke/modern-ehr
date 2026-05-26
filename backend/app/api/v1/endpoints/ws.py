from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import settings
from app.websockets.manager import ws_manager

router = APIRouter(tags=["ws"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        await websocket.close(code=4401)
        return
    if not user_id:
        await websocket.close(code=4401)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"echo": data})
    except WebSocketDisconnect:
        await ws_manager.disconnect(user_id, websocket)
