import React, { useState } from 'react';
import { X, Shuffle } from 'lucide-react';
import { TOWN_NODES, getHopDistance } from '../game/mapData';

interface RoutePickerModalProps {
  currentStartId: number;
  currentTargetId: number;
  onApply: (startId: number, targetId: number) => void;
  onClose: () => void;
}

export const RoutePickerModal: React.FC<RoutePickerModalProps> = ({
  currentStartId,
  currentTargetId,
  onApply,
  onClose,
}) => {
  const [startId, setStartId] = useState(currentStartId);
  const [targetId, setTargetId] = useState(currentTargetId);

  const isSame = startId === targetId;
  const hops = getHopDistance(startId, targetId);

  const handleRandom = () => {
    const ids = TOWN_NODES.map((n) => n.id);
    const s = ids[Math.floor(Math.random() * ids.length)];
    let t = s;
    for (let i = 0; i < 40; i++) {
      const candidate = ids[Math.floor(Math.random() * ids.length)];
      if (candidate !== s && getHopDistance(s, candidate) >= 2) {
        t = candidate;
        break;
      }
    }
    if (t === s) t = s === 1 ? 13 : 1;
    setStartId(s);
    setTargetId(t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#1b120b] border border-amber-500/30 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-amber-500/15">
          <h2 className="font-display text-lg font-semibold text-amber-100">
            Wybierz trasę A → B
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-800/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="start-select"
              className="block text-xs font-medium text-amber-300/90 mb-1.5"
            >
              Punkt startowy (A)
            </label>
            <select
              id="start-select"
              value={startId}
              onChange={(e) => setStartId(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl bg-[#120b06] border border-amber-500/30 px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-400"
            >
              {TOWN_NODES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="target-select"
              className="block text-xs font-medium text-emerald-300/90 mb-1.5"
            >
              Punkt docelowy (B)
            </label>
            <select
              id="target-select"
              value={targetId}
              onChange={(e) => setTargetId(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl bg-[#120b06] border border-emerald-500/35 px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-emerald-400"
            >
              {TOWN_NODES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-stone-400 flex items-center justify-between pt-1">
            <span>
              {isSame
                ? 'Wybierz dwie różne miejscowości.'
                : `Dystans w grafie: ${hops} ${hops === 1 ? 'odcinek' : hops < 5 ? 'odcinki' : 'odcinków'}`}
            </span>
            <button
              type="button"
              onClick={handleRandom}
              className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-medium cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Losuj parę
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-200 text-sm font-medium transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={isSame}
            onClick={() => {
              onApply(startId, targetId);
              onClose();
            }}
            className="flex-1 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 text-sm font-semibold transition-colors cursor-pointer"
          >
            Rozpocznij trasę
          </button>
        </div>
      </div>
    </div>
  );
};
