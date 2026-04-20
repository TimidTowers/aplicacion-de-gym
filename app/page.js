'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Check, Trophy, Flame, Zap, Target, TrendingUp, RotateCcw, ChevronDown, ChevronUp,
  Info, Timer, Play, Pause, X, Plus, Minus, Dumbbell, Home, BarChart3, User,
  LogOut, Download, Upload, ArrowRight, Calendar, Activity, Settings, Sparkles,
  Lightbulb, CalendarPlus, Edit3, Copy, Trash2, Scale, Ruler, Heart, Flame as FlameIcon,
  GripVertical, Save, ChevronRight, Circle,
} from 'lucide-react';
import { ROUTINES, ROUTINE_LIST } from './data/routines';
import { loadRoot, saveRoot, emptyProfile } from './lib/storage';
import {
  bmi, bmiCategory, bodyFatPercent, bodyFatCategory, bmr, maintenance,
  idealWeight, leanMass, ffmi, ACTIVITY_LEVELS,
} from './lib/bodyMetrics';

// Mapeo nombre → componente icon
const ICONS = { Zap, Flame, Target, Dumbbell, Trophy, Activity };
const IconOf = (name) => ICONS[name] || Dumbbell;

const exerciseId = (dayKey, i) => `${dayKey}-${i}`;

// Límite superior del descanso — 5 minutos
const REST_MAX = 300;

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [root, setRoot] = useState({ profiles: {}, currentProfile: null });
  const [view, setView] = useState('home'); // home | workout | stats | profile
  const [expandedDay, setExpandedDay] = useState(null);
  const [showInfo, setShowInfo] = useState(null);
  const [weightModalOpen, setWeightModalOpen] = useState(null);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerTotal, setTimerTotal] = useState(0);
  const timerRef = useRef(null);

  // Modales / editores
  const [bodyEditorOpen, setBodyEditorOpen] = useState(false);
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [routineEditor, setRoutineEditor] = useState(null); // { mode: 'create'|'edit'|'duplicate', routine? }

  // Carga inicial
  useEffect(() => {
    setRoot(loadRoot());
    setMounted(true);
  }, []);

  const persist = (next) => { setRoot(next); saveRoot(next); };

  const profile = root.currentProfile ? root.profiles[root.currentProfile] : null;

  // Helper: busca la rutina en presets o en las custom del perfil
  const resolveRoutine = (p, id) => {
    if (!p) return null;
    if (ROUTINES[id]) return ROUTINES[id];
    return p.customRoutines?.[id] || null;
  };
  const routine = profile ? resolveRoutine(profile, profile.routineId) : null;

  // Lista combinada de rutinas disponibles para este perfil (presets + custom)
  const allRoutines = profile
    ? [...ROUTINE_LIST, ...Object.values(profile.customRoutines || {})]
    : ROUTINE_LIST;

  // Timer
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setTimeout(() => setTimerSeconds(s => s - 1), 1000);
    } else if (timerSeconds === 0 && timerRunning) {
      setTimerRunning(false);
      // Patrón de vibración fuerte: 3 pulsos largos
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 120, 300, 120, 300]);
      }
      playBeep();
    }
    return () => clearTimeout(timerRef.current);
  }, [timerRunning, timerSeconds]);

  // Beep final compuesto: 3 pitidos ascendentes (más reconocible)
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      const frequencies = [660, 880, 1320]; // Mi · La · Mi (octava)
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.45, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.start(start); osc.stop(start + 0.25);
      });
    } catch {}
  };

  const startTimer = (seconds) => {
    const capped = Math.min(REST_MAX, Math.max(0, seconds));
    setTimerTotal(capped);
    setTimerSeconds(capped);
    setTimerRunning(true);
  };
  const toggleTimer = () => {
    if (timerSeconds === 0) { setTimerSeconds(timerTotal); setTimerRunning(true); }
    else { setTimerRunning(r => !r); }
  };
  const closeTimer = () => { setTimerRunning(false); setTimerSeconds(0); setTimerTotal(0); };
  const addTimerSeconds = (delta) => {
    setTimerSeconds(s => Math.max(0, Math.min(REST_MAX, s + delta)));
    setTimerTotal(t => Math.max(0, Math.min(REST_MAX, t + delta)));
  };

  // Acciones sobre el perfil activo
  const updateProfile = (fn) => {
    if (!profile) return;
    const updated = fn({ ...profile });
    const next = { ...root, profiles: { ...root.profiles, [profile.name]: updated } };
    persist(next);
  };

  const toggleCheck = (dayKey, i) => {
    if (!profile || !routine) return;
    const key = exerciseId(dayKey, i);
    const wasChecked = !!profile.checks[key];
    updateProfile(p => {
      p.checks = { ...p.checks, [key]: !wasChecked };
      if (!wasChecked) p.totalCompleted = (p.totalCompleted || 0) + 1;
      return p;
    });
    if (!wasChecked) {
      // Feedback háptico sutil (solo al completar)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
      const ex = routine.days[dayKey].exercises[i];
      if (ex.rest > 0) startTimer(ex.rest);
    }
  };

  const saveWeight = (key, weight) => {
    if (!profile) return;
    const w = parseFloat(weight);
    if (isNaN(w)) return;
    updateProfile(p => {
      const existing = p.weights[key] || [];
      const filtered = existing.filter(e => e.week !== p.week);
      const entry = { week: p.week, weight: w, date: new Date().toISOString() };
      p.weights = { ...p.weights, [key]: [...filtered, entry].sort((a, b) => a.week - b.week) };
      return p;
    });
  };

  const resetWeek = () => {
    if (!profile || !routine) return;
    if (!window.confirm('¿Empezar nueva semana? Se guardará el progreso de pesos y se reiniciarán los checks.')) return;
    updateProfile(p => {
      const totalDays = Object.keys(routine.days).length;
      const completedDays = Object.keys(routine.days).filter(dk => {
        const exs = routine.days[dk].exercises;
        return exs.every((_, i) => p.checks[exerciseId(dk, i)]);
      }).length;
      if (completedDays === totalDays) {
        p.streak = (p.streak || 0) + 1;
        p.history = [...(p.history || []), { week: p.week, completedAt: new Date().toISOString(), routineId: p.routineId }];
      }
      p.week = (p.week || 1) + 1;
      p.checks = {};
      return p;
    });
  };

  const switchRoutine = (routineId) => {
    if (!profile) return;
    updateProfile(p => { p.routineId = routineId; p.checks = {}; return p; });
    setView('workout');
    setExpandedDay(null);
  };

  // Body ──────────────────────────────────────────────
  const saveBody = (data) => {
    updateProfile(p => {
      p.body = { ...(p.body || {}), ...data };
      return p;
    });
  };

  const saveMeasurement = ({ weight, bodyFat }) => {
    updateProfile(p => {
      const body = p.body || { measurements: [] };
      const measurements = [...(body.measurements || [])];
      const idx = measurements.findIndex(m => m.week === p.week);
      const entry = {
        week: p.week,
        date: new Date().toISOString(),
        weight: parseFloat(weight),
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      };
      if (idx >= 0) measurements[idx] = entry; else measurements.push(entry);
      measurements.sort((a, b) => a.week - b.week);
      p.body = { ...body, measurements };
      return p;
    });
  };

  // Custom routines ───────────────────────────────────
  const saveCustomRoutine = (routineObj) => {
    updateProfile(p => {
      p.customRoutines = { ...(p.customRoutines || {}), [routineObj.id]: routineObj };
      return p;
    });
  };

  const deleteCustomRoutine = (routineId) => {
    if (!profile) return;
    const r = profile.customRoutines?.[routineId];
    if (!r) return;
    if (!window.confirm(`¿Eliminar la rutina "${r.name}"? Se borrarán también los pesos registrados asociados.`)) return;
    updateProfile(p => {
      const custom = { ...(p.customRoutines || {}) };
      delete custom[routineId];
      p.customRoutines = custom;
      // Si era la activa, vuelve a un preset
      if (p.routineId === routineId) {
        p.routineId = 'ppl';
        p.checks = {};
      }
      return p;
    });
  };

  const createProfile = (name, routineId) => {
    const clean = name.trim();
    if (!clean) return;
    const next = {
      ...root,
      profiles: { ...root.profiles, [clean]: emptyProfile(clean, routineId) },
      currentProfile: clean,
    };
    persist(next);
    setView('home');
  };

  const switchProfile = (name) => {
    persist({ ...root, currentProfile: name });
    setView('home');
  };

  const logout = () => {
    persist({ ...root, currentProfile: null });
    setView('home');
  };

  const deleteProfile = (name) => {
    if (!window.confirm(`¿Eliminar el perfil "${name}" y todos sus datos?`)) return;
    const next = { ...root, profiles: { ...root.profiles } };
    delete next.profiles[name];
    if (next.currentProfile === name) next.currentProfile = null;
    persist(next);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-stone-950" role="status" aria-label="Cargando">
        <div className="max-w-4xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <div className="h-4 w-32 bg-stone-900 rounded-full animate-pulse mb-3" />
          <div className="h-14 w-64 bg-stone-900 rounded-lg animate-pulse mb-6" />
          <div className="h-20 bg-stone-900 rounded-2xl animate-pulse mb-4" />
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="h-20 bg-stone-900 rounded-2xl animate-pulse" />
            <div className="h-20 bg-stone-900 rounded-2xl animate-pulse" />
            <div className="h-20 bg-stone-900 rounded-2xl animate-pulse" />
          </div>
          <div className="h-32 bg-stone-900 rounded-3xl animate-pulse mb-3" />
          <div className="h-16 bg-stone-900 rounded-2xl animate-pulse mb-2" />
          <div className="h-16 bg-stone-900 rounded-2xl animate-pulse mb-2" />
          <div className="h-16 bg-stone-900 rounded-2xl animate-pulse" />
        </div>
        <span className="sr-only">Cargando Gym Tracker…</span>
      </div>
    );
  }

  // Sin perfil → pantalla de bienvenida
  if (!profile) {
    return <WelcomeScreen root={root} onCreate={createProfile} onSelect={switchProfile} onDelete={deleteProfile} />;
  }

  // Cálculos para la vista
  const dayKeys = Object.keys(routine.days);
  const getDayProgress = (dk) => {
    const exs = routine.days[dk].exercises;
    const completed = exs.filter((_, i) => profile.checks[exerciseId(dk, i)]).length;
    return { completed, total: exs.length, percent: (completed / exs.length) * 100 };
  };
  const isDayComplete = (dk) => {
    const { completed, total } = getDayProgress(dk);
    return completed === total;
  };
  const totalProgress = dayKeys.reduce((a, dk) => a + getDayProgress(dk).completed, 0);
  const totalExercises = dayKeys.reduce((a, dk) => a + routine.days[dk].exercises.length, 0);
  const weekPercent = totalExercises > 0 ? (totalProgress / totalExercises) * 100 : 0;
  const daysCompleted = dayKeys.filter(isDayComplete).length;

  return (
    <main id="main" className="min-h-screen bg-stone-950 text-stone-100 pb-24" style={{ minHeight: '100dvh' }}>
      <div key={view} className="view-enter">
      {/* Contenido según vista */}
      {view === 'home' && (
        <HomeView
          profile={profile}
          routine={routine}
          weekPercent={weekPercent}
          daysCompleted={daysCompleted}
          totalDays={dayKeys.length}
          totalProgress={totalProgress}
          totalExercises={totalExercises}
          onStartDay={(dk) => { setExpandedDay(dk); setView('workout'); }}
          onResetWeek={resetWeek}
          onChangeRoutine={() => setView('profile')}
          getDayProgress={getDayProgress}
          isDayComplete={isDayComplete}
        />
      )}

      {view === 'workout' && (
        <WorkoutView
          profile={profile}
          routine={routine}
          expandedDay={expandedDay}
          setExpandedDay={setExpandedDay}
          showInfo={showInfo}
          setShowInfo={setShowInfo}
          onToggleCheck={toggleCheck}
          onOpenWeight={setWeightModalOpen}
          onStartTimer={startTimer}
          getDayProgress={getDayProgress}
          isDayComplete={isDayComplete}
          onResetWeek={resetWeek}
          weekPercent={weekPercent}
        />
      )}

      {view === 'stats' && (
        <StatsView profile={profile} routine={routine} />
      )}

      {view === 'profile' && (
        <ProfileView
          profile={profile}
          root={root}
          allRoutines={allRoutines}
          onSwitchRoutine={switchRoutine}
          onSwitchProfile={switchProfile}
          onDeleteProfile={deleteProfile}
          onLogout={logout}
          onNewProfile={() => persist({ ...root, currentProfile: null })}
          onOpenBodyEditor={() => setBodyEditorOpen(true)}
          onOpenMeasurementModal={() => setMeasurementModalOpen(true)}
          onOpenRoutineEditor={(mode, r) => setRoutineEditor({ mode, routine: r })}
          onDeleteCustomRoutine={deleteCustomRoutine}
        />
      )}

      </div>

      {/* Bottom nav */}
      <BottomNav view={view} setView={setView} />

      {/* Rest timer */}
      {timerTotal > 0 && (
        <RestTimer
          timerSeconds={timerSeconds}
          timerTotal={timerTotal}
          timerRunning={timerRunning}
          onClose={closeTimer}
          onToggle={toggleTimer}
          onAdd={addTimerSeconds}
        />
      )}

      {/* Weight modal */}
      {/* Body editor */}
      {bodyEditorOpen && (
        <BodyEditorModal
          body={profile.body || {}}
          onSave={(data) => { saveBody(data); setBodyEditorOpen(false); }}
          onClose={() => setBodyEditorOpen(false)}
        />
      )}

      {/* Measurement modal (registro semanal) */}
      {measurementModalOpen && (
        <MeasurementModal
          profile={profile}
          onSave={(data) => { saveMeasurement(data); setMeasurementModalOpen(false); }}
          onClose={() => setMeasurementModalOpen(false)}
        />
      )}

      {/* Routine editor */}
      {routineEditor && (
        <RoutineEditorModal
          mode={routineEditor.mode}
          initial={routineEditor.routine}
          existingIds={new Set([...Object.keys(ROUTINES), ...Object.keys(profile.customRoutines || {})])}
          onSave={(r) => {
            saveCustomRoutine(r);
            setRoutineEditor(null);
            // Si fue crear/duplicar, cambia a esa rutina
            if (routineEditor.mode !== 'edit') switchRoutine(r.id);
          }}
          onClose={() => setRoutineEditor(null)}
        />
      )}

      {weightModalOpen && (() => {
        const [dk, idxStr] = weightModalOpen.split('-');
        const i = parseInt(idxStr);
        const ex = routine.days[dk]?.exercises[i];
        if (!ex) return null;
        return (
          <WeightModal
            exercise={ex}
            history={profile.weights[weightModalOpen] || []}
            currentWeek={profile.week}
            onSave={(w) => { saveWeight(weightModalOpen, w); setWeightModalOpen(null); }}
            onClose={() => setWeightModalOpen(null)}
          />
        );
      })()}
    </main>
  );
}

