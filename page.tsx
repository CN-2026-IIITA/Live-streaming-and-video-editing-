'use client';

import { useStreamStudio } from '@/hooks/useStreamStudio';
import { Scissors, Radio, Terminal } from 'lucide-react';

export default function Home() {
  const {
    videoRef,
    canvasRef,
    isLive,
    logs,
    toggleStream,
    createReel
  } = useStreamStudio();

  return (
    <div className="bg-black text-white min-h-screen flex">
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />

      <main className="flex-1 p-8 flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full max-w-4xl rounded-xl border"
        />

        <div className="flex gap-4 mt-6">
          <button
            onClick={toggleStream}
            className="bg-red-600 px-6 py-3 rounded-xl"
          >
            <Radio />
          </button>

          <button
            onClick={createReel}
            className="bg-blue-600 px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <Scissors />
            Make Reel
          </button>
        </div>
      </main>

      <aside className="w-80 bg-gray-900 p-4">
        <h2 className="flex items-center gap-2 mb-4">
          <Terminal />
          Logs
        </h2>

        <div className="text-green-400 font-mono text-xs">
          {logs.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
      </aside>
    </div>
  );
}
