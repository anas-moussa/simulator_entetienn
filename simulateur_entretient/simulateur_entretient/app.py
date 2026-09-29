# app.py : le "serveur" de notre simulateur d'entretien
import sqlite3
from datetime import datetime
import json
import os
from flask import Flask, render_template, jsonify, request
from pypdf import PdfReader   # bibliothèque qui lit les fichiers PDF

app = Flask(__name__)

# Pour que les accents s'affichent normalement dans le JSON envoyé
app.json.ensure_ascii = False

# On refuse les fichiers de plus de 5 Mo (un CV n'a pas besoin d'être plus gros)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

# Dossier où se trouve app.py (pour trouver le dossier "data" facilement)
DOSSIER = os.path.dirname(os.path.abspath(__file__))
CHEMIN_DB = os.path.join(DOSSIER, "historique.db")


def connexion_db():
    """Ouvre une connexion à la base et s'assure que la table existe."""
    conn = sqlite3.connect(CHEMIN_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS entretiens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_heure TEXT NOT NULL,
            entreprise TEXT,
            langue TEXT,
            note REAL,
            decision TEXT,
            arret INTEGER DEFAULT 0
        )
    """)
    # Migration douce : ajoute la colonne "conseils" si elle n'existe pas encore
    colonnes = [c[1] for c in conn.execute("PRAGMA table_info(entretiens)").fetchall()]
    if "conseils" not in colonnes:
        conn.execute("ALTER TABLE entretiens ADD COLUMN conseils TEXT")
    return conn


def charger_entreprises():
    """Lit le fichier data/entreprises.json et renvoie son contenu (une liste Python)."""
    chemin = os.path.join(DOSSIER, "data", "entreprises.json")
    # encoding="utf-8" est important sous Windows pour lire les accents
    with open(chemin, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/")
def accueil():
    return render_template("index.html")


# Une "API" : une adresse qui renvoie des données au lieu d'une page
@app.route("/api/entreprises")
def api_entreprises():
    return jsonify(charger_entreprises())


# La banque de questions communes à toutes les entreprises
@app.route("/api/banque")
def api_banque():
    chemin = os.path.join(DOSSIER, "data", "banque_questions.json")
    with open(chemin, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


# Les réponses du recruteur aux questions du candidat
@app.route("/api/reponses_recruteur")
def api_reponses_recruteur():
    chemin = os.path.join(DOSSIER, "data", "reponses_recruteur.json")
    with open(chemin, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


# Réception du CV : le navigateur envoie un fichier (PDF ou TXT), on renvoie son texte
@app.route("/api/cv", methods=["POST"])
def api_cv():
    fichier = request.files.get("cv")
    if fichier is None or fichier.filename == "":
        return jsonify({"erreur": "Aucun fichier reçu."}), 400

    nom = fichier.filename.lower()
    pages = 0
    try:
        if nom.endswith(".pdf"):
            lecteur = PdfReader(fichier.stream)
            pages = len(lecteur.pages)
            # extract_text() peut renvoyer None pour une page sans texte
            texte = "\n".join((page.extract_text() or "") for page in lecteur.pages)
        elif nom.endswith(".txt"):
            texte = fichier.read().decode("utf-8", errors="ignore")
        else:
            return jsonify({"erreur": "Format non pris en charge : utilise un fichier PDF ou TXT."}), 400
    except Exception as erreur:
        return jsonify({"erreur": "Impossible de lire le fichier : " + str(erreur)}), 400

    texte = texte.strip()
    if texte == "":
        return jsonify({
            "erreur": "Aucun texte trouvé dans ce fichier (PDF scanné ou image ?). "
                      "Utilise un PDF exporté depuis Word ou Google Docs."
        }), 400

    return jsonify({"texte": texte, "caracteres": len(texte), "pages": pages})


# Si un fichier dépasse 5 Mo, Flask lève cette erreur : on répond proprement
@app.errorhandler(413)
def fichier_trop_gros(erreur):
    return jsonify({"erreur": "Fichier trop gros (5 Mo maximum)."}), 413

# Enregistre le résultat d'un entretien


@app.route("/api/historique", methods=["POST"])
def api_ajouter_historique():
    donnees = request.get_json(silent=True) or {}
    note = donnees.get("note")
    if note is None:
        return jsonify({"erreur": "Note manquante."}), 400

    conn = connexion_db()
    conn.execute(
        "INSERT INTO entretiens (date_heure, entreprise, langue, note, decision, arret, conseils) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            datetime.now().strftime("%Y-%m-%d %H:%M"),
            donnees.get("entreprise", ""),
            donnees.get("langue", ""),
            note,
            donnees.get("decision", ""),
            1 if donnees.get("arret") else 0,
            json.dumps(donnees.get("conseils", []), ensure_ascii=False),
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# Renvoie les entretiens passés, du plus récent au plus ancien
@app.route("/api/historique")
def api_lire_historique():
    conn = connexion_db()
    conn.row_factory = sqlite3.Row
    lignes = conn.execute(
        "SELECT id, date_heure, entreprise, langue, note, decision, arret, conseils FROM entretiens ORDER BY id DESC LIMIT 50"
    ).fetchall()
    conn.close()

    resultat = []
    for ligne in lignes:
        d = dict(ligne)
        try:
            d["conseils"] = json.loads(d["conseils"]) if d["conseils"] else []
        except (TypeError, ValueError):
            d["conseils"] = []
        resultat.append(d)
    return jsonify(resultat)
# Efface tout l'historique


@app.route("/api/historique", methods=["DELETE"])
def api_effacer_historique():
    conn = connexion_db()
    conn.execute("DELETE FROM entretiens")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# Efface un seul entretien de l'historique
@app.route("/api/historique/<int:id_entretien>", methods=["DELETE"])
def api_effacer_un_entretien(id_entretien):
    conn = connexion_db()
    conn.execute("DELETE FROM entretiens WHERE id = ?", (id_entretien,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
