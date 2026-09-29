// gestes.js : détection des mains et de la posture avec MediaPipe (étape 15)
// Module (il utilise import). Les calculs sont dans gestes_calculs.js.

import { HandLandmarker, PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const URL_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const URL_MAINS = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const URL_POSE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const PAUSE_MS = 90;   // on analyse les mains et la posture environ 11 fois par seconde

const video = document.getElementById("video");
let detecteurMains = null;
let detecteurPose = null;
let dernierCalcul = 0;

// Dernier résultat, lisible par les autres fichiers (on s'en servira à l'étape 16)
window.analyseGestes = { mains: [], contact: null, mouvement: 0, brasCroises: null, posture: null, evalPosture: null };

// ---------- Le panneau d'affichage (visible seulement en mode test) ----------
const panneau = document.createElement("pre");
panneau.id = "analyse-gestes";
panneau.style.cssText = "text-align:left; white-space:pre; background:#f4f4f4; padding:10px; " +
                        "border-radius:8px; font-size:14px; width:fit-content; margin:8px auto;";
const boutonPosture = document.createElement("button");
boutonPosture.textContent = "Recalibrer la posture (assieds-toi bien droit)";
boutonPosture.style.cssText = "display:block; margin:0 auto 8px auto;";

const reference = document.getElementById("analyse-camera");
if (reference && reference.parentNode) {
  reference.parentNode.insertBefore(panneau, reference.nextSibling);
  reference.parentNode.insertBefore(boutonPosture, panneau.nextSibling);
}

const caseTest = document.getElementById("mode-test");
function majAffichage() {
  const visible = caseTest && caseTest.checked;
  panneau.style.display = visible ? "block" : "none";
  boutonPosture.style.display = visible ? "block" : "none";
}
if (caseTest) caseTest.addEventListener("change", majAffichage);
majAffichage();

// ---------- Posture de départ (calibrage automatique) ----------
let echantillonsPosture = [];
let basePosture = null;

function mediane(valeurs) {
  const t = valeurs.slice().sort(function (a, b) { return a - b; });
  return t[Math.floor(t.length / 2)];
}

function recalibrerPosture() {
  echantillonsPosture = [];
  basePosture = null;
}
boutonPosture.addEventListener("click", recalibrerPosture);
window.recalibrerPosture = recalibrerPosture;   // utilisable par app.js à l'étape 16

function alimenterCalibrage(mesure) {
  if (basePosture !== null || mesure === null) return;
  echantillonsPosture.push(mesure);
  if (echantillonsPosture.length >= 30) {   // environ 3 secondes
    basePosture = {
      largeur: mediane(echantillonsPosture.map(function (m) { return m.largeur; })),
      hauteurTete: mediane(echantillonsPosture.map(function (m) { return m.hauteurTete; })),
      inclinaison: mediane(echantillonsPosture.map(function (m) { return m.inclinaison; }))
    };
  }
}

// ---------- Vitesse de mouvement des mains ----------
const dernierePosition = {};   // dernière position du poignet, par main
let vitesses = [];             // vitesses récentes (1,5 seconde)

// Renvoie la vitesse moyenne des mains, en "hauteurs de visage par seconde"
function mettreAJourMouvement(mains, tailleRefPx, W, H, maintenant) {
  let vMax = 0;
  mains.forEach(function (m) {
    const p = m.points[0];   // le poignet
    const avant = dernierePosition[m.cote];
    if (avant && maintenant - avant.t < 400) {
      const dt = (maintenant - avant.t) / 1000;
      vMax = Math.max(vMax, distPx(p, avant.p, W, H) / tailleRefPx / dt);
    }
    dernierePosition[m.cote] = { p: p, t: maintenant };
  });

  vitesses.push({ t: maintenant, v: vMax });
  while (vitesses.length > 0 && maintenant - vitesses[0].t > 1500) vitesses.shift();
  let somme = 0;
  for (const x of vitesses) somme += x.v;
  return vitesses.length > 0 ? somme / vitesses.length : 0;
}

// ---------- Analyse d'une image ----------
const NOMS_GESTES = {
  ouverte: "main ouverte ✔",
  poing: "poing fermé ✘",
  pointe: "doigt pointé ✘",
  honneur: "geste grossier ✘✘",
  pouce: "pouce levé (neutre)",
  autre: "autre geste (neutre)"
};

function analyserImage(maintenant) {
  const W = video.videoWidth;
  const H = video.videoHeight;

  // --- Les mains ---
  const mains = [];
  if (detecteurMains) {
    const rm = detecteurMains.detectForVideo(video, maintenant);
    if (rm && rm.landmarks) {
      const etiquettes = rm.handedness || rm.handednesses || [];
      rm.landmarks.forEach(function (points, i) {
        const cote = (etiquettes[i] && etiquettes[i][0]) ? etiquettes[i][0].categoryName : String(i);
        mains.push({ cote: cote, points: points, geste: classerMain(points, W, H) });
      });
    }
  }

  // --- La pose (épaules, bras) ---
  let pose = null;
  if (detecteurPose) {
    const rp = detecteurPose.detectForVideo(video, maintenant);
    if (rp && rp.landmarks && rp.landmarks.length > 0) pose = rp.landmarks[0];
  }

  // --- Le visage (calculé par camera.js) ---
  const a = window.analyseCamera;
  const ptsVisage = (a && a.visage && a.indicateurs && a.indicateurs.pts) ? a.indicateurs.pts : null;

  // Contact main - visage
  let contact = null;
  if (ptsVisage) {
    for (const m of mains) {
      const c = mainSurVisage(m.points, ptsVisage, W, H);
      if (c === "bouche") contact = "bouche";
      else if (c === "visage" && contact === null) contact = "visage";
    }
  }

  // Mouvement des mains (référence : la hauteur du visage, sinon un quart de l'image)
  const tailleRefPx = ptsVisage ? Math.max(20, (ptsVisage[152].y - ptsVisage[10].y) * H) : H * 0.25;
  const mouvement = mettreAJourMouvement(mains, tailleRefPx, W, H, maintenant);

  // Bras croisés et posture
  const croises = pose ? brasCroises(pose, W, H) : null;
  const mesure = pose ? mesurerPosture(pose, W, H) : null;
  alimenterCalibrage(mesure);
  const evalP = evaluerPosture(mesure, basePosture);
  traiterPourSuiviGestes(mains, contact, mouvement, croises, evalP, maintenant);
  window.analyseGestes = { mains: mains, contact: contact, mouvement: mouvement, brasCroises: croises,
                           posture: mesure, evalPosture: evalP, instant: Date.now() };
  afficher(mains, contact, mouvement, croises, mesure, evalP);
}

// ---------- Affichage ----------
function afficher(mains, contact, mouvement, croises, mesure, evalP) {
  const lignes = [];

  if (mains.length === 0) {
    lignes.push("Mains : non visibles");
  } else {
    const noms = mains.map(function (m, i) { return "main " + (i + 1) + " = " + NOMS_GESTES[m.geste]; });
    lignes.push("Mains : " + noms.join("  |  "));
  }

  if (contact === "bouche") lignes.push("Contact avec le visage : OUI, devant la bouche ✘");
  else if (contact === "visage") lignes.push("Contact avec le visage : OUI ✘");
  else lignes.push("Contact avec le visage : non");

  if (mains.length === 0) {
    lignes.push("Mouvement des mains : —");
  } else {
    let jugement = " (calme)";
    if (mouvement >= SEUILS_GESTES.mouvementAgite) jugement = " (agité ✘)";
    else if (mouvement >= SEUILS_GESTES.mouvementModere) jugement = " (modéré ✔)";
    lignes.push("Mouvement des mains : " + mouvement.toFixed(2) + jugement);
  }

  if (croises === null) lignes.push("Bras croisés : non mesurable (bras hors de l'image)");
  else lignes.push("Bras croisés : " + (croises ? "OUI ✘" : "non"));

  if (mesure === null) {
    lignes.push("Posture : épaules non visibles (éloigne-toi un peu de la caméra)");
  } else if (basePosture === null) {
    lignes.push("Posture : calibrage en cours (" + echantillonsPosture.length + " / 30)… reste bien droit");
  } else {
    const t = Math.round(100 * mesure.hauteurTete / basePosture.hauteurTete);
    const l = Math.round(100 * mesure.largeur / basePosture.largeur);
    const inc = Math.round(mesure.inclinaison - basePosture.inclinaison);
    lignes.push("Épaules : inclinaison " + inc + "° | tête à " + t + " % | largeur " + l + " %");
    const alertes = [];
    if (evalP.avachi) alertes.push("avachi ✘");
    if (evalP.tropPres) alertes.push("trop près de l'écran");
    if (evalP.tropLoin) alertes.push("reculé");
    if (evalP.epaulesInclinees) alertes.push("épaules inclinées ✘");
    lignes.push("Posture : " + (alertes.length > 0 ? alertes.join(", ") : "droite ✔"));
  }

  panneau.textContent = lignes.join("\n");
}

// ---------- Boucle et démarrage ----------
function boucle() {
  const maintenant = performance.now();
  if (video.readyState >= 2 && video.videoWidth > 0 && maintenant - dernierCalcul >= PAUSE_MS) {
    dernierCalcul = maintenant;
    try {
      analyserImage(maintenant);
    } catch (erreur) {
      panneau.textContent = "Erreur gestes : " + erreur.message;
    }
  }
  requestAnimationFrame(boucle);
}

// Crée un détecteur (avec la carte graphique, sinon avec le processeur)
async function creer(Classe, vision, modele, extra) {
  const options = Object.assign({ baseOptions: { modelAssetPath: modele, delegate: "GPU" }, runningMode: "VIDEO" }, extra);
  try {
    return await Classe.createFromOptions(vision, options);
  } catch (erreurGpu) {
    options.baseOptions.delegate = "CPU";
    return await Classe.createFromOptions(vision, options);
  }
}

async function demarrerGestes() {
  panneau.textContent = "Chargement des modèles mains et posture (quelques secondes)…";
  try {
    const vision = await FilesetResolver.forVisionTasks(URL_WASM);
    detecteurMains = await creer(HandLandmarker, vision, URL_MAINS, { numHands: 2 });
    detecteurPose = await creer(PoseLandmarker, vision, URL_POSE, { numPoses: 1 });
    panneau.textContent = "Modèles chargés. Active la caméra pour voir l'analyse.";
    boucle();
  } catch (erreur) {
    panneau.textContent = "Erreur MediaPipe (mains / posture) : " + erreur.message + "\n(Vérifie ta connexion Internet.)";
  }
}

demarrerGestes();
// ===================== SUIVI DANS LE TEMPS (étape 16) =====================

const suiviGestes = {
  actif: false,
  dernierInstant: null,
  tempsTotal: 0,           // secondes avec mains OU pose détectées
  tempsMainsVisibles: 0,
  tempsPostureVisible: 0,
  episodesMainOuverte: 0,
  evenements: { bouche: 0, visage: 0, poing: 0, pointe: 0, honneur: 0, agitation: 0,
               brasCroises: 0, avachi: 0, epaulesInclinees: 0 },
  etat: {}
};

function remiseAZeroGestes() {
  suiviGestes.dernierInstant = null;
  suiviGestes.tempsTotal = 0;
  suiviGestes.tempsMainsVisibles = 0;
  suiviGestes.tempsPostureVisible = 0;
  suiviGestes.episodesMainOuverte = 0;
  suiviGestes.evenements = { bouche: 0, visage: 0, poing: 0, pointe: 0, honneur: 0, agitation: 0,
                             brasCroises: 0, avachi: 0, epaulesInclinees: 0 };
  suiviGestes.etat = {};
}

// Un "épisode" = une condition vraie pendant au moins dureeMinSec. Un seul événement par épisode.
function suivreEpisodeGeste(nom, condition, dureeMinSec, maintenant) {
  if (!suiviGestes.etat[nom]) suiviGestes.etat[nom] = { debut: null, declenche: false };
  const e = suiviGestes.etat[nom];
  if (condition) {
    if (e.debut === null) { e.debut = maintenant; e.declenche = false; }
    if (!e.declenche && (maintenant - e.debut) / 1000 >= dureeMinSec) {
      e.declenche = true;
      if (nom === "mainOuverte") suiviGestes.episodesMainOuverte++;
      else suiviGestes.evenements[nom]++;
    }
  } else {
    e.debut = null; e.declenche = false;
  }
}

// Appelée à chaque image analysée (branchée sur analyserImage, voir ajout ci-dessous)
function traiterPourSuiviGestes(mains, contact, mouvement, croises, evalP, maintenant) {
  if (suiviGestes.dernierInstant === null) suiviGestes.dernierInstant = maintenant;
  const dt = Math.min(0.5, (maintenant - suiviGestes.dernierInstant) / 1000);
  suiviGestes.dernierInstant = maintenant;
  if (!suiviGestes.actif) return;

  suiviGestes.tempsTotal += dt;
  if (mains.length > 0) suiviGestes.tempsMainsVisibles += dt;
  if (evalP !== null) suiviGestes.tempsPostureVisible += dt;

  const gestesMains = mains.map(function (m) { return m.geste; });
  suivreEpisodeGeste("mainOuverte", gestesMains.includes("ouverte"), 1.0, maintenant);
  suivreEpisodeGeste("bouche", contact === "bouche", 0.6, maintenant);
  suivreEpisodeGeste("visage", contact === "visage", 0.8, maintenant);
  suivreEpisodeGeste("poing", gestesMains.includes("poing"), 1.0, maintenant);
  suivreEpisodeGeste("pointe", gestesMains.includes("pointe"), 1.0, maintenant);
  suivreEpisodeGeste("honneur", gestesMains.includes("honneur"), 0.5, maintenant);
  suivreEpisodeGeste("agitation", mouvement >= SEUILS_GESTES.mouvementAgite, 1.5, maintenant);

  if (evalP !== null) {
    suivreEpisodeGeste("brasCroises", croises === true, 1.5, maintenant);
    suivreEpisodeGeste("avachi", evalP.avachi, 2.0, maintenant);
    suivreEpisodeGeste("epaulesInclinees", evalP.epaulesInclinees, 2.0, maintenant);
  }
}

// Ce que notation.js peut utiliser
window.suiviGestesApi = {
  demarrer: function () { remiseAZeroGestes(); suiviGestes.actif = true; },
  arreter: function () { suiviGestes.actif = false; },
  resume: function () {
    const t = suiviGestes.tempsTotal;
    return {
      mainsDisponibles: suiviGestes.tempsMainsVisibles >= 5,
      postureDisponible: suiviGestes.tempsPostureVisible >= 5,
      episodesMainOuverte: suiviGestes.episodesMainOuverte,
      evenements: Object.assign({}, suiviGestes.evenements)
    };
  }
};