package com.example.locationfinderforinsx

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executor
import java.util.concurrent.Executors

// Public because MainActivity already reads this preference name.
const val LIVE_CAPTURE_PREFS = "live_location_capture"
private const val CHANNEL_ID = "divergent_live_capture"
private const val NOTIFICATION_ID = 6404
private const val SOURCE = "DEVICE_GPS"

private const val RECENT_PHOTO_MS = 2 * 60_000L      // only photos added in the last 2 minutes are looked at
private const val MAX_PHOTO_FIX_GAP_MS = 5 * 60_000L // a position is never given to a photo taken longer ago than this
private const val FRESH_FIX_MS = 60_000L             // a position this new is used as it is (no GPS work at all)
private const val SINGLE_FIX_TIMEOUT_MS = 20_000L    // otherwise one single fix, never longer than this
private const val STALE_FIX_MS = 10 * 60_000L        // last resort when no new fix comes (accuracy is recorded)
private const val UPLOAD_BATCH_SIZE = 20             // send when this many are waiting ...
private const val UPLOAD_MAX_WAIT_MS = 2 * 60_000L   // ... or after this long: few network wake-ups
private const val LOG_MONTHS_KEPT = 3
private const val QUEUE_FILE = "location_queue.json"

/**
 * 6.21.0 — the app records each photo's position itself, without INSX:
 *  - Android tells the app when a new image is saved (no polling). Only INSx photos from the
 *    last 2 minutes are read, newest first.
 *  - The position is taken at once: the phone's newest known fix when it is under a minute old
 *    (INSX keeps GPS warm while photographing, so this is the usual case and costs nothing),
 *    otherwise one single fix. GPS is never left running.
 *  - Every position is added as a new line to a monthly log on the phone (never overwritten,
 *    3 months kept) and put in an upload queue that survives restarts and network loss.
 *    Uploads go in batches; the same photo sent again replaces its coordinates on the server.
 */
class LiveLocationCaptureService : Service() {
    private lateinit var thread: HandlerThread
    private lateinit var handler: Handler
    private val net = Executors.newSingleThreadExecutor()
    private var mediaObserver: ContentObserver? = null
    private val inFlight = HashSet<String>()           // photos waiting for their fix
    @Volatile private var uploading = false
    private var retryDelayMs = 30_000L
    private var firstQueuedAt = 0L

