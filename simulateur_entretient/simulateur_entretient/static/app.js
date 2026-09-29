// app.js : simulateur d'entretien (caméra, micro, voix, QCM, entretien)

// ===================== PARTIE 1 : CAMÉRA + MICRO =====================

const bouton = document.getElementById("btn-demarrer");
const video = document.getElementById("video");
const statut = document.getElementById("statut");
const barreVolume = document.getElementById("barre-volume");

bouton.addEventListener("click", demarrer);

async function demarrer() {
  try {
    // On demande à Chrome l'accès à la caméra ET au micro
    const flux = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    // On branche le flux de la caméra sur la balise <video>
    video.srcObject = flux;
    statut.textContent = "Caméra et micro actifs. Parle pour voir la barre bouger.";

    // --- Mesure du volume du micro ---
    const contexteAudio = new AudioContext();
    const source = contexteAudio.createMediaStreamSource(flux);
    const analyseur = contexteAudio.createAnalyser();
    analyseur.fftSize = 256;
    source.connect(analyseur);

    const donnees = new Uint8Array(analyseur.frequencyBinCount);

    // Cette fonction se répète environ 60 fois par seconde
    function mesurer() {
      analyseur.getByteFrequencyData(donnees);
      let somme = 0;
      for (let i = 0; i < donnees.length; i++) {
        somme += donnees[i];
      }
      const moyenne = somme / donnees.length;
      barreVolume.style.width = Math.min(100, (moyenne / 255) * 200) + "%";
      requestAnimationFrame(mesurer);
    }
    mesurer();

  } catch (erreur) {
    statut.textContent = "Erreur : " + erreur.name + " (" + erreur.message + ")";
  }
}

// ===================== PARTIE 2 : TEST DE LA VOIX =====================

const selectLangue = document.getElementById("langue");
const btnQuestion = document.getElementById("btn-question");
const btnParler = document.getElementById("btn-parler");
const zoneTranscription = document.getElementById("transcription");

// Une question d'essai pour chaque langue
const questionsTest = {
  "fr-FR": "Quelles sont vos principales compétences techniques ?",
  "en-US": "What are your main technical skills?",
  "ar-TN": "ما هي أهم مهاراتك التقنية؟"
};

// L'appli PARLE (synthèse vocale)
function lireAVoixHaute(texte, langue) {
  window.speechSynthesis.cancel();
  const enonce = new SpeechSynthesisUtterance(texte);
  enonce.lang = langue;
  window.speechSynthesis.speak(enonce);
}

btnQuestion.addEventListener("click", function () {
  const langue = selectLangue.value;
  lireAVoixHaute(questionsTest[langue], langue);
});

// L'appli ÉCOUTE (reconnaissance vocale)
// Selon la version de Chrome, l'objet a deux noms possibles
const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!Reconnaissance) {
  zoneTranscription.textContent = "Reconnaissance vocale non supportée : utilise Chrome.";
  btnParler.disabled = true;
} else {
  const reco = new Reconnaissance();
  reco.continuous = true;
  reco.interimResults = true;
  let enEcoute = false;

  btnParler.addEventListener("click", function () {
    if (!enEcoute) {
      reco.lang = selectLangue.value;
      reco.start();
    } else {
      reco.stop();
    }
  });

  reco.onstart = function () {
    enEcoute = true;
    btnParler.textContent = "⏹ Arrêter";
  };

  reco.onend = function () {
    enEcoute = false;
    btnParler.textContent = "🎤 Répondre à voix haute";
  };

  reco.onresult = function (evenement) {
    let texte = "";
    for (let i = 0; i < evenement.results.length; i++) {
      texte += evenement.results[i][0].transcript + " ";
    }
    zoneTranscription.textContent = texte;
  };

  reco.onerror = function (evenement) {
    zoneTranscription.textContent = "Erreur : " + evenement.error;
  };
}

// ===================== PARTIE 3 : PRÉPARATION (QCM) =====================

const selectEntreprise = document.getElementById("choix-entreprise");
const descriptionEntreprise = document.getElementById("description-entreprise");
const zoneQcm = document.getElementById("zone-qcm");
const btnValiderQcm = document.getElementById("btn-valider-qcm");
const resultatQcm = document.getElementById("resultat-qcm");

