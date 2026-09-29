# AI people

The exercise pictures and the camera-free demo use photorealistic **AI-generated people who don't
exist**. The app picks these files up at build time:

| File | What |
| --- | --- |
| `people/<exercise>.jpg` | Photo for the exercise card, setup screen, summary and history |
| `demo/<exercise>.mp4` + `.webm` | Demo video (H.264 + VP9); the coach tracks it like a camera feed |
| `ai-people.json` | Which model and prompt made each file |

`<exercise>` is the exercise id: `squat`, `pushup`, `lunge`, `rdl`, `curl`, `press`,
`jumping_jack`, `plank`. Create them with `npm run people` (Imagen + Veo through the Gemini API), or
bring your own with `npm run people -- --import squat my-clip.mp4`. Until a file exists, the app
shows a plain tile instead of a photo and hides the demo button for that exercise.
