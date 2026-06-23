# Feature Spec: Two-Screen QR Controller

## 1. Goal

Build the first YUEDMAI Next two-screen experience.

The big screen, laptop, kiosk, or shared display starts on a QR code waiting screen. A user scans the QR code with their phone, opens the YUEDMAI webapp, chooses either Continue without login or Log in, selects a stretch quest, and uses the phone as a remote controller for the big display.

This feature turns YUEDMAI Next from a single-browser prototype into a clear product experience:

```text
Display screen = public camera, QR code, calibration, live stretch feedback, rewards
Phone webapp = private controller, guest/login choice, routine selection, start/pause/next controls
```

The primary value is to make the app feel like an interactive stretching booth or guided daily quest instead of a normal fitness website.

## 2. Non-goals

Do not build the following in this task:

- Real user authentication.
- Account creation.
- Password login.
- OAuth login.
- Database persistence.
- Real MediaPipe or MoveNet pose inference.
- Production push notifications.
- Payment, subscriptions, or premium features.
- Leaderboards.
- Admin dashboard.
- Multi-user rooms.
- Hardware, Arduino, Nano BLE, serial, or wearable integrations.
- Final visual branding, mascot, or production illustration set.
- Deployment configuration.
- Full offline mode.

The Log in option must appear in the UI, but it must be treated as a placeholder in this feature. Users must be able to continue as guest.

## 3. Assumptions

- The repository is `ArmmyC/Yuedmai`.
- The backend is FastAPI under `backend/`.
- The frontend is a Vite app under `frontend/`.
- The existing frontend is plain JavaScript, HTML, and CSS, not React.
- This feature should continue using the existing mock pose and session services.
- The display and phone are usually on the same network during local development.
- The display page and phone page are served from the same frontend origin during development.
- Room state can be stored in memory for this task.
- Room state may be lost when the backend restarts.
- Guest mode is the only working mode for this task.
- The QR code may be generated in the frontend using a small npm dependency if needed.
- Room codes should be short, human-readable, and temporary.
- The implementation should be safe for teen users and should not score body shape, body size, or extreme flexibility.

## 4. User stories

- As a walk-up user, I want to scan a QR code on the display, so that I can start without typing a long URL.
- As a guest user, I want to continue without logging in, so that I can try the stretch quest quickly.
- As a returning user, I want to see a Log in option, so that I know saved progress can exist later.
- As a phone user, I want to choose a stretch quest on my phone, so that the public display stays clean and focused.
- As a phone user, I want to start, pause, resume, skip, and advance a session from my phone, so that I do not need to touch the display device.
- As a display viewer, I want the big screen to update when the phone connects, so that I know the session is paired.
- As a display viewer, I want clear calibration and session states, so that I know what to do next.
- As a guest user, I want to see a result screen, so that I feel rewarded even without an account.
- As a developer, I want room state and events to be testable, so that future auth, persistence, and pose inference can be added safely.

## 5. UX / UI requirements

### Screens and routes

Implement these frontend routes using the existing Vite app. If the app does not use a router, implement lightweight path-based rendering with `window.location.pathname`.

```text
/display
/display/:roomCode
/join/:roomCode
/controller/:roomCode
```

`/` may redirect or render a simple landing choice with links to `/display` for this task.

### Display screen: idle QR state

Purpose: wait for a phone controller.

Required elements:

- YUEDMAI logo or text title.
- Short tagline: `Stretch better. Play daily.`
- Generated QR code that links to `/join/:roomCode`.
- Human-readable room code, for example `K8P4`.
- Loading indicator while room is being created.
- Expiration text, for example `This code refreshes after 10 minutes.`
- Fallback text link or URL for development.
- Connection status label.

States:

- Loading room.
- Waiting for phone.
- Phone connected.
- Room expired.
- Backend unavailable.

Idle display wireframe:

```text
+------------------------------------------------+
|                    YUEDMAI                     |
|             Stretch better. Play daily.         |
|                                                |
|                +----------------+              |
|                |                |              |
|                |    QR CODE     |              |
|                |                |              |
|                +----------------+              |
|                                                |
|              Scan to start your quest           |
|                    Code: K8P4                  |
|                                                |
|             Waiting for your phone...           |
+------------------------------------------------+
```

### Display screen: connected state

When a phone joins the room, the display must show:

- `Phone connected` status.
- Controller mode, for example `Guest`.
- Selected routine if one is selected.
- Prompt to choose or start from phone.

Example:

```text
Phone connected
Guest controller ready
Choose your quest on your phone
```

### Display screen: calibration state

This is a mock calibration state for this task. It does not need real pose inference.

Required elements:

- Title: `Camera Check`.
- Camera preview area using the existing browser camera logic if available.
- Friendly guidance messages:
  - `Stand where the camera can see you.`
  - `Center your shoulders in the frame.`
  - `Make sure the area is well lit.`