let entreprises = [];          // toutes les entreprises lues dans le JSON
let entrepriseChoisie = null;  // l'entreprise actuellement sélectionnée
let scoreQcm = 0;              // score du QCM (affiché à part, indépendant de l'entretien)

// On demande la liste des entreprises au serveur Flask
async function chargerEntreprises() {
  try {
    const reponse = await fetch("/api/entreprises");
    entreprises = await reponse.json();

    // On remplit le menu déroulant : une option par entreprise
    entreprises.forEach(function (entreprise, index) {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = entreprise.nom;
      selectEntreprise.appendChild(option);
    });

    afficherEntreprise(0); // on affiche la première par défaut
  } catch (erreur) {
    descriptionEntreprise.textContent = "Impossible de charger les entreprises : " + erreur.message;
  }
}

// Affiche la description et le QCM de l'entreprise numéro "index"
function afficherEntreprise(index) {
  entrepriseChoisie = entreprises[index];
  descriptionEntreprise.textContent = entrepriseChoisie.description;
  resultatQcm.textContent = "";
  zoneQcm.innerHTML = "";   // on vide l'ancien QCM

  entrepriseChoisie.qcm.forEach(function (question, numQuestion) {
    const bloc = document.createElement("div");

    const titre = document.createElement("p");
    titre.textContent = (numQuestion + 1) + ". " + question.texte;
    bloc.appendChild(titre);

    // Un bouton radio pour chaque choix de réponse
    question.choix.forEach(function (texteChoix, numChoix) {
      const etiquette = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = question.id;   // même nom = un seul choix possible
      radio.value = numChoix;
      etiquette.appendChild(radio);
      etiquette.appendChild(document.createTextNode(" " + texteChoix));
      bloc.appendChild(etiquette);
      bloc.appendChild(document.createElement("br"));
    });

    zoneQcm.appendChild(bloc);
  });
}

// Quand on change d'entreprise dans le menu
selectEntreprise.addEventListener("change", function () {
  afficherEntreprise(selectEntreprise.value);
});

// Correction du QCM (indépendante de l'entretien)
btnValiderQcm.addEventListener("click", function () {
  let bonnesReponses = 0;
  let details = "";

  for (const question of entrepriseChoisie.qcm) {
    const coche = document.querySelector('input[name="' + question.id + '"]:checked');

    if (coche === null) {
      resultatQcm.textContent = "Réponds à toutes les questions avant de valider.";
      return;
    }

    if (Number(coche.value) === question.bonne) {
      bonnesReponses++;
      details += "✔ " + question.texte + "\n";
    } else {
      details += "✘ " + question.texte + " → bonne réponse : " + question.choix[question.bonne] + "\n";
    }
  }

  scoreQcm = bonnesReponses;
  resultatQcm.textContent = "Score du QCM : " + bonnesReponses + " / " + entrepriseChoisie.qcm.length + "\n" + details;
});

// ===================== PARTIE 4 : BANQUE DE QUESTIONS COMMUNES =====================

let banqueQuestions = [];   // les questions communes lues dans le JSON

// On demande la banque au serveur Flask
async function chargerBanque() {
  try {
    const reponse = await fetch("/api/banque");
    banqueQuestions = await reponse.json();
  } catch (erreur) {
    console.log("Banque de questions introuvable : " + erreur.message);
  }
}

// Choisit un élément au hasard dans une liste
function choisirAuHasard(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

// Mélange une liste (sans modifier l'originale)
function melanger(liste) {
  const copie = liste.slice();
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copie[i];
    copie[i] = copie[j];
    copie[j] = temp;
  }
  return copie;
}

