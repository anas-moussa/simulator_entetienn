// notation.js : moteur de note (partie PAROLE seulement pour l'instant)
// Ce fichier ne touche pas à la page : il reçoit les réponses et renvoie un résultat.

// ---------- Poids des catégories ----------
// Total prévu : 100 points. Pour l'instant on ne note que la parole (60 points).
// À ajouter plus tard : langage corporel (25), tenue (10), préparation (5).
const POIDS = {
    contenu: 30,   // présentation et contenu des réponses
    verbal: 15,    // communication verbale
    finales: 15    // questions finales et remerciements
  };
  
  // ---------- Listes de mots (tu pourras les enrichir) ----------
  const MOTS = {
    bonjour: ["bonjour", "bonsoir", "hello", "good morning", "good afternoon", "good evening",
              "مرحبا", "السلام عليكم", "صباح الخير", "مساء الخير"],
  
    // Mots parasites (Chrome n'écrit pas toujours les "euh" : critère à améliorer plus tard)
    parasites: ["euh", "heu", "heuh", "hum", "hmm", "bah", "ben", "du coup", "uh", "um", "erm", "you know"],
  
    // Langage trop familier
    familiers: ["ouais", "wesh", "mec", "bro", "gars", "truc", "ca roule"],
  
    // Signes d'un exemple concret
    exemples: ["par exemple", "j'ai realise", "j'ai developpe", "j'ai cree", "j'ai concu",
               "j'ai participe", "j'ai travaille", "j'ai fait", "lors de", "durant mon",
               "pendant mon", "dans mon projet", "en stage",
               "for example", "i built", "i developed", "i created", "i worked", "i led",
               "during my", "in my project", "مثلا", "على سبيل المثال", "قمت ب", "انجزت"],
  
    // Phrases qui montrent qu'on est trop sûr de soi
    surconfiance: ["je suis le meilleur", "je suis la meilleure", "le meilleur candidat",
                   "je suis parfait", "je suis parfaite", "aucun defaut", "pas de defaut",
                   "aucun point faible", "pas de point faible", "je ne fais jamais d'erreur",
                   "je ne me trompe jamais", "je sais tout",
                   "i am the best", "i have no weakness", "i never make mistakes", "i'm perfect",
                   "انا الافضل"],
  
    // Remerciements
    merciComplet: ["merci pour votre temps", "merci de votre temps", "merci pour le temps",
                   "merci de m'avoir recu", "merci pour cet entretien", "merci pour cette opportunite",
                   "thank you for your time", "thanks for your time", "thank you for having me",
                   "شكرا على وقتكم", "شكرا على وقتك"],
    merciSimple: ["merci", "thank", "شكرا"],
  
    // Mots qui montrent qu'on pose une question
    interrogatifs: ["quel", "quelle", "quels", "quelles", "comment", "pourquoi", "est-ce", "est ce",
                    "combien", "quand", "qui", "pouvez-vous", "pouvez vous", "puis-je", "puis je",
                    "peut-on", "peut on", "y a-t-il", "y a t il", "aimerais savoir", "voudrais savoir",
                    "souhaiterais savoir", "je me demandais",
                    "what", "how", "when", "where", "who", "why", "could you", "can you", "can i",
                    "is there", "do you", "are there", "which",
                    "ما", "ماذا", "كيف", "متى", "اين", "لماذا", "هل", "كم"],
  
    // Sujets pertinents pour les questions finales (d'après le cours)
    groupes: {
      entreprise: ["fonde", "fondee", "creee", "cree", "existe depuis", "histoire de l'entreprise",
      "combien d'employes", "taille de l'entreprise", "presence internationale", "depuis quand"],
      activite: ["activite", "projets", "strategie", "clients", "produits", "technologies", "methode",
                 "objectifs de l'entreprise", "evolution de l'entreprise",
                 "company", "strategy", "projects", "products"],
      poste: ["service", "poste", "mission", "role", "affecte", "equipe", "taches",
              "team", "position", "responsibilities", "department"],
      conditions: ["horaires", "flexibilite", "teletravail", "conditions de travail", "lieu de travail",
                   "working hours", "remote", "flexibility", "working conditions"],
      suite: ["recontacte", "recontacter", "la suite", "reponse", "delai", "prochaine etape",
              "prochaines etapes", "nouvelles", "next step", "hear back", "follow up", "decision"]
    },
  
    // Questions à éviter au premier entretien : PAS de pénalité, juste un conseil
    interdites: ["conges", "conge", "vacances", "dejeuner", "pause", "salaire", "remuneration",
    "paie", "augmentation", "salary", "wage", "pay"]
  };
  
  // Noms lisibles des sujets (pour les conseils)
  const LIBELLES = {
    activite: "l'activité et les projets de l'entreprise",
    poste: "le poste, le service ou la mission",
    conditions: "les conditions de travail",
    suite: "la suite du processus (qui vous recontacte, quand)",
    entreprise: "l'histoire et la taille de l'entreprise"
  };
  
  // ---------- Détection du nom et de l'âge (sur du texte normalisé) ----------
  const REGEX_NOM = /(je m'appelle|je m appelle|mon nom est|mon prenom est|my name is|اسمي)/;
  
  const REGEX_AGE = [
    /\bj'?\s?ai\s+\d{1,2}\s+ans\b(?!\s+(?:de|d'))/,
    /\bj'?\s?ai\s+(?:dix[- ]?sept|dix[- ]?huit|dix[- ]?neuf|vingt|trente)(?:[- ]et[- ]un|[- ](?:deux|trois|quatre|cinq|six|sept|huit|neuf))?\s+ans\b(?!\s+(?:de|d'))/,
    /\bage de\s+\d{1,2}\s+ans\b/,
    /\b(?:i am|i'm)\s+\d{1,2}\s+years old\b/,
    /عمري\s+\d{1,2}/
  ];
  
  // ---------- Conseils (texte affiché dans le rapport) ----------
  const CONSEILS = {
    nomAge: "Ne commence pas ta présentation par ton nom ou ton âge : le recruteur a déjà ton CV. Parle de ton parcours, de tes compétences et de ce que tu peux apporter.",
    presTrop: "Ta présentation doit durer 3 minutes maximum. Entraîne-toi avec un chronomètre.",
    presCourte: "Ta présentation était trop courte : développe ton parcours, tes compétences et donne un exemple concret.",
    surconfiance: "Évite les phrases comme « je suis le meilleur » ou « je n'ai aucun défaut » : présente tes atouts avec des faits (projets, résultats) sans paraître trop sûr de toi.",
    bonjour: "Dis toujours bonjour quand le recruteur t'accueille.",
    parasites: "Réduis les mots parasites (euh, ben, du coup) : fais une courte pause à la place.",
    silences: "Évite les longs silences : prépare tes réponses aux questions classiques (sans les apprendre par cœur).",
    familier: "Garde un langage soutenu : évite « ouais », « mec », « truc »…",
    reponsesFaibles: "Pour chaque réponse, utilise le vocabulaire du poste et donne un exemple concret (projet, stage, résultat).",
    non: "Ne réponds jamais « non » à « Avez-vous des questions ? » : pose 2 ou 3 questions sur l'activité, le poste, les conditions de travail et la suite du processus. Cela montre ton intérêt.",
    interdites: "Les questions sur les congés, la pause déjeuner ou le salaire se posent plutôt une fois que tu es retenu.",
    merciSimple: "Termine par « Merci pour votre temps » : c'est la formule attendue.",
    merciAbsent: "N'oublie pas de remercier le recruteur à la fin : « Merci pour votre temps »."
  };
  
  // ---------- Petits outils sur le texte ----------
  
  // Minuscules + sans accents : "Présentation" -> "presentation"
  function normaliser(texte) {
    return (texte || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’`]/g, "'")
      .trim();
  }
  
  // Protège les caractères spéciaux d'un mot avant de l'utiliser dans une expression régulière
  function echapper(mot) {
    return mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  
  // Compte combien de fois un MOT ENTIER apparaît (texte déjà normalisé)
  function compterOccurrences(texte, mot) {
    const m = normaliser(mot);
    const regex = new RegExp("(^|[^a-z0-9])" + echapper(m) + "(?![a-z0-9])", "g");
    const resultat = texte.match(regex);
    return resultat ? resultat.length : 0;
  }
  
  // Renvoie les éléments de la liste que le texte CONTIENT (plus tolérant : "projet" trouve "projets")
  function contient(texte, liste) {
    return liste.filter(function (mot) {
      return texte.includes(normaliser(mot));
    });
  }
  
  function nombreDeMots(texte) {
    const t = texte.trim();
    return t === "" ? 0 : t.split(/\s+/).length;
  }
  
  // Garde un nombre entre un minimum et un maximum
  function borner(x, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, x));
  }
  
  // Arrondi à 1 décimale
  function arrondir(x) {
    return Math.round(x * 10) / 10;
  }
  
  // ---------- Note d'UNE réponse (sur 10) ----------
  function noterReponse(reponse) {
    const t = normaliser(reponse.reponse);
    if (t === "") return { note: 0, motsCles: [], exemple: false };
  
    const motsCles = contient(t, reponse.mots_cles || []);
    const exemple = contient(t, MOTS.exemples).length > 0;
  
    let note = Math.min(6, motsCles.length * 2);   // 2 points par mot-clé, 6 maximum
    if (exemple) note += 3;                        // exemple concret
    if (nombreDeMots(t) >= 15) note += 1;          // réponse assez développée
  
    return { note: Math.min(10, note), motsCles: motsCles, exemple: exemple };
  }
  
  // ---------- LE CALCUL DE LA NOTE ----------
  // reponses = la liste "reponsesEntretien" créée dans app.js
  function calculerNote(reponses, statsCamera) {
    const evenements = [];      // { categorie, points, texte }
    const conseils = [];
    const pointsForts = [];
    const detailQuestions = [];
  
    function evenement(categorie, points, texte, conseil) {
      evenements.push({ categorie: categorie, points: points, texte: texte });
      if (conseil && !conseils.includes(conseil)) conseils.push(conseil);
    }
  
    function parId(id) {
      return reponses.find(function (r) { return r.id === id; });
    }
  
    const accueil = parId("accueil");
    const presentation = parId("presentation");
    const finales = parId("questions_finales");
    const remerciement = parId("remerciement");
  
    // Les vraies questions d'entretien (présentation comprise)
    const questions = reponses.filter(function (r) {
      return r.id !== "accueil" && r.id !== "questions_finales" && r.id !== "remerciement";
    });
  
    // ===== CATÉGORIE 1 : PRÉSENTATION ET CONTENU (30 points) =====
    let sommeNotes = 0;
    for (const q of questions) {
      const n = noterReponse(q);
      sommeNotes += n.note;
      let ligne = q.id + " : " + n.note + " / 10";
      if (n.motsCles.length > 0) ligne += " (mots-clés : " + n.motsCles.join(", ") + ")";
      if (n.exemple) ligne += " + exemple concret";
      if (normaliser(q.reponse) === "") ligne = q.id + " : 0 / 10 (aucune réponse)";
      detailQuestions.push(ligne);
    }
    const moyenne = questions.length > 0 ? sommeNotes / questions.length : 0;
    let contenu = POIDS.contenu * moyenne / 10;
  
    if (moyenne < 5) {
      conseils.push(CONSEILS.reponsesFaibles);
    }
  
    if (presentation) {
      const t = normaliser(presentation.reponse);
      if (t !== "") {
        const ditNom = REGEX_NOM.test(t) || diraitSonNom(presentation.reponse);
        const ditAge = REGEX_AGE.some(function (r) { return r.test(t); });
  
        if (ditNom || ditAge) {
          const quoi = ditNom && ditAge ? "ton nom et ton âge" : (ditNom ? "ton nom" : "ton âge");
          evenement("contenu", -10, "Présentation : tu as donné " + quoi + " (« je m'appelle… », « j'ai X ans »)", CONSEILS.nomAge);
          contenu -= 10;
        } else {
          pointsForts.push("Ta présentation ne commence pas par ton nom ni ton âge : le recruteur a déjà ton CV.");
        }
  
        if (presentation.dureeSec > 180) {
          evenement("contenu", -5, "Présentation trop longue (plus de 3 minutes)", CONSEILS.presTrop);
          contenu -= 5;
        } else if (presentation.dureeSec < 20) {
          evenement("contenu", -5, "Présentation trop courte (moins de 20 secondes)", CONSEILS.presCourte);
          contenu -= 5;
        }
      }
    }
  
    // Trop sûr de soi (dans n'importe quelle réponse)
    for (const r of reponses) {
      const trouves = contient(normaliser(r.reponse), MOTS.surconfiance);
      if (trouves.length > 0) {
        evenement("contenu", -5, "Tu as l'air trop sûr de toi (« " + trouves[0] + " »)", CONSEILS.surconfiance);
        contenu -= 5;
        break;   // une seule fois
      }
    }
    contenu = borner(contenu, 0, POIDS.contenu);
  
    // ===== CATÉGORIE 2 : COMMUNICATION VERBALE (15 points) =====
    let verbal = POIDS.verbal;
  
    // Bonjour (dans l'accueil ou au début de la présentation)
    const texteSalut = normaliser(accueil ? accueil.reponse : "") + " " + normaliser(presentation ? presentation.reponse : "");
    if (contient(texteSalut, MOTS.bonjour).length === 0) {
      evenement("verbal", -3, "Tu n'as pas dit bonjour", CONSEILS.bonjour);
      verbal -= 3;
    } else {
      pointsForts.push("Tu as salué le recruteur.");
    }
  
    // Mots parasites : on tolère 3 par réponse
    let totalParasites = 0;
    let exces = 0;
    for (const q of questions) {
      const t = normaliser(q.reponse);
      let n = 0;
      for (const mot of MOTS.parasites) n += compterOccurrences(t, mot);
      totalParasites += n;
      if (n > 3) exces += n - 3;
    }
    if (exces > 0) {
      const perte = Math.min(6, exces);
      evenement("verbal", -perte, "Mots parasites : " + totalParasites + " au total", CONSEILS.parasites);
      verbal -= perte;
    } else if (totalParasites === 0) {
      pointsForts.push("Peu ou pas de mots parasites détectés.");
    }
  
    // Silences avant de répondre (plus de 8 secondes) ou réponse vide
    let nbSilences = 0;
    for (const q of questions) {
      const vide = normaliser(q.reponse) === "";
      const tropLong = typeof q.delaiSec === "number" && q.delaiSec > 8;
      if (vide || tropLong) nbSilences++;
    }
    if (nbSilences > 0) {
      const perte = Math.min(6, nbSilences * 3);
      evenement("verbal", -perte, "Longs silences ou réponses vides : " + nbSilences, CONSEILS.silences);
      verbal -= perte;
    }
  
    // Langage familier
    let nbFamiliers = 0;
    const familiersTrouves = [];
    for (const r of reponses) {
      const t = normaliser(r.reponse);
      for (const mot of MOTS.familiers) {
        const n = compterOccurrences(t, mot);
        if (n > 0) {
          nbFamiliers += n;
          if (!familiersTrouves.includes(mot)) familiersTrouves.push(mot);
        }
      }
    }
    if (nbFamiliers > 0) {
      const perte = Math.min(4, nbFamiliers);
      evenement("verbal", -perte, "Langage familier : " + familiersTrouves.join(", "), CONSEILS.familier);
      verbal -= perte;
    }
    verbal = borner(verbal, 0, POIDS.verbal);
  
    // ===== CATÉGORIE 3 : QUESTIONS FINALES ET REMERCIEMENTS (15 points) =====
    let scoreFinales = 0;
    let ditNon = false;
  
    const tf = normaliser(finales ? finales.reponse : "");
  
    // Combien de questions le candidat a-t-il posées ?
    let nbMarqueurs = 0;
    for (const mot of MOTS.interrogatifs) nbMarqueurs += compterOccurrences(tf, mot);
  
    const groupesTrouves = [];
    for (const nom of ["activite", "poste", "conditions", "suite", "entreprise"]) {
      if (contient(tf, MOTS.groupes[nom]).length > 0) groupesTrouves.push(nom);
    }
    const interdites = contient(tf, MOTS.interdites);
  
    const nbQuestions = Math.max(
      Math.min(nbMarqueurs, 3),
      groupesTrouves.length + (interdites.length > 0 ? 1 : 0)
    );
  
    if (nbQuestions === 0) {
      ditNon = true;
      evenement("finales", 0, "Aucune question posée à la fin (« non » ou silence) : note plafonnée à 8/20", CONSEILS.non);
    } else {
      const pts = 4 * Math.min(3, groupesTrouves.length);
      if (pts > 0) {
        const noms = groupesTrouves.map(function (g) { return LIBELLES[g]; });
        evenement("finales", pts, "Bonnes questions posées sur : " + noms.join(" ; "));
        scoreFinales += pts;
      }
      if (groupesTrouves.length < 3) {
        const manquants = ["activite", "poste", "conditions", "suite"]
          .filter(function (g) { return !groupesTrouves.includes(g); })
          .slice(0, 2)
          .map(function (g) { return LIBELLES[g]; });
        conseils.push("Tu peux aussi poser des questions sur : " + manquants.join(" ; ") + ".");
      }
      if (interdites.length > 0) {
        conseils.push(CONSEILS.interdites);   // aucune pénalité, juste un conseil
      }
    }
  
    // Remerciement (dit après la question finale ou à la fin)
    const texteMerci = tf + " " + normaliser(remerciement ? remerciement.reponse : "");
    if (estRemerciementComplet(texteMerci)) {
      evenement("finales", 3, "Remerciement complet (« merci pour votre temps »)");
      scoreFinales += 3;
      pointsForts.push("Tu as remercié le recruteur pour son temps.");
    } else if (contient(texteMerci, MOTS.merciSimple).length > 0) {
      evenement("finales", 1, "Remerciement simple", CONSEILS.merciSimple);
      scoreFinales += 1;
    } else {
      evenement("finales", -5, "Aucun remerciement à la fin", CONSEILS.merciAbsent);
      scoreFinales -= 5;
    }
    scoreFinales = borner(scoreFinales, 0, POIDS.finales);
  
    if (groupesTrouves.length >= 2) {
      pointsForts.push("Tu as posé des questions pertinentes à la fin de l'entretien.");
    }
  
    // ===== TOTAL, PLAFOND ET DÉCISION =====
    const categories = [
      { nom: "Présentation et contenu", score: contenu, max: POIDS.contenu },
      { nom: "Communication verbale", score: verbal, max: POIDS.verbal },
      { nom: "Questions finales et remerciements", score: scoreFinales, max: POIDS.finales }
    ];
    
  // ===== CATÉGORIE 4 : LANGAGE CORPOREL (caméra) =====
  const corps = noterCorps(statsCamera);   // null si la caméra n'a rien mesuré
  if (corps !== null) {
    categories.push({ nom: "Langage corporel (caméra)", score: corps.score, max: POIDS.corps });
    for (const e of corps.evenements) evenements.push(e);
    for (const c of corps.conseils) {
      if (!conseils.includes(c)) conseils.push(c);
    }
    for (const p of corps.pointsForts) pointsForts.push(p);
  }
      // ===== VOUVOIEMENT (compte dans la communication verbale) =====
  const vouv = analyserVouvoiement(reponses);
  if (vouv.perte > 0) {
    const catVerbal = categories.find(function (c) { return c.nom === "Communication verbale"; });
    catVerbal.score = borner(catVerbal.score - vouv.perte, 0, catVerbal.max);
    evenements.push({ categorie: "verbal", points: -vouv.perte, texte: vouv.texte });
    if (!conseils.includes(CONSEILS.tutoiement)) conseils.push(CONSEILS.tutoiement);
  } else if (vouv.bien) {
    pointsForts.push("Tu as bien vouvoyé le recruteur.");
  }
  // ===== CATÉGORIES 5 ET 6 : TENUE ET PRÉPARATION (formulaire + couleur du haut) =====
  if (typeof noterTenue === "function" && typeof profilCandidat !== "undefined" && profilCandidat !== null) {
    const tenue = noterTenue(profilCandidat);
    const prepa = noterPreparation(profilCandidat, reponses);
    for (const bloc of [tenue, prepa]) {
      categories.push({ nom: bloc.nom, score: bloc.score, max: bloc.max });
      for (const e of bloc.evenements) evenements.push(e);
      for (const c of bloc.conseils) {
        if (!conseils.includes(c)) conseils.push(c);
      }
      for (const p of bloc.pointsForts) pointsForts.push(p);
    }
  }
  
    let total = 0;
    let maxTotal = 0;
    for (const c of categories) {
      total += c.score;
      maxTotal += c.max;
    }
  
    let note20 = (total / maxTotal) * 20;
    let plafonnee = false;
    if (ditNon && note20 > 8) {
      note20 = 8;
      plafonnee = true;
    }
    note20 = arrondir(note20);
  
    let decision;
    if (note20 >= 14) decision = "Accepté";
    else if (note20 >= 10) decision = "En réflexion";
    else decision = "Refusé";
  
    return {
      categories: categories,
      note20: note20,
      plafonnee: plafonnee,
      decision: decision,
      evenements: evenements,
      conseils: conseils,
      pointsForts: pointsForts,
      detailQuestions: detailQuestions,
      totalParasites: totalParasites
    };
  }
  
  // ---------- Transforme le résultat en texte lisible ----------
   
  // ===================== AJOUTS (étape 9 bis) =====================

// Expressions "trop sûr de soi" supplémentaires
MOTS.surconfiance.push("tres fort", "rien ne marche sans moi", "je sais tout faire",
"je peux tout faire", "je suis excellent", "je suis incollable");

// Analyse un texte pour savoir si le candidat pose des questions, et sur quels sujets
function analyserQuestions(texte) {
  const t = normaliser(texte);
  let nbMarqueurs = 0;
  for (const mot of MOTS.interrogatifs) nbMarqueurs += compterOccurrences(t, mot);
  const groupes = [];
  for (const nom of ["activite", "poste", "conditions", "suite", "entreprise"]) {
    if (contient(t, MOTS.groupes[nom]).length > 0) groupes.push(nom);
  }
  const interdites = contient(t, MOTS.interdites).length > 0;
  return {
    nbQuestions: Math.max(Math.min(nbMarqueurs, 3), groupes.length + (interdites ? 1 : 0)),
    groupes: groupes,
    interdites: interdites
  };
}
// ===================== AJOUTS (étape 9 ter) =====================

// Plus de façons de parler des conditions de travail
MOTS.groupes.conditions.push("horaire", "heure de travail", "heures de travail", "temps de travail");

// Remerciement complet : "merci" + une allusion au temps ou à l'entretien
// (accepte "merci beaucoup pour votre temps", "merci infiniment de m'avoir reçu", etc.)
function estRemerciementComplet(texte) {
  const t = normaliser(texte);
  if (contient(t, MOTS.merciComplet).length > 0) return true;
  const ditMerci = contient(t, ["merci", "thank", "شكرا"]).length > 0;
  const parleDuTemps = contient(t, ["temps", "recu", "entretien", "opportunite", "time", "وقت"]).length > 0;
  return ditMerci && parleDuTemps;
}

// "je suis Anas" : détecte "je suis" suivi d'un mot qui commence par une majuscule
// (Chrome met souvent une majuscule aux prénoms). On exclut quelques mots courants.
function diraitSonNom(texteBrut) {
  const regex = /\b[Jj]e suis\s+([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’-]+)/g;
  const exclus = ["java", "javascript", "python", "sql", "html", "css", "tunisien", "tunisienne", "sfaxien", "sfaxienne"];
  let trouve;
  while ((trouve = regex.exec(texteBrut || "")) !== null) {
    if (!exclus.includes(normaliser(trouve[1]))) return true;
  }
  return false;
}
// ===================== AJOUTS (étape 11 : caméra, note en direct, arrêt) =====================

POIDS.corps = 25;   // langage corporel : regard 10 + sourire 5 + maîtrise du visage 10

const CONSEILS_CORPS = {
  regard: "Regarde la caméra (le recruteur) environ 70 % du temps : ni fuyant, ni fixe. Détourne parfois le regard pour rester naturel.",
  sourire: "Un sourire naturel à l'accueil et pendant l'échange donne une meilleure impression.",
  langue: "Ne tire jamais la langue : c'est très mal perçu par un recruteur.",
  baillement: "Évite de bâiller (ou cache-le et excuse-toi) : cela donne une impression de désintérêt.",
  grimace: "Contrôle ton visage : évite les grimaces (froncer le nez, gonfler les joues, avancer les lèvres).",
  tete: "Garde la tête droite : une tête penchée trop longtemps peut donner une impression de fatigue ou de désinvolture.",
  visage: "On te voyait mal pendant une bonne partie de l'entretien : place-toi face à la caméra, bien éclairé."
};

// Note du langage corporel (sur 25) à partir des statistiques de camera.js
function noterCorps(stats, statsGestes) {
  if (!stats || !stats.disponible) return null;

  const evenements = [];
  const conseils = [];
  const pointsForts = [];

  // 1) Regard vers la caméra (7 points)
  const ratio = stats.ratioRegard;
  const pourcent = Math.round(ratio * 100);
  const ptsRegard = 7 * Math.min(1, ratio / 0.7);
  if (ptsRegard < 7) {
    evenements.push({ categorie: "corps", points: -arrondir(7 - ptsRegard),
      texte: "Regard vers la caméra : " + pourcent + " % du temps (objectif : 70 % ou plus)" });
    conseils.push(CONSEILS_CORPS.regard);
  } else {
    pointsForts.push("Bon contact visuel : tu regardais la caméra " + pourcent + " % du temps.");
  }

  // 2) Sourire (3 points)
  let ptsSourire = 3;
  if (stats.episodesSourire === 0) {
    ptsSourire = 1;
    evenements.push({ categorie: "corps", points: -2, texte: "Aucun sourire détecté pendant l'entretien" });
    conseils.push(CONSEILS_CORPS.sourire);
  } else {
    pointsForts.push("Tu as souri naturellement (" + stats.episodesSourire + " fois).");
  }

  // 3) Maîtrise du visage (5 points)
  let maitrise = 5;
  const ev = stats.evenements;
  function perdre(nombre, unite, plafond, texte, conseil) {
    if (nombre <= 0) return;
    const perte = Math.min(plafond, nombre * unite);
    maitrise -= perte;
    evenements.push({ categorie: "corps", points: -perte, texte: texte + " : " + nombre + " fois" });
    conseils.push(conseil);
  }
  perdre(ev.langue, 4, 5, "Langue tirée", CONSEILS_CORPS.langue);
  perdre(ev.baillement, 3, 5, "Bâillement", CONSEILS_CORPS.baillement);
  perdre(ev.grimace, 2, 4, "Grimaces", CONSEILS_CORPS.grimace);
  maitrise = borner(maitrise, 0, 5);
  if (ev.langue + ev.baillement + ev.grimace === 0) {
    pointsForts.push("Ton visage est resté maîtrisé : ni grimace, ni langue tirée, ni bâillement.");
  }
  if (stats.partSansVisage > 0.2) conseils.push(CONSEILS_CORPS.visage);

  // 4) Gestes des mains (6 points) et 5) Posture (4 points)
  let ptsMains = 6;
  let ptsPosture = 4;
  if (statsGestes && statsGestes.mainsDisponibles) {
    const eg = statsGestes.evenements;
    function perdreGeste(nombre, unite, plafond, texte, conseil) {
      if (nombre <= 0) return;
      const perte = Math.min(plafond, nombre * unite);
      ptsMains -= perte;
      evenements.push({ categorie: "corps", points: -perte, texte: texte + " : " + nombre + " fois" });
      conseils.push(conseil);
    }
    perdreGeste(eg.bouche, 4, 8, "Main devant la bouche", CONSEILS_CORPS.mainBouche);
    perdreGeste(eg.visage, 2, 4, "Main sur le visage", CONSEILS_CORPS.mainVisage);
    perdreGeste(eg.poing, 2, 4, "Poing fermé", CONSEILS_CORPS.poing);
    perdreGeste(eg.pointe, 2, 4, "Doigt pointé vers le recruteur", CONSEILS_CORPS.pointe);
    perdreGeste(eg.honneur, 6, 6, "Geste très inapproprié", CONSEILS_CORPS.honneur);
    perdreGeste(eg.agitation, 3, 3, "Mains trop agitées", CONSEILS_CORPS.agitation);
    ptsMains = borner(ptsMains, 0, 6);
    if (statsGestes.episodesMainOuverte > 0 && eg.bouche + eg.visage + eg.poing + eg.pointe + eg.honneur === 0) {
      pointsForts.push("Tu as utilisé tes mains naturellement, sans geste à éviter.");
    }
  } else {
    ptsMains = 3;   // mains jamais visibles : ni bonus ni malus, on ne compte que la moitié
    conseils.push(CONSEILS_CORPS.mainsNonVues);
  }

  if (statsGestes && statsGestes.postureDisponible) {
    const eg = statsGestes.evenements;
    function perdrePosture(nombre, unite, plafond, texte, conseil) {
      if (nombre <= 0) return;
      const perte = Math.min(plafond, nombre * unite);
      ptsPosture -= perte;
      evenements.push({ categorie: "corps", points: -perte, texte: texte + " : " + nombre + " fois" });
      conseils.push(conseil);
    }
    perdrePosture(eg.brasCroises, 3, 3, "Bras croisés", CONSEILS_CORPS.brasCroises);
    perdrePosture(eg.avachi, 2, 4, "Posture avachie", CONSEILS_CORPS.avachi);
    perdrePosture(eg.epaulesInclinees, 2, 4, "Épaules inclinées trop longtemps", CONSEILS_CORPS.epaulesInclinees);
    ptsPosture = borner(ptsPosture, 0, 4);
    if (eg.brasCroises + eg.avachi + eg.epaulesInclinees === 0) {
      pointsForts.push("Ta posture est restée ouverte et droite pendant l'entretien.");
    }
  } else {
    ptsPosture = 2;
    conseils.push(CONSEILS_CORPS.posturenNonVue);
  }

  return {
    score: ptsRegard + ptsSourire + maitrise + ptsMains + ptsPosture,
    evenements: evenements,
    conseils: conseils,
    pointsForts: pointsForts
  };
}



// Note en direct (sur 20) : ce que serait la note si l'entretien s'arrêtait maintenant.
// On n'utilise pas les questions finales (pas encore posées).
function calculerNoteEnDirect(reponses, statsCamera, statsGestes) {
  const r = calculerNoteAvecGestes(reponses, statsCamera, statsGestes);
  const nbQuestions = reponses.filter(function (x) {
    return x.id !== "accueil" && x.id !== "questions_finales" && x.id !== "remerciement";
  }).length;

  let total = 0;
  let max = 0;
  for (const c of r.categories) {
    if (c.nom.indexOf("Questions finales") === 0) continue;                  // pas encore posées
    if (c.nom.indexOf("Présentation") === 0 && nbQuestions === 0) continue;  // pas encore de réponse
    total += c.score;
    max += c.max;
  }
  return max > 0 ? arrondir((total / max) * 20) : 10;
}

// Quand le recruteur arrête l'entretien : on retire tout ce qui concerne la fin (jamais atteinte)
function preparerRapportArret(r, reponses, statsCamera) {
  r.arret = true;
  r.categories = r.categories.filter(function (c) { return c.nom.indexOf("Questions finales") !== 0; });
  r.evenements = r.evenements.filter(function (e) { return e.categorie !== "finales"; });

  const aRetirer = [CONSEILS.non, CONSEILS.merciAbsent, CONSEILS.merciSimple, CONSEILS.interdites];
  r.conseils = r.conseils.filter(function (c) {
    return !aRetirer.includes(c) && c.indexOf("Tu peux aussi poser") !== 0;
  });
  r.pointsForts = r.pointsForts.filter(function (p) {
    return p.indexOf("remercié") === -1 && p.indexOf("questions pertinentes") === -1;
  });

  r.plafonnee = false;
  r.note20 = calculerNoteEnDirect(reponses, statsCamera);
  r.decision = "Refusé";
  return r;
}

// Nouvelle version de formaterRapport (elle remplace celle écrite plus haut dans le fichier)
function formaterRapport(r) {
  let t = "";
  t += "NOTE FINALE : " + r.note20 + " / 20  →  " + r.decision + "\n";
  t += "(Le langage corporel n'est compté que si la caméra a bien fonctionné ; la posture des épaules et les gestes des mains ne sont pas encore analysés.)\n";
    if (r.arret) {
    t += "⛔ Le recruteur a arrêté l'entretien : ta note en direct est tombée trop bas.\n";
  }
  if (r.plafonnee) {
    t += "⚠ Note plafonnée à 8/20 : tu n'as posé aucune question à la fin de l'entretien.\n";
  }

  t += "\nPAR CATÉGORIE\n";
  for (const c of r.categories) {
    t += "- " + c.nom + " : " + arrondir(c.score) + " / " + c.max + "\n";
  }

  t += "\nTES RÉPONSES (note sur 10 : mots-clés, exemple concret, longueur)\n";
  for (const ligne of r.detailQuestions) t += "- " + ligne + "\n";

  t += "\nPOINTS GAGNÉS OU PERDUS\n";
  if (r.evenements.length === 0) t += "(aucun)\n";
  for (const e of r.evenements) {
    t += (e.points > 0 ? "+" : "") + e.points + "  " + e.texte + "\n";
  }

  t += "\nCE QUE TU AS BIEN FAIT\n";
  if (r.pointsForts.length === 0) t += "(rien de notable cette fois)\n";
  for (const p of r.pointsForts) t += "✔ " + p + "\n";

  t += "\nCONSEILS POUR PROGRESSER\n";
  if (r.conseils.length === 0) t += "(aucun conseil : bravo !)\n";
  for (const c of r.conseils) t += "→ " + c + "\n";

  return t;
}
// ===================== AJOUTS (étape 13 : vouvoiement) =====================

// Mots trop familiers en plus (comptés avec le langage familier)
MOTS.familiers.push("salut", "coucou", "mon ami", "mon frere", "mon pote");

// Tutoiement (à éviter) et vouvoiement (attendu)
MOTS.tutoiement = ["tu", "toi", "ton", "ta", "tes", "te", "t'as", "t'es", "t'inquiete"];
MOTS.vouvoiement = ["vous", "votre", "vos"];

CONSEILS.tutoiement = "Vouvoie toujours le recruteur : dis « vous », « votre », jamais « tu », « toi » ni « salut ».";

// Compte le tutoiement et le vouvoiement dans toutes les réponses du candidat
function analyserVouvoiement(reponses) {
  let nbTu = 0;
  let nbVous = 0;
  const tuTrouves = [];

  for (const r of reponses) {
    const t = normaliser(r.reponse);
    for (const mot of MOTS.tutoiement) {
      const n = compterOccurrences(t, mot);
      if (n > 0) {
        nbTu += n;
        if (!tuTrouves.includes(mot)) tuTrouves.push(mot);
      }
    }
    for (const mot of MOTS.vouvoiement) nbVous += compterOccurrences(t, mot);
  }

  let perte = 0;
  let texte = "";
  if (nbTu > 0) {
    perte = nbTu >= 3 ? 6 : 3;
    texte = "Tutoiement du recruteur : « " + tuTrouves.join(" », « ") + " » (" + nbTu + " fois)";
  }
  return { perte: perte, texte: texte, bien: nbTu === 0 && nbVous >= 2 };
}
// ===================== AJOUTS (étape 14 : recalibrage de la note de contenu) =====================

// Vocabulaire professionnel général : chaque mot différent rapporte 1 point (2 maximum par réponse)
MOTS.generiques = ["entreprise", "poste", "domaine", "secteur", "competence", "experience", "projet", "stage",
  "equipe", "objectif", "avenir", "futur", "recherche", "apprendre", "evoluer", "ingenieur", "formation",
  "motivation", "passion", "interesse", "responsabilite", "autonomie", "rigueur", "resultat", "methode", "solution"];

// Pour ces questions, les compétences techniques citées comptent comme des mots-clés
const QUESTIONS_TECHNIQUES = ["presentation", "competences_techniques", "fierte", "analyse_probleme"];

// Nouvelle version de noterReponse (elle remplace celle écrite plus haut dans le fichier)
function noterReponse(reponse) {
  const t = normaliser(reponse.reponse);
  if (t === "") return { note: 0, motsCles: [], exemple: false };

  // Mots-clés de la question
  const motsCles = contient(t, reponse.mots_cles || []);

  // Compétences techniques citées (Python, SQL, Java...) pour les questions techniques
  if (QUESTIONS_TECHNIQUES.includes(reponse.id) && typeof LISTE_COMPETENCES !== "undefined") {
    const techniques = LISTE_COMPETENCES.filter(function (c) { return compterOccurrences(t, c) > 0; });
    for (const c of techniques) {
      if (!motsCles.includes(c)) motsCles.push(c);
    }
  }

  const exemple = contient(t, MOTS.exemples).length > 0;
  const generiques = contient(t, MOTS.generiques).filter(function (m) { return !motsCles.includes(m); });

  let note = Math.min(6, motsCles.length * 2);   // 2 points par mot-clé, 6 maximum
  if (exemple) note += 3;                        // exemple concret
  note += Math.min(2, generiques.length);        // vocabulaire professionnel général
  const nb = nombreDeMots(t);
  if (nb >= 30) note += 2;                       // réponse bien développée
  else if (nb >= 15) note += 1;                  // réponse assez développée

  return { note: Math.min(10, note), motsCles: motsCles, exemple: exemple };
}
// ===================== AJOUTS (étape 16 : gestes des mains et posture) =====================

Object.assign(CONSEILS_CORPS, {
  mainBouche: "Ne mets pas la main devant ta bouche en parlant : cela peut donner une impression de gêne ou de manque d'assurance.",
  mainVisage: "Évite de toucher ton visage (nez, joue, cheveux) : cela peut trahir un certain stress.",
  poing: "Détends tes mains : un poing fermé peut paraître tendu ou agressif.",
  pointe: "Évite de pointer du doigt le recruteur : ouvre plutôt la main quand tu expliques quelque chose.",
  honneur: "Contrôle absolument tes gestes : certains d'entre eux sont irrespectueux dans n'importe quel contexte professionnel.",
  agitation: "Calme un peu tes gestes : des mains trop agitées peuvent trahir du stress. Un mouvement modéré accompagne mieux le discours.",
  mainsNonVues: "On ne voyait pas bien tes mains : recule-toi un peu pour qu'elles soient visibles, cela met en valeur tes explications.",
  brasCroises: "Évite de croiser les bras : cela peut donner une impression de fermeture ou de défense.",
  avachi: "Tiens-toi droit, épaules ouvertes : une posture avachie peut donner une impression de fatigue ou de désintérêt.",
  epaulesInclinees: "Garde les épaules alignées et droites face à la caméra.",
  posturenNonVue: "On ne voyait pas bien tes épaules : recule-toi un peu pour que ta posture soit visible."
});

// Version qui appelle noterCorps avec les deux jeux de statistiques (mains, posture)
function calculerNoteAvecGestes(reponses, statsCamera, statsGestes) {
  const r = calculerNote(reponses, statsCamera);
  // _calculerNoteSansGestes a déjà appelé noterCorps(statsCamera) sans les gestes : on corrige ici
  const indexCorps = r.categories.findIndex(function (c) { return c.nom.indexOf("Langage corporel") === 0; });
  if (indexCorps !== -1) {
    const corps = noterCorps(statsCamera, statsGestes);
    if (corps !== null) {
      r.categories[indexCorps].score = corps.score;
      for (const e of corps.evenements) r.evenements.push(e);
      for (const c of corps.conseils) { if (!r.conseils.includes(c)) r.conseils.push(c); }
      for (const p of corps.pointsForts) r.pointsForts.push(p);
      // Recalcule la note finale sur 20 avec le score corrigé
      let total = 0, maxTotal = 0;
      for (const c of r.categories) { total += c.score; maxTotal += c.max; }
      let note20 = arrondir((total / maxTotal) * 20);
      if (r.plafonnee) note20 = Math.min(note20, 8);
      r.note20 = note20;
      r.decision = note20 >= 14 ? "Accepté" : (note20 >= 10 ? "En réflexion" : "Refusé");
    }
  }
  return r;
}