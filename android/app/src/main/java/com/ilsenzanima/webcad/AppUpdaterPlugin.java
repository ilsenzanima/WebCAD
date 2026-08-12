package com.ilsenzanima.webcad;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Lets the web app trigger the Android package installer on an APK that was
 * already downloaded to app storage, so updates can be applied without the
 * user leaving the app or digging through the Downloads folder.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void installApk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Missing 'path' parameter");
            return;
        }

        // Filesystem.getUri() on the JS side returns a "file://" URI rather than
        // a plain path, so normalize it before handing it to java.io.File.
        String filePath = path.startsWith("file:") ? Uri.parse(path).getPath() : path;
        if (filePath == null) {
            call.reject("Invalid 'path' parameter: " + path);
            return;
        }

        File file = new File(filePath);
        if (!file.exists()) {
            call.reject("File not found: " + path);
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        getContext().startActivity(intent);

        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }
}