// Construit la liste des questions de l'entretien
// code = "fr", "en" ou "ar"
function construireEntretien(code) {
  const liste = [];

  // Ajoute une question avec UNE formulation tirée au hasard
  // variantes = un objet du type { fr: [...], en: [...] }
  function ajouter(id, variantes, motsCles) {
    const dansLaLangue = variantes[code];
    const existe = dansLaLangue !== undefined && dansLaLangue.length > 0;
    // Si la langue n'existe pas (ex : arabe), on pose la question en français
    const texte = choisirAuHasard(existe ? dansLaLangue : variantes.fr);
    liste.push({
      id: id,
      texte: texte,
      langueVoix: existe ? selectLangue.value : "fr-FR",
      mots_cles: motsCles   // servira au calcul de la note
    });
  }

  // 1) La présentation, toujours en premier
  const presentation = banqueQuestions.find(function (q) { return q.id === "presentation"; });
  if (presentation) ajouter(presentation.id, presentation, presentation.mots_cles);

  // 2) Les questions propres à l'entreprise (on saute celles qui existent déjà dans la banque)
  for (const q of entrepriseChoisie.questions) {
    const dansLaBanque = banqueQuestions.some(function (b) { return b.id === q.id; });
    if (dansLaBanque) continue;
    ajouter(q.id, q.texte, q.mots_cles);
  }

  // 3) Deux questions communes tirées au hasard
  const communes = banqueQuestions.filter(function (q) { return q.id !== "presentation"; });
  for (const q of melanger(communes).slice(0, 2)) {
    ajouter(q.id, q, q.mots_cles);
  }

  return liste;
}

// ===================== PARTIE 5 : ENTRETIEN =====================

const btnLancer = document.getElementById("btn-lancer");
const btnFinReponse = document.getElementById("btn-fin-reponse");
const zoneQuestion = document.getElementById("question-en-cours");
const zoneReponse = document.getElementById("reponse-en-cours");
const zoneJournal = document.getElementById("journal");
const zoneRapport = document.getElementById("rapport");
const zoneJaugeTexte = document.getElementById("jauge-texte");
const barreJauge = document.getElementById("jauge-barre");

// Réglages de l'arrêt anticipé (tu peux les changer)
const SEUIL_ARRET = 8;     // note en direct (sur 20) en dessous de laquelle le recruteur arrête l'entretien
const QUESTIONS_MIN = 2;   // nombre de questions à faire avant qu'un arrêt soit possible

// Phrases fixes de l'interviewer, dans chaque langue
const PHRASES = {
  fr: {
    accueil: "Bonjour, merci d'être venu. J'ai lu votre CV avec attention. Nous allons commencer l'entretien.",
    questionFinale: "Avez-vous des questions à nous poser ?",
    cloture: "Très bien, c'est tout pour moi. Nous vous recontacterons prochainement.",
    arret: "Je suis désolé, nous allons nous arrêter là. Votre profil ne correspond pas à ce que nous recherchons, nous ne pourrons pas donner suite à votre candidature."
  },
  en: {
    accueil: "Hello, thank you for coming. I have read your resume carefully. Let's begin the interview.",
    questionFinale: "Do you have any questions for us?",
    cloture: "Very well, that is all from me. We will contact you soon.",
    arret: "I'm sorry, we are going to stop here. Your profile does not match what we are looking for, and we will not be able to follow up on your application."
  },
  ar: {
    accueil: "مرحبا، شكرا على حضورك. لقد قرأت سيرتك الذاتية باهتمام. سنبدأ المقابلة.",
    questionFinale: "هل لديك أسئلة تودّ طرحها علينا؟",
    cloture: "حسنا، هذا كل شيء من جهتي. سنتصل بك قريبا.",
    arret: "أنا آسف، سنتوقف هنا. ملفك لا يتوافق مع ما نبحث عنه، ولن نتمكن من متابعة ترشحك."
  }
};

let reponsesEntretien = [];   // toutes les réponses du candidat (pour la note)
let arreterReponse = null;    // fonction qui termine la réponse en cours
let minuterieJauge = null;    // rafraîchit la jauge chaque seconde

// L'interviewer parle, et on attend qu'il ait FINI de parler
function parlerEtAttendre(texte, langue) {
  return new Promise(function (resolve) {
    window.speechSynthesis.cancel();
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = langue;
    enonce.onend = resolve;     // fini de parler : on continue
    enonce.onerror = resolve;   // problème de voix : on continue quand même
    window.speechSynthesis.speak(enonce);
  });
}

