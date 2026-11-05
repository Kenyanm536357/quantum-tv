const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

function withAutoBoot(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const permissionName = "android.permission.RECEIVE_BOOT_COMPLETED";
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    if (!manifest["uses-permission"].some((entry) => entry.$["android:name"] === permissionName)) {
      manifest["uses-permission"].push({ $: { "android:name": permissionName } });
    }

    const app = manifest.application[0];
    app.receiver = app.receiver || [];
    const receiverName = `${modConfig.android.package}.AutoBootReceiver`;
    if (!app.receiver.some((entry) => entry.$["android:name"] === receiverName)) {
      app.receiver.push({
        $: {
          "android:name": receiverName,
          "android:enabled": "true",
          "android:exported": "true",
        },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }] },
        ],
      });
    }
    return modConfig;
  });

  return withDangerousMod(config, ["android", async (modConfig) => {
    const packageName = modConfig.android.package;
    const packagePath = packageName.split(".").join(path.sep);
    const sourceDir = path.join(
      modConfig.modRequest.platformProjectRoot,
      "app",
      "src",
      "main",
      "java",
      packagePath,
    );
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "AutoBootReceiver.kt"), `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AutoBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val enabled = context.getSharedPreferences("quantum_tv_auto_boot", Context.MODE_PRIVATE)
      .getBoolean("enabled", false)
    if (!enabled) return

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    try {
      context.startActivity(launchIntent)
    } catch (error: Exception) {
      Log.w("QuantumTVAutoBoot", "Could not launch app after boot", error)
    }
  }
}
`);
    return modConfig;
  }]);
}

module.exports = withAutoBoot;