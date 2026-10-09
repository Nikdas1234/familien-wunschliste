package io.github.nikdas1234.wunschliste;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigene Erweiterungen müssen vor dem Start der Hülle angemeldet sein.
        registerPlugin(ShareTargetPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
