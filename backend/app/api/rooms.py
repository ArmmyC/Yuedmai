from __future__ import annotations

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.models.room import (
    JoinRoomRequest,
    RoomCommandRequest,
    RoomEvent,
    RoomResponse,
    RoutineListResponse,
    SelectRoutineRequest,
)
from app.services.room_service import (
    RoomConflictError,
    RoomExpiredError,
    RoomNotFoundError,
    RoomServiceError,
    RoomValidationError,
    room_service,
)

router = APIRouter(tags=["rooms"])


@router.post("/api/rooms", response_model=RoomResponse)
async def create_room() -> RoomResponse:
    try:
        return room_service.create_room()
    except RoomServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/rooms/routines", response_model=RoutineListResponse)
def list_routines() -> RoutineListResponse:
    return RoutineListResponse(routines=room_service.list_routines())


@router.get("/api/rooms/{room_code}", response_model=RoomResponse)
def get_room(room_code: str) -> RoomResponse:
    try:
        return room_service.get_room(room_code)
    except RoomServiceError as exc:
        raise _room_http_exception(exc) from exc


@router.post("/api/rooms/{room_code}/join", response_model=RoomResponse)
async def join_room(room_code: str, payload: JoinRoomRequest) -> RoomResponse:
    try:
        room = room_service.join_room(room_code, payload.mode)
    except RoomServiceError as exc:
        raise _room_http_exception(exc) from exc

    await room_service.broadcast_room(room.code)
    return room


@router.post("/api/rooms/{room_code}/routine", response_model=RoomResponse)
async def select_routine(room_code: str, payload: SelectRoutineRequest) -> RoomResponse:
    try:
        room = room_service.select_routine(room_code, payload.routine_id)
    except RoomServiceError as exc:
        raise _room_http_exception(exc) from exc

    await room_service.broadcast_room(room.code)
    return room


@router.post("/api/rooms/{room_code}/commands", response_model=RoomResponse)
async def send_room_command(room_code: str, payload: RoomCommandRequest) -> RoomResponse:
    try:
        room = room_service.send_command(room_code, payload.type)
    except RoomServiceError as exc:
        raise _room_http_exception(exc) from exc

    await room_service.broadcast_room(room.code)
    return room


@router.websocket("/ws/rooms/{room_code}/display")
async def display_room_socket(websocket: WebSocket, room_code: str) -> None:
    await _room_socket(websocket, room_code, role="display")


@router.websocket("/ws/rooms/{room_code}/controller")
async def controller_room_socket(websocket: WebSocket, room_code: str) -> None:
    await _room_socket(websocket, room_code, role="controller")


def _room_http_exception(exc: RoomServiceError) -> HTTPException:
    if isinstance(exc, RoomValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, RoomNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, RoomConflictError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, RoomExpiredError):
        return HTTPException(status_code=410, detail=str(exc))
    return HTTPException(status_code=500, detail="Room service error")


async def _room_socket(websocket: WebSocket, room_code: str, *, role: str) -> None:
    accepted = False
    try:
        await room_service.connect(room_code, role, websocket)
        accepted = True
        while True:
            await websocket.receive_text()
    except (RoomValidationError, RoomNotFoundError, RoomConflictError, RoomExpiredError) as exc:
        if not accepted:
            await websocket.accept()
            accepted = True
        payload = RoomEvent(type="ROOM_ERROR", message=str(exc))
        await websocket.send_json(payload.model_dump(mode="json"))
        await websocket.close(code=1008)
    except WebSocketDisconnect:
        return
    finally:
        if accepted:
            normalized_code = room_code.strip().upper()
            room_reset = await room_service.disconnect(normalized_code, role, websocket)
            if room_reset:
                await room_service.broadcast_room(normalized_code)
