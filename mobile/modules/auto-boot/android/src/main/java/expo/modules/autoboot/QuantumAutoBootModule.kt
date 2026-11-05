package expo.modules.autoboot

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QuantumAutoBootModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QuantumAutoBoot")

    Function("isEnabled") {
      val context = appContext.reactContext ?: return@Function false
      context.getSharedPreferences("quantum_tv_auto_boot", Context.MODE_PRIVATE)
        .getBoolean("enabled", false)
    }

    Function("setEnabled") { enabled: Boolean ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Application context is unavailable")
      context.getSharedPreferences("quantum_tv_auto_boot", Context.MODE_PRIVATE)
        .edit()
        .putBoolean("enabled", enabled)
        .apply()
    }
  }
}