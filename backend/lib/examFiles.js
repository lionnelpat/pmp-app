/**
 * Manifeste des examens livrés avec l'application.
 * Source unique partagée par le seed (reset destructif) et le bootstrap
 * automatique au démarrage (import non destructif si la base est vide).
 */
module.exports = [
  { file: 'PMP_Examen1_180Questions.json',   name: 'Examen PMP #1',  desc: '180 questions — PMBOK 7 & Agile · examen complet 3 h 50' },
  { file: 'PMP_Examen2_180Questions.json',   name: 'Examen PMP #2',  desc: '180 questions — choix unique, QCM multiples & appariement · 3 h 50' },
  { file: 'PMP_Examen5_180Questions.json',   name: 'Examen PMP #5',  desc: '180 questions — PMBOK 7 & Agile · examen complet 3 h 50' },
  { file: 'PMP_Examen6_180Questions.json',   name: 'Examen PMP #6',  desc: '180 questions — PMBOK 7 & Agile · examen complet 3 h 50' },
  { file: 'PMP_Examen120_120Questions.json', name: 'Examen PMP — 120 questions', desc: '120 questions — entraînement · 2 h' },
  { file: 'PMP_Examen60_60Questions.json',   name: 'Examen PMP — 60 questions',  desc: '60 questions — entraînement rapide · 1 h' },
];
