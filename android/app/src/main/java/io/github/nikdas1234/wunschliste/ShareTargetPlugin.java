package io.github.nikdas1234.wunschliste;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Nimmt Texte an, die andere Apps über "Teilen" schicken (z. B. einen Produktlink),
 * und reicht sie als Ereignis "shared" an die Oberfläche weiter.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }
        // Beim Wiederöffnen aus der Liste der letzten Apps nicht noch einmal auslösen.
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
            return;
        }
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null || text.toString().trim().isEmpty()) {
            return;
        }
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        JSObject data = new JSObject();
        data.put("text", text.toString());
        data.put("subject", subject == null ? "" : subject);

        // Als erledigt markieren, damit ein Neuaufbau der Ansicht den Inhalt nicht wiederholt.
        intent.removeExtra(Intent.EXTRA_TEXT);

        // true: Ereignis aufheben, bis die Oberfläche geladen ist und zuhört.
        notifyListeners("shared", data, true);
    }
}