- Status chips:
  - Person visible.
  - Centered.
  - Lighting okay.
- Button text on phone controls the transition, not the display.

The display must not make comments about body shape, weight, attractiveness, or flexibility.

### Display screen: active session state

Required elements:

- Current stretch number, for example `Stretch 1 of 4`.
- Current stretch name.
- Timer or mock timer.
- Score.
- Stars.
- XP.
- Feedback message.
- Camera preview area.
- Next action hint, for example `Control from your phone`.

Active display wireframe:

```text
+------------------------------------------------+
| Stretch 1/4                  XP 40      **-    |
|                                                |
| +---------------------------+ +--------------+ |
| |                           | | Shoulder     | |
| |       Camera preview      | | Opener       | |
| |       pose area           | |              | |
| +---------------------------+ | Timer 00:25  | |
|                               +--------------+ |
| Feedback: Hold steady. You are doing great.    |
+------------------------------------------------+
```

Use star characters or accessible text. Do not rely on color alone.

### Display screen: paused state

Required elements:

- Paused label.
- Current stretch name remains visible.
- Message: `Paused from phone.`
- No score increase while paused.

### Display screen: rest state

Required elements:

- `Rest` title.
- Next stretch preview.
- Short countdown or static message.
- Prompt: `Tap Next on your phone when ready.`

### Display screen: result state

Required elements:

- `Quest Complete` title.
- Total XP earned.
- Total stars.
- Completed routine name.
- Guest save prompt: `Create an account later to keep XP and streaks.`
- Button hint: `Start another quest from your phone.`

No account creation must be implemented in this task.

### Phone screen: join and auth choice

Route: `/join/:roomCode`.

Required elements:

- YUEDMAI title.
- Room code confirmation.
- Room status loading state.
- Primary button: `Continue without login`.
- Secondary button: `Log in`.
- Guest explanation:
  - `Play now.`
  - `Your result is temporary.`
- Login explanation:
  - `Save XP, streaks, and badges later.`
- If the user taps Log in, show a non-blocking message: `Login is coming soon. Continue as guest for this version.`
- Continue without login must join the room and navigate to `/controller/:roomCode`.

### Phone screen: routine selection

Route: `/controller/:roomCode`.

Required elements:

- Connection status.
- Room code.
- Guest mode label.
- Routine card list.
- At least one routine: `Quick Reset`.
- Routine details:
  - Duration: `3 minutes`.
  - Stretches: `Neck reset`, `Shoulder opener`, `Standing side bend`, `Hamstring reach`.
- Select routine button.
- Start calibration button after routine selection.

For this task, `Quick Reset` may be the only selectable routine.

### Phone screen: controller active state

Required controls:

- Start Calibration.
- Start Quest.
- Pause.
- Resume.
- Next Stretch.
- Skip Stretch.
- End Session.
- Start Another Quest from result state.

Controls must be disabled when not applicable.

Example:

```text
Connected to YUEDMAI screen
Quick Reset
Stretch 2 of 4: Shoulder Opener

[ Pause ]
[ Next Stretch ]
[ End Session ]
```

### Desktop behavior

Desktop display mode must prioritize large, readable layout:

- QR code should be visually prominent.
- Minimum QR display size should be 220px by 220px.
- Main text should be readable from a few meters away.
- Use high contrast.
- Avoid dense paragraphs.
- Display screen should look good at 1366x768 and 1920x1080.
- If opened on desktop at `/join/:roomCode`, render the mobile join UI centered in a narrow card.

### Mobile behavior

Phone controller must be thumb-friendly:

- Primary buttons should be at least 44px tall.
- Cards should fit within a single-column layout.
- Do not require horizontal scrolling.
- Keep the most important control near the bottom when session is active.
- Text must remain readable at 360px width.
- Button disabled states must be clear.

### Loading states

Required loading states:

- Display creating room.
- Display connecting WebSocket.
- Phone fetching room.
- Phone joining room.
- Controller sending command.
- QR generation pending.

Loading text must be specific, for example `Creating room...`, not only a spinner.

### Empty states

Required empty states:

- No room found: show `This room does not exist or has expired.`
- No routine selected: show routine selection prompt.
- No controller connected: display QR and waiting prompt.
- No active session: controller shows Start Calibration or Start Quest depending on state.

### Error states

Required error states:

- Backend unavailable.
- Room expired.
- Invalid room code.
- Display WebSocket disconnected.
- Controller WebSocket disconnected.
- Command rejected because the room is in the wrong state.
- Camera permission denied on display.

Errors must explain what the user can do next, for example `Refresh the display to create a new code.`

### Success states

Required success states:

- Room created.
- Phone connected.
- Guest mode joined.
- Routine selected.
- Calibration started.
- Session started.
- Session paused.
- Session resumed.
- Stretch advanced.
- Quest completed.

