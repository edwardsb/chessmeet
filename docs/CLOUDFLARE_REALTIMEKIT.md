# Cloudflare RealtimeKit Integration Guide

This document captures learnings from integrating Cloudflare RealtimeKit (video calling) into ChessMeet.

## Overview

Cloudflare RealtimeKit is a real-time video/audio SDK built on WebRTC. It's powered by Dyte under the hood (you'll see `dyte.io` in WebSocket connections).

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React Frontend │────▶│  Backend Worker  │────▶│  Cloudflare Calls   │
│  (RealtimeKit   │     │  (Durable Object)│     │  API                │
│   React SDK)    │     │                  │     │                     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
        │                        │
        │                        ▼
        │               ┌──────────────────┐
        └──────────────▶│  RealtimeKit     │
                        │  WebSocket       │
                        │  (dyte.io)       │
                        └──────────────────┘
```

## Key Concepts

### 1. Meetings
- A **Meeting** is a video room where participants can join
- Created via the Cloudflare API: `POST /accounts/{account_id}/realtime/kit/{app_id}/meetings`
- Each meeting has a unique `meetingId`
- Store the `meetingId` in your backend (we use Durable Object storage) to reuse for the same game/session

### 2. Participants
- Each user joining a meeting is a **Participant**
- Created via: `POST /accounts/{account_id}/realtime/kit/{app_id}/meetings/{meeting_id}/participants`
- Returns an `authToken` (JWT) that the client uses to connect
- Each participant needs their own token (don't share tokens between users)

### 3. Presets
- **Presets** define participant permissions and meeting behavior
- Configured in the Cloudflare Dashboard under RealtimeKit > Presets
- Important preset settings:
  - **Waiting Room**: If enabled, participants wait for host approval
  - **Video/Audio**: Enable/disable camera and microphone
  - **Screen Share**: Allow screen sharing

### 4. Room States
The SDK uses `roomState` to track the meeting lifecycle:

| State | Description |
|-------|-------------|
| `init` | Meeting initialized but not joined (show setup screen) |
| `waitlisted` | In waiting room, pending approval |
| `joined` | Successfully in the meeting |
| `left` | User left the meeting |
| `ended` | Meeting was ended |

## Backend Implementation

### API Endpoint: `/api/game/{gameId}/call`

```typescript
// 1. Create meeting if it doesn't exist
let meetingId = await this.ctx.storage.get<string>("meetingId");

if (!meetingId) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/realtime/kit/${APP_ID}/meetings`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${APP_SECRET}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        title: "My Meeting",
        waiting_room_enabled: false  // Important: disable waiting room
      })
    }
  );
  const data = await res.json();
  meetingId = data.data.id;  // Note: response uses .data not .result
  await this.ctx.storage.put("meetingId", meetingId);
}

// 2. Add participant with preset
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/realtime/kit/${APP_ID}/meetings/${meetingId}/participants`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${APP_SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Player",
      preset_name: "skip_waiting",  // Use preset without waiting room
      client_specific_id: crypto.randomUUID()
    })
  }
);
const data = await res.json();
return { authToken: data.data.token };  // Note: .token not .authToken
```

### Environment Variables

```toml
# wrangler.toml
[vars]
CALLS_APP_ID = "your-app-id"

# Store secret securely:
# npx wrangler secret put CALLS_APP_SECRET
```

## Frontend Implementation

### Required Packages

```bash
npm install @cloudflare/realtimekit-react @cloudflare/realtimekit-react-ui
```

### Key Imports

```typescript
import { 
  useRealtimeKitClient, 
  RealtimeKitProvider, 
  useRealtimeKitSelector 
} from '@cloudflare/realtimekit-react';

