# Gym Tracker 💪

App web para **monitorear tus entrenamientos** en el gimnasio. Sin login, sin backend — tus datos viven en tu navegador (localStorage).

## Características

- 🏋️ **5 rutinas predefinidas**: Push/Pull/Legs, Upper/Lower, Full Body 3x, Tenis, En casa sin pesas
- ✅ **Checklist de ejercicios** con progreso por día y semana
- ⏱️ **Temporizador de descanso** automático con sonido y vibración
- 📊 **Registro de peso** semana a semana, con historial y progreso %
- 🔥 **Racha de semanas** completadas
- 👥 **Multi-perfil** — varios usuarios en el mismo dispositivo
- 📈 **Vista de estadísticas** con mini-gráficos de progresión
- 💾 **Exportar / importar** datos en JSON
- 📱 **Diseño mobile-first**, instalable como PWA

## Tecnología

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- lucide-react (iconos)

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Deploy a Vercel (para que cualquiera pueda entrar)

1. Sube el proyecto a un repo de GitHub.
2. Entra en [vercel.com](https://vercel.com) con tu cuenta de GitHub.
3. **Add New... → Project**, importa el repo.
4. No cambies nada. Click **Deploy**.
5. En ~1 min tendrás una URL pública tipo `tu-app.vercel.app`.

Cualquiera con la URL puede entrar y crear su perfil — los datos son locales a cada navegador.

## Estructura

```
app/
├── data/
│   └── routines.js      # rutinas predefinidas
├── lib/
│   └── storage.js       # helpers de localStorage
├── globals.css
├── layout.js
└── page.js              # app completa (dashboard, workout, stats, perfil)
public/
├── manifest.json
├── icon-192.png
├── icon-512.png
└── apple-touch-icon.png
```

## Personalización

Para añadir rutinas, edita `app/data/routines.js`. Cada rutina tiene:

```js
'mi-rutina': {
  id: 'mi-rutina',
  name: 'Mi rutina',
  tagline: 'Breve descripción · N días',
  description: 'Descripción más larga',
  level: 'Principiante | Intermedio | Avanzado',
  daysPerWeek: 3,
  icon: 'Dumbbell',         // Zap | Flame | Target | Dumbbell | Activity
  accent: 'from-orange-500 to-red-600',
  days: {
    dia1: {
      name: 'Día 1',
      focus: 'Enfoque del día',
      iconName: 'Zap',
      color: 'from-orange-500 to-red-600',
      hint: 'Nota corta',
      exercises: [
        { name: 'Ejercicio', sets: '4', reps: '8-10', note: 'Tip', trackWeight: true, rest: 90 },
        // ...
      ],
    },
  },
},
```