// On écoute la réponse du candidat jusqu'à un silence de 4 secondes.
// delaiDepartMs = temps maximum d'attente avant que le candidat commence à parler.
// Renvoie un objet : { texte, delaiSec, dureeSec }
function ecouterReponse(langue, delaiDepartMs) {
  return new Promise(function (resolve) {
    if (!Reconnaissance) {
      resolve({ texte: "", delaiSec: null, dureeSec: 0 });
      return;
    }

    const reco = new Reconnaissance();
    reco.lang = langue;
    reco.continuous = true;
    reco.interimResults = true;

    let texteFinal = "";
    let minuterie = null;
    const tDebut = Date.now();
    let tPremierMot = null;
    let tDernierMot = null;

    function relancerMinuterie(delaiMs) {
      clearTimeout(minuterie);
      minuterie = setTimeout(function () { reco.stop(); }, delaiMs);
    }

    reco.onresult = function (evenement) {
      let texte = "";
      for (let i = 0; i < evenement.results.length; i++) {
        texte += evenement.results[i][0].transcript + " ";
      }
      texteFinal = texte;
      zoneReponse.textContent = texte;

      const maintenant = Date.now();
      if (tPremierMot === null) tPremierMot = maintenant;
      tDernierMot = maintenant;

      relancerMinuterie(4000);   // le candidat parle : silence de 4 s = fin de réponse
    };

    reco.onend = function () {
      clearTimeout(minuterie);
      arreterReponse = null;
      resolve({
        texte: texteFinal.trim(),
        delaiSec: tPremierMot === null ? null : (tPremierMot - tDebut) / 1000,
        dureeSec: tPremierMot === null ? 0 : (tDernierMot - tPremierMot) / 1000
      });
    };

    arreterReponse = function () { reco.stop(); };
    reco.start();
    relancerMinuterie(delaiDepartMs || 15000);
  });
}

// Ajoute une ligne au journal affiché à l'écran
function ajouterAuJournal(question, reponse) {
  zoneJournal.textContent += "Q : " + question + "\nR : " + (reponse || "(aucune réponse)") + "\n\n";
}

// Enregistre une réponse (texte + temps) dans la liste et dans le journal
function enregistrer(id, question, rep, motsCles) {
  reponsesEntretien.push({
    id: id,
    question: question,
    reponse: rep.texte,
    delaiSec: rep.delaiSec,
    dureeSec: rep.dureeSec,
    mots_cles: motsCles || []
  });
  ajouterAuJournal(question, rep.texte);
}

// Statistiques de la caméra (null si camera.js n'est pas chargé)
function statsCamera() {
  return window.suiviCamera ? window.suiviCamera.resume() : null;
}
function statsGestes() {
  return window.suiviGestesApi ? window.suiviGestesApi.resume() : null;
}

// Met à jour la jauge de note en direct
function afficherJauge() {
  if (!zoneJaugeTexte || !barreJauge) return;
  if (typeof calculerNoteEnDirect !== "function" || reponsesEntretien.length === 0) {
    zoneJaugeTexte.textContent = "—";
    barreJauge.style.width = "0%";
    return;
  }
  const note = calculerNoteEnDirect(reponsesEntretien, statsCamera(), statsGestes());
  zoneJaugeTexte.textContent = note + " / 20";
  barreJauge.style.width = (note / 20 * 100) + "%";
  barreJauge.style.background = note >= 12 ? "#2ecc71" : (note >= SEUIL_ARRET ? "#f39c12" : "#e74c3c");
}

// Le recruteur doit-il arrêter l'entretien ?
function doitArreter(nbQuestionsFaites) {
  if (nbQuestionsFaites < QUESTIONS_MIN) return false;
  return calculerNoteEnDirect(reponsesEntretien, statsCamera(), statsGestes()) < SEUIL_ARRET;
}

