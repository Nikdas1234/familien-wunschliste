package io.github.nikdas1234.wunschliste;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Lädt die neueste Installationsdatei der App herunter und öffnet die Installation von Android.
 * Die Adresse steht fest im Code, damit die Oberfläche keine fremde Datei unterschieben kann;
 * Android prüft zusätzlich, dass die Datei mit demselben Schlüssel signiert ist.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String APK_URL =
        "https://github.com/Nikdas1234/familien-wunschliste/releases/latest/download/Wunschliste.apk";

    private final AtomicBoolean running = new AtomicBoolean(false);

    @PluginMethod
    public void install(PluginCall call) {
        if (!running.compareAndSet(false, true)) {
            call.reject("Das Update wird bereits geladen.");
            return;
        }
        // Eigener Thread, damit die App während des Herunterladens bedienbar bleibt.
        new Thread(() -> {
            try {
                File apk = download();
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Das Update konnte nicht geladen werden.", ex);
            } finally {
                running.set(false);
            }
        })
            .start();
    }

    private File download() throws Exception {
        File dir = new File(getContext().getCacheDir(), "update");
        if (!dir.isDirectory() && !dir.mkdirs()) {
            throw new IllegalStateException("Ordner für das Update lässt sich nicht anlegen");
        }
        File apk = new File(dir, "Wunschliste.apk");

        HttpURLConnection conn = (HttpURLConnection) new URL(APK_URL).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        try {
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Server antwortet mit " + conn.getResponseCode());
            }
            long total = conn.getContentLengthLong();
            long loaded = 0;
            int lastPercent = -1;
            byte[] buffer = new byte[64 * 1024];
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                int n;
                while ((n = in.read(buffer)) != -1) {
                    out.write(buffer, 0, n);
                    loaded += n;
                    int percent = total > 0 ? (int) (loaded * 100 / total) : -1;
                    // Nur in 5-%-Schritten melden, sonst zeichnet die Oberfläche unnötig oft neu.
                    if (percent >= 0 && percent / 5 != lastPercent / 5) {
                        lastPercent = percent;
                        JSObject data = new JSObject();
                        data.put("percent", percent);
                        notifyListeners("progress", data);
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
        return apk;
    }
}