### Accessibility requirements

- All interactive elements must be keyboard reachable.
- Buttons must have visible focus states.
- Use semantic `button` elements for actions.
- QR code must have accessible fallback text with the join URL or room code.
- Use `aria-live="polite"` for connection status and major session state changes.
- Do not communicate state by color alone.
- Text contrast should be readable on the selected background.
- Motion or animations must not be required to understand the UI.
- Camera preview must have a visible label.

## 6. Functional requirements

FR-1: The display route `/display` creates a new temporary room by calling the backend.

FR-2: Each created room has a unique 4-character room code using uppercase letters and digits, excluding confusing characters where practical.

FR-3: The display shows a QR code whose payload is the absolute URL for `/join/:roomCode`.

FR-4: The display shows the room code as text below the QR code.

FR-5: The display connects to a room display WebSocket after room creation.

FR-6: The phone route `/join/:roomCode` validates the room with the backend before showing the guest/login choice.

FR-7: The phone join page shows Continue without login as the primary action.

FR-8: The phone join page shows a Log in action, but selecting it does not start real authentication and instead shows a coming soon message.

FR-9: Selecting Continue without login joins the room as a guest controller.

FR-10: After successful guest join, the phone navigates to `/controller/:roomCode`.

FR-11: When the phone joins, the display updates from waiting state to connected state without manual refresh.

FR-12: The controller page shows the room code, connection status, and guest mode.

FR-13: The controller page shows the `Quick Reset` routine.

FR-14: The user can select the `Quick Reset` routine from the controller.

FR-15: When a routine is selected on the phone, the display updates to show the selected routine.

FR-16: The phone can send Start Calibration.

FR-17: When Start Calibration is sent, the display enters calibration state.

FR-18: The phone can send Start Quest after a routine is selected.

FR-19: When Start Quest is sent, the backend creates or starts a mock stretch session using the existing session engine where practical.

FR-20: When the session starts, the display enters active session state.

FR-21: The active display shows current stretch name, current stretch index, score, XP, stars, timer or elapsed time, and feedback.

FR-22: The phone can send Pause only while a session is active.

FR-23: When Pause is sent, the display enters paused state and active controls update.

FR-24: The phone can send Resume only while a session is paused.

FR-25: When Resume is sent, the display returns to active state.

FR-26: The phone can send Next Stretch while a session is active, paused, or rest state.

FR-27: Next Stretch advances the existing session through the existing session engine where practical.

FR-28: The phone can send Skip Stretch while a session is active, paused, or rest state.

FR-29: Skip Stretch advances to the next stretch and records that the previous stretch was skipped in room state.

FR-30: When the final stretch is advanced or skipped, the display enters result state.

FR-31: The result state shows total XP, total stars, routine name, and guest save prompt.

FR-32: The phone result state shows Start Another Quest and End Session actions.

FR-33: End Session resets the controller to a finished state and the display to a completed or new QR-ready state according to implementation choice.

FR-34: Start Another Quest resets the room to routine selection without creating a new room.

FR-35: Room codes expire after a configurable TTL, default 10 minutes when no session has started.

FR-36: Expired rooms reject join, command, and WebSocket actions with clear errors.

FR-37: Invalid room codes return a 404 HTTP response from REST endpoints and a close/error behavior from WebSockets.

FR-38: Duplicate commands from rapid repeated button taps must not corrupt room state.

FR-39: The UI disables controls while command requests are pending.

FR-40: If the display WebSocket disconnects, the display shows a reconnection or refresh message.

FR-41: If the controller WebSocket disconnects, the phone shows a reconnection or refresh message.

FR-42: Existing `/ws/pose-stream` behavior must not be broken.

FR-43: Existing `/api/sessions` behavior must not be broken.

FR-44: The implementation must not require login, database, hardware, or real pose inference.

FR-45: The implementation must not score or comment on body shape, body size, attractiveness, or extreme flexibility.

## 7. Technical requirements

### Architecture

Add a lightweight room system to the existing FastAPI backend and Vite frontend.

Backend responsibilities:

- Create rooms.
- Store in-memory room state.
- Validate room codes.
- Track room lifecycle.
- Accept controller joins.
- Accept controller commands.
- Broadcast room state to display and controller clients.
- Integrate with the existing session engine for mock session progress where practical.

Frontend responsibilities:

- Render display route.
- Generate QR code for join URL.
- Render phone join route.
- Render phone controller route.
- Manage WebSocket connection state.
- Send controller commands.
- Render room state updates.
- Preserve existing camera and pose prototype behavior where practical.

### Data flow

Expected happy path:

