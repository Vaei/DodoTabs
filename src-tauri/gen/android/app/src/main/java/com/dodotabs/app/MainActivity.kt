package com.dodotabs.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Request the microphone at runtime so the WebView's getUserMedia (used for
    // metronome sync) can be granted. The webview-level grant is handled by the
    // framework; this covers the OS-level runtime permission (Android 6+).
    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)
    }
  }
}
