'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Check, Trophy, Flame, Zap, Target, TrendingUp, RotateCcw, ChevronDown, ChevronUp,
  Info, Timer, Play, Pause, X, Plus, Minus, Dumbbell, Home, BarChart3, User,
  LogOut, Download, Upload, ArrowRight, Calendar, Activity, Settings, Sparkles,
  Lightbulb,
} from 'lucide-react';
import { ROUTINES, ROUTINE_LIST } from './data/routines';
import { loadRoot, saveRoot, emptyProfile } from './lib/storage';

// Mapeo nombre → componente icon
const ICONS = { Zap, Flame, Target, Dumbbell, Trophy, Activity };
const IconOf = (name) => ICONS[name] || Dumbbell;

const exerciseId = (dayKey, i) => `${dayKey}-${i}`;

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

  // Carga inicial
  useEffect(() => {
    setRoot(loadRoot());
    setMounted(true);
  }, []);

  const persist = (next) => { setRoot(next); saveRoot(next); };

  const profile = root.currentProfile ? root.profiles[root.currentProfile] : null;
  const routine = profile ? ROUTINES[profile.routineId] : null;

  // Timer
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setTimeout(() => setTimerSeconds(s => s - 1), 1000);
    } else if (timerSeconds === 0 && timerRunning) {
      setTimerRunning(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      playBeep();
    }
    return () => clearTimeout(timerRef.current);
  }, [timerRunning, timerSeconds]);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const startTimer = (seconds) => {
    setTimerTotal(seconds);
    setTimerSeconds(seconds);
    setTimerRunning(true);
  };
  const toggleTimer = () => {
    if (timerSeconds === 0) { setTimerSeconds(timerTotal); setTimerRunning(true); }
    else { setTimerRunning(r => !r); }
  };
  const closeTimer = () => { setTimerRunning(false); setTimerSeconds(0); setTimerTotal(0); };
  const addTimerSeconds = (delta) => {
    setTimerSeconds(s => Math.max(0, s + delta));
    setTimerTotal(t => Math.max(0, t + delta));
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
          onSwitchRoutine={switchRoutine}
          onSwitchProfile={switchProfile}
          onDeleteProfile={deleteProfile}
          onLogout={logout}
          onNewProfile={() => persist({ ...root, currentProfile: null })}
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
              className="tap rounded-full bg-stone-800 hover:bg-stone-700 transition-colors border border-stone-700 flex-shrink-0"
              aria-label="Empezar nueva semana"
              title="Nueva semana"
            >
              <RotateCcw size={18} aria-hidden="true" />
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
              className="tap rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-700 flex-shrink-0"
              aria-label="Empezar nueva semana"
            >
              <RotateCcw size={16} aria-hidden="true" />
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
function ProfileView({ profile, root, onSwitchRoutine, onSwitchProfile, onDeleteProfile, onLogout, onNewProfile }) {
  const profiles = Object.values(root.profiles);
  const currentRoutineId = profile.routineId;

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
        <section>
          <h2 className="text-xs font-bold tracking-[0.25em] text-stone-500 mb-3">CAMBIAR RUTINA</h2>
          <div className="grid gap-2">
            {ROUTINE_LIST.map(r => {
              const Icon = IconOf(r.icon);
              const current = r.id === currentRoutineId;
              return (
                <button
                  key={r.id}
                  onClick={() => !current && onSwitchRoutine(r.id)}
                  disabled={current}
                  className={`text-left p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                    current
                      ? 'bg-stone-900 border-orange-500/50 ring-2 ring-orange-500/20'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.accent} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{r.name}</div>
                    <div className="text-xs text-stone-500 truncate">{r.description}</div>
                    <div className="text-[10px] text-stone-600 mt-0.5">{r.level} · {r.daysPerWeek} días/sem</div>
                  </div>
                  {current && (
                    <div className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full font-bold tracking-wider flex-shrink-0">
                      ACTUAL
                    </div>
                  )}
                </button>
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
          <button onClick={() => onAdd(-15)} className="tap px-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors" aria-label="Restar 15 segundos">
            <Minus size={14} aria-hidden="true" />15s
          </button>
          <button onClick={onToggle} className="btn-primary px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-white" aria-label={timerRunning ? 'Pausar' : 'Reanudar'}>
            {timerRunning ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {timerRunning ? 'Pausa' : (timerSeconds === 0 ? 'Reiniciar' : 'Seguir')}
          </button>
          <button onClick={() => onAdd(15)} className="tap px-3 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors" aria-label="Sumar 15 segundos">
            <Plus size={14} aria-hidden="true" />15s
          </button>
        </div>
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
