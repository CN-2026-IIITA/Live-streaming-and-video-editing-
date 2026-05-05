'use client';

import React from 'react';
import { useStreamStudio } from '../../hooks/useStreamStudio';
import { Radio, Scissors, Terminal } from 'lucide-react';

export default function StudioPage() {
  const {
    videoRef,
    canvasRef,
    isLive,
    logs,
    toggleStream,
    createReel
  } = useStreamStudio();

  return (
    <div className="bg-gray-950 text-white min-h-screen flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      <nav className="p-4 border-b border-gray-800 flex justify-between bg-gray-900">
        <h1 className="text-xl font-bold">
          Stream<span className="text-blue-500">Forge</span> Studio
        </h1>

        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm font-mono">
            {isLive ? 'LIVE' : 'STANDBY'}
          </span>
        </div>
      </nav>

      <main className="flex-1 flex">
        <section className="flex-1 p-8 flex flex-col items-center justify-center">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full max-w-4xl rounded-2xl border border-gray-800 bg-black"
          />

          <div className="mt-8 flex space-x-4 bg-gray-900 p-4 rounded-2xl border border-gray-700">
            <button
              onClick={toggleStream}
              className={`${
                isLive ? 'bg-red-600' : 'bg-blue-600'
              } p-4 rounded-full`}
            >
              <Radio />
            </button>

            <button
              onClick={createReel}
              className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl flex items-center transition-colors"
            >
              <Scissors size={18} className="mr-2 text-blue-400" />
              Make Reel
            </button>
          </div>
        </section>

        <aside className="w-80 border-l border-gray-800 bg-gray-900 p-6 flex flex-col">
          <h3 className="font-bold mb-4 flex items-center">
            <Terminal size={18} className="mr-2 text-blue-500" />
            Logs
          </h3>

          <div className="flex-1 bg-black rounded p-4 font-mono text-[10px] text-green-500 overflow-y-auto border border-gray-800">
            {logs.map((log, i) => (
              <p key={i}>{log}</p>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
