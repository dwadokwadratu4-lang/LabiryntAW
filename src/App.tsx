import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  Crosshair,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  MapPin,
  RotateCcw,
  Shuffle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  LabyrinthCanvas,
  ActiveBallMission,
  CameraViewMode,
  GameMode,
  TargetInfoText,
} from './components/LabyrinthCanvas';
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton';
import { RoutePickerModal } from './components/RoutePickerModal';
import {
  NODE_MAP,
  TOWN_FACTS,
  pickRandomRoute,
  pickThreeCourierRoutes,
} from './game/mapData';
import { soundEngine } from './game/soundEngine';

function formatTime(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const secs = totalSec % 60;
  const mins = Math.floor(totalSec / 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export default function App() {
  const [mode, setMode] = useState<GameMode>('single');
  const [singleRoute, setSingleRoute] = useState<{ startId: number; targetId: number }>(() => ({
    startId: 1,
    targetId: 9,
  }));
  const [courierMissions, setCourierMissions] = useState<ActiveBallMission[]>(() =>
    pickThreeCourierRoutes().map((m) => ({
      key: m.ballKey,
      label: m.label,
      startId: m.startId,
      targetId: m.targetId,
      colorHex: m.colorHex,
      uiColor: m.uiColor,
    }))
  );

  const [runId, setRunId] = useState(1);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [completedCount, setCompletedCount] = useState(0);
  const [bestTimeMs, setBestTimeMs] = useState<number | null>(null);
  const [deliveredKeys, setDeliveredKeys] = useState<Set<string>>(() => new Set());

  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const [muted, setMuted] = useState(false);
  const [cameraView, setCameraView] = useState<CameraViewMode>('follow');
  const [gyroEnabled, setGyroEnabled] = useState(true);
  const [calibrateSignal, setCalibrateSignal] = useState(0);
  const [centerLevelSignal, setCenterLevelSignal] = useState(0);
  const [dockCollapsed, setDockCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [virtualTilt, setVirtualTilt] = useState({ pitch: 0, roll: 0 });
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [introActive, setIntroActive] = useState(true);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [winOverlay, setWinOverlay] = useState<{ timeMs: number; routeLabel: string } | null>(null);
  const [outOfLives, setOutOfLives] = useState(false);
  const [tiltReadout, setTiltReadout] = useState({ pitch: 0, roll: 0 });

  const autoNextTimeoutRef = useRef<number | null>(null);
  const bannerTimeoutRef = useRef<number | null>(null);

  const activeMissions: ActiveBallMission[] = useMemo(() => {
    if (mode === 'single') {
      return [
        {
          key: 'gold',
          label: 'Złota',
          startId: singleRoute.startId,
          targetId: singleRoute.targetId,
          colorHex: 0xf4c430,
          uiColor: '#eab308',
        },
      ];
    }
    return courierMissions;
  }, [mode, singleRoute, courierMissions]);

  const primaryTargetId = useMemo(() => {
    if (mode === 'single') return singleRoute.targetId;
    const nextUndelivered = courierMissions.find((m) => !deliveredKeys.has(m.key));
    return nextUndelivered?.targetId ?? courierMissions[0]?.targetId ?? 9;
  }, [mode, singleRoute.targetId, courierMissions, deliveredKeys]);

  const targetFact = TOWN_FACTS[primaryTargetId] ?? TOWN_FACTS[9];

  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    const totalLen =
      targetFact.title.length +
      targetFact.era.length +
      targetFact.population.length +
      targetFact.distanceToStarostwo.length;

    setTypedChars(0);
    if (introActive) return;

    const timer = window.setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= totalLen) {
          window.clearInterval(timer);
          return totalLen;
        }
        return Math.min(totalLen, prev + 2);
      });
    }, 22);

    return () => window.clearInterval(timer);
  }, [targetFact, runId, introActive]);

  const typedInfo: TargetInfoText = useMemo(() => {
    let rem = typedChars;
    const t = targetFact.title.slice(0, rem);
    rem = Math.max(0, rem - targetFact.title.length);
    const e = targetFact.era.slice(0, rem);
    rem = Math.max(0, rem - targetFact.era.length);
    const p = targetFact.population.slice(0, rem);
    rem = Math.max(0, rem - targetFact.population.length);
    const d = targetFact.distanceToStarostwo.slice(0, rem);
    return { title: t, era: e, population: p, distance: d };
  }, [typedChars, targetFact]);

  // High-precision stopwatch loop
  useEffect(() => {
    if (!timerRunning) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now() - elapsedMs;
    }
    let raf = 0;
    const update = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(performance.now() - startTimeRef.current);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [timerRunning]);

  const showTempBanner = useCallback((msg: string, duration = 2600) => {
    setStatusBanner(msg);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      setStatusBanner(null);
    }, duration);
  }, []);

  const resetCurrentRun = useCallback(() => {
    if (autoNextTimeoutRef.current) {
      window.clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    setAttemptsLeft(3);
    setDeliveredKeys(new Set());
    setElapsedMs(0);
    setTimerRunning(false);
    startTimeRef.current = null;
    setWinOverlay(null);
    setOutOfLives(false);
    setRunId((r) => r + 1);
  }, []);

  const drawNextRoute = useCallback(() => {
    if (autoNextTimeoutRef.current) {
      window.clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    if (mode === 'single') {
      setSingleRoute((prev) => pickRandomRoute(prev.startId));
    } else {
      setCourierMissions(
        pickThreeCourierRoutes().map((m) => ({
          key: m.ballKey,
          label: m.label,
          startId: m.startId,
          targetId: m.targetId,
          colorHex: m.colorHex,
          uiColor: m.uiColor,
        }))
      );
    }
    setAttemptsLeft(3);
    setDeliveredKeys(new Set());
    setElapsedMs(0);
    setTimerRunning(false);
    startTimeRef.current = null;
    setWinOverlay(null);
    setOutOfLives(false);
    setRunId((r) => r + 1);
  }, [mode]);

  const handleModeSwitch = (nextMode: GameMode) => {
    if (nextMode === mode) return;
    soundEngine.unlock();
    if (autoNextTimeoutRef.current) {
      window.clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    setMode(nextMode);
    if (nextMode === 'courier3') {
      setCourierMissions(
        pickThreeCourierRoutes().map((m) => ({
          key: m.ballKey,
          label: m.label,
          startId: m.startId,
          targetId: m.targetId,
          colorHex: m.colorHex,
          uiColor: m.uiColor,
        }))
      );
    }
    setAttemptsLeft(3);
    setDeliveredKeys(new Set());
    setElapsedMs(0);
    setTimerRunning(false);
    startTimeRef.current = null;
    setWinOverlay(null);
    setOutOfLives(false);
    setRunId((r) => r + 1);
  };

  const unlockGyroOnGesture = useCallback(async (showFeedback: boolean) => {
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res === 'granted') {
          setGyroEnabled(true);
          setCalibrateSignal((s) => s + 1);
          if (showFeedback) showTempBanner('Żyroskop aktywny — poziom skalibrowany');
        } else {
          setGyroEnabled(false);
          if (showFeedback) showTempBanner('Brak dostępu do żyroskopu — użyj strzałek lub przeciągania');
        }
        return;
      } catch {
        if (showFeedback) showTempBanner('Użyj strzałek na ekranie, palca lub klawiszy WASD');
        return;
      }
    }
    setGyroEnabled(true);
    setCalibrateSignal((s) => s + 1);
    if (showFeedback) showTempBanner('Poziom planszy skalibrowany');
  }, [showTempBanner]);

  const handleCalibrate = async () => {
    soundEngine.unlock();
    await unlockGyroOnGesture(true);
  };

  const handleCenterLevel = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    soundEngine.unlock();
    setCenterLevelSignal((s) => s + 1);
    showTempBanner('Plansza wypoziomowana i wyśrodkowana', 1800);
  };

  const handleFirstMove = useCallback(() => {
    setTimerRunning((running) => {
      if (!running) {
        startTimeRef.current = performance.now();
      }
      return true;
    });
  }, []);

  const handleTrapFall = useCallback(
    (ballLabel: string, holeName: string) => {
      setAttemptsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setTimerRunning(false);
          setOutOfLives(true);
          showTempBanner(`Wpadłeś do: ${holeName} — wyczerpano 3 próby`, 3200);
        } else {
          showTempBanner(
            mode === 'single'
              ? `Otworek ${holeName}! Powrót na start (pozostały ${next} próby).`
              : `Kulka ${ballLabel} wpadła do ${holeName}! (Pozostały ${next} próby).`
          );
        }
        return next;
      });
    },
    [mode, showTempBanner]
  );

  const handleBallDelivered = useCallback((ballKey: string, remaining: number) => {
    setDeliveredKeys((prev) => {
      const next = new Set(prev);
      next.add(ballKey);
      return next;
    });
    if (remaining > 0) {
      showTempBanner(`Kulka dostarczona! Pozostało kulek: ${remaining}`, 2000);
    }
  }, [showTempBanner]);

  const handleRouteComplete = useCallback(() => {
    setTimerRunning(false);
    const finalTime =
      startTimeRef.current !== null ? performance.now() - startTimeRef.current : elapsedMs;
    setElapsedMs(finalTime);
    setCompletedCount((c) => c + 1);
    setBestTimeMs((prev) => (prev === null ? finalTime : Math.min(prev, finalTime)));

    const startName = NODE_MAP.get(singleRoute.startId)?.shortName ?? '';
    const targetName = NODE_MAP.get(singleRoute.targetId)?.shortName ?? '';
    const routeLabel =
      mode === 'single' ? `${startName} → ${targetName}` : 'Kurier Powiatu (3 kulki)';

    setWinOverlay({ timeMs: finalTime, routeLabel });
  }, [elapsedMs, mode, singleRoute.startId, singleRoute.targetId]);

  // Auto-return to 3D Intro flyover after 10 seconds of inactivity on win/loss summary screen
  useEffect(() => {
    const isSummaryOpen = (Boolean(winOverlay) || outOfLives) && !introActive;
    if (!isSummaryOpen) return;

    let idleTimer: number | null = null;
    const scheduleReturnToIntro = () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        resetCurrentRun();
        setIntroActive(true);
      }, 10000);
    };

    scheduleReturnToIntro();
    window.addEventListener('pointerdown', scheduleReturnToIntro);
    window.addEventListener('touchstart', scheduleReturnToIntro, { passive: true });
    window.addEventListener('keydown', scheduleReturnToIntro);

    return () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', scheduleReturnToIntro);
      window.removeEventListener('touchstart', scheduleReturnToIntro);
      window.removeEventListener('keydown', scheduleReturnToIntro);
    };
  }, [winOverlay, outOfLives, introActive, resetCurrentRun]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleSkipIntro = useCallback(() => {
    soundEngine.unlock();
    void unlockGyroOnGesture(false);
    setIntroActive(false);
  }, [unlockGyroOnGesture]);

  useEffect(() => {
    if (!introActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleSkipIntro();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [introActive, handleSkipIntro]);

  const setVirtualAxis = (pitch: number, roll: number) => {
    soundEngine.unlock();
    setVirtualTilt({ pitch, roll });
  };
  const clearVirtualAxis = () => setVirtualTilt({ pitch: 0, roll: 0 });

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#120b06] text-stone-100 select-none">
      {/* Fullscreen 3D WebGL Board */}
      <LabyrinthCanvas
        mode={mode}
        missions={activeMissions}
        runId={runId}
        introActive={introActive}
        isPaused={introActive || showRouteModal || outOfLives || Boolean(winOverlay)}
        cameraView={cameraView}
        gyroEnabled={gyroEnabled}
        calibrateSignal={calibrateSignal}
        centerLevelSignal={centerLevelSignal}
        virtualTilt={virtualTilt}
        targetInfoText={typedInfo}
        onTrapFall={handleTrapFall}
        onBallDelivered={handleBallDelivered}
        onRouteComplete={handleRouteComplete}
        onFirstMove={handleFirstMove}
        onTiltChange={(pitch, roll) => setTiltReadout({ pitch, roll })}
      />

      {/* Cinematic 3D Intro Overlay */}
      {introActive && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-between py-8 px-4 pointer-events-none bg-gradient-to-b from-black/55 via-transparent to-black/65">
          <div className="mt-4 sm:mt-8 max-w-2xl w-full rounded-2xl bg-[#160d07]/88 border border-amber-400/45 px-6 py-5 text-center shadow-2xl pointer-events-auto">
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-wide text-amber-300 drop-shadow">
              ZŁOTE KULE POWIATU
            </h1>
            <p className="mt-2 text-xs sm:text-sm font-medium text-amber-100/85 tracking-wider">
              Koncepcja i realizacja: Artur Wierzbicki
            </p>
          </div>

          <div className="mb-6 flex flex-col items-center gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={handleSkipIntro}
              className="min-w-[180px] min-h-[50px] px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] border-2 border-amber-200/80 text-stone-950 font-display font-extrabold text-base tracking-widest shadow-2xl transition-all cursor-pointer"
            >
              [ POMIŃ ]
            </button>
          </div>
        </div>
      )}

      {/* Top Compact HUD — Full-width vertical 3-row stack + controls strip */}
      {!introActive && (
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-20 p-2 sm:p-3.5 flex flex-col gap-2">
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-1.5 rounded-2xl bg-[#18100a]/92 border border-amber-500/25 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xl pointer-events-auto">
          {/* Row 1: Main Title (full width, single line, clamp sized) */}
          <div
            className="w-full font-display font-extrabold tracking-wide text-amber-300 leading-tight whitespace-nowrap"
            style={{ fontSize: 'clamp(14px, 4.2vw, 19px)' }}
          >
            ZŁOTE KULE POWIATU
          </div>

          {/* Row 2: Author attribution (50% smaller than main title) */}
          <div
            className="w-full font-medium text-amber-200/85 leading-tight"
            style={{ fontSize: 'clamp(7px, 2.1vw, 9.5px)' }}
          >
            Koncepcja i realizacja: Artur Wierzbicki
          </div>

          {/* Row 3 (courier3 mode only): Compact colored target badges without numbers */}
          {mode === 'courier3' && (
            <div
              className="w-full flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-medium leading-snug"
              style={{ fontSize: 'clamp(10px, 2.8vw, 13px)' }}
            >
              {courierMissions.map((m, idx) => {
                const tNode = NODE_MAP.get(m.targetId);
                const done = deliveredKeys.has(m.key);
                return (
                  <React.Fragment key={m.key}>
                    {idx > 0 && (
                      <span aria-hidden="true" className="text-stone-600">
                        ·
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 ${
                        done ? 'line-through text-stone-500' : 'text-stone-100'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: m.uiColor }}
                      />
                      <span>
                        {m.label} → {tNode?.shortName}
                      </span>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Row 4: Metrics & Camera/Audio Controls */}
          <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-amber-500/15">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm">
              <span className="font-mono-tabular font-bold text-amber-200 leading-tight">
                {formatTime(elapsedMs)}
              </span>
              <span className="text-[11px] text-stone-400 font-mono-tabular">
                Próby: {attemptsLeft}/3
                {completedCount > 0 ? ` · Trasy: ${completedCount}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCameraView((v) => (v === 'follow' ? 'overview' : 'follow'))}
                title={
                  cameraView === 'follow'
                    ? 'Przełącz na widok całej mapy'
                    : 'Przełącz na śledzenie kulki'
                }
                className="min-h-[36px] px-2.5 rounded-xl bg-[#271910] hover:bg-[#362216] border border-amber-500/25 text-amber-200 flex items-center gap-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Widok: {cameraView === 'follow' ? 'Śledź kulkę' : 'Cała mapa'}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-[#271910] hover:bg-[#362216] border border-amber-500/25 text-amber-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Transient Event Banner */}
        {statusBanner && (
          <div className="mx-auto rounded-xl bg-[#24160d]/95 border border-amber-400/40 px-4 py-1.5 text-xs sm:text-sm font-medium text-amber-100 shadow-lg">
            {statusBanner}
          </div>
        )}
      </header>
      )}

      <OfflineBanner />

      {/* Victory Overlay Card */}
      {winOverlay && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4 pointer-events-auto">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a110a] border border-emerald-400/50 p-6 text-center shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Trasa ukończona
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-amber-100">
              Brawo! Cel osiągnięty
            </h2>
            <p className="mt-1 text-sm text-stone-300">{winOverlay.routeLabel}</p>
            <div className="mt-4 py-3 rounded-xl bg-[#120b06] border border-amber-500/20">
              <div className="text-xs text-stone-400">Czas przejazdu</div>
              <div className="font-mono-tabular text-3xl font-bold text-amber-300 mt-0.5">
                {formatTime(winOverlay.timeMs)}
              </div>
              {bestTimeMs !== null && (
                <div className="text-xs text-stone-400 mt-1 font-mono-tabular">
                  Najlepszy czas: {formatTime(bestTimeMs)}
                </div>
              )}
            </div>
            <p className="mt-4 font-display text-lg font-bold text-amber-300">
              Bawimy się dalej kulami ?
            </p>
            <button
              type="button"
              onClick={drawNextRoute}
              className="mt-3 w-full min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-semibold text-sm transition-colors cursor-pointer"
            >
              Następna trasa (losuj)
            </button>
          </div>
        </div>
      )}

      {/* Out of Lives Overlay Card */}
      {outOfLives && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 pointer-events-auto">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a110a] border border-amber-500/45 p-6 text-center shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Wyczerpano 3 próby
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-stone-100">
              Kulka wpadła do pułapki
            </h2>
            <p className="mt-2 text-sm text-stone-300">
              Spróbuj jeszcze raz tej samej trasy lub wylosuj nowe wyzwanie w Powiecie Raciborskim.
            </p>
            <p className="mt-4 font-display text-lg font-bold text-amber-300">
              Bawimy się dalej kulami ?
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={resetCurrentRun}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm transition-colors cursor-pointer"
              >
                Powtórz trasę
              </button>
              <button
                type="button"
                onClick={drawNextRoute}
                className="flex-1 min-h-[44px] rounded-xl border border-amber-500/40 bg-[#26180f] hover:bg-[#332014] text-amber-200 font-medium text-sm transition-colors cursor-pointer"
              >
                Losuj nową
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Bottom-Left Control Dock (leaves bottom-center hole 15 Granica PL/CZ unobstructed) */}
      {!introActive && (
      <div className="fixed bottom-3 left-3 z-20 max-w-[54vw] sm:max-w-[440px] flex flex-col items-start pointer-events-none">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setDockCollapsed((c) => !c);
          }}
          className="pointer-events-auto mb-1.5 px-3 py-1.5 rounded-xl bg-[#18100a]/92 border border-amber-500/30 text-xs font-medium text-amber-200 hover:text-amber-100 flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Pokaż sterowanie</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Ukryj panel</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full rounded-2xl bg-[#18100a]/92 border border-amber-500/25 px-3 py-2 shadow-2xl flex flex-wrap items-center justify-start gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-[#100905] border border-amber-500/15">
              <button
                type="button"
                onClick={() => handleModeSwitch('single')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  mode === 'single'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-300 hover:text-stone-100'
                }`}
              >
                Trasa z A do B
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('courier3')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  mode === 'courier3'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-300 hover:text-stone-100'
                }`}
              >
                3 Kulki (Kurier)
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCenterLevel}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#2a1b11] hover:bg-[#382417] border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                title="Ustaw planszę płasko i wycentruj kamerę"
              >
                <Crosshair className="w-4 h-4 shrink-0" />
                <span>Centruj widok / Poziomuj</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  void handleCalibrate();
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#2a1b11] hover:bg-[#382417] border border-amber-400/35 text-amber-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                title="Wyzeruj kąt trzymania telefonu (żyroskop)"
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>Kalibruj poziom</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  drawNextRoute();
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#26180f] hover:bg-[#332014] border border-amber-500/25 text-stone-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Shuffle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Losuj trasę</span>
              </button>

              {mode === 'single' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShowRouteModal(true);
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#26180f] hover:bg-[#332014] border border-amber-500/25 text-stone-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Wybierz A/B</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  resetCurrentRun();
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#26180f] hover:bg-[#332014] border border-amber-500/25 text-stone-100 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0 text-stone-300" />
                <span>Restart</span>
              </button>

              <PWAInstallButton />
            </div>

            {/* Touch Thumb Arrow Pad (▲ ▼ ◄ ►) + Control hint */}
            <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-amber-500/15">
              <div className="grid grid-cols-3 gap-1 w-[132px] shrink-0 touch-none select-none">
                <div />
                <button
                  type="button"
                  aria-label="Przechyl w górę"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setVirtualAxis(-1, 0);
                  }}
                  onPointerUp={clearVirtualAxis}
                  onPointerLeave={clearVirtualAxis}
                  onPointerCancel={clearVirtualAxis}
                  className="min-h-[38px] rounded-lg bg-[#2a1b11] active:bg-amber-500 active:text-stone-950 border border-amber-400/35 text-amber-200 flex items-center justify-center cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <div />
                <button
                  type="button"
                  aria-label="Przechyl w lewo"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setVirtualAxis(0, -1);
                  }}
                  onPointerUp={clearVirtualAxis}
                  onPointerLeave={clearVirtualAxis}
                  onPointerCancel={clearVirtualAxis}
                  className="min-h-[38px] rounded-lg bg-[#2a1b11] active:bg-amber-500 active:text-stone-950 border border-amber-400/35 text-amber-200 flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Przechyl w dół"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setVirtualAxis(1, 0);
                  }}
                  onPointerUp={clearVirtualAxis}
                  onPointerLeave={clearVirtualAxis}
                  onPointerCancel={clearVirtualAxis}
                  className="min-h-[38px] rounded-lg bg-[#2a1b11] active:bg-amber-500 active:text-stone-950 border border-amber-400/35 text-amber-200 flex items-center justify-center cursor-pointer"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Przechyl w prawo"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setVirtualAxis(0, 1);
                  }}
                  onPointerUp={clearVirtualAxis}
                  onPointerLeave={clearVirtualAxis}
                  onPointerCancel={clearVirtualAxis}
                  className="min-h-[38px] rounded-lg bg-[#2a1b11] active:bg-amber-500 active:text-stone-950 border border-amber-400/35 text-amber-200 flex items-center justify-center cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col items-end text-right text-[10px] sm:text-[11px] text-stone-400 font-mono-tabular leading-tight">
                <span>Pinch / Kółko = Zoom</span>
                <span className="hidden sm:inline">WASD / Strzałki / Mysz</span>
                <span>
                  {tiltReadout.pitch.toFixed(0)}° / {tiltReadout.roll.toFixed(0)}°
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Collapsible Bottom-Right Target Town Info Bubble (Typewriter Effect) */}
      {!introActive && (
      <div className="fixed bottom-7 right-3 z-20 flex flex-col items-end pointer-events-none">
        {infoCollapsed ? (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setInfoCollapsed(false);
            }}
            className="pointer-events-auto px-3 py-1.5 rounded-xl bg-[#18100a]/92 border border-amber-500/35 text-xs font-medium text-amber-200 hover:text-amber-100 flex items-center gap-1.5 shadow-xl cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cel: {targetFact.title}</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="pointer-events-auto w-[41vw] min-w-[165px] max-w-[235px] sm:w-[270px] sm:max-w-none rounded-2xl bg-[#18100a]/94 border border-amber-500/35 px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-2xl">
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-amber-500/20">
              <div className="flex items-center gap-1.5 min-w-0">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider truncate">
                  Cel: {typedInfo.title || '…'}
                </span>
              </div>
              <button
                type="button"
                aria-label="Zwiń opis miejscowości"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setInfoCollapsed(true);
                }}
                className="p-1 rounded-lg hover:bg-[#2a1b11] text-amber-200/80 hover:text-amber-100 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[11px] sm:text-xs leading-snug">
              <div className="text-stone-200">
                <span className="text-stone-400">Powstanie:</span>{' '}
                <span className="font-medium">{typedInfo.era}</span>
              </div>
              <div className="text-stone-200">
                <span className="text-stone-400">Mieszkańcy:</span>{' '}
                <span className="font-medium">{typedInfo.population}</span>
              </div>
              <div className="text-emerald-300">
                <span className="text-stone-400">Do Starostwa w Raciborzu:</span>{' '}
                <span className="font-semibold">{typedInfo.distance}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Discrete Author Signature */}
      {!introActive && (
      <footer className="pointer-events-none fixed bottom-1 right-2.5 z-10 text-[10px] sm:text-[11px] text-stone-400/75 tracking-wide">
        Koncepcja i realizacja: Artur Wierzbicki
      </footer>
      )}

      {/* Route Picker Modal */}
      {showRouteModal && (
        <RoutePickerModal
          currentStartId={singleRoute.startId}
          currentTargetId={singleRoute.targetId}
          onApply={(startId, targetId) => {
            setSingleRoute({ startId, targetId });
            setAttemptsLeft(3);
            setElapsedMs(0);
            setTimerRunning(false);
            startTimeRef.current = null;
            setWinOverlay(null);
            setOutOfLives(false);
            setRunId((r) => r + 1);
          }}
          onClose={() => setShowRouteModal(false)}
        />
      )}
    </div>
  );
}
