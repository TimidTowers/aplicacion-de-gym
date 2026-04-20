// Fórmulas nutricionales y corporales aceptadas.
// Todos los inputs en métrico: kg, cm, años.
// sex: 'male' | 'female'

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function bmiCategory(value) {
  if (value == null) return null;
  if (value < 18.5) return { label: 'Bajo peso', color: 'text-sky-400', bg: 'bg-sky-500/15' };
  if (value < 25) return { label: 'Peso normal', color: 'text-cta-400', bg: 'bg-cta-500/15' };
  if (value < 30) return { label: 'Sobrepeso', color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
  if (value < 35) return { label: 'Obesidad grado I', color: 'text-orange-400', bg: 'bg-orange-500/15' };
  if (value < 40) return { label: 'Obesidad grado II', color: 'text-red-400', bg: 'bg-red-500/15' };
  return { label: 'Obesidad grado III', color: 'text-red-400', bg: 'bg-red-500/15' };
}

// Deurenberg — estimación rápida de % grasa corporal sólo con BMI + edad + sexo
export function bodyFatPercent(weightKg, heightCm, age, sex) {
  const b = bmi(weightKg, heightCm);
  if (b == null || !age || !sex) return null;
  const sexN = sex === 'male' ? 1 : 0;
  const bf = 1.20 * b + 0.23 * age - 10.8 * sexN - 5.4;
  return Math.max(2, Math.min(60, bf));
}

export function bodyFatCategory(bfPct, sex) {
  if (bfPct == null) return null;
  // Rangos ACE (American Council on Exercise)
  const ranges = sex === 'male'
    ? [
        { max: 5, label: 'Muy bajo', color: 'text-sky-400', bg: 'bg-sky-500/15' },
        { max: 13, label: 'Atlético', color: 'text-cta-400', bg: 'bg-cta-500/15' },
        { max: 17, label: 'Fitness', color: 'text-cta-400', bg: 'bg-cta-500/15' },
        { max: 24, label: 'Promedio', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
        { max: Infinity, label: 'Alto', color: 'text-red-400', bg: 'bg-red-500/15' },
      ]
    : [
        { max: 13, label: 'Muy bajo', color: 'text-sky-400', bg: 'bg-sky-500/15' },
        { max: 20, label: 'Atlética', color: 'text-cta-400', bg: 'bg-cta-500/15' },
        { max: 24, label: 'Fitness', color: 'text-cta-400', bg: 'bg-cta-500/15' },
        { max: 31, label: 'Promedio', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
        { max: Infinity, label: 'Alto', color: 'text-red-400', bg: 'bg-red-500/15' },
      ];
  return ranges.find(r => bfPct < r.max);
}

// Mifflin-St Jeor (más precisa que Harris-Benedict)
export function bmr(weightKg, heightCm, age, sex) {
  if (!weightKg || !heightCm || !age || !sex) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

// Mantenimiento calórico por factor de actividad
export function maintenance(bmrValue, activity = 1.55) {
  if (bmrValue == null) return null;
  return bmrValue * activity;
}

// Peso ideal (Hamwi) — rango útil como referencia
export function idealWeight(heightCm, sex) {
  if (!heightCm || !sex) return null;
  const inchesOver5 = Math.max(0, (heightCm - 152.4) / 2.54);
  if (sex === 'male') return 48 + 2.7 * inchesOver5;
  return 45.5 + 2.2 * inchesOver5;
}

// Masa libre de grasa
export function leanMass(weightKg, bfPct) {
  if (!weightKg || bfPct == null) return null;
  return weightKg * (1 - bfPct / 100);
}

// FFMI — índice de masa libre de grasa (para evaluar desarrollo muscular)
export function ffmi(leanKg, heightCm) {
  if (!leanKg || !heightCm) return null;
  const h = heightCm / 100;
  return leanKg / (h * h);
}

export const ACTIVITY_LEVELS = [
  { id: 1.2, label: 'Sedentario', desc: 'Sin ejercicio' },
  { id: 1.375, label: 'Ligero', desc: '1-3 días/sem' },
  { id: 1.55, label: 'Moderado', desc: '3-5 días/sem' },
  { id: 1.725, label: 'Intenso', desc: '6-7 días/sem' },
  { id: 1.9, label: 'Muy intenso', desc: 'Atleta / 2×día' },
];
