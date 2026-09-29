// camera.js : analyse du visage avec MediaPipe (étape 10)
// Ce fichier est un "module" (il utilise import) : il se charge avec type="module".

import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const URL_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const URL_MODELE = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Seuils entre 0 et 1 (sauf roll en degrés et langue en rapport) : à ajuster après tes essais
const SEUILS = {
  sourire: 0.35,
  boucheOuverte: 0.35,
  grimace: 0.5,
  yeux: 0.45,      // regard des yeux détourné
  tete: 0.14,      // tête tournée (écart par rapport au centre)
  roll: 18,        // inclinaison de la tête en degrés
  langue: 1.6      // rapport de rougeur sous la lèvre (expérimental)
};

const video = document.getElementById("video");
const panneau = document.getElementById("analyse-camera");
const canvas = document.getElementById("canvas-echantillon");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let faceLandmarker = null;
let dernierTemps = -1;

// Dernier résultat, lisible par les autres fichiers (on s'en servira à l'étape 11)
window.analyseCamera = { visage: false, indicateurs: {} };

// ---------- Petits outils ----------

function moy(a, b) {
  return (a + b) / 2;
}

function pct(x) {
  return Math.round(x * 100) + " %";
}

// Transforme la liste [{categoryName, score}, ...] en dictionnaire { nom: score }
function versDictionnaire(categories) {
  const d = {};
  for (const c of categories) d[c.categoryName] = c.score;
  return d;
}

// Rougeur moyenne (Rouge - Vert) d'un rectangle de l'image
function rougeurMoyenne(x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.max(1, Math.min(Math.floor(w), canvas.width - x));
  h = Math.max(1, Math.min(Math.floor(h), canvas.height - y));
  const donnees = ctx.getImageData(x, y, w, h).data;
  let somme = 0;
  let n = 0;
  for (let i = 0; i < donnees.length; i += 4) {
    somme += donnees[i] - donnees[i + 1];   // rouge - vert
    n++;
  }
  return somme / n;
}

// ---------- Détection expérimentale de la langue tirée ----------
// Idée : sous la lèvre inférieure, il n'y a normalement que de la peau.
// Si la langue sort, cette zone devient beaucoup plus rouge que les joues.
function mesurerLangue(pts) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.drawImage(video, 0, 0, W, H);

  const levreBas = pts[17];     // bas de la lèvre inférieure
  const menton = pts[152];
  const coinG = pts[61];        // coins de la bouche
  const coinD = pts[291];
  const largeurBouche = Math.abs(coinD.x - coinG.x) * W;
  const hauteurZone = (menton.y - levreBas.y) * H;

  // Zone A : juste sous la lèvre inférieure
  const rougeurA = rougeurMoyenne(
    levreBas.x * W - largeurBouche * 0.25,
    levreBas.y * H + hauteurZone * 0.05,
    largeurBouche * 0.5,
    hauteurZone * 0.5
  );

  // Zone B : la peau de référence (les deux joues)
  const cote = largeurBouche * 0.3;
  const joueG = pts[205];
  const joueD = pts[425];
  const rougeurB = moy(
    rougeurMoyenne(joueG.x * W - cote / 2, joueG.y * H - cote / 2, cote, cote),
    rougeurMoyenne(joueD.x * W - cote / 2, joueD.y * H - cote / 2, cote, cote)
  );

  return rougeurA / Math.max(rougeurB, 5);
}

// ---------- Calcul des indicateurs à partir du résultat MediaPipe ----------
function analyser(resultat) {
  if (!resultat.faceLandmarks || resultat.faceLandmarks.length === 0) return null;
  if (!resultat.faceBlendshapes || resultat.faceBlendshapes.length === 0) return null;

  const pts = resultat.faceLandmarks[0];   // les 478 points du visage
  const b = versDictionnaire(resultat.faceBlendshapes[0].categories);
  const v = function (nom) { return b[nom] || 0; };

  const sourire = moy(v("mouthSmileLeft"), v("mouthSmileRight"));
  const boucheOuverte = v("jawOpen");

  // Grimace : on prend la plus forte des "tensions" du visage
  const grimace = Math.max(
    moy(v("browDownLeft"), v("browDownRight")),
    moy(v("noseSneerLeft"), v("noseSneerRight")),
    moy(v("mouthFrownLeft"), v("mouthFrownRight")),
    moy(v("mouthStretchLeft"), v("mouthStretchRight")),
    v("cheekPuff"),
    v("mouthPucker")
  );

  // Regard des yeux : plus la valeur est haute, plus les yeux regardent ailleurs
  const horizontal = Math.max(
    moy(v("eyeLookOutLeft"), v("eyeLookInRight")),
    moy(v("eyeLookInLeft"), v("eyeLookOutRight"))
  );
  const vertical = Math.max(
    moy(v("eyeLookUpLeft"), v("eyeLookUpRight")),
    moy(v("eyeLookDownLeft"), v("eyeLookDownRight"))
  );
  const yeux = Math.max(horizontal, vertical);

  // Tête tournée : position du nez entre les deux bords du visage (0,5 = de face)
  const bordG = pts[234];
  const bordD = pts[454];
  const nez = pts[1];
  const rapport = (nez.x - bordG.x) / (bordD.x - bordG.x);
  const tete = Math.abs(rapport - 0.5);

  // Inclinaison de la tête (en degrés) : angle de la ligne entre les deux yeux
  const oeilG = pts[33];
  const oeilD = pts[263];
  const dx = (oeilD.x - oeilG.x) * video.videoWidth;
  const dy = (oeilD.y - oeilG.y) * video.videoHeight;
  const roll = Math.atan2(dy, dx) * 180 / Math.PI;

  return {
    sourire: sourire,
    boucheOuverte: boucheOuverte,
    grimace: grimace,
    yeux: yeux,
    tete: tete,
    roll: roll - decalageRoll,
    langue: mesurerLangue(pts),
    pts: pts   // les points du visage (servent à mesurer la couleur du haut)
  };
}