```text
Display opens /display
→ frontend POST /api/rooms
→ backend creates room K8P4
→ display renders QR for /join/K8P4
→ display connects WS /ws/rooms/K8P4/display
→ phone opens /join/K8P4
→ phone GET /api/rooms/K8P4
→ phone POST /api/rooms/K8P4/join with mode guest
→ backend marks controller connected
→ backend broadcasts ROOM_UPDATED
→ display shows phone connected
→ phone navigates /controller/K8P4
→ phone connects WS /ws/rooms/K8P4/controller
→ phone selects Quick Reset
→ backend updates room routine and broadcasts
→ phone sends START_CALIBRATION
→ backend updates room status and broadcasts
→ phone sends START_SESSION
→ backend creates mock session and broadcasts
→ phone sends PAUSE, RESUME, NEXT_STRETCH, SKIP_STRETCH, END_SESSION
→ backend updates state and broadcasts
→ display renders result at completion
```

### State management

Backend room state is the source of truth.

Frontend state should be derived from:

- REST responses for initial load.
- WebSocket events for live updates.
- Local pending state for button loading.
- Local error state for failed actions.

Do not make the display and phone independently calculate session state if the backend already provides it.

### Backend room states

Use explicit room statuses:

```text
waiting
connected
routine_selected
calibrating
active
paused
rest
complete
expired
ended
```

Rules:

- New room starts as `waiting`.
- Guest join moves `waiting` to `connected`.
- Routine selection moves `connected` to `routine_selected`.
- Start Calibration moves `routine_selected` or `connected` to `calibrating` only if a routine exists.
- Start Quest moves `routine_selected` or `calibrating` to `active`.
- Pause moves `active` to `paused`.
- Resume moves `paused` to `active`.
- Next Stretch advances current session. If complete, move to `complete`; otherwise stay `active` or optionally enter `rest` if existing session logic supports it.
- Skip Stretch behaves like Next Stretch but records skipped segment codes in room state.
- End Session moves to `ended`.
- Expiry moves to `expired`.

### APIs or server actions

Add a backend room API module, likely `backend/app/api/rooms.py`, and include it in `backend/app/main.py`.

Add a backend room service, likely `backend/app/services/room_service.py`.

Add Pydantic request/response models either in the API module or in `backend/app/models/room.py`.

### Database changes

No database changes are required for this feature.

All room state must be in memory for this task.

### Validation rules

- `room_code` must match `^[A-Z0-9]{4,8}$`.
- Generated codes should be 4 characters by default.
- Controller mode currently supports only `guest`.
- Unsupported controller mode returns 400.
- Unknown routine ID returns 400.
- Commands not valid for the current room status return 409.
- Commands for missing or expired rooms return 404 or 410.
- WebSocket connections for invalid rooms must be rejected or closed with an error event.

### Authentication and authorization

No real auth is required.

Guest mode is allowed without authentication.

The Log in button is UI-only and must show a coming soon message.

Room control authorization for this task is lightweight:

- A room may have one active controller.
- Once a guest controller joins, another join attempt should either be rejected with 409 or replace the controller only if explicitly designed. For this feature, reject duplicates with 409.
- Do not expose secrets in the room code.
- Do not include personal data in room state.

### Security concerns

- Do not store camera frames in this feature.
- Do not send camera frames through the new room endpoints.
- Do not log personal data.
- Do not add real auth tokens.
- Do not hardcode production URLs.
- Validate room codes before using them.
- Escape or safely render all user-visible data.
- Avoid leaking stack traces to clients.
- Room codes are not strong authentication. Treat them only as temporary pairing codes.

### Performance concerns

- Room service should avoid unbounded memory growth.
- Expired rooms should be cleaned up opportunistically on create, read, join, and command operations.
- WebSocket broadcasts should be small JSON payloads.
- Frontend QR generation should happen only when room data changes.
- Avoid high-frequency timers that trigger excessive DOM updates.

### Logging and error handling requirements

Backend:

- Log room creation at info level if logging exists.
- Log invalid command attempts at warning level if logging exists.
- Do not log join URLs with private query tokens because no tokens should exist yet.
- Return structured JSON errors for REST endpoints.

Frontend:

- Show friendly error messages.
- Log detailed errors to console for development.
- Disable controls while commands are pending.
- Recover gracefully from failed WebSocket connection by showing a refresh message.

## 8. Files likely involved