    private val prefs by lazy { getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE) }
    private val done: MutableSet<String> by lazy { prefs.getStringSet("photo_done", emptySet()).orEmpty().toMutableSet() }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(
            NOTIFICATION_ID,
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Divergent Field Tools")
                .setContentText("กำลังเก็บพิกัดรูป INSx")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
        )
        prefs.edit().putBoolean("active", true).putLong("service_started_ms", now()).putString("last_error", "").apply()
        thread = HandlerThread("divergent-location").also { it.start() }
        handler = Handler(thread.looper)
        handler.post {
            watchMediaStore()
            findNewPhotos()       // photos added in the last 2 minutes
            cleanOldLogs()
            flushQueue(force = true)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (::handler.isInitialized) handler.post { findNewPhotos(); flushQueue(force = true) }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        mediaObserver?.let { runCatching { contentResolver.unregisterContentObserver(it) } }
        if (::thread.isInitialized) thread.quitSafely()
        net.shutdown()
        prefs.edit().putBoolean("active", false).apply()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- new photos

    private fun watchMediaStore() {
        val obs = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                // several change events arrive for one photo: handle them once
                handler.removeCallbacks(scanPhotos)
                handler.postDelayed(scanPhotos, 1_000L)
            }
        }
        runCatching {
            contentResolver.registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, obs)
            mediaObserver = obs
        }.onFailure { error("observer", it) }
    }

    private val scanPhotos = Runnable { findNewPhotos() }

    private fun findNewPhotos() {
        try {
            val since = (now() - RECENT_PHOTO_MS) / 1000
            contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                arrayOf(MediaStore.Images.Media.DISPLAY_NAME, MediaStore.Images.Media.DATE_TAKEN, MediaStore.Images.Media.DATE_ADDED),
                "${MediaStore.Images.Media.DATE_ADDED} >= ? AND ${MediaStore.Images.Media.DISPLAY_NAME} LIKE 'INSx%'",
                arrayOf(since.toString()),
                "${MediaStore.Images.Media.DATE_ADDED} DESC"
            )?.use { c ->
                while (c.moveToNext()) {
                    val name = c.getString(0) ?: continue
                    val parsed = parseInsxFileName(name) ?: continue
                    val key = key(parsed.ca, name)
                    if (key in done || key in inFlight) continue
                    val taken = c.getLong(1).takeIf { it > 0 } ?: (c.getLong(2) * 1000L)
                    inFlight += key
                    takeFix { fix ->
                        inFlight -= key
                        when {
                            fix == null -> Unit
                            // an old photo saved late: today's position would be wrong for it
                            taken > 0 && kotlin.math.abs(fix.time - taken) > MAX_PHOTO_FIX_GAP_MS -> { done += key }
                            else -> record(parsed.ca, name, taken, fix)
                        }
                    }
                }
            }
        } catch (e: Exception) { error("media", e) }
    }

    private fun record(ca: String, photoName: String, takenMs: Long, fix: Location) {
        val key = key(ca, photoName)
        done += key
        val compact = if (done.size > 4000) done.toList().takeLast(3000).toMutableSet() else done
        prefs.edit().putStringSet("photo_done", HashSet(compact)).apply()

        val photoTime = serverTime(if (takenMs > 0) takenMs else now())
        val fixTime = serverTime(fix.time)
        val acc = if (fix.hasAccuracy()) Math.round(fix.accuracy) else -1
        appendLog(ca, photoName, fix, acc, photoTime, fixTime)
        enqueue(
            JSONObject()
                .put("ca_number", ca)
                .put("photo_name", photoName)
                .put("latitude", fix.latitude)
                .put("longitude", fix.longitude)
                .put("photo_datetime", photoTime)
                .put("event_datetime", fixTime)
                .put("source_file", SOURCE)
                .put("raw_parameter", JSONObject().put("source", SOURCE).put("accuracy_m", acc).put("provider", fix.provider ?: "").put("fix_age_s", (now() - fix.time) / 1000).toString())
        )
        prefs.edit().putString("last_ca", ca).putString("last_photo", photoName)
            .putString("last_latlon", "${fix.latitude}, ${fix.longitude}").putInt("last_accuracy_m", acc)
            .putLong("last_capture_ms", now()).putInt("captured_count", prefs.getInt("captured_count", 0) + 1).apply()
        flushQueue(force = false)
    }

    // ---------------------------------------------------------------- position

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /** The phone's newest position if under a minute old; otherwise one single fix (max 20 s). */
    @SuppressLint("MissingPermission")
    private fun takeFix(onFix: (Location?) -> Unit) {
        if (!hasLocationPermission()) { prefs.edit().putString("gps_status", "ยังไม่ได้อนุญาต Location").apply(); onFix(null); return }
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) }
        if (providers.isEmpty()) { prefs.edit().putString("gps_status", "GPS/Location ถูกปิดอยู่").apply(); onFix(null); return }
        val known = providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
        val fresh = known.filter { now() - it.time <= FRESH_FIX_MS }.minByOrNull { if (it.hasAccuracy()) it.accuracy else 9999f }
        if (fresh != null) { prefs.edit().putString("gps_status", "GPS พร้อมใช้").apply(); onFix(fresh); return }

        // fall back to a recent (≤10 min) position when no new fix arrives in time
        val stale = known.filter { now() - it.time <= STALE_FIX_MS }.maxByOrNull { it.time }
        var finished = false
        val finish: (Location?) -> Unit = { loc -> if (!finished) { finished = true; onFix(loc ?: stale) } }
        val provider = if (LocationManager.GPS_PROVIDER in providers) LocationManager.GPS_PROVIDER else providers.first()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val cancel = CancellationSignal()
            handler.postDelayed({ cancel.cancel(); finish(null) }, SINGLE_FIX_TIMEOUT_MS)
            runCatching {
                lm.getCurrentLocation(provider, cancel, Executor { r -> handler.post(r) }) { loc -> finish(loc) }
            }.onFailure { finish(null) }
        } else {
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) { lm.removeUpdates(this); finish(location) }
                @Deprecated("Deprecated in Java") override fun onStatusChanged(p: String?, s: Int, e: Bundle?) = Unit
                override fun onProviderEnabled(p: String) = Unit
                override fun onProviderDisabled(p: String) = Unit
            }
            @Suppress("DEPRECATION")
            runCatching { lm.requestSingleUpdate(provider, listener, handler.looper) }.onFailure { finish(null) }
            handler.postDelayed({ runCatching { lm.removeUpdates(listener) }; finish(null) }, SINGLE_FIX_TIMEOUT_MS)
        }
    }

    // ---------------------------------------------------------------- monthly log (append only)

    /** Divergent/พิกัดรูป_YYYY-MM.txt in shared storage when allowed, else the app's own folder. */
    private fun logDir(): File {
        val shared = Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager()
        val dir = if (shared) File(Environment.getExternalStorageDirectory(), "Divergent") else File(getExternalFilesDir(null) ?: filesDir, "Divergent")
        dir.mkdirs()
        return dir
    }

    private fun monthTag(cal: Calendar) = String.format(Locale.US, "%04d-%02d", cal.get(Calendar.YEAR) + 543, cal.get(Calendar.MONTH) + 1)

    /** Same line layout as InsUploadPic's <Parameter>, so the web import can read the file. */
    private fun appendLog(ca: String, photoName: String, fix: Location, acc: Int, photoTime: String, fixTime: String) {
        runCatching {
            val fields = MutableList(24) { " " }
            fields[0] = SOURCE
            fields[2] = ca
            fields[3] = "acc=${acc}m"
            fields[15] = fix.latitude.toString()
            fields[16] = fix.longitude.toString()
            fields[17] = "N"
            fields[18] = photoName
            fields[21] = photoTime
            fields[22] = "N"
            fields[23] = fixTime
            File(logDir(), "พิกัดรูป_${monthTag(Calendar.getInstance())}.txt")
                .appendText("<Parameter>${fields.joinToString(",")}</Parameter>\n", Charsets.UTF_8)
        }.onFailure { error("log", it) }
    }

    private fun cleanOldLogs() {
        runCatching {
            val keep = (0 until LOG_MONTHS_KEPT).map { back ->
                monthTag(Calendar.getInstance().apply { add(Calendar.MONTH, -back) })
            }.toSet()
            logDir().listFiles()?.forEach { f ->
                val tag = Regex("""^พิกัดรูป_(\d{4}-\d{2})\.txt$""").find(f.name)?.groupValues?.get(1) ?: return@forEach
                if (tag !in keep) f.delete()
            }
        }
    }

    // ---------------------------------------------------------------- queue + upload

    private fun key(ca: String, photoName: String) = "$ca|${photoName.substringBeforeLast('.').lowercase(Locale.US)}"

    /** One entry per photo; a newer position for the same photo replaces the older one. */
    @Synchronized private fun enqueue(rec: JSONObject) {
        val q = readQueue()
        if (q.length() == 0) firstQueuedAt = now()
        q.put(key(rec.getString("ca_number"), rec.getString("photo_name")), rec)
        writeQueue(q)
    }

    @Synchronized private fun readQueue(): JSONObject =
        runCatching { JSONObject(File(filesDir, QUEUE_FILE).readText()) }.getOrDefault(JSONObject())

    @Synchronized private fun writeQueue(q: JSONObject) {
        val tmp = File(filesDir, "$QUEUE_FILE.tmp")
        tmp.writeText(q.toString())
        tmp.renameTo(File(filesDir, QUEUE_FILE))
        prefs.edit().putInt("queue_size", q.length()).apply()
    }

    private val retry = Runnable { flushQueue(force = true) }

    /** Sends in batches: when 20 are waiting, after 2 minutes, or on a retry — not per photo. */
    private fun flushQueue(force: Boolean) {
        if (uploading) return
        val q = readQueue()
        if (q.length() == 0) return
        if (!force && q.length() < UPLOAD_BATCH_SIZE && now() - firstQueuedAt < UPLOAD_MAX_WAIT_MS) {
            handler.removeCallbacks(retry)
            handler.postDelayed(retry, UPLOAD_MAX_WAIT_MS - (now() - firstQueuedAt).coerceAtLeast(0))
            return
        }
        uploading = true
        val keys = q.keys().asSequence().take(200).toList()
        val batch = JSONArray().apply { keys.forEach { put(q.getJSONObject(it)) } }
        net.execute {
            val ok = post(JSONObject().put("records", batch))
            handler.post {
                uploading = false
                if (ok) {
                    val cur = readQueue()
                    keys.forEachIndexed { i, k -> if (cur.optJSONObject(k)?.toString() == batch.getJSONObject(i).toString()) cur.remove(k) }
                    writeQueue(cur)
                    firstQueuedAt = if (cur.length() > 0) now() else 0L
                    retryDelayMs = 30_000L
                    prefs.edit().putInt("uploaded_count", prefs.getInt("uploaded_count", 0) + keys.size).putString("last_error", "").apply()
                    if (cur.length() >= UPLOAD_BATCH_SIZE) handler.post { flushQueue(force = true) }
                } else {
                    handler.removeCallbacks(retry)
                    handler.postDelayed(retry, retryDelayMs)
                    retryDelayMs = (retryDelayMs * 2).coerceAtMost(10 * 60_000L)
                }
            }
        }
    }

    private fun post(payload: JSONObject): Boolean {
        val apiKey = BuildConfig.SUPABASE_KEY
        val c = URL("${BuildConfig.SUPABASE_URL}/functions/v1/image-location-import").openConnection() as HttpURLConnection
        return try {
            c.requestMethod = "POST"
            c.connectTimeout = 20_000
            c.readTimeout = 30_000
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.setRequestProperty("apikey", apiKey)
            c.setRequestProperty("Authorization", "Bearer $apiKey")
            c.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = c.responseCode
            if (code !in 200..299) {
                val body = c.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                prefs.edit().putString("last_error", "LOCATION_IMPORT HTTP $code: ${body.take(160)}").apply()
                // NO_VALID_RECORDS can never succeed: drop it instead of retrying for ever
                code == 400 && body.contains("NO_VALID_RECORDS")
            } else true
        } catch (e: Exception) {
            prefs.edit().putString("last_error", "LOCATION_IMPORT ${e.javaClass.simpleName}: ${e.message.orEmpty()}").apply()
            false
        } finally { c.disconnect() }
    }

    // ---------------------------------------------------------------- helpers

    private fun now() = System.currentTimeMillis()
    private fun serverTime(ms: Long): String =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getDefault() }.format(Date(ms))
    private fun error(where: String, e: Throwable) =
        prefs.edit().putString("last_error", "$where: ${e.javaClass.simpleName}: ${e.message.orEmpty()}").apply()

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Divergent เก็บพิกัดรูป", NotificationManager.IMPORTANCE_LOW)
                    .apply { description = "เก็บพิกัดของรูป INSx ทุกรูป" }
            )
        }
    }
}

fun Context.startLiveLocationCapture(): Boolean {
    // The service is a location foreground service: Android refuses to start it without the permission.
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