// Le déroulement complet de l'entretien
async function lancerEntretien() {
  if (entrepriseChoisie === null) return;

  // Si la caméra n'est pas encore active, on l'active automatiquement
  if (!video.srcObject) {
    await demarrer();
    if (!video.srcObject) return;   // caméra ou micro refusés : on n'ouvre pas l'entretien
  }

  // La banque de questions doit être chargée
  if (banqueQuestions.length === 0) {
    zoneQuestion.textContent = "Erreur : banque de questions non chargée. Vérifie http://127.0.0.1:5000/api/banque";
    return;
  }
    // La tenue doit être renseignée avant de commencer
    if (typeof lireProfil === "function") {
      const p = lireProfil();
      if (!p.tenue.haut || !p.tenue.bas || !p.tenue.accessoires) {
        zoneQuestion.textContent = "Avant de commencer, renseigne ta tenue dans « Ta préparation » (haut, bas et chaussures, accessoires).";
        return;
      }
    } 
  btnLancer.disabled = true;
  btnFinReponse.disabled = false;
  reponsesEntretien = [];
  phrasesDejaDites = new Set();
  zoneJournal.textContent = "";
  zoneRapport.textContent = "L'entretien est en cours…";

  const langueVoix = selectLangue.value;      // ex : "fr-FR"
  const code = langueVoix.split("-")[0];      // ex : "fr"
  const phrases = PHRASES[code];

  // On construit les questions AVANT de commencer : une erreur éventuelle s'affiche tout de suite
  let questions;
  try {
    questions = construireEntretien(code);
  } catch (erreur) {
    zoneQuestion.textContent = "Erreur dans les questions : " + erreur.message;
    btnLancer.disabled = false;
    btnFinReponse.disabled = true;
    return;
  }

  // 0) Calibrage de la caméra : 3 secondes, visage neutre
  zoneQuestion.textContent = "Calibrage : regarde la caméra, visage détendu (3 secondes)…";
  zoneReponse.textContent = "";
   // Lecture du formulaire (CV, affaires, tenue)
   profilCandidat = (typeof lireProfil === "function") ? lireProfil() : null;
   if (window.suiviGestesApi) window.suiviGestesApi.demarrer();
   if (window.suiviCamera) {
     // Pendant ces 3 secondes : calibrage du visage ET mesure de la couleur du haut
     const resultats = await Promise.all([
       window.suiviCamera.calibrer(3000),
       (typeof mesurerCouleurHaut === "function") ? mesurerCouleurHaut(3000) : Promise.resolve(null)
     ]);
     if (profilCandidat) profilCandidat.couleurHaut = resultats[1];
     window.suiviCamera.demarrer();   // à partir de maintenant, on compte les événements
   }
  minuterieJauge = setInterval(afficherJauge, 1000);
  afficherJauge();

  let arret = false;

  // 1) Accueil : l'interviewer salue, puis on écoute la réponse du candidat (bonjour...)
  zoneQuestion.textContent = phrases.accueil;
  await parlerEtAttendre(phrases.accueil, langueVoix);
  const repAccueil = await ecouterReponse(langueVoix, 7000);
  enregistrer("accueil", phrases.accueil, repAccueil, []);

  // 2) Les questions, une par une (avec arrêt anticipé possible)
  let nbFaites = 0;
  for (const q of questions) {
    zoneQuestion.textContent = q.texte;
    zoneReponse.textContent = "";
    await parlerEtAttendre(q.texte, q.langueVoix);
    const rep = await ecouterReponse(langueVoix);
    enregistrer(q.id, q.texte, rep, q.mots_cles);
    nbFaites++;
    afficherJauge();
    if (doitArreter(nbFaites)) {
      arret = true;
      break;
    }
  }

  if (arret) {
    // Le recruteur met fin à l'entretien
    zoneQuestion.textContent = phrases.arret;
    zoneReponse.textContent = "";
    await parlerEtAttendre(phrases.arret, langueVoix);
  } else {
    // 3) Questions finales : le candidat pose ses questions, le recruteur répond
    await phaseQuestionsFinales(phrases, code, langueVoix);

    // 4) Clôture : l'interviewer conclut, puis on écoute le remerciement du candidat
    zoneQuestion.textContent = phrases.cloture;
    zoneReponse.textContent = "";
    await parlerEtAttendre(phrases.cloture, langueVoix);
    const repMerci = await ecouterReponse(langueVoix, 7000);
    enregistrer("remerciement", phrases.cloture, repMerci, []);
  }

  // Fin : on arrête le suivi de la caméra et la jauge
  clearInterval(minuterieJauge);
  const stats = statsCamera();
  const statsGest = statsGestes();
  if (window.suiviCamera) window.suiviCamera.arreter();
  if (window.suiviGestesApi) window.suiviGestesApi.arreter();
  afficherJauge();

  zoneQuestion.textContent = arret ? "Entretien arrêté par le recruteur." : "Entretien terminé.";
  btnLancer.disabled = false;
  btnFinReponse.disabled = true;
  console.log("Réponses enregistrées :", reponsesEntretien);
  console.log("Statistiques caméra :", stats);

  // 5) Calcul de la note et affichage du rapport
  if (typeof calculerNote === "function") {
    let resultat = calculerNoteAvecGestes(reponsesEntretien, stats, statsGest);
    if (arret) resultat = preparerRapportArret(resultat, reponsesEntretien, stats);
    zoneRapport.textContent = formaterRapport(resultat);
    zoneRapport.textContent = formaterRapport(resultat);
    if (typeof enregistrerHistorique === "function") enregistrerHistorique(resultat);
  } else {
    zoneRapport.textContent = "Erreur : notation.js n'est pas chargé (vérifie la ligne <script> dans index.html).";
  }
}