- `backend/app/main.py`: include the new rooms router.
- `backend/app/api/rooms.py`: new REST and WebSocket room endpoints.
- `backend/app/services/room_service.py`: new in-memory room lifecycle and command service.
- `backend/app/models/room.py`: room state, command, and response models if models are kept separate.
- `backend/app/services/session_engine.py`: possible small integration with room commands, but avoid broad rewrites.
- `backend/app/models/domain.py`: possible reuse of existing session models, but avoid unrelated changes.
- `frontend/package.json`: add a QR generation dependency only if needed.
- `frontend/index.html`: may need root shell updates for route rendering.
- `frontend/src/main.js`: route-based app bootstrap may need refactoring.
- `frontend/src/api.js`: add room REST and WebSocket client functions.
- `frontend/src/camera.js`: reuse display camera preview where appropriate.
- `frontend/src/styles.css`: add display, QR, join, controller, state, and responsive styles.
- `frontend/src/rooms.js`: recommended new module for room state and commands.
- `frontend/src/routes/display.js`: optional route module for display UI.
- `frontend/src/routes/join.js`: optional route module for phone join UI.
- `frontend/src/routes/controller.js`: optional route module for phone controller UI.
- `frontend/public/manifest.json`: no change expected unless app name or route scope requires it.
- `docs/specs/two-screen-qr-controller.md`: this specification.
- `AGENTS.md`: repo-wide Codex instructions, if missing.

Do not modify unrelated legacy, Arduino, or hardware files.

## 9. Data model

No database changes are required.

Use an in-memory backend data model for this feature.

### In-memory model: Room

Recommended fields:

```python
class RoomStatus(str, Enum):
    waiting = "waiting"
    connected = "connected"
    routine_selected = "routine_selected"
    calibrating = "calibrating"
    active = "active"
    paused = "paused"
    rest = "rest"
    complete = "complete"
    expired = "expired"
    ended = "ended"
```

```python
class Room:
    code: str
    status: RoomStatus
    controller_mode: str | None
    selected_routine_id: str | None
    session_id: str | None
    skipped_segments: list[str]
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
```

### In-memory model: RoutineSummary

```python
class RoutineSummary:
    id: str
    name: str
    duration_seconds: int
    stretches: list[str]
    description: str
```

For this task, include one routine:

```json
{
  "id": "quick-reset",
  "name": "Quick Reset",
  "duration_seconds": 180,
  "stretches": [
    "Neck reset",
    "Shoulder opener",
    "Standing side bend",
    "Hamstring reach"
  ],
  "description": "A short stretch quest for study or desk breaks."
}
```

### Relationships

- One room may have one selected routine.
- One room may have one active mock stretch session.
- One room may have one active controller.
- A room does not belong to a persisted user in this task.

### Indexes

No database indexes are required.

The in-memory room map should be keyed by `room.code`.

### Migration requirements

No migration is required.

### Default values

- `status`: `waiting`.
- `controller_mode`: `null`.
- `selected_routine_id`: `null`.
- `session_id`: `null`.
- `skipped_segments`: empty list.
- `expires_at`: created time plus 10 minutes by default.

### Constraints

- `code` must be unique among active rooms.
- `code` must be uppercase alphanumeric.
- `selected_routine_id` must be one of the supported routines.
- `controller_mode` must be `guest` or `null` for this task.

## 10. API contract

### Create Room

- Method: `POST`
- Path: `/api/rooms`
- Auth required: No
- Request body:

```json
{}
```

- Response body:

```json
{
  "code": "K8P4",
  "status": "waiting",
  "join_path": "/join/K8P4",
  "display_path": "/display/K8P4",
  "expires_at": "2026-06-24T12:00:00Z",
  "selected_routine": null,
  "session": null,
  "controller_mode": null,
  "skipped_segments": []
}
```

- Error cases:
  - 500 if a unique room code cannot be generated after reasonable retries.
- Validation rules:
  - No client input required.

### Get Room

- Method: `GET`
- Path: `/api/rooms/{room_code}`
- Auth required: No
- Request body: None
- Response body:

```json
{
  "code": "K8P4",
  "status": "connected",
  "join_path": "/join/K8P4",
  "display_path": "/display/K8P4",
  "expires_at": "2026-06-24T12:00:00Z",
  "selected_routine": null,
  "session": null,
  "controller_mode": "guest",
  "skipped_segments": []
}
```

- Error cases:
  - 404 if room does not exist.
  - 410 if room expired.
- Validation rules:
  - `room_code` must match uppercase alphanumeric format.

### Join Room

- Method: `POST`
- Path: `/api/rooms/{room_code}/join`
- Auth required: No
- Request body:

```json
{
  "mode": "guest"
}
```

- Response body:

```json
{
  "code": "K8P4",
  "status": "connected",
  "controller_mode": "guest",
  "selected_routine": null,
  "session": null,
  "skipped_segments": []
}
```

- Error cases:
  - 400 if mode is unsupported.
  - 404 if room does not exist.
  - 409 if a controller is already connected.
  - 410 if room expired.
- Validation rules:
  - `mode` must be `guest` for this task.

### List Routines

- Method: `GET`
- Path: `/api/rooms/routines`
- Auth required: No
- Request body: None
- Response body:

```json
{
  "routines": [
    {
      "id": "quick-reset",
      "name": "Quick Reset",
      "duration_seconds": 180,
      "stretches": ["Neck reset", "Shoulder opener", "Standing side bend", "Hamstring reach"],
      "description": "A short stretch quest for study or desk breaks."
    }
  ]
}
```