import { 
  RtkMeeting, 
  RtkSetupScreen, 
  RtkUiProvider 
} from '@cloudflare/realtimekit-react-ui';
```

### Initialization Pattern

```typescript
function VideoCall({ gameId }) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');

  const handleJoin = async () => {
    setState('loading');
    
    // Fetch auth token from your backend
    const res = await fetch(`/api/game/${gameId}/call`, { method: 'POST' });
    const { authToken } = await res.json();
    
    // Initialize the meeting (does NOT join yet)
    initMeeting({
      authToken,
      defaults: {
        audio: true,
        video: true,
      },
    });
    
    setState('ready');
  };

  if (state === 'idle') {
    return <button onClick={handleJoin}>Join Video Call</button>;
  }

  if (state === 'loading' || !meeting) {
    return <div>Connecting...</div>;
  }

  // Wrap with providers and render UI based on roomState
  return (
    <RealtimeKitProvider value={meeting}>
      <RtkUiProvider meeting={meeting}>
        <MeetingUI meeting={meeting} />
      </RtkUiProvider>
    </RealtimeKitProvider>
  );
}
```

### Room State Handling

```typescript
function MeetingUI({ meeting }) {
  // useRealtimeKitSelector provides reactive updates
  const roomState = useRealtimeKitSelector((m) => m.self.roomState);

  switch (roomState) {
    case 'init':
      // RtkSetupScreen shows camera preview + "Join" button
      // It handles calling meeting.join() internally
      return <RtkSetupScreen meeting={meeting} />;
    
    case 'joined':
      // RtkMeeting shows all participants in the call
      return <RtkMeeting meeting={meeting} mode="fill" />;
    
    case 'waitlisted':
      return <div>Waiting for host approval...</div>;
    
    case 'ended':
    case 'left':
      return <div>Call ended</div>;
    
    default:
      return <div>Loading...</div>;
  }
}
```

## Common Pitfalls & Solutions

### 1. "Waiting Room" Message
**Problem**: Users see "You are in the waiting room, the host will let you in soon."

**Solution**: 
- Create a preset in the Cloudflare Dashboard with Waiting Room disabled
- Set Behaviour to "Skip - Enter directly"
- Use that preset name when adding participants

### 2. Don't Call `meeting.join()` Manually
**Problem**: Calling `meeting.join()` directly can cause issues.

**Solution**: 
- Use `RtkSetupScreen` component - it handles joining when user clicks "Join"
- Or use `RtkMeeting` which auto-joins
- Check `roomState` to know when user has joined

### 3. Participants Can't See Each Other
**Problem**: Two users in same meeting only see themselves.

**Causes**:
- Different `meetingId` for each user (check your backend logic)
- Waiting room blocking entry
- Not using `RealtimeKitProvider` wrapper

**Solution**:
- Verify both users get the same `meetingId` from backend
- Use preset without waiting room
- Wrap components with `RealtimeKitProvider` and `RtkUiProvider`

### 4. React Strict Mode Double-Initialization
**Problem**: Effects run twice in development, causing duplicate API calls.

**Solution**:
```typescript
const initRef = useRef(false);

useEffect(() => {
  if (initRef.current) return;
  initRef.current = true;
  
  // Your initialization code
}, []);
```

### 5. API Response Structure
**Problem**: Cloudflare API responses use `.data` not `.result`.

```typescript
// Wrong
const meetingId = response.result.id;

// Correct
const meetingId = response.data.id;
```

## Useful Components from SDK

| Component | Purpose |
|-----------|---------|
| `RtkMeeting` | Full meeting UI with all participants |
| `RtkSetupScreen` | Pre-join screen with camera preview |
| `RtkParticipantTile` | Single participant video tile |
| `RtkMicToggle` | Microphone toggle button |
| `RtkCameraToggle` | Camera toggle button |
| `RtkLeaveButton` | Leave meeting button |
| `RtkEndedScreen` | Post-meeting screen |
| `RtkWaitingScreen` | Waiting room screen |

## Useful Hooks

| Hook | Purpose |
|------|---------|
| `useRealtimeKitClient()` | Get `[meeting, initMeeting]` tuple |
| `useRealtimeKitMeeting()` | Get `{ meeting }` from context |
| `useRealtimeKitSelector(fn)` | Subscribe to reactive state updates |

## Example: Getting Participant Count

```typescript
const activeParticipants = useRealtimeKitSelector((meeting) =>
  meeting.participants.active.toArray()
);

// participants.active = other participants currently in call
// participants.joined = all participants who have joined
// participants.pinned = pinned participants
```

## Resources

- [RealtimeKit Web Examples](https://github.com/cloudflare/realtimekit-web-examples)
- [RealtimeKit Docs](https://developers.cloudflare.com/realtime/realtimekit/)
- [UI Kit Components](https://developers.cloudflare.com/realtime/realtimekit/ui-kit/)
- [React SDK](https://docs.realtime.cloudflare.com/react-ui-kit/quickstart)

## Cloudflare Dashboard Setup

1. Go to Cloudflare Dashboard > RealtimeKit
2. Create an App (get `APP_ID`)
3. Create an API Token with RealtimeKit permissions (get `APP_SECRET`)
4. Create a Preset:
   - Name: `skip_waiting` (or your choice)
   - Waiting Room > Behaviour: "Skip - Enter directly"
   - Enable Video and Audio as needed
5. Use the preset name in your backend when adding participants