// ---------- Affichage ----------
function afficher(ind) {
  if (ind === null) {
    panneau.textContent = "Visage détecté : NON\n(place-toi face à la caméra, bien éclairé)";
    return;
  }
  const regardOk = ind.yeux < SEUILS.yeux && ind.tete < SEUILS.tete;
  const lignes = [
    "Visage détecté : oui",
    "Regard vers la caméra : " + (regardOk ? "OUI" : "NON") + "   (yeux " + pct(ind.yeux) + ", tête " + pct(ind.tete) + ")",
    "Sourire : " + pct(ind.sourire) + (ind.sourire > SEUILS.sourire ? "   ← sourire" : ""),
    "Bouche ouverte : " + pct(ind.boucheOuverte) + (ind.boucheOuverte > SEUILS.boucheOuverte ? "   ← bouche ouverte (bâillement ?)" : ""),
    "Grimace : " + pct(ind.grimace) + (ind.grimace > SEUILS.grimace ? "   ← grimace" : ""),
    "Tête inclinée : " + Math.round(ind.roll) + "°" + (Math.abs(ind.roll) > SEUILS.roll ? "   ← tête penchée" : ""),
    "Langue (expérimental) : ×" + ind.langue.toFixed(2) + (ind.langue > SEUILS.langue ? "   ← langue tirée ?" : "")
  ];
  panneau.textContent = lignes.join("\n");
}

// ---------- Boucle d'analyse : à chaque nouvelle image de la caméra ----------
function boucle() {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== dernierTemps) {
    dernierTemps = video.currentTime;
    try {
      const resultat = faceLandmarker.detectForVideo(video, performance.now());
      const ind = analyser(resultat);
      traiterPourSuivi(ind);
      window.analyseCamera = { visage: ind !== null, indicateurs: ind || {}, instant: Date.now() };
      afficher(ind);
    } catch (erreur) {
      panneau.textContent = "Erreur d'analyse : " + erreur.message;
    }
  }
  requestAnimationFrame(boucle);
}

// ---------- Démarrage : chargement du modèle ----------
function options(delegue) {
  return {
    baseOptions: { modelAssetPath: URL_MODELE, delegate: delegue },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true
  };
}

async function demarrerAnalyse() {
  panneau.textContent = "Chargement du modèle MediaPipe (quelques secondes)…";
  try {
    const vision = await FilesetResolver.forVisionTasks(URL_WASM);
    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, options("GPU"));
    } catch (erreurGpu) {
      // Si la carte graphique pose problème, on utilise le processeur
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, options("CPU"));
    }
    panneau.textContent = "Modèle chargé. Clique sur « Activer caméra et micro » pour voir l'analyse.";
    boucle();
  } catch (erreur) {
    panneau.textContent = "Erreur MediaPipe : " + erreur.message + "\n(Vérifie ta connexion Internet.)";
  }
}

demarrerAnalyse();
// ===================== SUIVI DANS LE TEMPS (étape 11) =====================
// On compte les événements (langue, bâillement, grimace...) et le temps de regard.

SEUILS.baillement = 0.55;   // bouche très ouverte pendant plus de 1,2 s = bâillement

let decalageRoll = 0;       // inclinaison "normale" de ta tête, mesurée au calibrage

const calibration = { actif: false, echantillons: [] };

const suivi = {
  actif: false,
  dernierInstant: null,
  tempsTotal: 0,          // secondes avec visage détecté
  tempsSansVisage: 0,
  tempsRegard: 0,
  tempsSourire: 0,
  episodesSourire: 0,
  evenements: { langue: 0, baillement: 0, grimace: 0, tete: 0 },
  etat: {
    sourire: { debut: null, declenche: false },
    langue: { debut: null, declenche: false },
    baillement: { debut: null, declenche: false },
    grimace: { debut: null, declenche: false },
    tete: { debut: null, declenche: false }
  }
};