- Error cases:
  - None expected.
- Validation rules:
  - None.

### Select Routine

- Method: `POST`
- Path: `/api/rooms/{room_code}/routine`
- Auth required: No
- Request body:

```json
{
  "routine_id": "quick-reset"
}
```

- Response body:

```json
{
  "code": "K8P4",
  "status": "routine_selected",
  "selected_routine": {
    "id": "quick-reset",
    "name": "Quick Reset",
    "duration_seconds": 180,
    "stretches": ["Neck reset", "Shoulder opener", "Standing side bend", "Hamstring reach"],
    "description": "A short stretch quest for study or desk breaks."
  },
  "session": null,
  "controller_mode": "guest",
  "skipped_segments": []
}
```

- Error cases:
  - 400 if routine ID is invalid.
  - 404 if room does not exist.
  - 409 if no controller is connected.
  - 410 if room expired.
- Validation rules:
  - `routine_id` must be supported.

### Send Room Command

- Method: `POST`
- Path: `/api/rooms/{room_code}/commands`
- Auth required: No
- Request body:

```json
{
  "type": "START_SESSION"
}
```

Supported command types:

```text
START_CALIBRATION
START_SESSION
PAUSE_SESSION
RESUME_SESSION
NEXT_STRETCH
SKIP_STRETCH
END_SESSION
START_ANOTHER_QUEST
```

- Response body:

```json
{
  "code": "K8P4",
  "status": "active",
  "selected_routine": {
    "id": "quick-reset",
    "name": "Quick Reset",
    "duration_seconds": 180,
    "stretches": ["Neck reset", "Shoulder opener", "Standing side bend", "Hamstring reach"],
    "description": "A short stretch quest for study or desk breaks."
  },
  "session": {
    "id": "session-id",
    "state": "active",
    "current_index": 0,
    "segments": [],
    "total_score": 0,
    "xp_earned": 0
  },
  "controller_mode": "guest",
  "skipped_segments": []
}
```

- Error cases:
  - 400 if command type is unknown.
  - 404 if room does not exist.
  - 409 if command is invalid for current status.
  - 410 if room expired.
- Validation rules:
  - `type` must be one of the supported command strings.
  - START_SESSION requires selected routine.
  - PAUSE_SESSION requires active status.
  - RESUME_SESSION requires paused status.
  - NEXT_STRETCH and SKIP_STRETCH require a session.

### Display Room WebSocket

- Method: WebSocket
- Path: `/ws/rooms/{room_code}/display`
- Auth required: No
- Request body: WebSocket messages are optional for display.
- Response body:

Server sends initial state after connection:

```json
{
  "type": "ROOM_STATE",
  "room": {
    "code": "K8P4",
    "status": "waiting"
  }
}
```

Server sends updates:

```json
{
  "type": "ROOM_UPDATED",
  "room": {
    "code": "K8P4",
    "status": "active"
  }
}
```

- Error cases:
  - Close connection or send error event if room is missing or expired.
- Validation rules:
  - `room_code` must be valid format.

### Controller Room WebSocket

- Method: WebSocket
- Path: `/ws/rooms/{room_code}/controller`
- Auth required: No
- Request body: WebSocket messages are optional if commands use REST.
- Response body:

Server sends initial state after connection and updates after room changes.

```json
{
  "type": "ROOM_UPDATED",
  "room": {
    "code": "K8P4",
    "status": "routine_selected"
  }
}
```

- Error cases:
  - Close connection or send error event if room is missing or expired.
- Validation rules:
  - `room_code` must be valid format.

## 11. Edge cases

- User opens `/join/abcd` in lowercase. The app should normalize to uppercase or show invalid room clearly.
- User scans an expired QR code. The phone should show `This room has expired. Refresh the display for a new code.`
- User opens controller route without joining. The app should fetch room state and either allow guest join or redirect to `/join/:roomCode`.
- Two phones scan the same QR. The first guest join succeeds. The second gets a clear already connected error.
- User double taps Continue without login. Only one join should succeed and UI should not navigate twice.
- User double taps Start Quest. Only one session should be created.
- User taps Next Stretch rapidly. Commands must be serialized or rejected while pending.
- Backend restarts while display is waiting. Display should show disconnected or room missing and suggest refresh.
- Backend restarts while phone controller is active. Phone should show room unavailable and suggest returning to display.
- Display WebSocket connects before controller joins. It must receive initial waiting state.
- Controller WebSocket connects after routine selection. It must receive current state, not only future updates.
- Phone loses network. Display remains in last known state and may show controller disconnected if implemented.
- Display loses network. Phone should show command failure.
- Camera permission is denied on display. The display should still show session state and a friendly camera error.
- QR dependency fails to render. Show room code and join URL fallback.
- User opens `/display/:roomCode` directly for an expired room. Show expired state and a way to create a new display room.
- Unsupported command reaches backend. Return 400 and do not change room state.
- Command valid in general but invalid for current state. Return 409 and do not change room state.
- Existing session endpoints continue to work while room endpoints are added.