btnLancer.addEventListener("click", lancerEntretien);

// Bouton "J'ai fini ma réponse" : on arrête l'écoute tout de suite
btnFinReponse.addEventListener("click", function () {
  if (arreterReponse !== null) arreterReponse();
});

// ===================== DÉMARRAGE : chargement des données =====================
// (ces deux lignes doivent rester tout à la fin du fichier)
chargerEntreprises();
chargerBanque();
// ===================== PARTIE 6 : QUESTIONS FINALES DU CANDIDAT =====================
// ===================== PARTIE 6 : QUESTIONS FINALES DU CANDIDAT =====================

let reponsesRecruteur = {};   // phrases du recruteur, lues dans le JSON

async function chargerReponsesRecruteur() {
  try {
    const reponse = await fetch("/api/reponses_recruteur");
    reponsesRecruteur = await reponse.json();
  } catch (erreur) {
    console.log("Réponses du recruteur introuvables : " + erreur.message);
  }
}
chargerReponsesRecruteur();

// Phrases de secours si le JSON n'est pas chargé
const DEFAUTS = {
  ecoute: { fr: "Je vous écoute." },
  autre: { fr: "D'autres questions ?" }
};

// "valeur" peut être un texte ou une liste de textes : on en choisit un au hasard
function choisirTexteUnique(valeur) {
  if (Array.isArray(valeur)) return choisirAuHasard(valeur);
  return valeur;
}

// Renvoie un bloc de phrases communes (ex : "ecoute"), ou la phrase de secours
function blocCommun(nom) {
  const commun = reponsesRecruteur.commun || {};
  return commun[nom] || DEFAUTS[nom];
}

// Le recruteur choisit une phrase dans un bloc, dans la langue de l'entretien si elle existe
function dire(bloc, code) {
  const existe = bloc[code] !== undefined;
  return {
    texte: choisirTexteUnique(existe ? bloc[code] : bloc.fr),
    langueVoix: existe ? selectLangue.value : "fr-FR"
  };
}

// Est-ce que le candidat dit "oui, j'ai des questions" ?
function ditOui(texte) {
  const t = normaliser(texte);
  if (t === "") return false;
  if (/^(non|no|nan)\b/.test(t)) return false;
  if (t.includes("pas de question") || t.includes("aucune question")) return false;
  return /\b(oui|yes|ouais|bien sur)\b/.test(t) || t.includes("question") || t.includes("نعم");
}

// Construit la réponse du recruteur selon les sujets abordés par le candidat
function construireReponseRecruteur(analyse, code) {
  const societe = reponsesRecruteur[entrepriseChoisie.id] || {};
  const commun = reponsesRecruteur.commun || {};

  // Ces phrases existent en français et en anglais (pour l'instant)
  const langue = (code === "fr" || code === "en") ? code : "fr";

  const morceaux = [];
  // Ajoute une phrase tirée au hasard dans un bloc (si le bloc existe)
  function ajouter(bloc) {
    if (bloc && bloc[langue] !== undefined) morceaux.push(choisirTexteUnique(bloc[langue]));
  }

  if (analyse.groupes.length > 0) ajouter(commun.ouverture);
  for (const groupe of analyse.groupes) ajouter(societe[groupe]);
  if (analyse.interdites) ajouter(commun.interdites);
  if (analyse.interdites) ajouter(commun.interdites);
  if (analyse.groupes.length >= 2) ajouter(commun.compliment);  // candidat bien préparé
  if (morceaux.length === 0) ajouter(commun.generique);

  return {
    texte: morceaux.length > 0 ? morceaux.join(" ") : "Très bien, merci pour votre question.",
    langueVoix: (code === "fr" || code === "en") ? selectLangue.value : "fr-FR"
  };
}