function remiseAZero() {
  suivi.dernierInstant = null;
  suivi.tempsTotal = 0;
  suivi.tempsSansVisage = 0;
  suivi.tempsRegard = 0;
  suivi.tempsSourire = 0;
  suivi.episodesSourire = 0;
  suivi.evenements = { langue: 0, baillement: 0, grimace: 0, tete: 0 };
  for (const nom in suivi.etat) {
    suivi.etat[nom] = { debut: null, declenche: false };
  }
}

// Un "épisode" = une condition vraie pendant au moins dureeMinSec secondes.
// On compte UN événement par épisode.
function suivreEpisode(nom, condition, dureeMinSec, maintenant) {
  const e = suivi.etat[nom];
  if (condition) {
    if (e.debut === null) {
      e.debut = maintenant;
      e.declenche = false;
    }
    if (!e.declenche && (maintenant - e.debut) / 1000 >= dureeMinSec) {
      e.declenche = true;
      if (nom === "sourire") suivi.episodesSourire++;
      else suivi.evenements[nom]++;
    }
  } else {
    e.debut = null;
    e.declenche = false;
  }
}

// Appelée à chaque image analysée (ind = null si aucun visage)
function traiterPourSuivi(ind) {
  const maintenant = performance.now();

  // Pendant le calibrage, on collecte des mesures du visage neutre
  if (calibration.actif && ind !== null) calibration.echantillons.push(ind);

  if (suivi.dernierInstant === null) suivi.dernierInstant = maintenant;
  const dt = Math.min(0.5, (maintenant - suivi.dernierInstant) / 1000);
  suivi.dernierInstant = maintenant;

  if (!suivi.actif) return;

  if (ind === null) {
    suivi.tempsSansVisage += dt;
    return;
  }

  suivi.tempsTotal += dt;
  const regardOk = ind.yeux < SEUILS.yeux && ind.tete < SEUILS.tete;
  if (regardOk) suivi.tempsRegard += dt;
  // Un vrai sourire : sans grimace et sans bouche grande ouverte (donc pas quand tu manges ou fais des grimaces)
  const sourireVrai = ind.sourire > SEUILS.sourire && ind.grimace <= SEUILS.grimace && ind.boucheOuverte < 0.3;
  if (sourireVrai) suivi.tempsSourire += dt;
  suivreEpisode("sourire", sourireVrai, 1.0, maintenant);
  suivreEpisode("langue", ind.langue > SEUILS.langue, 0.4, maintenant);
  suivreEpisode("baillement", ind.boucheOuverte > SEUILS.baillement, 1.2, maintenant);
  suivreEpisode("grimace", ind.grimace > SEUILS.grimace, 0.6, maintenant);
  suivreEpisode("tete", Math.abs(ind.roll) > SEUILS.roll, 3.0, maintenant);
}

// La valeur du milieu d'une liste de nombres
function mediane(valeurs) {
  const t = valeurs.slice().sort(function (a, b) { return a - b; });
  return t[Math.floor(t.length / 2)];
}

// Calibrage : pendant dureeMs, on mesure le visage neutre, puis on adapte les seuils
function calibrer(dureeMs) {
  return new Promise(function (resolve) {
    calibration.echantillons = [];
    calibration.actif = true;
    setTimeout(function () {
      calibration.actif = false;
      const e = calibration.echantillons;
      if (e.length >= 5) {
        const base = {};
        for (const nom of ["grimace", "yeux", "tete", "langue", "roll"]) {
          base[nom] = mediane(e.map(function (x) { return x[nom]; }));
        }
        SEUILS.grimace = Math.max(0.5, base.grimace + 0.25);
        SEUILS.yeux = Math.max(0.45, base.yeux + 0.3);
        SEUILS.tete = Math.max(0.14, base.tete + 0.08);
        SEUILS.langue = Math.max(1.6, base.langue * 2.5);
        decalageRoll = decalageRoll + base.roll;
      }
      resolve();
    }, dureeMs);
  });
}

// Ce que les autres fichiers (app.js, notation.js) peuvent utiliser
window.suiviCamera = {
  calibrer: calibrer,
  demarrer: function () { remiseAZero(); suivi.actif = true; },
  arreter: function () { suivi.actif = false; },
  resume: function () {
    const total = suivi.tempsTotal;
    return {
      disponible: total >= 5,     // au moins 5 secondes de visage mesurées
      duree: total,
      ratioRegard: total > 0 ? suivi.tempsRegard / total : 0,
      ratioSourire: total > 0 ? suivi.tempsSourire / total : 0,
      episodesSourire: suivi.episodesSourire,
      evenements: Object.assign({}, suivi.evenements),
      partSansVisage: suivi.tempsSansVisage / Math.max(1, total + suivi.tempsSansVisage)
    };
  }
};