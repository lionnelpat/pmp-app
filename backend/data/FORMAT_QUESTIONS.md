# Format des questions (import / seed)

Les fichiers JSON de `backend/data/` sont des **tableaux de questions**. Chaque question
est classée en `single` (choix unique), `multi` (choix multiples) ou `match`
(appariement gauche/droite), via le champ `questionType` s'il est présent, sinon par
détection automatique sur l'énoncé.

## État

Les **trois types sont pleinement jouables** (interface + scoring) dès lors que les
données sont complètes. Une question n'est **exclue** d'un quiz que si ses données sont
insuffisantes (par ex. `options` vide, ou aucune paire pour un appariement) — c'est le
cas des questions spéciales des anciens exports (Examens #1, #5, #6, 120, 60). L'**Examen
#2** est au bon format : ses 180 questions (dont QCM et appariements) sont toutes jouables.

Le caractère « jouable » est calculé à l'import et stocké dans `questions.playable` ;
la livraison aux quiz (`GET /api/exams/:id/questions`) ne renvoie que `playable = true`,
**sans jamais exposer la bonne réponse**.

---

## 1. Choix unique — `single`

```json
{
  "questionNum": "1",
  "questionType": "single",
  "questionText": "Énoncé…",
  "options": [
    { "letter": "A", "text": "Option A" },
    { "letter": "B", "text": "Option B" },
    { "letter": "C", "text": "Option C" },
    { "letter": "D", "text": "Option D" }
  ],
  "correctAnswer": "Option C",
  "explanation": "Analyse BARAKUDA…"
}
```

La bonne réponse est l'option dont le texte == `correctAnswer` (ou `isCorrect: true`).

## 2. Choix multiples — `multi` (« Choisissez deux/trois »)

Fournir **toutes** les options, et les bonnes réponses via `correctAnswers` (liste de
textes) **ou** `isCorrect: true` sur chaque option correcte.

```json
{
  "questionNum": "27",
  "questionType": "multi",
  "questionText": "Quelles sont les deux actions… ? (Choisissez deux)",
  "options": [
    { "letter": "A", "text": "Former des binômes mentor/apprenti" },
    { "letter": "B", "text": "Demander un financement supplémentaire" },
    { "letter": "C", "text": "Ignorer le problème" },
    { "letter": "D", "text": "Identifier les lacunes en compétences" },
    { "letter": "E", "text": "Redistribuer certaines tâches" }
  ],
  "correctAnswers": [
    "Former des binômes mentor/apprenti",
    "Identifier les lacunes en compétences"
  ],
  "explanation": "…"
}
```

Scoring : **tout-ou-rien** (toutes les bonnes options cochées, aucune mauvaise).
UI : cases à cocher.

## 3. Appariement — `match` (« Faites correspondre / Associez »)

Fournir les paires correctes dans `correctPairs` (`premise`/`response`, ou `left`/`right`).
À l'examen, la gauche reste fixe et les réponses de droite sont **mélangées** ; le candidat
relie chaque ligne via un menu déroulant.

```json
{
  "questionNum": "175",
  "questionType": "match",
  "questionText": "Associez les parties prenantes à la fréquence appropriée :",
  "correctPairs": [
    { "premise": "Product Owner",          "response": "Mises à jour quotidiennes du statut" },
    { "premise": "Comité exécutif",        "response": "Mises à jour des jalons critiques" },
    { "premise": "Représentants du projet","response": "Mises à jour hebdomadaires du statut" }
  ],
  "explanation": "…"
}
```

Scoring : **toutes les paires doivent être correctes**.

---

## Champs reconnus

| Champ            | Type(s)       | Description |
|------------------|---------------|-------------|
| `questionNum`    | tous          | Numéro affiché (sinon ordre d'import). |
| `questionType`   | tous (option.)| `single` \| `multi` \| `match` (+ alias : `single_choice`, `multiple_choice`, `matching`…). Si absent → déduit de l'énoncé. |
| `questionText`   | tous          | Énoncé. |
| `options`        | single, multi | `{ letter, text, isCorrect? }`. |
| `correctAnswer`  | single        | Texte de la bonne réponse. |
| `correctAnswers` | multi         | Liste des textes corrects (ou `isCorrect:true` par option). |
| `correctPairs`   | match         | Liste `{ premise, response }` (ou `{ left, right }`). |
| `explanation`    | tous          | Corrigé / analyse. |

## Durées des examens (auto)

| Questions | Durée examen complet |
|-----------|----------------------|
| 180       | 3 h 50 (230 min)     |
| 120       | 2 h (120 min)        |
| 60        | 1 h (60 min)         |
| autre     | proportionnel (≈ 1,28 min/question) |

En mode personnalisé, le temps est calculé au prorata du rythme officiel.

## Ajouter / corriger un examen

1. Déposer le fichier JSON (au format ci-dessus) dans `backend/data/`.
2. L'ajouter à la liste `EXAM_FILES` de `scripts/seed.js` (ou l'importer via l'admin).
3. `npm run seed` → import + classification + calcul `playable` automatiques.

> Pour réparer les questions spéciales des anciens examens (#1, #5, #6, 120, 60), il
> suffit de fournir ces fichiers au format `correctAnswers` / `correctPairs` : elles
> deviendront automatiquement jouables, sans modification de code.