/* ─────────────────────── WELCOME SCREEN ─────────────────────── */
function WelcomeScreen({ root, onCreate, onSelect, onDelete }) {
  const [name, setName] = useState('');
  const [routineId, setRoutineId] = useState('ppl');
  const profiles = Object.values(root.profiles);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100" style={{ minHeight: '100dvh' }}>
      <div className="relative overflow-hidden border-b border-stone-800">
        <div className="bg-orbs opacity-40" aria-hidden="true" />
        <div className="relative max-w-2xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+3rem)] pb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-stone-900/60 border border-stone-800 rounded-full px-3 py-1.5 mb-6">
            <Sparkles size={12} className="text-orange-400" aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-[0.25em] text-stone-400">GYM TRACKER</span>
          </div>
          <h1 className="font-display text-6xl md:text-7xl font-black uppercase mb-4" style={{ letterSpacing: '-0.02em', lineHeight: 0.95 }}>
            Monitorea<br />tu <span className="gradient-text animate-popIn inline-block">progreso</span>
          </h1>
          <p className="text-stone-400 max-w-md mx-auto text-base md:text-lg leading-relaxed">
            Rutinas predefinidas, registro de series, peso y descansos. Sin login — tus datos viven en tu navegador.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        {profiles.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">TUS PERFILES</h2>
            <div className="space-y-2 stagger">
              {profiles.map((p) => {
                const r = ROUTINES[p.routineId];
                return (
                  <div key={p.name} className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                      <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{p.name}</div>
                      <div className="text-xs text-stone-500">
                        {r ? r.name : 'Sin rutina'} · Semana {p.week || 1} · Racha {p.streak || 0}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelect(p.name)}
                      className="btn-cta px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 text-white"
                      aria-label={`Entrar como ${p.name}`}
                    >
                      Entrar <ArrowRight size={14} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onDelete(p.name)}
                      className="tap text-stone-500 hover:text-red-400 transition-colors rounded-lg"
                      aria-label={`Eliminar perfil ${p.name}`}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="bg-stone-900 border border-stone-800 rounded-3xl p-5">
          <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-4">
            {profiles.length > 0 ? 'CREAR OTRO PERFIL' : 'EMPIEZA AQUÍ'}
          </h2>

          <label className="block mb-3">
            <span className="text-xs text-stone-400 font-semibold">Nombre</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre o alias"
              className="w-full mt-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
            />
          </label>

          <div className="mb-4">
            <div className="text-xs text-stone-400 font-semibold mb-2">Elige tu rutina</div>
            <div className="grid gap-2 stagger">
              {ROUTINE_LIST.map(r => {
                const Icon = IconOf(r.icon);
                const selected = r.id === routineId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRoutineId(r.id)}
                    className={`text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                      selected
                        ? 'bg-stone-950 border-orange-500/50 ring-2 ring-orange-500/20'
                        : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.accent} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{r.name}</div>
                      <div className="text-xs text-stone-500 truncate">{r.tagline}</div>
                    </div>
                    {selected && <Check size={18} className="text-orange-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onCreate(name, routineId)}
            disabled={!name.trim()}
            className="btn-cta w-full py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            Crear perfil y empezar <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>

        <p className="text-center text-xs text-stone-600 px-4 pb-8">
          Privacidad total: todo se guarda en <span className="text-stone-400 font-mono">localStorage</span> de tu navegador. No subimos nada a ningún servidor.
        </p>
      </div>
    </main>
  );
}

/* ─────────────────────── HOME VIEW ─────────────────────── */
function HomeView({ profile, routine, weekPercent, daysCompleted, totalDays, totalProgress, totalExercises, onStartDay, onResetWeek, onChangeRoutine, getDayProgress, isDayComplete }) {
  const dayKeys = Object.keys(routine.days);
  const nextDay = dayKeys.find(dk => !isDayComplete(dk)) || dayKeys[0];
  const RoutineIcon = IconOf(routine.icon);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border-b border-stone-800">
        <div className="bg-orbs opacity-30" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.3em] text-orange-400 mb-1">{greeting.toUpperCase()}</div>
              <h1 className="name-heading text-5xl md:text-6xl truncate">
                {profile.name}
              </h1>
            </div>
            <button
              onClick={onResetWeek}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-stone-800 hover:bg-stone-700 transition-colors border border-stone-700 flex-shrink-0 min-h-[44px]"
              aria-label="Empezar nueva semana"
              title="Nueva semana"
            >
              <CalendarPlus size={16} aria-hidden="true" />
              <span className="text-xs font-bold tracking-wider hidden sm:inline">NUEVA SEMANA</span>
              <span className="text-xs font-bold tracking-wider sm:hidden">NUEVA</span>
            </button>
          </div>

          <button
            onClick={onChangeRoutine}
            className="card-interactive w-full text-left bg-stone-900/60 backdrop-blur border border-stone-800 rounded-2xl p-4 mt-4 flex items-center gap-3"
            aria-label={`Rutina activa: ${routine.name}. Cambiar rutina.`}
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${routine.accent} flex items-center justify-center flex-shrink-0 shadow-glow`}>
              <RoutineIcon size={20} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold tracking-[0.2em] text-stone-500">RUTINA ACTIVA</div>
              <div className="font-display text-xl font-bold truncate uppercase">{routine.name}</div>
              <div className="text-xs text-stone-500 truncate">{routine.tagline}</div>
            </div>
            <ChevronDown size={16} className="text-stone-500 -rotate-90" aria-hidden="true" />
          </button>

          <div className="grid grid-cols-3 gap-3 mt-4 stagger">
            <StatCard label="SEMANA" value={`${Math.round(weekPercent)}%`} icon={TrendingUp} />
            <StatCard label="RACHA" value={profile.streak || 0} unit="sem" icon={Flame} iconColor="text-orange-400" />
            <StatCard label="TOTAL" value={profile.totalCompleted || 0} icon={Trophy} iconColor="text-yellow-400" />
          </div>

          <div className="mt-4">
            <div className="h-2 bg-stone-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(weekPercent)} aria-valuemin="0" aria-valuemax="100" aria-label="Progreso semanal">
              <div
                className="progress-fill h-full bg-gradient-to-r from-orange-500 via-pink-500 to-cta-500"
                style={{ width: `${weekPercent}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-stone-500 font-mono">
              <span>Semana {profile.week}</span>
              <span>{totalProgress}/{totalExercises} ejercicios</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {/* Próximo entrenamiento */}
        <section>
          <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">PRÓXIMO ENTRENAMIENTO</h2>
          <button
            onClick={() => onStartDay(nextDay)}
            className="card-interactive w-full text-left bg-stone-900 border border-stone-800 rounded-3xl p-5 animate-fadeIn"
            aria-label={`Empezar entrenamiento: ${routine.days[nextDay].name}`}
          >
            {(() => {
              const d = routine.days[nextDay];
              const DIcon = IconOf(d.iconName);
              const prog = getDayProgress(nextDay);
              return (
                <>
                  <div className="flex items-start gap-4 mb-3">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${d.color} flex items-center justify-center flex-shrink-0 shadow-glow`}>
                      <DIcon size={26} className="text-white" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.25em] text-cta-500 mb-0.5">HOY</div>
                      <div className="font-display text-2xl font-black uppercase tracking-display">{d.name}</div>
                      <div className="text-sm text-stone-400">{d.focus}</div>
                    </div>
                    <div className="flex-shrink-0 tap bg-cta-500 rounded-xl text-white shadow-glow-cta">
                      <Play size={18} fill="currentColor" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${d.color} progress-fill`}
                        style={{ width: `${prog.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-500 font-mono">{prog.completed}/{prog.total}</span>
                  </div>
                </>
              );
            })()}
          </button>
        </section>

        {/* Lista de días */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500">SEMANA COMPLETA</h2>
            <span className="text-xs text-stone-500">{daysCompleted}/{totalDays} días</span>
          </div>
          <div className="grid gap-2 stagger">
            {dayKeys.map(dk => {
              const d = routine.days[dk];
              const DIcon = IconOf(d.iconName);
              const prog = getDayProgress(dk);
              const done = isDayComplete(dk);
              return (
                <button
                  key={dk}
                  onClick={() => onStartDay(dk)}
                  className={`card-interactive text-left bg-stone-900 border rounded-2xl p-4 flex items-center gap-3 ${done ? 'border-cta-500/40' : 'border-stone-800'}`}
                  aria-label={`${d.name}: ${d.focus}. ${prog.completed} de ${prog.total} ejercicios completados${done ? '. Completado.' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center flex-shrink-0`}>
                    <DIcon size={18} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-base uppercase tracking-tight flex items-center gap-2">
                      {d.name}
                      {done && <span className="text-[9px] bg-cta-500/20 text-cta-400 px-1.5 py-0.5 rounded-full tracking-widest font-bold">HECHO</span>}
                    </div>
                    <div className="text-xs text-stone-500 truncate">{d.focus}</div>
                  </div>
                  <div className="stat-number text-sm text-stone-500 flex-shrink-0">{prog.completed}/{prog.total}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value, unit, icon: Icon, iconColor = 'text-stone-400' }) {
  return (
    <div className="bg-stone-900/60 backdrop-blur border border-stone-800 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-semibold tracking-wider mb-1">
        {Icon && <Icon size={12} className={iconColor} aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <div className="stat-number text-3xl text-white">
        {value}
        {unit && <span className="text-xs text-stone-500 font-normal ml-1 tracking-normal">{unit}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────── WORKOUT VIEW ─────────────────────── */
function WorkoutView({ profile, routine, expandedDay, setExpandedDay, showInfo, setShowInfo, onToggleCheck, onOpenWeight, onStartTimer, getDayProgress, isDayComplete, onResetWeek, weekPercent }) {
  const dayKeys = Object.keys(routine.days);
  const RoutineIcon = IconOf(routine.icon);

  return (
    <>
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border-b border-stone-800">
        <div className="bg-orbs opacity-20" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${routine.accent} flex items-center justify-center flex-shrink-0 shadow-glow`}>
                <RoutineIcon size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-[0.25em] text-stone-500">SEMANA {profile.week}</div>
                <div className="font-display text-xl font-black uppercase tracking-tight truncate">{routine.name}</div>
              </div>
            </div>
            <button
              onClick={onResetWeek}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-700 flex-shrink-0 min-h-[44px]"
              aria-label="Empezar nueva semana"
            >
              <CalendarPlus size={14} aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-wider hidden sm:inline">NUEVA</span>
            </button>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(weekPercent)} aria-valuemin="0" aria-valuemax="100">
            <div
              className="progress-fill h-full bg-gradient-to-r from-orange-500 via-pink-500 to-cta-500"
              style={{ width: `${weekPercent}%` }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-4 space-y-3 stagger">
        {dayKeys.map(dayKey => {
          const day = routine.days[dayKey];
          const DIcon = IconOf(day.iconName);
          const { completed, total, percent } = getDayProgress(dayKey);
          const complete = isDayComplete(dayKey);
          const isExpanded = expandedDay === dayKey;

          return (
            <div
              key={dayKey}
              className={`bg-stone-900 border rounded-3xl overflow-hidden transition-colors ${complete ? 'border-cta-500/50' : 'border-stone-800'}`}
            >
              <button
                onClick={() => setExpandedDay(isExpanded ? null : dayKey)}
                className="w-full p-5 text-left hover:bg-stone-900/50 transition-colors"
                aria-expanded={isExpanded}
                aria-controls={`panel-${dayKey}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${day.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <DIcon size={22} className="text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h2 className="font-display text-xl font-black uppercase tracking-display">{day.name}</h2>
                      {complete && (
                        <div className="px-2 py-0.5 bg-cta-500/20 text-cta-400 text-[10px] font-bold rounded-full tracking-widest">
                          HECHO
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-stone-400 mb-2">{day.focus}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin="0" aria-valuemax="100">
                        <div className={`h-full bg-gradient-to-r ${day.color} progress-fill`} style={{ width: `${percent}%` }} />
                      </div>
                      <span className="stat-number text-sm text-stone-500 flex-shrink-0">{completed}/{total}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 pt-1">
                    {isExpanded ? <ChevronUp size={20} className="text-stone-500" aria-hidden="true" /> : <ChevronDown size={20} className="text-stone-500" aria-hidden="true" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div id={`panel-${dayKey}`} className="px-5 pb-5 space-y-2 animate-fadeIn stagger">
                  {day.hint && (
                    <div className="mb-3 p-3 bg-stone-950 rounded-xl border-l-2 border-orange-500">
                      <div className="text-[10px] font-bold text-orange-400 tracking-[0.25em] mb-0.5">ENFOQUE</div>
                      <div className="text-sm text-stone-300">{day.hint}</div>
                    </div>
                  )}

                  {day.exercises.map((ex, i) => {
                    const key = exerciseId(dayKey, i);
                    const checked = !!profile.checks[key];
                    const infoKey = `info-${key}`;
                    const isInfoOpen = showInfo === infoKey;
                    const history = profile.weights[key] || [];
                    const last = history[history.length - 1] || null;
                    const trend = history.length >= 2
                      ? (history[history.length - 1].weight > history[history.length - 2].weight ? 'up'
                        : history[history.length - 1].weight < history[history.length - 2].weight ? 'down' : 'same')
                      : null;

                    return (
                      <div
                        key={i}
                        className={`rounded-2xl border transition-all ${checked ? 'bg-stone-950/50 border-stone-800 opacity-60' : 'bg-stone-950 border-stone-800 hover:border-stone-700'}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => onToggleCheck(dayKey, i)}
                            className={`tap rounded-lg flex-shrink-0 transition-[background-color,border-color,box-shadow] duration-200 ${
                              checked ? `bg-gradient-to-br ${day.color} shadow-lg` : 'bg-stone-900 border-2 border-stone-700 hover:border-stone-500'
                            }`}
                            aria-label={`${checked ? 'Desmarcar' : 'Marcar'} ${ex.name} como completado`}
                            aria-pressed={checked}
                          >
                            {checked && <Check size={18} className="text-white animate-checkPop" strokeWidth={3} aria-hidden="true" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm leading-tight ${checked ? 'line-through text-stone-500' : 'text-stone-100'}`}>
                              {ex.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="stat-number text-sm text-stone-400">
                                {ex.sets} <span className="text-stone-600">×</span> {ex.reps}
                              </span>
                              {ex.rest > 0 && (
                                <span className="text-[10px] stat-number text-stone-600 flex items-center gap-0.5">
                                  <Timer size={9} aria-hidden="true" />{ex.rest}s
                                </span>
                              )}
                              {last && (
                                <span className={`text-[10px] stat-number px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  trend === 'up' ? 'bg-cta-500/20 text-cta-400' :
                                  trend === 'down' ? 'bg-red-500/20 text-red-300' :
                                  'bg-stone-800 text-stone-400'
                                }`}>
                                  {trend === 'up' && '↑'}{trend === 'down' && '↓'}{last.weight}kg
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {ex.trackWeight && (
                              <button
                                onClick={() => onOpenWeight(key)}
                                className="tap rounded-lg hover:bg-stone-800 hover:text-orange-400 text-stone-500 transition-colors"
                                aria-label={`Registrar peso de ${ex.name}`}
                              >
                                <Dumbbell size={16} aria-hidden="true" />
                              </button>
                            )}
                            {ex.rest > 0 && (
                              <button
                                onClick={() => onStartTimer(ex.rest)}
                                className="tap rounded-lg hover:bg-stone-800 hover:text-orange-400 text-stone-500 transition-colors"
                                aria-label={`Iniciar descanso de ${ex.rest} segundos`}
                              >
                                <Timer size={16} aria-hidden="true" />
                              </button>
                            )}
                            {ex.note && (
                              <button
                                onClick={() => setShowInfo(isInfoOpen ? null : infoKey)}
                                className="tap rounded-lg hover:bg-stone-800 hover:text-orange-400 text-stone-500 transition-colors"
                                aria-label={`Ver nota de ${ex.name}`}
                                aria-expanded={isInfoOpen}
                              >
                                <Info size={16} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                        {isInfoOpen && ex.note && (
                          <div className="px-4 pb-4 pl-14 animate-fadeIn">
                            <div className="text-xs text-stone-400 bg-stone-900 rounded-lg p-3 border border-stone-800 flex items-start gap-2">
                              <Lightbulb size={14} className="text-orange-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                              <span>{ex.note}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─────────────────────── STATS VIEW ─────────────────────── */
function StatsView({ profile, routine }) {
  const dayKeys = Object.keys(routine.days);
  const totalExercises = dayKeys.reduce((a, dk) => a + routine.days[dk].exercises.length, 0);
  const completedThisWeek = Object.values(profile.checks).filter(Boolean).length;

  // Agrupa ejercicios con peso registrado
  const trackedExercises = [];
  for (const dk of dayKeys) {
    routine.days[dk].exercises.forEach((ex, i) => {
      const key = exerciseId(dk, i);
      const history = profile.weights[key];
      if (history && history.length > 0) {
        const first = history[0].weight;
        const last = history[history.length - 1].weight;
        const change = first > 0 ? ((last - first) / first) * 100 : 0;
        const max = Math.max(...history.map(h => h.weight));
        trackedExercises.push({ name: ex.name, day: routine.days[dk].name, history, change, max, last });
      }
    });
  }
  trackedExercises.sort((a, b) => b.change - a.change);

  return (
    <>
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border-b border-stone-800">
        <div className="bg-orbs opacity-20" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-5">
          <div className="text-[11px] font-bold tracking-[0.3em] text-violet-400 mb-1">ESTADÍSTICAS</div>
          <h1 className="font-display text-4xl font-black uppercase" style={{ letterSpacing: '-0.02em' }}>Tu progreso</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        <section className="grid grid-cols-2 gap-3 stagger">
          <StatBig label="Racha" value={profile.streak || 0} unit="semanas" gradient="from-orange-500 to-red-600" icon={Flame} />
          <StatBig label="Semana actual" value={profile.week || 1} unit="" gradient="from-violet-500 to-purple-600" icon={Calendar} />
          <StatBig label="Ejercicios totales" value={profile.totalCompleted || 0} unit="completados" gradient="from-emerald-500 to-teal-600" icon={Trophy} />
          <StatBig label="Esta semana" value={`${completedThisWeek}/${totalExercises}`} unit="" gradient="from-sky-500 to-blue-600" icon={Activity} />
        </section>

        {trackedExercises.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">PROGRESO DE PESO</h2>
            <div className="space-y-2">
              {trackedExercises.map((ex, idx) => (
                <div key={idx} className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{ex.name}</div>
                      <div className="text-xs text-stone-500">{ex.day}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-black font-mono">{ex.last}<span className="text-xs text-stone-500">kg</span></div>
                        <div className={`text-[10px] font-mono ${ex.change > 0 ? 'text-emerald-400' : ex.change < 0 ? 'text-red-400' : 'text-stone-500'}`}>
                          {ex.change > 0 ? '+' : ''}{ex.change.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <MiniChart history={ex.history} />
                </div>
              ))}
            </div>
          </section>
        )}

        {profile.history && profile.history.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">SEMANAS COMPLETADAS</h2>
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2">
              {[...profile.history].reverse().map((h, i) => {
                const r = ROUTINES[h.routineId];
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0">
                    <div>
                      <div className="text-sm font-bold">Semana {h.week}</div>
                      <div className="text-xs text-stone-500">{r?.name || h.routineId}</div>
                    </div>
                    <div className="text-xs text-stone-500">{new Date(h.completedAt).toLocaleDateString()}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {trackedExercises.length === 0 && (!profile.history || profile.history.length === 0) && (
          <div className="text-center py-12 text-stone-500">
            <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aún no hay datos suficientes.</p>
            <p className="text-xs mt-1">Registra pesos y completa entrenamientos para ver tu progreso.</p>
          </div>
        )}
      </div>
    </>
  );
}

function StatBig({ label, value, unit, gradient, icon: Icon }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="text-[11px] text-stone-500 font-bold tracking-[0.2em] mb-1">{label.toUpperCase()}</div>
      <div className="stat-number text-3xl text-white">
        {value}
        {unit && <span className="text-xs text-stone-500 font-normal ml-1.5 tracking-normal">{unit}</span>}
      </div>
    </div>
  );
}

// Line chart con fill (area) — recomendación del skill para Trend Over Time.
function MiniChart({ history }) {
  if (!history || history.length === 0) return null;
  const W = 100, H = 40;
  if (history.length === 1) {
    return (
      <div className="flex items-center gap-2 h-10 mt-2">
        <div className="flex-1 h-px bg-stone-800" />
        <div className="w-2 h-2 rounded-full bg-orange-500" aria-hidden="true" />
        <span className="stat-number text-xs text-stone-500">{history[0].weight}kg</span>
      </div>
    );
  }
  const max = Math.max(...history.map(h => h.weight));
  const min = Math.min(...history.map(h => h.weight));
  const range = Math.max(1, max - min);
  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - ((h.weight - min) / range) * (H - 8) - 4;
    return [x, y];
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const tableId = `chart-data-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-10 mt-2 overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={tableId}
      >
        <title id={tableId}>Evolución del peso: {history.map(h => `Semana ${h.week} ${h.weight}kg`).join(', ')}</title>
        <defs>
          <linearGradient id={`grad-${tableId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${tableId})`} />
        <path d={linePath} fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="1.8" fill="#F97316" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {/* Data table para accesibilidad (oculta visualmente) */}
      <table className="sr-only">
        <caption>Progresión de peso</caption>
        <thead><tr><th scope="col">Semana</th><th scope="col">Peso (kg)</th></tr></thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={i}><td>{h.week}</td><td>{h.weight}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ─────────────────────── PROFILE VIEW ─────────────────────── */
function ProfileView({ profile, root, allRoutines, onSwitchRoutine, onSwitchProfile, onDeleteProfile, onLogout, onNewProfile, onOpenBodyEditor, onOpenMeasurementModal, onOpenRoutineEditor, onDeleteCustomRoutine }) {
  const profiles = Object.values(root.profiles);
  const currentRoutineId = profile.routineId;
  const body = profile.body || {};
  const measurements = body.measurements || [];
  const thisWeekMeasurement = measurements.find(m => m.week === profile.week);
  const lastMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const currentWeight = lastMeasurement?.weight;
  const bmiValue = bmi(currentWeight, body.height);
  const bmiCat = bmiCategory(bmiValue);
  const bfValue = bodyFatPercent(currentWeight, body.height, body.age, body.sex);
  const bfCat = bodyFatCategory(bfValue, body.sex);
  const bmrValue = bmr(currentWeight, body.height, body.age, body.sex);
  const maintenanceValue = maintenance(bmrValue, body.activity || 1.55);
  const lean = leanMass(currentWeight, bfValue);
  const ffmiValue = ffmi(lean, body.height);
  const idealW = idealWeight(body.height, body.sex);
  const hasBodyData = !!(body.height && body.age && body.sex);

  const exportData = () => {
    const data = JSON.stringify(root, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.profiles) throw new Error('Formato inválido');
        localStorage.setItem('gym-tracker-v1', ev.target.result);
        window.location.reload();
      } catch (err) {
        alert('Archivo inválido: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border-b border-stone-800">
        <div className="bg-orbs opacity-20" aria-hidden="true" />
        <div className="relative max-w-4xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-glow animate-popIn">
              <User size={26} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="name-heading text-3xl truncate">{profile.name}</h1>
              <div className="text-xs text-stone-500">
                Semana {profile.week} · Racha {profile.streak || 0} · {profile.totalCompleted || 0} ejercicios
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {/* ── CUERPO ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500">CUERPO</h2>
            <button
              onClick={onOpenBodyEditor}
              className="text-[11px] font-bold tracking-wider text-orange-400 hover:text-orange-300 flex items-center gap-1 min-h-[32px]"
            >
              <Edit3 size={12} aria-hidden="true" />
              {hasBodyData ? 'EDITAR' : 'CONFIGURAR'}
            </button>
          </div>

          {!hasBodyData ? (
            <button
              onClick={onOpenBodyEditor}
              className="w-full text-left bg-stone-900 border border-dashed border-stone-700 rounded-2xl p-5 hover:border-orange-500/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
                  <Scale size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-display text-lg font-bold uppercase">Registra tus datos</div>
                  <div className="text-xs text-stone-400">Para ver BMI, % grasa, BMR y calorías</div>
                </div>
              </div>
              <div className="text-xs text-stone-500">Todo opcional · se guarda solo en tu navegador</div>
            </button>
          ) : (
            <div className="space-y-3">
              {/* Resumen datos base */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
                <div className="grid grid-cols-3 gap-3">
                  <InfoCell label="ALTURA" value={body.height} unit="cm" />
                  <InfoCell label="EDAD" value={body.age} unit="años" />
                  <InfoCell label="SEXO" value={body.sex === 'male' ? 'H' : body.sex === 'female' ? 'M' : '—'} />
                </div>
              </div>

              {/* Registro semanal */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.2em] text-stone-500">SEMANA {profile.week}</div>
                    <div className="font-display text-lg font-bold">
                      {thisWeekMeasurement
                        ? <span>{thisWeekMeasurement.weight}<span className="text-sm text-stone-500">kg</span></span>
                        : <span className="text-stone-500">Sin registro</span>}
                    </div>
                  </div>
                  <button
                    onClick={onOpenMeasurementModal}
                    className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    {thisWeekMeasurement ? <><Edit3 size={14} aria-hidden="true" />ACTUALIZAR</> : <><Plus size={14} aria-hidden="true" />REGISTRAR</>}
                  </button>
                </div>

                {measurements.length >= 2 && (
                  <BodyWeightChart measurements={measurements} />
                )}
              </div>

              {/* Métricas calculadas */}
              {currentWeight && (
                <div className="grid grid-cols-2 gap-2">
                  {bmiValue != null && (
                    <MetricCard
                      label="BMI"
                      value={bmiValue.toFixed(1)}
                      unit=""
                      tag={bmiCat?.label}
                      tagColor={bmiCat?.color}
                      tagBg={bmiCat?.bg}
                      icon={Activity}
                    />
                  )}
                  {bfValue != null && (
                    <MetricCard
                      label="% GRASA"
                      value={bfValue.toFixed(1)}
                      unit="%"
                      tag={bfCat?.label}
                      tagColor={bfCat?.color}
                      tagBg={bfCat?.bg}
                      icon={Heart}
                    />
                  )}
                  {bmrValue != null && (
                    <MetricCard
                      label="BMR"
                      value={Math.round(bmrValue)}
                      unit="kcal"
                      hint="reposo / día"
                      icon={FlameIcon}
                    />
                  )}
                  {maintenanceValue != null && (
                    <MetricCard
                      label="MANTENIM."
                      value={Math.round(maintenanceValue)}
                      unit="kcal"
                      hint={ACTIVITY_LEVELS.find(a => a.id === (body.activity || 1.55))?.label.toLowerCase() || ''}
                      icon={TrendingUp}
                    />
                  )}
                  {lean != null && (
                    <MetricCard
                      label="MASA MAGRA"
                      value={lean.toFixed(1)}
                      unit="kg"
                      hint="peso sin grasa"
                      icon={Dumbbell}
                    />
                  )}
                  {idealW != null && (
                    <MetricCard
                      label="PESO IDEAL"
                      value={idealW.toFixed(0)}
                      unit="kg"
                      hint="referencia"
                      icon={Target}
                    />
                  )}
                </div>
              )}

              {!currentWeight && (
                <div className="text-xs text-stone-500 text-center py-2">
                  Registra un peso para ver tus métricas calculadas.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── RUTINAS ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500">CAMBIAR RUTINA</h2>
            <button
              onClick={() => onOpenRoutineEditor('create')}
              className="text-[11px] font-bold tracking-wider text-cta-400 hover:text-cta-300 flex items-center gap-1 min-h-[32px]"
            >
              <Plus size={12} aria-hidden="true" />CREAR
            </button>
          </div>
          <div className="grid gap-2 stagger">
            {allRoutines.map(r => {
              const Icon = IconOf(r.icon);
              const current = r.id === currentRoutineId;
              const isCustom = !ROUTINES[r.id];
              return (
                <div
                  key={r.id}
                  className={`text-left p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                    current
                      ? 'bg-stone-900 border-orange-500/50 ring-2 ring-orange-500/20'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <button
                    onClick={() => !current && onSwitchRoutine(r.id)}
                    disabled={current}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    aria-label={current ? `Rutina activa: ${r.name}` : `Activar rutina ${r.name}`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.accent} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate flex items-center gap-2">
                        {r.name}
                        {isCustom && (
                          <span className="text-[9px] bg-cta-500/20 text-cta-300 px-1.5 py-0.5 rounded-full font-bold tracking-widest">MÍA</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 truncate">{r.description}</div>
                      <div className="text-[10px] text-stone-600 mt-0.5">{r.level} · {r.daysPerWeek} días/sem</div>
                    </div>
                    {current && (
                      <div className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full font-bold tracking-wider flex-shrink-0">
                        ACTUAL
                      </div>
                    )}
                  </button>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => onOpenRoutineEditor(isCustom ? 'edit' : 'duplicate', r)}
                      className="tap rounded-lg text-stone-500 hover:text-orange-400 hover:bg-stone-800"
                      aria-label={isCustom ? `Editar ${r.name}` : `Duplicar y editar ${r.name}`}
                      title={isCustom ? 'Editar' : 'Duplicar para editar'}
                    >
                      {isCustom ? <Edit3 size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => onDeleteCustomRoutine(r.id)}
                        className="tap rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800"
                        aria-label={`Eliminar ${r.name}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {profiles.length > 1 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">CAMBIAR DE PERFIL</h2>
            <div className="space-y-2">
              {profiles.filter(p => p.name !== profile.name).map(p => (
                <button
                  key={p.name}
                  onClick={() => onSwitchProfile(p.name)}
                  className="w-full text-left p-3 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3 hover:border-stone-700"
                >
                  <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-stone-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className="text-xs text-stone-500">Semana {p.week || 1} · {ROUTINES[p.routineId]?.name || '—'}</div>
                  </div>
                  <ArrowRight size={16} className="text-stone-500" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">DATOS</h2>
          <div className="grid gap-2">
            <button onClick={exportData} className="p-3 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3 hover:border-stone-700">
              <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center">
                <Download size={16} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-sm">Exportar datos</div>
                <div className="text-xs text-stone-500">Descarga un JSON con todos tus perfiles</div>
              </div>
            </button>
            <label className="p-3 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3 hover:border-stone-700 cursor-pointer">
              <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center">
                <Upload size={16} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Importar datos</div>
                <div className="text-xs text-stone-500">Restaura desde un JSON exportado</div>
              </div>
              <input type="file" accept="application/json" onChange={importData} className="hidden" />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">CUENTA</h2>
          <div className="grid gap-2">
            <button onClick={onNewProfile} className="p-3 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3 hover:border-stone-700">
              <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center">
                <Plus size={16} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-sm">Crear otro perfil</div>
                <div className="text-xs text-stone-500">Añade un usuario más en este navegador</div>
              </div>
            </button>
            <button onClick={onLogout} className="p-3 bg-stone-900 border border-stone-800 rounded-2xl flex items-center gap-3 hover:border-stone-700">
              <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center">
                <LogOut size={16} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-sm">Cerrar sesión</div>
                <div className="text-xs text-stone-500">Volver a la pantalla de selección</div>
              </div>
            </button>
            <button onClick={() => onDeleteProfile(profile.name)} className="p-3 bg-stone-900 border border-red-900/50 rounded-2xl flex items-center gap-3 hover:border-red-800">
              <div className="w-9 h-9 rounded-xl bg-red-950 flex items-center justify-center">
                <X size={16} className="text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold text-sm text-red-400">Eliminar este perfil</div>
                <div className="text-xs text-stone-500">Borra todos los datos de {profile.name}</div>
              </div>
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-stone-600 pb-4">
          Gym Tracker · Datos guardados en tu navegador
        </p>
      </div>
    </>
  );
}

/* ─────────────────────── BOTTOM NAV ─────────────────────── */
function BottomNav({ view, setView }) {
  const items = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'workout', label: 'Entrenar', icon: Dumbbell },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'profile', label: 'Perfil', icon: User },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-stone-950/95 backdrop-blur-lg border-t border-stone-800 z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="max-w-4xl mx-auto grid grid-cols-4">
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`min-h-[56px] py-2 flex flex-col items-center justify-center gap-1 transition-colors relative ${active ? 'text-orange-400' : 'text-stone-500 hover:text-stone-200'}`}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" aria-hidden="true" />}
              <Icon size={20} aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold tracking-[0.15em]">{label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ─────────────────────── REST TIMER ─────────────────────── */
function RestTimer({ timerSeconds, timerTotal, timerRunning, onClose, onToggle, onAdd }) {
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const progress = timerTotal > 0 ? ((timerTotal - timerSeconds) / timerTotal) * 100 : 0;

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-4 right-4 max-w-md mx-auto z-40 animate-slideUp"
      role="status"
      aria-live="polite"
    >
      <div className="bg-stone-900 border border-stone-700 rounded-3xl shadow-2xl p-4 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${timerRunning ? 'bg-orange-500 animate-pulse' : 'bg-stone-600'}`} aria-hidden="true"></div>
            <span className="text-[11px] font-bold tracking-[0.25em] text-stone-400">DESCANSO</span>
          </div>
          <button onClick={onClose} className="tap rounded-lg text-stone-500 hover:text-stone-300" aria-label="Cerrar temporizador">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="text-center mb-3">
          <div className={`stat-number text-6xl ${timerSeconds === 0 ? 'text-cta-400' : 'text-stone-100'}`}>
            {formatTime(timerSeconds)}
          </div>
          {timerSeconds === 0 && (
            <div className="font-display text-sm text-cta-400 font-bold mt-1 uppercase tracking-wider">¡A por la siguiente serie!</div>
          )}
        </div>
        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden mb-3" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100">
          <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onAdd(-15)}
            disabled={timerTotal <= 15}
            className="tap px-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
            aria-label="Restar 15 segundos"
          >
            <Minus size={14} aria-hidden="true" />15s
          </button>
          <button onClick={onToggle} className="btn-primary px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-white" aria-label={timerRunning ? 'Pausar' : 'Reanudar'}>
            {timerRunning ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {timerRunning ? 'Pausa' : (timerSeconds === 0 ? 'Reiniciar' : 'Seguir')}
          </button>
          <button
            onClick={() => onAdd(15)}
            disabled={timerTotal >= 300}
            className="tap px-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
            aria-label="Sumar 15 segundos"
            title={timerTotal >= 300 ? 'Máximo 5 min' : undefined}
          >
            <Plus size={14} aria-hidden="true" />15s
          </button>
        </div>
        {timerTotal >= 285 && (
          <div className="text-[10px] text-stone-500 text-center mt-2 tracking-wider">MÁXIMO 5 MINUTOS</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── WEIGHT MODAL ─────────────────────── */
function WeightModal({ exercise, history, currentWeek, onSave, onClose }) {
  const thisWeekEntry = history.find(e => e.week === currentWeek);
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const [weight, setWeight] = useState(
    thisWeekEntry ? thisWeekEntry.weight.toString() :
      lastEntry ? lastEntry.weight.toString() : ''
  );

  // Escape key cierra + lock scroll body mientras está abierto
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const adjust = (delta) => {
    const current = parseFloat(weight) || 0;
    setWeight(Math.max(0, current + delta).toString());
  };

  const maxWeight = history.length > 0 ? Math.max(...history.map(e => e.weight)) : 0;
  const firstWeight = history.length > 0 ? history[0].weight : 0;
  const progress = lastEntry && firstWeight > 0 ? ((lastEntry.weight - firstWeight) / firstWeight) * 100 : 0;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-modal-title"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-stone-900 border-b border-stone-800 p-5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] text-orange-400 font-bold tracking-[0.25em] mb-1">PROGRESIÓN</div>
            <h3 id="weight-modal-title" className="font-display text-xl font-black uppercase tracking-tight truncate">{exercise.name}</h3>
          </div>
          <button onClick={onClose} className="tap rounded-full hover:bg-stone-800 flex-shrink-0 transition-colors" aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-5">
            <label className="block text-[11px] text-stone-400 mb-2 font-bold tracking-[0.2em]" htmlFor="weight-input">
              SEMANA {currentWeek} · PESO (KG)
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => adjust(-2.5)} className="min-w-[48px] min-h-[56px] bg-stone-800 hover:bg-stone-700 rounded-xl font-bold text-xl flex-shrink-0 transition-colors" aria-label="Restar 2.5 kg">−</button>
              <input
                id="weight-input"
                type="number" step="0.5" value={weight}
                onChange={e => setWeight(e.target.value)}
                inputMode="decimal"
                className="stat-number flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-4xl text-center focus:outline-none focus:border-orange-500 min-w-0"
                placeholder="0"
                aria-label="Peso en kilogramos"
              />
              <button onClick={() => adjust(2.5)} className="min-w-[48px] min-h-[56px] bg-stone-800 hover:bg-stone-700 rounded-xl font-bold text-xl flex-shrink-0 transition-colors" aria-label="Sumar 2.5 kg">+</button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => adjust(-0.5)} className="flex-1 min-h-[36px] text-xs text-stone-400 hover:text-stone-200 bg-stone-800/50 hover:bg-stone-800 rounded-lg transition-colors" aria-label="Restar 0.5 kg">-0.5</button>
              <button onClick={() => adjust(0.5)} className="flex-1 min-h-[36px] text-xs text-stone-400 hover:text-stone-200 bg-stone-800/50 hover:bg-stone-800 rounded-lg transition-colors" aria-label="Sumar 0.5 kg">+0.5</button>
              <button onClick={() => adjust(1)} className="flex-1 min-h-[36px] text-xs text-stone-400 hover:text-stone-200 bg-stone-800/50 hover:bg-stone-800 rounded-lg transition-colors" aria-label="Sumar 1 kg">+1</button>
              <button onClick={() => adjust(5)} className="flex-1 min-h-[36px] text-xs text-stone-400 hover:text-stone-200 bg-stone-800/50 hover:bg-stone-800 rounded-lg transition-colors" aria-label="Sumar 5 kg">+5</button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-1">MÁX</div>
                <div className="stat-number text-xl">{maxWeight}<span className="text-xs text-stone-500 tracking-normal">kg</span></div>
              </div>
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-1">ÚLTIMO</div>
                <div className="stat-number text-xl">{lastEntry.weight}<span className="text-xs text-stone-500 tracking-normal">kg</span></div>
              </div>
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-1">PROGRESO</div>
                <div className={`stat-number text-xl ${progress > 0 ? 'text-cta-400' : progress < 0 ? 'text-red-400' : 'text-stone-400'}`}>
                  {progress > 0 && '+'}{progress.toFixed(0)}%
                </div>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="mb-5">
              <div className="text-xs text-stone-400 mb-2 font-bold tracking-wider">HISTORIAL</div>
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                {[...history].reverse().map((entry, i) => {
                  const origIdx = history.indexOf(entry);
                  const prev = origIdx > 0 ? history[origIdx - 1] : null;
                  const delta = prev ? entry.weight - prev.weight : 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-stone-800 last:border-0">
                      <span className="text-stone-400">Semana {entry.week}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{entry.weight}kg</span>
                        {delta !== 0 && (
                          <span className={`text-[10px] font-mono ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => weight && onSave(weight)}
            disabled={!weight}
            className="btn-cta w-full py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-base"
          >
            Guardar Semana {currentWeek}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── BODY METRICS HELPERS ─────────────────────── */

function InfoCell({ label, value, unit }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-1">{label}</div>
      <div className="stat-number text-xl">
        {value ?? '—'}
        {unit && value != null && <span className="text-xs text-stone-500 font-normal ml-1 tracking-normal">{unit}</span>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, hint, tag, tagColor, tagBg, icon: Icon }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 animate-fadeIn">
      <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-2">
        {Icon && <Icon size={11} aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <div className="stat-number text-2xl text-white mb-1">
        {value}
        {unit && <span className="text-xs text-stone-500 font-normal ml-1 tracking-normal">{unit}</span>}
      </div>
      {tag ? (
        <div className={`inline-block text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full ${tagBg} ${tagColor}`}>
          {tag.toUpperCase()}
        </div>
      ) : hint ? (
        <div className="text-[10px] text-stone-500">{hint}</div>
      ) : null}
    </div>
  );
}

// Gráfica mini de progresión del peso corporal (reutiliza el estilo del MiniChart)
function BodyWeightChart({ measurements }) {
  if (!measurements || measurements.length < 2) return null;
  const W = 100, H = 50;
  const max = Math.max(...measurements.map(m => m.weight));
  const min = Math.min(...measurements.map(m => m.weight));
  const range = Math.max(0.5, max - min);
  const points = measurements.map((m, i) => {
    const x = (i / (measurements.length - 1)) * W;
    const y = H - ((m.weight - min) / range) * (H - 10) - 5;
    return [x, y];
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const first = measurements[0].weight;
  const last = measurements[measurements.length - 1].weight;
  const deltaKg = last - first;
  const id = Math.random().toString(36).slice(2, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-[10px] text-stone-500 font-bold tracking-wider">
        <span>S{measurements[0].week}</span>
        <span className={deltaKg === 0 ? 'text-stone-500' : deltaKg < 0 ? 'text-cta-400' : 'text-orange-400'}>
          {deltaKg > 0 ? '+' : ''}{deltaKg.toFixed(1)} kg
        </span>
        <span>S{measurements[measurements.length - 1].week}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 overflow-visible" preserveAspectRatio="none" role="img" aria-label="Evolución del peso corporal">
        <defs>
          <linearGradient id={`bw-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#bw-${id})`} />
        <path d={linePath} fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#22C55E" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

/* ─────────────────────── BODY EDITOR MODAL ─────────────────────── */

function BodyEditorModal({ body, onSave, onClose }) {
  const [height, setHeight] = useState(body.height ?? '');
  const [age, setAge] = useState(body.age ?? '');
  const [sex, setSex] = useState(body.sex ?? '');
  const [activity, setActivity] = useState(body.activity ?? 1.55);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const canSave = height && age && sex;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="body-title">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-stone-900 border-b border-stone-800 p-5 flex items-center justify-between z-10">
          <div>
            <div className="text-[11px] text-orange-400 font-bold tracking-[0.25em] mb-1">TUS DATOS</div>
            <h3 id="body-title" className="font-display text-xl font-black uppercase">Datos corporales</h3>
          </div>
          <button onClick={onClose} className="tap rounded-full hover:bg-stone-800" aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <p className="text-xs text-stone-400">Todo es opcional. Sólo se usa para calcular tus métricas (BMI, % grasa, BMR). Nada se envía a ningún servidor.</p>

          {/* Altura */}
          <div>
            <label htmlFor="b-height" className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">ALTURA (CM)</label>
            <input
              id="b-height" type="number" inputMode="numeric" min="100" max="250" value={height}
              onChange={e => setHeight(e.target.value)}
              className="stat-number w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-2xl text-center focus:outline-none focus:border-orange-500"
              placeholder="175"
            />
          </div>

          {/* Edad */}
          <div>
            <label htmlFor="b-age" className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">EDAD</label>
            <input
              id="b-age" type="number" inputMode="numeric" min="10" max="120" value={age}
              onChange={e => setAge(e.target.value)}
              className="stat-number w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-2xl text-center focus:outline-none focus:border-orange-500"
              placeholder="25"
            />
          </div>

          {/* Sexo */}
          <div>
            <div className="text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">SEXO BIOLÓGICO <span className="text-stone-600 font-normal tracking-normal">· para cálculos</span></div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'male', label: 'Hombre' },
                { id: 'female', label: 'Mujer' },
              ].map(o => (
                <button
                  key={o.id}
                  onClick={() => setSex(o.id)}
                  className={`min-h-[52px] rounded-xl border font-bold text-sm transition-colors ${
                    sex === o.id ? 'bg-orange-500/10 border-orange-500/60 text-orange-200' : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actividad */}
          <div>
            <div className="text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">NIVEL DE ACTIVIDAD</div>
            <div className="space-y-1.5">
              {ACTIVITY_LEVELS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setActivity(a.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                    activity === a.id ? 'bg-orange-500/10 border-orange-500/50' : 'bg-stone-950 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${activity === a.id ? 'bg-orange-500 border-orange-500' : 'border-stone-600'}`} aria-hidden="true" />
                  <div className="flex-1">
                    <div className="text-sm font-bold">{a.label}</div>
                    <div className="text-[11px] text-stone-500">{a.desc}</div>
                  </div>
                  <div className="text-[10px] font-mono text-stone-500">×{a.id}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => canSave && onSave({
              height: parseFloat(height), age: parseInt(age), sex, activity,
            })}
            disabled={!canSave}
            className="btn-cta w-full py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
          >
            <Save size={16} aria-hidden="true" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── MEASUREMENT MODAL ─────────────────────── */

function MeasurementModal({ profile, onSave, onClose }) {
  const measurements = profile.body?.measurements || [];
  const thisWeek = measurements.find(m => m.week === profile.week);
  const lastEntry = measurements[measurements.length - 1] || null;
  const [weight, setWeight] = useState(
    thisWeek ? thisWeek.weight.toString()
      : lastEntry ? lastEntry.weight.toString() : ''
  );
  const [bodyFat, setBodyFat] = useState(
    thisWeek?.bodyFat != null ? thisWeek.bodyFat.toString()
      : lastEntry?.bodyFat != null ? lastEntry.bodyFat.toString() : ''
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const adjust = (delta) => {
    const current = parseFloat(weight) || 0;
    setWeight(Math.max(0, current + delta).toFixed(1).replace(/\.0$/, ''));
  };

  const firstEntry = measurements[0];
  const deltaFromFirst = firstEntry && weight ? parseFloat(weight) - firstEntry.weight : 0;
  const deltaFromLast = lastEntry && weight ? parseFloat(weight) - lastEntry.weight : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="meas-title">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-stone-900 border-b border-stone-800 p-5 flex items-center justify-between z-10">
          <div>
            <div className="text-[11px] text-cta-400 font-bold tracking-[0.25em] mb-1">SEMANA {profile.week}</div>
            <h3 id="meas-title" className="font-display text-xl font-black uppercase">Tu peso</h3>
          </div>
          <button onClick={onClose} className="tap rounded-full hover:bg-stone-800" aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label htmlFor="m-weight" className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">PESO (KG)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => adjust(-0.5)} className="min-w-[48px] min-h-[56px] bg-stone-800 hover:bg-stone-700 rounded-xl font-bold text-xl" aria-label="Restar 0.5 kg">−</button>
              <input
                id="m-weight" type="number" step="0.1" inputMode="decimal" value={weight}
                onChange={e => setWeight(e.target.value)}
                className="stat-number flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-4xl text-center focus:outline-none focus:border-cta-500 min-w-0"
                placeholder="0"
              />
              <button onClick={() => adjust(0.5)} className="min-w-[48px] min-h-[56px] bg-stone-800 hover:bg-stone-700 rounded-xl font-bold text-xl" aria-label="Sumar 0.5 kg">+</button>
            </div>
          </div>

          <div>
            <label htmlFor="m-bf" className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">% GRASA <span className="text-stone-600 font-normal tracking-normal">· opcional (báscula inteligente)</span></label>
            <input
              id="m-bf" type="number" step="0.1" inputMode="decimal" min="2" max="60" value={bodyFat}
              onChange={e => setBodyFat(e.target.value)}
              className="stat-number w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-2xl text-center focus:outline-none focus:border-cta-500"
              placeholder="si lo tienes"
            />
          </div>

          {weight && measurements.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-1">vs INICIO</div>
                <div className={`stat-number text-xl ${deltaFromFirst === 0 ? 'text-stone-300' : deltaFromFirst < 0 ? 'text-cta-400' : 'text-orange-400'}`}>
                  {deltaFromFirst > 0 ? '+' : ''}{deltaFromFirst.toFixed(1)}<span className="text-xs text-stone-500 tracking-normal">kg</span>
                </div>
              </div>
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em] mb-1">vs ÚLTIMO</div>
                <div className={`stat-number text-xl ${deltaFromLast === 0 ? 'text-stone-300' : deltaFromLast < 0 ? 'text-cta-400' : 'text-orange-400'}`}>
                  {deltaFromLast > 0 ? '+' : ''}{deltaFromLast.toFixed(1)}<span className="text-xs text-stone-500 tracking-normal">kg</span>
                </div>
              </div>
            </div>
          )}

          {measurements.length > 0 && (
            <div>
              <div className="text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-2">HISTORIAL</div>
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                {[...measurements].reverse().map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-stone-800 last:border-0">
                    <span className="text-stone-400">Semana {m.week}</span>
                    <div className="flex items-center gap-2">
                      <span className="stat-number text-sm">{m.weight}kg</span>
                      {m.bodyFat != null && <span className="text-[10px] text-stone-500">{m.bodyFat}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => weight && onSave({ weight, bodyFat: bodyFat || null })}
            disabled={!weight}
            className="btn-cta w-full py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-base"
          >
            Guardar Semana {profile.week}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── ROUTINE EDITOR MODAL ─────────────────────── */

const COLOR_OPTIONS = [
  'from-orange-500 to-red-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-indigo-500 to-violet-600',
  'from-lime-500 to-emerald-600',
];
const ICON_OPTIONS = ['Zap', 'Flame', 'Target', 'Dumbbell', 'Activity', 'Trophy'];

const blankExercise = () => ({ name: '', sets: '3', reps: '10', note: '', trackWeight: true, rest: 60 });
const blankDay = (idx = 1) => ({
  name: `Día ${idx}`, focus: 'Entrenamiento', iconName: 'Zap',
  color: COLOR_OPTIONS[(idx - 1) % COLOR_OPTIONS.length], hint: '',
  exercises: [blankExercise()],
});

function makeUniqueId(base, existingIds) {
  const slug = base.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'rutina';
  let id = `custom-${slug}`;
  let n = 2;
  while (existingIds.has(id)) { id = `custom-${slug}-${n++}`; }
  return id;
}

function RoutineEditorModal({ mode, initial, existingIds, onSave, onClose }) {
  // Estructura base — cuando se duplica/edita, partir de initial (deep clone)
  const seed = () => {
    if (mode === 'create' || !initial) {
      return {
        id: null, name: '', tagline: '', description: '', level: 'Intermedio',
        icon: 'Dumbbell', accent: COLOR_OPTIONS[0],
        days: { d1: blankDay(1) },
      };
    }
    const clone = JSON.parse(JSON.stringify(initial));
    if (mode === 'duplicate') {
      clone.id = null; // se regenera al guardar
      clone.name = `${clone.name} (copia)`;
    }
    return clone;
  };
  const [form, setForm] = useState(seed);
  const [expandedDay, setExpandedDay] = useState(() => Object.keys(seed().days)[0]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const dayKeys = Object.keys(form.days);

  const updateDay = (dk, patch) => {
    setForm(f => ({ ...f, days: { ...f.days, [dk]: { ...f.days[dk], ...patch } } }));
  };

  const addDay = () => {
    const nextKey = `d${dayKeys.length + 1}-${Math.random().toString(36).slice(2, 5)}`;
    setForm(f => ({ ...f, days: { ...f.days, [nextKey]: blankDay(dayKeys.length + 1) } }));
    setExpandedDay(nextKey);
  };

  const removeDay = (dk) => {
    if (dayKeys.length <= 1) { alert('La rutina necesita al menos un día.'); return; }
    setForm(f => {
      const days = { ...f.days };
      delete days[dk];
      return { ...f, days };
    });
    if (expandedDay === dk) setExpandedDay(Object.keys(form.days).filter(k => k !== dk)[0]);
  };

  const addExercise = (dk) => {
    setForm(f => ({
      ...f,
      days: { ...f.days, [dk]: { ...f.days[dk], exercises: [...f.days[dk].exercises, blankExercise()] } },
    }));
  };
  const updateExercise = (dk, i, patch) => {
    setForm(f => {
      const exs = [...f.days[dk].exercises];
      exs[i] = { ...exs[i], ...patch };
      return { ...f, days: { ...f.days, [dk]: { ...f.days[dk], exercises: exs } } };
    });
  };
  const removeExercise = (dk, i) => {
    setForm(f => {
      const exs = f.days[dk].exercises.filter((_, idx) => idx !== i);
      return { ...f, days: { ...f.days, [dk]: { ...f.days[dk], exercises: exs.length ? exs : [blankExercise()] } } };
    });
  };

  const canSave = form.name.trim() && dayKeys.length > 0 && dayKeys.every(dk => form.days[dk].exercises.some(ex => ex.name.trim()));

  const submit = () => {
    if (!canSave) return;
    const id = mode === 'edit' && form.id ? form.id : makeUniqueId(form.name, existingIds);
    const cleaned = {
      ...form,
      id,
      daysPerWeek: dayKeys.length,
      tagline: form.tagline || `${dayKeys.length} días/semana`,
      description: form.description || form.tagline || '',
      days: Object.fromEntries(
        dayKeys.map(dk => [dk, {
          ...form.days[dk],
          exercises: form.days[dk].exercises
            .filter(ex => ex.name.trim())
            .map(ex => ({
              ...ex,
              rest: Math.max(0, Math.min(REST_MAX, parseInt(ex.rest) || 0)),
              trackWeight: !!ex.trackWeight,
            })),
        }])
      ),
    };
    onSave(cleaned);
  };

  const title = mode === 'edit' ? 'Editar rutina' : mode === 'duplicate' ? 'Duplicar rutina' : 'Nueva rutina';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-stretch justify-center animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="routine-title">
      <div className="bg-stone-900 border-l border-r border-stone-800 w-full max-w-2xl max-h-full overflow-y-auto animate-slideUp" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-stone-900/95 backdrop-blur border-b border-stone-800 p-4 flex items-center justify-between z-20">
          <div className="min-w-0">
            <div className="text-[11px] text-cta-400 font-bold tracking-[0.25em] mb-0.5">{mode === 'edit' ? 'EDITANDO' : mode === 'duplicate' ? 'DUPLICANDO' : 'CREANDO'}</div>
            <h3 id="routine-title" className="font-display text-xl font-black uppercase truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={submit} disabled={!canSave} className="btn-cta px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 flex items-center gap-1.5">
              <Save size={14} aria-hidden="true" />Guardar
            </button>
            <button onClick={onClose} className="tap rounded-full hover:bg-stone-800" aria-label="Cerrar sin guardar">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5 pb-12">
          {/* Datos generales */}
          <section className="space-y-3">
            <div>
              <label className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-1.5">NOMBRE DE LA RUTINA</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="p.ej. Mi rutina de fuerza"
                maxLength={40}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-1.5">BREVE DESCRIPCIÓN</label>
              <input
                value={form.tagline}
                onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                placeholder="4 días · hipertrofia"
                maxLength={60}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-1.5">NIVEL</label>
                <select
                  value={form.level}
                  onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-3 focus:outline-none focus:border-orange-500"
                >
                  <option>Principiante</option>
                  <option>Intermedio</option>
                  <option>Avanzado</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-1.5">ICONO</label>
                <div className="grid grid-cols-6 gap-1">
                  {ICON_OPTIONS.map(ic => {
                    const Ic = IconOf(ic);
                    return (
                      <button
                        key={ic}
                        onClick={() => setForm(f => ({ ...f, icon: ic }))}
                        className={`aspect-square rounded-lg flex items-center justify-center transition-colors ${form.icon === ic ? 'bg-orange-500/20 ring-2 ring-orange-500/50' : 'bg-stone-950 border border-stone-800 hover:border-stone-700'}`}
                        aria-label={`Icono ${ic}`}
                      >
                        <Ic size={16} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-stone-400 font-bold tracking-[0.2em] mb-1.5">COLOR PRINCIPAL</label>
              <div className="grid grid-cols-9 gap-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, accent: c }))}
                    className={`aspect-square rounded-lg bg-gradient-to-br ${c} transition-all ${form.accent === c ? 'ring-2 ring-white/80 scale-105' : 'opacity-70 hover:opacity-100'}`}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Días */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] text-stone-400 font-bold tracking-[0.2em]">DÍAS ({dayKeys.length})</h4>
              <button onClick={addDay} className="text-[11px] font-bold tracking-wider text-cta-400 flex items-center gap-1 min-h-[32px]">
                <Plus size={12} aria-hidden="true" />DÍA
              </button>
            </div>
            <div className="space-y-2">
              {dayKeys.map((dk, dayIdx) => {
                const day = form.days[dk];
                const DIcon = IconOf(day.iconName);
                const isOpen = expandedDay === dk;
                return (
                  <div key={dk} className="bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 p-3">
                      <button
                        onClick={() => setExpandedDay(isOpen ? null : dk)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${day.color} flex items-center justify-center flex-shrink-0`}>
                          <DIcon size={14} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{day.name || `Día ${dayIdx + 1}`}</div>
                          <div className="text-[11px] text-stone-500 truncate">{day.exercises.filter(e => e.name.trim()).length} ejercicios</div>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-stone-500 flex-shrink-0" aria-hidden="true" /> : <ChevronDown size={16} className="text-stone-500 flex-shrink-0" aria-hidden="true" />}
                      </button>
                      <button onClick={() => removeDay(dk)} className="tap rounded-lg text-stone-500 hover:text-red-400" aria-label={`Eliminar ${day.name}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-stone-800 p-3 space-y-3 animate-fadeIn">
                        {/* Campos del día */}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={day.name}
                            onChange={e => updateDay(dk, { name: e.target.value })}
                            placeholder="Nombre del día"
                            maxLength={30}
                            className="bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                          />
                          <input
                            value={day.focus}
                            onChange={e => updateDay(dk, { focus: e.target.value })}
                            placeholder="Enfoque"
                            maxLength={40}
                            className="bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex gap-1">
                            {ICON_OPTIONS.slice(0, 6).map(ic => {
                              const Ic = IconOf(ic);
                              return (
                                <button
                                  key={ic}
                                  onClick={() => updateDay(dk, { iconName: ic })}
                                  className={`tap rounded-lg ${day.iconName === ic ? 'bg-orange-500/20 ring-2 ring-orange-500/50' : 'bg-stone-900 border border-stone-800'}`}
                                  aria-label={ic}
                                >
                                  <Ic size={14} aria-hidden="true" />
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {COLOR_OPTIONS.map(c => (
                              <button
                                key={c}
                                onClick={() => updateDay(dk, { color: c })}
                                className={`w-6 h-6 rounded-md bg-gradient-to-br ${c} ${day.color === c ? 'ring-2 ring-white/80' : 'opacity-60 hover:opacity-100'}`}
                                aria-label={c}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Ejercicios */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] text-stone-500 font-bold tracking-[0.2em]">EJERCICIOS</div>
                            <button onClick={() => addExercise(dk)} className="text-[10px] font-bold tracking-wider text-cta-400 flex items-center gap-1 min-h-[28px]">
                              <Plus size={10} aria-hidden="true" />AÑADIR
                            </button>
                          </div>
                          {day.exercises.map((ex, i) => (
                            <ExerciseRow
                              key={i}
                              exercise={ex}
                              onChange={(patch) => updateExercise(dk, i, patch)}
                              onRemove={() => removeExercise(dk, i)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ExerciseRow({ exercise, onChange, onRemove }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 space-y-2">
      <div className="flex gap-2">
        <input
          value={exercise.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Nombre del ejercicio"
          maxLength={60}
          className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
        />
        <button onClick={onRemove} className="tap rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800" aria-label="Eliminar ejercicio">
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Series" value={exercise.sets} onChange={v => onChange({ sets: v })} placeholder="4" />
        <LabeledInput label="Reps" value={exercise.reps} onChange={v => onChange({ reps: v })} placeholder="8-10" />
        <LabeledInput
          label="Desc (s)"
          value={exercise.rest}
          onChange={v => {
            const n = parseInt(v) || 0;
            onChange({ rest: Math.max(0, Math.min(REST_MAX, n)) });
          }}
          type="number"
          max={REST_MAX}
          inputMode="numeric"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!exercise.trackWeight}
            onChange={e => onChange({ trackWeight: e.target.checked })}
            className="accent-orange-500 w-4 h-4"
          />
          Registra peso
        </label>
        <input
          value={exercise.note || ''}
          onChange={e => onChange({ note: e.target.value })}
          placeholder="Nota / tip (opcional)"
          maxLength={80}
          className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
        />
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text', max, inputMode }) {
  return (
    <label className="block">
      <div className="text-[9px] text-stone-500 font-bold tracking-widest mb-1">{label.toUpperCase()}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        max={max}
        inputMode={inputMode}
        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:border-orange-500"
      />
    </label>
  );
}
