// Verbindung zur Online-Datenbank (Supabase).
// Solange beide Werte leer sind, läuft die App im Demo-Modus:
// Die Daten liegen dann nur auf dem jeweiligen Gerät und werden nicht geteilt.
//
// Beide Werte stehen in Supabase unter "Project Settings" -> "API".
// Der Schlüssel ist der öffentliche ("publishable" bzw. "anon") — NICHT der geheime
// ("secret" bzw. "service_role"). Der öffentliche darf hier stehen, weil die Tabellen
// gesperrt sind und nur mit dem Familiencode gelesen werden können.
window.WUNSCHLISTE_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