## 12. Testing plan

### Unit tests

Backend unit tests should cover the room service.

- Test FR-1 and FR-2: creating a room returns unique uppercase room code.
- Test FR-35 and FR-36: expired rooms reject join and commands.
- Test FR-9 and FR-11: guest join moves room from waiting to connected.
- Test FR-14 and FR-15: selecting `quick-reset` moves room to routine_selected.
- Test FR-16 and FR-17: START_CALIBRATION moves room to calibrating.
- Test FR-18 and FR-20: START_SESSION creates session and moves room to active.
- Test FR-22 and FR-23: PAUSE_SESSION only works from active.
- Test FR-24 and FR-25: RESUME_SESSION only works from paused.
- Test FR-26 through FR-30: NEXT_STRETCH and SKIP_STRETCH advance and eventually complete.
- Test FR-38: duplicate or invalid repeated commands do not corrupt state.
- Test FR-37: invalid room code format is rejected.
- Test FR-44 and FR-45: no hardware, auth, body-shape scoring, or real pose dependency is required.

If no backend test framework exists, add the smallest reasonable pytest setup. Do not add unrelated testing infrastructure.

### Integration tests

Backend API integration tests should use FastAPI TestClient if available.

- POST `/api/rooms` returns room payload.
- GET `/api/rooms/{room_code}` returns room payload.
- POST `/api/rooms/{room_code}/join` accepts guest.
- Duplicate join returns 409.
- GET `/api/rooms/routines` returns Quick Reset.
- POST `/api/rooms/{room_code}/routine` selects Quick Reset.
- POST `/api/rooms/{room_code}/commands` handles all valid command types.
- Invalid command returns 400.
- Wrong-state command returns 409.
- Existing `/api/sessions` endpoints still respond as before.
- Existing `/ws/pose-stream` remains available.

### UI or component tests

If the frontend has no test runner, do not add a large framework only for this feature unless necessary. Prefer testable pure functions for route parsing and room API helpers.

Recommended tests if a frontend test runner is added or exists:

- Route parser recognizes `/display`, `/display/:roomCode`, `/join/:roomCode`, and `/controller/:roomCode`.
- Join page renders guest and login options.
- Login click shows coming soon message.
- Controller disables invalid actions by state.
- QR fallback text is present.

### End-to-end tests

If an E2E tool already exists, add this flow:

```text
Open /display
Wait for QR and room code
Open /join/:roomCode in second page context
Continue as guest
Select Quick Reset
Start Calibration
Start Quest
Pause
Resume
Next Stretch until complete
Verify result screen on display and phone
```

If no E2E tool exists, do not add one just for this task.

### Manual QA checklist

- Start backend on port 8000.
- Start frontend on port 5173.
- Open `http://localhost:5173/display` on laptop.
- Confirm QR code appears.
- Confirm room code appears.
- Open join URL manually on phone or another browser tab.
- Confirm guest/login choice appears.
- Click Log in and verify coming soon message.
- Click Continue without login.
- Confirm display updates to connected state.
- Select Quick Reset on controller.
- Confirm display shows selected routine.
- Start Calibration.
- Confirm display shows Camera Check.
- Start Quest.
- Confirm display shows active stretch state.
- Pause and resume.
- Confirm display state changes correctly.
- Next or skip through all stretches.
- Confirm result screen appears.
- Confirm Start Another Quest resets state.
- Try a fake room code and confirm friendly error.
- Stop backend and confirm frontend shows useful error.
- Confirm mobile layout at 360px width.
- Confirm desktop layout at 1366x768.
- Confirm keyboard focus can reach all buttons.

## 13. Definition of done

The task is complete only when:

- All functional requirements are implemented.
- All relevant tests are added or updated.
- Tests pass.
- Lint passes if lint is available.
- Typecheck passes if typecheck is available.
- Existing behavior is not broken.
- Existing `/api/sessions` endpoints still work.
- Existing `/ws/pose-stream` still works.
- The display can create a room and show a QR code.
- The phone can join a room as guest.
- The phone can select Quick Reset.
- The phone can control calibration, start, pause, resume, next, skip, end, and start another quest.
- Display and controller stay synchronized through backend room state.
- Invalid, expired, duplicate, and wrong-state actions show safe errors.
- The implementation follows existing project patterns.
- The implementation matches this spec.
- No unrelated files are changed.
- No real auth, database, hardware, or real pose inference is added.
- Any remaining risks are documented in the final implementation summary.

## 14. Codex implementation instructions

Read `AGENTS.md` first if it exists.

Implement this spec exactly.

