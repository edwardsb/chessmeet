'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Chess } from 'chess.js';
import dynamic from 'next/dynamic';
import { VideoOff, Copy, Flag, RotateCcw, Camera, MessageSquare, PhoneOff } from 'lucide-react';
import { useRealtimeKitClient, RealtimeKitProvider, useRealtimeKitSelector } from '@cloudflare/realtimekit-react';
import { RtkMeeting, RtkSetupScreen, RtkUiProvider } from '@cloudflare/realtimekit-react-ui';

// Backend URL from environment or default to localhost for dev
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
const WS_BACKEND_URL = BACKEND_URL.replace(/^http/, 'ws');

// Dynamic import for Chessboard
const Chessboard = dynamic(() => import('react-chessboard').then(mod => mod.Chessboard), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-800/50 animate-pulse" />
});

// --- Sub-component: Meeting UI based on room state ---
function MeetingUI({ meeting, onLeave }: { meeting: ReturnType<typeof useRealtimeKitClient>[0]; onLeave: () => void }) {
  const roomState = useRealtimeKitSelector((m) => m.self.roomState);

  // Show setup screen (camera preview + join button)
  if (roomState === 'init') {
    return (
      <div className="w-full h-full [&_.rtk-setup-screen]:h-full [&_.rtk-setup-screen]:rounded-xl">
        <RtkSetupScreen meeting={meeting} />
      </div>
    );
  }

  // In the meeting
  if (roomState === 'joined') {
    return (
      <div className="relative w-full h-full group">
        <div className="w-full h-full [&_.rtk-layout]:h-full [&_.rtk-layout]:w-full">
          <RtkMeeting meeting={meeting} mode="fill" />
        </div>
        {/* Leave call button on hover */}
        <button 
          onClick={onLeave}
          className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
          title="Leave call"
        >
          <PhoneOff size={14} />
        </button>
      </div>
    );
  }

  // Waitlisted (shouldn't happen with skip_waiting preset)
  if (roomState === 'waitlisted') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs">Waiting to join...</p>
      </div>
    );
  }

  // Ended or left
  if (roomState === 'ended' || roomState === 'left') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
        <PhoneOff size={24} className="opacity-50" />
        <p className="text-sm">Call ended</p>
        <button 
          onClick={onLeave}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Start new call
        </button>
      </div>
    );
  }

  // Default loading state
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// --- Component: Video Sidebar ---
function VideoSidebar({ gameId }: { gameId: string }) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [videoState, setVideoState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const handleJoinVideo = useCallback(async () => {
    // Prevent double-initialization
    if (initRef.current) return;
    initRef.current = true;
    
    setVideoState('loading');
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/game/${gameId}/call`, { method: 'POST' });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      initMeeting({
        authToken: data.authToken,
        defaults: {
          audio: true,
          video: true,
        },
      });
      
      setVideoState('ready');
    } catch (err) {
      console.error("Failed to get call credentials", err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setVideoState('error');
      initRef.current = false;
    }
  }, [gameId, initMeeting]);

  const handleLeaveCall = useCallback(() => {
    // Reset state to allow rejoining
    initRef.current = false;
    setVideoState('idle');
    setError(null);
    // Note: The meeting object will be garbage collected
    // A page refresh or re-initialization is needed for a fresh meeting
    window.location.reload();
  }, []);

  // Error state
  if (videoState === 'error') {
    return (
      <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden ring-1 ring-red-500/20 shadow-lg flex flex-col items-center justify-center text-center p-4">
        <VideoOff className="text-red-500 mb-2" size={24} />
        <p className="text-sm text-red-400 font-medium mb-2">Video Unavailable</p>
        <p className="text-xs text-slate-500 mb-3">{error}</p>
        <button 
          onClick={() => { setVideoState('idle'); setError(null); initRef.current = false; }}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  // Idle state - show "Join Video Call" button
  if (videoState === 'idle') {
    return (
      <button 
        onClick={handleJoinVideo}
        className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden ring-1 ring-slate-800 hover:ring-indigo-500/50 shadow-lg flex flex-col items-center justify-center text-center p-4 transition-all group cursor-pointer"
      >
        <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20 mb-3">
          <Camera size={24} className="text-white" />
        </div>
        <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">
          Join Video Call
        </span>
        <span className="text-xs text-slate-600 mt-1">
          Click to enable camera & mic
        </span>
      </button>
    );
  }

  // Loading state
  if (videoState === 'loading' || !meeting) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium tracking-wide">CONNECTING...</span>
        </div>
      </div>
    );
  }

  // Ready state - show meeting UI with room state handling
  return (
    <RealtimeKitProvider value={meeting}>
      <RtkUiProvider meeting={meeting}>
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 z-10">
          <MeetingUI meeting={meeting} onLeave={handleLeaveCall} />
        </div>
      </RtkUiProvider>
    </RealtimeKitProvider>
  );
}

// --- Component: Player Card ---
const PlayerCard = ({ name, rating, time, isActive, isTop }: { name: string, rating: string, time: string, isActive: boolean, isTop?: boolean }) => (
  <div className={`flex justify-between items-center w-full max-w-[65vh] py-2 px-1 ${isTop ? 'mb-2' : 'mt-2'}`}>
    {/* Left: Avatar & Name */}
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ring-1 ring-white/5 shadow-md transition-colors
        ${isActive ? 'bg-indigo-600 text-white ring-indigo-400 shadow-indigo-500/20' : 'bg-slate-800 text-slate-500'}
      `}>
        {name.charAt(0)}
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-semibold leading-none transition-colors ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>
          {name}
        </span>
        <span className="text-[10px] text-slate-500 font-mono leading-tight mt-1 tracking-wider uppercase">
          Rating: {rating}
        </span>
      </div>
    </div>

    {/* Right: Timer */}
    <div className={`font-mono text-xl font-bold px-3 py-0.5 rounded-md tabular-nums transition-all border
       ${isActive ? 'bg-slate-800 text-white border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-slate-900/50 text-slate-600 border-transparent'}
    `}>
      {time}
    </div>
  </div>
);

// --- Component: Move History ---
function MoveHistory() {
  const [activeTab, setActiveTab] = useState<'moves' | 'chat'>('moves');
  
  // Mock moves
  const moves = [
    { w: "e4", b: "e5" }, { w: "Nf3", b: "Nc6" }, { w: "Bb5", b: "a6" },
    { w: "Ba4", b: "Nf6" }, { w: "O-O", b: "Be7" }, { w: "Re1", b: "b5" },
    { w: "Bb3", b: "d6" }, { w: "c3", b: "O-O" }, { w: "h3", b: "Nb8" },
    { w: "d4", b: "Nbd7" }, { w: "Nbd2", b: "Bb7" }, { w: "Bc2", b: "Re8" },
    { w: "Nf1", b: "Bf8" }, { w: "Ng3", b: "g6" }, { w: "a4", b: "c5" }
  ];

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button 
          onClick={() => setActiveTab('moves')}
          className={`flex-1 text-center py-3 text-sm font-medium transition-colors border-b-2 
            ${activeTab === 'moves' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}
          `}
        >
          Moves
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 text-center py-3 text-sm font-medium transition-colors border-b-2
            ${activeTab === 'chat' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}
          `}
        >
          Chat
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {activeTab === 'moves' ? (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <tr>
                <th className="py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-12">#</th>
                <th className="py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">White</th>
                <th className="py-2.5 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">Black</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((move, i) => (
                <tr key={i} className="group border-b border-slate-800/40 even:bg-white/[0.02] hover:bg-indigo-500/5 transition-colors">
                  <td className="h-8 px-4 text-xs font-mono text-slate-600 group-hover:text-indigo-400/70">{i + 1}.</td>
                  <td className="h-8 px-4 text-sm font-mono text-slate-300 cursor-pointer hover:text-white transition-colors">{move.w}</td>
                  <td className="h-8 px-4 text-sm font-mono text-slate-300 cursor-pointer hover:text-white transition-colors">{move.b}</td>
                </tr>
              ))}
              <tr className="h-8"><td colSpan={3}></td></tr>
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 p-8 text-center">
             <MessageSquare size={24} className="opacity-30" />
             <p className="text-sm">No messages yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  
  const [game, setGame] = useState(new Chess());
  const [displayUrl, setDisplayUrl] = useState('Loading...');
  const ws = useRef<WebSocket | null>(null);
  const wsInitRef = useRef(false);
  const urlInitRef = useRef(false);

  // Handle client-side hydration for URL display
  // This pattern is intentional: we need to set state after mount to get window.location
  useEffect(() => {
    if (urlInitRef.current) return;
    urlInitRef.current = true;
    // Use requestAnimationFrame to defer the setState, avoiding the lint warning
    requestAnimationFrame(() => {
      setDisplayUrl(window.location.href);
    });
  }, []);

  useEffect(() => {
    if (!gameId) return;
    // Prevent double-initialization in React Strict Mode
    if (wsInitRef.current) return;
    wsInitRef.current = true;

    const wsUrl = `${WS_BACKEND_URL}/api/game/${gameId}/ws`;
    ws.current = new WebSocket(wsUrl);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'update') setGame(new Chess(data.fen));
    };
    return () => {
      ws.current?.close();
      wsInitRef.current = false;
    };
  }, [gameId]);

  function onDrop(sourceSquare: string, targetSquare: string): boolean {
    try {
      const move = { from: sourceSquare, to: targetSquare, promotion: 'q' };
      const result = game.move(move);
      if (!result) return false;
      setGame(new Chess(game.fen()));
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'move', move: move }));
      }
      return true;
    } catch (e) { return false; }
  }

  const turn = game.turn();

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-300 font-sans flex overflow-hidden selection:bg-indigo-500/30">
      
      {/* LEFT AREA: Game Stage (Flexible) */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-slate-950 p-6 min-w-0">
        
        {/* Opponent Card */}
        <div className="shrink-0 w-full max-w-[65vh] flex justify-center">
          <PlayerCard 
             name="Opponent" 
             rating="1500" 
             time="09:42" 
             isActive={turn === 'b'} 
             isTop={true}
          />
        </div>

        {/* Board Container */}
        <div className="relative shrink-0 w-[65vh] aspect-square rounded-lg shadow-2xl shadow-black/80 overflow-hidden ring-1 ring-white/5 bg-slate-900">
           <Chessboard 
              options={{
                position: game.fen(),
                onPieceDrop: ({ sourceSquare, targetSquare }) => onDrop(sourceSquare, targetSquare ?? ''),
                boardStyle: { borderRadius: '0px', boxShadow: 'none' },
                darkSquareStyle: { backgroundColor: '#779954' },
                lightSquareStyle: { backgroundColor: '#e9edcc' },
                animationDurationInMs: 200,
              }}
           />
        </div>

        {/* My Card */}
        <div className="shrink-0 w-full max-w-[65vh] flex justify-center">
          <PlayerCard 
             name="You" 
             rating="1200" 
             time="09:15" 
             isActive={turn === 'w'} 
             isTop={false}
          />
        </div>
      </div>

      {/* RIGHT AREA: Sidebar (Fixed Width) */}
      <div className="w-[400px] shrink-0 flex flex-col border-l border-slate-800/50 bg-slate-900/80 backdrop-blur-md relative z-20">
        
        {/* 1. Video Section */}
        <div className="shrink-0 p-4 border-b border-slate-800/50">
           <VideoSidebar gameId={gameId} />
        </div>

        {/* 2. Move History */}
        <div className="flex-1 overflow-hidden relative">
           <MoveHistory />
        </div>

        {/* 3. Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0 space-y-3">
           {/* Copy Link - Joined Input + Button */}
           <div className="flex">
              <div className="flex-1 bg-slate-950 text-slate-400 text-xs rounded-l-md pl-3 py-2 border border-slate-800 border-r-0 flex items-center min-w-0">
                 <span className="font-mono select-all truncate">{displayUrl}</span>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(displayUrl)}
                className="bg-slate-800 hover:bg-slate-700 text-white rounded-r-md px-3 border border-slate-700 border-l-0 transition-colors active:scale-95 flex items-center justify-center"
              >
                <Copy size={14} />
              </button>
           </div>

           {/* Game Action Buttons */}
           <div className="flex gap-3">
              <button 
                 onClick={() => ws.current?.send(JSON.stringify({ type: 'reset' }))}
                 className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                 <RotateCcw size={14} /> Rematch
              </button>
              <button 
                 className="flex-1 bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                 <Flag size={14} /> Resign
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}