// Toute la phase des questions finales
async function phaseQuestionsFinales(phrases, code, langueVoix) {
  let texteTotal = "";      // tout ce que le candidat dit pendant cette phase
  let delaiPremier = null;  // temps avant sa première réponse
  let dureeTotale = 0;

  // --- Tour 1 : "Avez-vous des questions à nous poser ?" ---
  zoneQuestion.textContent = phrases.questionFinale;
  zoneReponse.textContent = "";
  await parlerEtAttendre(phrases.questionFinale, langueVoix);
  let rep = await ecouterReponse(langueVoix);
  ajouterAuJournal(phrases.questionFinale, rep.texte);
  texteTotal += rep.texte + " ";
  delaiPremier = rep.delaiSec;
  dureeTotale += rep.dureeSec;
  let analyse = analyserQuestions(rep.texte);

  // Le candidat dit "oui j'ai des questions" sans en poser : "Je vous écoute"
  if (analyse.nbQuestions === 0 && ditOui(rep.texte)) {
    const ecoute = dire(blocCommun("ecoute"), code);
    zoneQuestion.textContent = ecoute.texte;
    zoneReponse.textContent = "";
    await parlerEtAttendre(ecoute.texte, ecoute.langueVoix);
    rep = await ecouterReponse(langueVoix);
    ajouterAuJournal(ecoute.texte, rep.texte);
    texteTotal += rep.texte + " ";
    dureeTotale += rep.dureeSec;
    analyse = analyserQuestions(rep.texte);
  }

  // Tant que le candidat pose des questions (3 tours maximum), le recruteur répond
  let tours = 0;
  while (analyse.nbQuestions > 0 && tours < 3) {
    tours++;
    const reponseRecruteur = construireReponseRecruteur(analyse, code);
    zoneQuestion.textContent = reponseRecruteur.texte;
    zoneReponse.textContent = "";
    await parlerEtAttendre(reponseRecruteur.texte, reponseRecruteur.langueVoix);
    zoneJournal.textContent += "Recruteur : " + reponseRecruteur.texte + "\n\n";

    if (tours >= 3) break;

    // "D'autres questions ?" (formulation variable)
    const autre = dire(blocCommun("autre"), code);
    zoneQuestion.textContent = autre.texte;
    zoneReponse.textContent = "";
    await parlerEtAttendre(autre.texte, autre.langueVoix);
    rep = await ecouterReponse(langueVoix, 8000);
    ajouterAuJournal(autre.texte, rep.texte);
    texteTotal += rep.texte + " ";
    dureeTotale += rep.dureeSec;
    analyse = analyserQuestions(rep.texte);
  }

  // On garde tout le texte du candidat pour la note
  reponsesEntretien.push({
    id: "questions_finales",
    question: phrases.questionFinale,
    reponse: texteTotal.trim(),
    delaiSec: delaiPremier,
    dureeSec: dureeTotale,
    mots_cles: []
  });
}
// ===================== MODE TEST : cacher ou montrer les mesures =====================
// Par défaut, le candidat ne voit ni la note en direct ni l'analyse de la caméra
// (voir sa note pendant l'entretien peut stresser, et un vrai recruteur ne l'affiche pas).

const caseModeTest = document.getElementById("mode-test");

function appliquerModeTest() {
  const visible = caseModeTest ? caseModeTest.checked : false;
  const panneau = document.getElementById("analyse-camera");
  const elements = [
    panneau,
    panneau ? panneau.previousElementSibling : null,       // le titre au-dessus du panneau
    zoneJaugeTexte ? zoneJaugeTexte.parentElement : null,  // la ligne "Note en direct : ..."
    document.getElementById("jauge-fond")                  // la barre de la jauge
  ];
  for (const el of elements) {
    if (el) el.style.display = visible ? "" : "none";
  }
}

if (caseModeTest) caseModeTest.addEventListener("change", appliquerModeTest);
appliquerModeTest();   // au chargement de la page : tout est caché
// ===================== ANTI-RÉPÉTITION DES PHRASES DU RECRUTEUR =====================

let phrasesDejaDites = new Set();   // remise à zéro à chaque nouvel entretien

// Comme unTexte, mais évite de reprendre une phrase déjà dite dans cet entretien
function choisirTexteUnique(valeur) {
  if (!Array.isArray(valeur)) return valeur;
  const disponibles = valeur.filter(function (t) { return !phrasesDejaDites.has(t); });
  const choix = choisirAuHasard(disponibles.length > 0 ? disponibles : valeur);
  phrasesDejaDites.add(choix);
  return choix;
}