Inspect the repository structure before editing.

Follow existing project patterns.

Do not change unrelated files.

Do not introduce new dependencies unless necessary.

A QR generation dependency is acceptable if the existing project has no QR implementation. Prefer a small frontend dependency such as `qrcode` for generating the display QR code. If adding it, explain why in the final summary.

Add or update tests for changed backend behavior.

If no test framework exists, add only the smallest reasonable backend test setup needed to validate the room service and room API.

Do not add a large frontend framework.

Keep the frontend as plain JavaScript unless the repository has already moved to a framework.

Run the relevant tests.

Run lint and typecheck if available.

If lint or typecheck scripts do not exist, state that they are unavailable.

Summarize changed files and tradeoffs when finished.

Do not implement real authentication.

Do not implement database persistence.

Do not implement real pose inference.

Do not add hardware support.

Do not put feature-specific rules into `AGENTS.md`.

## 15. AGENTS.md recommendation

This repository should include an `AGENTS.md` file because it is now intended to be worked on by Codex across multiple backend, frontend, and documentation tasks.

No `AGENTS.md` exists at the time this spec was written.

Recommended draft:

```md
# AGENTS.md

## Project overview

YUEDMAI Next is a camera-first, web/PWA-first stretching companion. The product direction is a server-hosted FastAPI backend with a Vite frontend. The main experience should reward consistency, completion, safe camera visibility, and daily practice. Do not design features that score body shape, body size, attractiveness, or extreme flexibility.

## Repository layout

- `backend/`: FastAPI app, API routes, services, models, and backend tests.
- `frontend/`: Vite frontend app, browser camera UI, PWA shell, and frontend assets.
- `docs/`: architecture notes, migration notes, and feature specs.
- `docs/specs/`: implementation specs that Codex should follow for feature work.

## Tech stack

Backend:

- Python
- FastAPI
- Uvicorn
- Pydantic

Frontend:

- Vite
- Plain JavaScript modules
- HTML
- CSS

Do not migrate the frontend to a framework unless a feature spec explicitly requires it.

## Package manager

Use `pip` for backend Python dependencies.

Use `npm` for frontend dependencies.

On Windows PowerShell, `npm.cmd` may be needed if script execution is blocked.

## Install commands

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

## Development commands

Backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

## Test commands

If backend tests exist:

```bash
cd backend
pytest
```

If frontend tests exist, use the test script defined in `frontend/package.json`.

Do not invent test commands in final summaries. If no test command exists, say so.

## Lint and typecheck commands

Use existing lint and typecheck scripts if they exist.

If no lint or typecheck command exists, state that they are unavailable.

Do not add lint or typecheck tooling unless a feature spec requires it.

## Database and migrations

The current starter is in-memory unless a feature spec adds persistence.

Do not add a database, ORM, or migration system unless the active feature spec requires it.

## Code style conventions

- Follow existing file structure and naming patterns.
- Keep backend API modules small and focused.
- Keep business logic in services instead of route handlers when practical.
- Use Pydantic models for request and response validation.
- Keep frontend code modular and readable.
- Prefer semantic HTML and accessible controls.
- Avoid large rewrites unless required by the feature spec.

## Testing expectations

- Add or update tests for changed backend behavior when practical.
- Prefer small unit tests for services and integration tests for API routes.
- Do not add a large frontend testing framework unless required by the feature spec.
- Existing behavior must not be broken.

## Security and privacy rules

- Never commit secrets, API keys, tokens, credentials, or `.env` files with real values.
- Use `.env.example` for documented configuration.
- Do not store camera frames unless a feature spec explicitly requires storage and privacy behavior.
- Do not log personal data.
- Validate all client input on the backend.
- Treat room codes and client-provided IDs as untrusted input.

## Dependency rules

- Do not introduce new dependencies unless necessary.
- Prefer small, well-maintained dependencies.
- If a dependency is added, explain why in the final summary.
- Do not replace the existing stack without explicit instruction.

## What Codex should avoid changing

- Do not add Arduino, Nano BLE, serial, or wearable hardware dependencies to the main product path.
- Do not modify unrelated files.
- Do not perform broad formatting-only rewrites.
- Do not move the project to a different framework without a spec.
- Do not add real authentication, database persistence, deployment infrastructure, or pose inference unless the active spec asks for it.
- Do not put feature-specific requirements in `AGENTS.md`; keep them in `docs/specs/`.
```

## 16. Final Codex prompt

```text
Read AGENTS.md first, then implement docs/specs/two-screen-qr-controller.md exactly. Inspect the repository structure before editing, follow existing project patterns, avoid unrelated changes, and do not add new dependencies unless necessary. Add or update tests for the changed behavior. Run the relevant tests, lint, and typecheck if available. When finished, summarize changed files, tests run, tradeoffs, and any remaining issues.
```
