'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chess } from 'chess.js';
import dynamic from 'next/dynamic';
import { Play, Users, Video } from 'lucide-react';

const Chessboard = dynamic(() => import('react-chessboard').then(mod => mod.Chessboard), {
  ssr: false,
  loading: () => <div className="size-full bg-stone-200/60" />
});

export default function Home() {
  const router = useRouter();
  const [game, setGame] = useState(new Chess());

  const handlePlay = () => {
    // For prototype, instant redirect to a random room
    // In real app, this would POST /api/queue/join
    const randomId = Math.random().toString(36).substring(7);
    router.push(`/play/${randomId}`);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-slate-950 text-slate-200 p-8 selection:bg-indigo-500/30">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-semibold text-balance">ChessMeet</h1>
        <p className="text-xl text-pretty text-slate-400 max-w-md mx-auto">
          Instant video chess matching. No registration required.
        </p>
      </header>

      <div className="w-full max-w-md aspect-square rounded-lg shadow-2xl shadow-black/70 overflow-hidden ring-1 ring-white/10 bg-slate-900">
        <Chessboard
          options={{
            position: game.fen(),
            allowDragging: false,
            boardStyle: {
              borderRadius: '0px',
            },
            darkSquareStyle: { backgroundColor: '#779954' },
            lightSquareStyle: { backgroundColor: '#e9edcc' },
          }}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handlePlay}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <Play size={24} fill="currentColor" aria-hidden="true" />
          Play Now
        </button>
        <button className="flex items-center justify-center gap-2 bg-slate-900 text-slate-200 px-6 py-4 rounded-full font-semibold border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">
          <Video size={20} aria-hidden="true" />
          Test Video
        </button>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center text-sm text-slate-400 max-w-4xl">
        <div className="flex flex-col items-center gap-2">
          <Users size={24} />
          <p className="text-pretty">Instant global matching</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Video size={24} />
          <p className="text-pretty">Crystal clear video chat</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="font-mono font-semibold text-lg">DO</div>
          <p className="text-pretty">Powered by Cloudflare Edge</p>
        </div>
      </div>
    </main>
  );
}