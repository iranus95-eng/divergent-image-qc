package com.example.locationfinderforinsx

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.IBinder
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs

// Public because MainActivity 6.19.6 already reads this preference name.
const val LIVE_CAPTURE_PREFS = "live_location_capture"
private const val LIVE_CAPTURE_CHANNEL_ID = "divergent_live_capture"
private const val LIVE_CAPTURE_NOTIFICATION_ID = 6404
private const val SOURCE_DEVICE_LIVE = "DEVICE_LIVE"
private const val MAX_FIX_AGE_MS = 45_000L
private const val RECENT_PHOTO_WINDOW_MS = 5 * 60_000L
private const val LOOP_DELAY_MS = 1_500L

private data class LiveGpsFix(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val timeMs: Long
)

private data class LivePhoto(
    val id: Long,
    val name: String,
    val ca: String,
    val rawDate: String,
    val mediaTimeMs: Long,
    val addedTimeMs: Long
)

private data class LiveUploadRecord(
    val ca: String,
    val photoName: String,
    val rawDate: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val fixTimeMs: Long,
    val mediaTimeMs: Long,
    val sourceFile: String,
    val rawParameter: String
) {
    val key: String get() = "$ca|${photoName.lowercase(Locale.US)}"
}

class LiveLocationCaptureService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loopJob: Job? = null
    private var locationManager: LocationManager? = null
    private val gpsHistory = ArrayDeque<LiveGpsFix>()
    private var lastFileBackfillAt = 0L

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            val now = System.currentTimeMillis()
            val fix = LiveGpsFix(
                latitude = location.latitude,
                longitude = location.longitude,
                accuracy = location.accuracy,
                timeMs = if (location.time > 0) location.time else now
            )
            synchronized(gpsHistory) {
                gpsHistory.addLast(fix)
                while (gpsHistory.size > 180) gpsHistory.removeFirst()
                while (gpsHistory.isNotEmpty() && now - gpsHistory.first().timeMs > 10 * 60_000L) {
                    gpsHistory.removeFirst()
                }
            }
            getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putLong("device_latitude", java.lang.Double.doubleToRawLongBits(fix.latitude))
                .putLong("device_longitude", java.lang.Double.doubleToRawLongBits(fix.longitude))
                .putFloat("device_accuracy", fix.accuracy)
                .putLong("device_time_ms", fix.timeMs)
                .putString("gps_status", "DEVICE GPS ทำงานอยู่")
                .putString("gps_debug", "accuracy=${fix.accuracy}m")
                .apply()
        }

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
        override fun onProviderEnabled(provider: String) = Unit
        override fun onProviderDisabled(provider: String) = Unit
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(
            LIVE_CAPTURE_NOTIFICATION_ID,
            NotificationCompat.Builder(this, LIVE_CAPTURE_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Divergent Field Tools 6.19.7")
                .setContentText("กำลังเก็บพิกัดใบแจ้งเตือนแบบ LIVE")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
        )

        getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("active", true)
            .putLong("service_started_ms", System.currentTimeMillis())
            .putString("last_error", "")
            .apply()

        startDeviceLocationTracking()
        loopJob = serviceScope.launch { liveLoop() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Permission can be granted while an already-created service exists.
        stopDeviceLocationTracking()
        startDeviceLocationTracking()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopDeviceLocationTracking()
        loopJob?.cancel()
        serviceScope.cancel()
        getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("active", false).apply()
        super.onDestroy()
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun startDeviceLocationTracking() {
        val prefs = getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE)
        if (!hasLocationPermission()) {
            prefs.edit().putString("gps_status", "ยังไม่ได้อนุญาต Location").putString("last_error", "LOCATION_PERMISSION_REQUIRED").apply()
            return
        }
        try {
            val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            locationManager = manager
            val providers = buildList {
                if (runCatching { manager.isProviderEnabled(LocationManager.GPS_PROVIDER) }.getOrDefault(false)) add(LocationManager.GPS_PROVIDER)
                if (runCatching { manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }.getOrDefault(false)) add(LocationManager.NETWORK_PROVIDER)
            }
            if (providers.isEmpty()) {
                prefs.edit().putString("gps_status", "GPS/Location ถูกปิดอยู่").putString("last_error", "LOCATION_SERVICE_DISABLED").apply()
                return
            }
            providers.forEach { provider ->
                manager.requestLocationUpdates(provider, 1_000L, 0f, locationListener)
                runCatching { manager.getLastKnownLocation(provider) }.getOrNull()?.let { locationListener.onLocationChanged(it) }
            }
            prefs.edit().putString("gps_status", "DEVICE GPS ทำงานอยู่").putString("last_error", "").apply()
        } catch (e: SecurityException) {
            prefs.edit().putString("gps_status", "Location permission ถูกปฏิเสธ").putString("last_error", "${e.javaClass.simpleName}: ${e.message.orEmpty()}").apply()
        } catch (e: Exception) {
            prefs.edit().putString("gps_status", "GPS ERROR").putString("last_error", "${e.javaClass.simpleName}: ${e.message.orEmpty()}").apply()
        }
    }

    private fun stopDeviceLocationTracking() {
        runCatching { locationManager?.removeUpdates(locationListener) }
        locationManager = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    LIVE_CAPTURE_CHANNEL_ID,
                    "Divergent LIVE Location Capture",
                    NotificationManager.IMPORTANCE_LOW
                ).apply { description = "เก็บพิกัดจริงของรูป INSx เพื่อใช้เป็นพิกัดใบแจ้งเตือน" }
            )
        }
    }

    private suspend fun liveLoop() {
        val prefs = getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE)
        while (serviceScope.isActive) {
            try {
                if (hasLocationPermission()) {
                    captureNewPhotos(prefs)
                    // Safe historical backfill: only from InsUploadPic because it contains
                    // the actual coordinates captured with each photo. Never backfill an old
                    // photo using the phone's current location.
                    val now = System.currentTimeMillis()
                    if (now - lastFileBackfillAt >= 60_000L) {
                        lastFileBackfillAt = now
                        backfillFromInsUploadPic(prefs)
                    }
                }
            } catch (e: Exception) {
                prefs.edit().putString("last_error", "LIVE loop: ${e.javaClass.simpleName}: ${e.message.orEmpty()}").apply()
            }
            delay(LOOP_DELAY_MS)
        }
    }

    private fun scanRecentInsxPhotos(): List<LivePhoto> {
        val result = mutableListOf<LivePhoto>()
        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.DATE_TAKEN
        )
        val now = System.currentTimeMillis()
        contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            null,
            null,
            "${MediaStore.Images.Media.DATE_ADDED} DESC"
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
            val addedCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
            val takenCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_TAKEN)
            var inspected = 0
            while (cursor.moveToNext() && inspected < 500) {
                inspected++
                val name = cursor.getString(nameCol) ?: continue
                if (!name.startsWith("INSx", ignoreCase = true)) continue
                val parsed = parseInsxFileName(name) ?: continue
                val addedMs = if (addedCol >= 0 && !cursor.isNull(addedCol)) cursor.getLong(addedCol) * 1000L else 0L
                val takenMs = if (takenCol >= 0 && !cursor.isNull(takenCol)) cursor.getLong(takenCol) else 0L
                val mediaMs = when {
                    takenMs > 0L -> takenMs
                    addedMs > 0L -> addedMs
                    else -> now
                }
                val freshnessMs = when {
                    addedMs > 0L -> now - addedMs
                    else -> now - mediaMs
                }
                if (freshnessMs !in 0..RECENT_PHOTO_WINDOW_MS) continue
                result += LivePhoto(
                    id = cursor.getLong(idCol),
                    name = name,
                    ca = parsed.ca,
                    rawDate = parsed.rawDate,
                    mediaTimeMs = mediaMs,
                    addedTimeMs = addedMs.takeIf { it > 0L } ?: mediaMs
                )
            }
        }
        return result.distinctBy { it.name.lowercase(Locale.US) }
    }

    private fun nearestFreshFix(photoTimeMs: Long): LiveGpsFix? {
        val now = System.currentTimeMillis()
        val candidates = synchronized(gpsHistory) { gpsHistory.toList() }
        val best = candidates.minByOrNull { abs(it.timeMs - photoTimeMs) }
        if (best != null && abs(best.timeMs - photoTimeMs) <= MAX_FIX_AGE_MS && now - best.timeMs <= 2 * 60_000L) return best

        // Last-known fix can be used only when it is genuinely fresh.
        val prefs = getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE)
        val t = prefs.getLong("device_time_ms", 0L)
        if (t <= 0L || now - t > MAX_FIX_AGE_MS || abs(t - photoTimeMs) > MAX_FIX_AGE_MS) return null
        if (!prefs.contains("device_latitude") || !prefs.contains("device_longitude")) return null
        return LiveGpsFix(
            latitude = java.lang.Double.longBitsToDouble(prefs.getLong("device_latitude", 0L)),
            longitude = java.lang.Double.longBitsToDouble(prefs.getLong("device_longitude", 0L)),
            accuracy = prefs.getFloat("device_accuracy", -1f),
            timeMs = t
        )
    }

    private fun captureNewPhotos(prefs: android.content.SharedPreferences) {
        val sent = prefs.getStringSet("device_live_sent", emptySet()).orEmpty().toMutableSet()
        var changed = false
        var uploaded = 0
        val photos = scanRecentInsxPhotos()
        for (photo in photos.sortedBy { it.addedTimeMs }) {
            val key = "${photo.ca}|${photo.name.lowercase(Locale.US)}"
            if (key in sent) continue
            val fix = nearestFreshFix(photo.mediaTimeMs) ?: continue
            if (fix.latitude !in -90.0..90.0 || fix.longitude !in -180.0..180.0 || (fix.latitude == 0.0 && fix.longitude == 0.0)) continue

            val record = LiveUploadRecord(
                ca = photo.ca,
                photoName = photo.name,
                rawDate = photo.rawDate,
                latitude = fix.latitude,
                longitude = fix.longitude,
                accuracy = fix.accuracy,
                fixTimeMs = fix.timeMs,
                mediaTimeMs = photo.mediaTimeMs,
                sourceFile = SOURCE_DEVICE_LIVE,
                rawParameter = JSONObject()
                    .put("source", SOURCE_DEVICE_LIVE)
                    .put("media_id", photo.id)
                    .put("media_time_ms", photo.mediaTimeMs)
                    .put("gps_time_ms", fix.timeMs)
                    .put("accuracy_m", fix.accuracy)
                    .toString()
            )
            appendBackup(record)
            if (uploadRecords(listOf(record))) {
                sent += key
                changed = true
                uploaded++
                prefs.edit()
                    .putString("last_ca", photo.ca)
                    .putString("last_photo", photo.name)
                    .putString("last_latlon", "${fix.latitude}, ${fix.longitude}")
                    .putLong("last_capture_ms", System.currentTimeMillis())
                    .putString("last_capture_source", SOURCE_DEVICE_LIVE)
                    .putString("last_error", "")
                    .apply()
            }
        }
        if (changed) {
            // Prevent unbounded SharedPreferences growth while retaining enough history
            // to avoid duplicate sends across normal daily use.
            val compact = if (sent.size > 6000) sent.takeLast(5000).toSet() else sent
            prefs.edit()
                .putStringSet("device_live_sent", compact)
                .putInt("device_uploaded_count", prefs.getInt("device_uploaded_count", 0) + uploaded)
                .putInt("captured_count", prefs.getInt("captured_count", 0) + uploaded)
                .apply()
        }
    }

    private fun appendBackup(record: LiveUploadRecord) {
        val obj = JSONObject()
            .put("ca_number", record.ca)
            .put("photo_name", record.photoName)
            .put("raw_date", record.rawDate)
            .put("latitude", record.latitude)
            .put("longitude", record.longitude)
            .put("accuracy_m", record.accuracy)
            .put("gps_time_ms", record.fixTimeMs)
            .put("media_time_ms", record.mediaTimeMs)
            .put("source_file", record.sourceFile)
            .put("saved_at_ms", System.currentTimeMillis())
        runCatching {
            File(filesDir, "live_location_backup.jsonl").appendText(obj.toString() + "\n", Charsets.UTF_8)
        }
    }

    private fun backfillFromInsUploadPic(prefs: android.content.SharedPreferences) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) return
        val records = runCatching { applicationContext.scanInsUploadPicFilesAuto() }.getOrDefault(emptyList())
        if (records.isEmpty()) return

        val sent = prefs.getStringSet("insupload_backfill_sent", emptySet()).orEmpty().toMutableSet()
        val pending = records.filter {
            val key = "${it.caNumber}|${it.photoName.lowercase(Locale.US)}|${it.latitude}|${it.longitude}"
            key !in sent
        }
        if (pending.isEmpty()) return

        var imported = 0
        pending.chunked(250).forEach { chunk ->
            if (uploadImageWorkRecords(chunk)) {
                chunk.forEach {
                    sent += "${it.caNumber}|${it.photoName.lowercase(Locale.US)}|${it.latitude}|${it.longitude}"
                }
                imported += chunk.size
            }
        }
        if (imported > 0) {
            val compact = if (sent.size > 12000) sent.takeLast(10000).toSet() else sent
            prefs.edit()
                .putStringSet("insupload_backfill_sent", compact)
                .putInt("insupload_backfill_count", prefs.getInt("insupload_backfill_count", 0) + imported)
                .putString("last_backfill_status", "InsUploadPic ส่งย้อนหลัง $imported รายการ")
                .apply()
        }
    }

    private fun uploadImageWorkRecords(records: List<ImageWorkLocationRecord>): Boolean {
        if (records.isEmpty()) return true
        val root = JSONObject().put("records", JSONArray().apply {
            records.forEach { r ->
                put(JSONObject().apply {
                    put("ca_number", r.caNumber)
                    put("photo_name", r.photoName)
                    put("latitude", r.latitude)
                    put("longitude", r.longitude)
                    r.photoDateTime?.let { put("photo_datetime", it) }
                    r.eventDateTime?.let { put("event_datetime", it) }
                    put("source_file", r.sourceFile)
                    r.jobRef?.let { put("job_ref", it) }
                    r.cycleCode?.let { put("cycle_code", it) }
                    r.secondaryRef?.let { put("secondary_ref", it) }
                    r.subdistrict?.let { put("subdistrict", it) }
                    r.district?.let { put("district", it) }
                    r.province?.let { put("province", it) }
                    put("raw_parameter", r.rawParameter)
                })
            }
        })
        return postToLocationImport(root)
    }

    private fun uploadRecords(records: List<LiveUploadRecord>): Boolean {
        if (records.isEmpty()) return true
        // Grouping keeps source_batch_id meaningful for diagnostics. Matching itself is
        // also possible by exact CA + photo stem even before a real batch is registered.
        val grouped = records.groupBy { it.rawDate }
        var allOk = true
        for ((rawDate, rows) in grouped) {
            val payload = JSONObject()
                .put("site_code", "LIVE_CAPTURE")
                .put("batch_id", "LIVE-$rawDate")
                .put("records", JSONArray().apply {
                    rows.forEach { r ->
                        val event = formatServerTime(r.fixTimeMs)
                        put(JSONObject()
                            .put("ca_number", r.ca)
                            .put("photo_name", r.photoName)
                            .put("latitude", r.latitude)
                            .put("longitude", r.longitude)
                            .put("photo_datetime", event)
                            .put("event_datetime", event)
                            .put("source_file", r.sourceFile)
                            .put("raw_parameter", r.rawParameter)
                        )
                    }
                })
            if (!postToLocationImport(payload)) allOk = false
        }
        return allOk
    }

    private fun formatServerTime(ms: Long): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getDefault()
        }.format(Date(ms))
    }

    private fun postToLocationImport(payload: JSONObject): Boolean {
        val urlBase = buildConfigValue("SUPABASE_URL")
        val key = buildConfigValue("SUPABASE_KEY")
        if (urlBase.isBlank() || key.isBlank()) {
            getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE).edit()
                .putString("last_error", "SUPABASE_CONFIG_MISSING").apply()
            return false
        }
        val connection = (URL("$urlBase/functions/v1/image-location-import").openConnection() as HttpURLConnection)
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 20_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("apikey", key)
            connection.setRequestProperty("Authorization", "Bearer $key")
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val body = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE).edit()
                    .putString("last_error", "LOCATION_IMPORT HTTP $code: ${body.take(160)}").apply()
                false
            } else true
        } catch (e: Exception) {
            getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE).edit()
                .putString("last_error", "LOCATION_IMPORT ${e.javaClass.simpleName}: ${e.message.orEmpty()}").apply()
            false
        } finally {
            connection.disconnect()
        }
    }

    private fun buildConfigValue(name: String): String = try {
        val clazz = Class.forName("com.example.locationfinderforinsx.BuildConfig")
        clazz.getField(name).get(null)?.toString().orEmpty()
    } catch (_: Exception) { "" }
}

fun Context.startLiveLocationCapture(): Boolean {
    val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!fine && !coarse) return false
    return try {
        val intent = Intent(this, LiveLocationCaptureService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ContextCompat.startForegroundService(this, intent) else startService(intent)
        true
    } catch (e: Exception) {
        getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("active", false)
            .putString("last_error", "START_LIVE ${e.javaClass.simpleName}: ${e.message.orEmpty()}")
            .apply()
        false
    }
}
