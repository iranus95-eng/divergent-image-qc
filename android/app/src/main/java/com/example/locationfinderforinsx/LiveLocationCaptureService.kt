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
import android.os.Environment
import android.os.FileObserver
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
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
import java.util.concurrent.Executors

// Public because MainActivity already reads this preference name.
const val LIVE_CAPTURE_PREFS = "live_location_capture"
private const val CHANNEL_ID = "divergent_live_capture"
private const val NOTIFICATION_ID = 6404

/** Coordinates written by INSX for the photo it is sending (exact field values). */
private const val SOURCE_INSX_FILE = "InsUploadPic.txt"
/** Fallback: the phone's own position, used only when INSX never wrote a record for the photo. */
private const val SOURCE_DEVICE_GPS = "DEVICE_LIVE"

private const val FILE_POLL_MS = 3_000L            // cheap stat() of 1-2 known files
private const val FILE_SEARCH_RETRY_MS = 30 * 60_000L // full storage search only when the file is unknown
private const val PHOTO_GRACE_MS = 45_000L          // wait this long for INSX's own record before using GPS
private const val RECENT_PHOTO_MS = 10 * 60_000L
private const val FRESH_FIX_MS = 60_000L
private const val SINGLE_FIX_TIMEOUT_MS = 20_000L
private const val QUEUE_FILE = "location_queue.json"

/**
 * 6.20.0 photo-location capture, light on battery:
 *  1. Watches InsUploadPic*.txt (FileObserver + a 3 s stat check). INSX rewrites that file for
 *     every photo it sends, so each change is read at once and its coordinates are kept.
 *  2. When a new INSx photo appears and INSX has not written its record within 45 s, the phone's
 *     position is used instead: the last GPS fix if it is fresh (INSX keeps GPS warm), otherwise
 *     one single fix. GPS is never left running.
 *  3. Every record goes into a queue saved on the phone and is sent until the server accepts it,
 *     so nothing is lost when the network or the server is down. The same photo sent again
 *     replaces the stored coordinates on the server (upsert on CA + photo name).
 */
class LiveLocationCaptureService : Service() {
    private lateinit var thread: HandlerThread
    private lateinit var handler: Handler
    private val net = Executors.newSingleThreadExecutor()
    private val observers = mutableListOf<FileObserver>()
    private var mediaObserver: ContentObserver? = null

    private val knownFiles = mutableMapOf<String, Long>()   // path -> last seen lastModified+length
    private var lastFileSearch = 0L
    private val insxSeen = LinkedHashMap<String, Long>()     // photo key -> time INSX record seen
    private val pendingPhotos = LinkedHashMap<String, PendingPhoto>()
    @Volatile private var uploading = false
    private var retryDelayMs = 30_000L

    private data class PendingPhoto(val ca: String, val name: String, val rawDate: String, val seenAt: Long, var fix: Location?)

    private val prefs by lazy { getSharedPreferences(LIVE_CAPTURE_PREFS, Context.MODE_PRIVATE) }
    private val insxDone: MutableSet<String> by lazy { prefs.getStringSet("insx_done", emptySet()).orEmpty().toMutableSet() }

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
            findInsUploadFiles(force = true)
            watchMediaStore()
            handler.post(fileTick)
            handler.post(photoTick)
            flushQueue()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (::handler.isInitialized) handler.post { findInsUploadFiles(force = knownFiles.isEmpty()); flushQueue() }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        observers.forEach { runCatching { it.stopWatching() } }
        observers.clear()
        mediaObserver?.let { runCatching { contentResolver.unregisterContentObserver(it) } }
        if (::thread.isInitialized) thread.quitSafely()
        net.shutdown()
        prefs.edit().putBoolean("active", false).apply()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- InsUploadPic watching

    private val fileTick = object : Runnable {
        override fun run() {
            try {
                if (knownFiles.isEmpty()) findInsUploadFiles(force = false)
                for (path in knownFiles.keys.toList()) checkFile(File(path))
            } catch (e: Exception) { error("file", e) }
            handler.postDelayed(this, FILE_POLL_MS)
        }
    }

    private fun hasFileAccess(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager()

    /** Uses the remembered location of the file; searches storage only when it is not known yet. */
    private fun findInsUploadFiles(force: Boolean) {
        if (!hasFileAccess()) { prefs.edit().putString("gps_status", "ยังไม่ได้อนุญาตเข้าถึงไฟล์ทั้งหมด").apply(); return }
        prefs.getStringSet("insupload_paths", emptySet()).orEmpty().forEach { p ->
            if (File(p).isFile && p !in knownFiles) addKnownFile(File(p))
        }
        if (knownFiles.isNotEmpty() && !force) return
        if (!force && now() - lastFileSearch < FILE_SEARCH_RETRY_MS) return
        lastFileSearch = now()
        val found = mutableListOf<File>()
        val nameRe = Regex("""^InsUploadPic.*\.txt$""", RegexOption.IGNORE_CASE)
        val skip = setOf("Android", "LOST.DIR")
        val queue = ArrayDeque<Pair<File, Int>>()
        queue.add(Environment.getExternalStorageDirectory() to 0)
        while (queue.isNotEmpty()) {
            val (dir, depth) = queue.removeFirst()
            val children = runCatching { dir.listFiles()?.toList() }.getOrNull().orEmpty()
            for (f in children) {
                if (f.isDirectory) {
                    if (depth < 6 && !f.name.startsWith(".") && f.name !in skip) queue.add(f to depth + 1)
                } else if (nameRe.matches(f.name)) found += f
            }
        }
        found.forEach { addKnownFile(it) }
        prefs.edit().putStringSet("insupload_paths", knownFiles.keys.toSet())
            .putString("insupload_status", if (found.isEmpty()) "ยังไม่พบไฟล์ InsUploadPic" else "พบ InsUploadPic ${found.size} ไฟล์").apply()
    }

    private fun addKnownFile(f: File) {
        val path = f.absolutePath
        if (path in knownFiles) return
        knownFiles[path] = 0L
        val dir = f.parentFile ?: return
        if (observers.any { it.toString() == dir.absolutePath }) return
        val mask = FileObserver.CLOSE_WRITE or FileObserver.MOVED_TO or FileObserver.CREATE
        val obs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            object : FileObserver(dir, mask) {
                override fun onEvent(event: Int, name: String?) = onDirEvent(dir, name)
                override fun toString() = dir.absolutePath
            }
        } else {
            @Suppress("DEPRECATION")
            object : FileObserver(dir.absolutePath, mask) {
                override fun onEvent(event: Int, name: String?) = onDirEvent(dir, name)
                override fun toString() = dir.absolutePath
            }
        }
        runCatching { obs.startWatching(); observers += obs }
    }

    private fun onDirEvent(dir: File, name: String?) {
        if (name == null || !name.startsWith("InsUploadPic", ignoreCase = true)) return
        handler.post { val f = File(dir, name); if (f.absolutePath !in knownFiles) addKnownFile(f); checkFile(f) }
    }

    /** Reads the file only when its time or size changed since the last read. */
    private fun checkFile(f: File) {
        if (!f.isFile) return
        val stamp = f.lastModified() * 31 + f.length()
        if (knownFiles[f.absolutePath] == stamp) return
        knownFiles[f.absolutePath] = stamp
        val text = runCatching { f.readText(Charsets.UTF_8) }.getOrNull() ?: return
        val records = runCatching { parseInsUploadPicText(SOURCE_INSX_FILE, text) }.getOrDefault(emptyList())
        if (records.isEmpty()) return
        for (r in records) {
            val key = key(r.caNumber, r.photoName)
            insxSeen[key] = now()
            pendingPhotos.remove(key)
            insxDone += key
            enqueue(
                JSONObject()
                    .put("ca_number", r.caNumber)
                    .put("photo_name", r.photoName)
                    .put("latitude", r.latitude)
                    .put("longitude", r.longitude)
                    .putOpt("photo_datetime", r.photoDateTime)
                    .putOpt("event_datetime", r.eventDateTime)
                    .put("source_file", SOURCE_INSX_FILE)
                    .putOpt("job_ref", r.jobRef)
                    .putOpt("cycle_code", r.cycleCode)
                    .putOpt("secondary_ref", r.secondaryRef)
                    .putOpt("subdistrict", r.subdistrict)
                    .putOpt("district", r.district)
                    .putOpt("province", r.province)
                    .put("raw_parameter", r.rawParameter)
            )
            prefs.edit().putString("last_ca", r.caNumber).putString("last_photo", r.photoName)
                .putString("last_latlon", "${r.latitude}, ${r.longitude}")
                .putString("last_capture_source", SOURCE_INSX_FILE).putLong("last_capture_ms", now())
                .putInt("insx_record_count", prefs.getInt("insx_record_count", 0) + 1).apply()
        }
        while (insxSeen.size > 3000) insxSeen.remove(insxSeen.keys.first())
        val compact = if (insxDone.size > 4000) insxDone.toList().takeLast(3000).toMutableSet() else insxDone
        prefs.edit().putStringSet("insx_done", HashSet(compact)).apply()
        flushQueue()
    }

    // ---------------------------------------------------------------- GPS fallback

    private fun watchMediaStore() {
        val obs = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                handler.removeCallbacks(scanPhotos)
                handler.postDelayed(scanPhotos, 1_500L) // several change events arrive per photo
            }
        }
        runCatching {
            contentResolver.registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, obs)
            mediaObserver = obs
        }
    }

    private val scanPhotos = Runnable {
        try { findNewPhotos() } catch (e: Exception) { error("media", e) }
    }

    /** Only photos added in the last 10 minutes are read, newest first. */
    private fun findNewPhotos() {
        val since = (now() - RECENT_PHOTO_MS) / 1000
        contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Images.Media.DISPLAY_NAME),
            "${MediaStore.Images.Media.DATE_ADDED} >= ? AND ${MediaStore.Images.Media.DISPLAY_NAME} LIKE 'INSx%'",
            arrayOf(since.toString()),
            "${MediaStore.Images.Media.DATE_ADDED} DESC"
        )?.use { c ->
            while (c.moveToNext()) {
                val name = c.getString(0) ?: continue
                val parsed = parseInsxFileName(name) ?: continue
                val key = key(parsed.ca, name)
                if (key in insxSeen || key in insxDone || key in pendingPhotos || prefs.getStringSet("gps_done", emptySet())!!.contains(key)) continue
                val p = PendingPhoto(parsed.ca, name, parsed.rawDate, now(), null)
                pendingPhotos[key] = p
                takeFix { p.fix = it }  // taken now, used later only if INSX writes nothing
            }
        }
    }

    private val photoTick = object : Runnable {
        override fun run() {
            try { settlePhotos() } catch (e: Exception) { error("photo", e) }
            handler.postDelayed(this, 10_000L)
        }
    }

    private fun settlePhotos() {
        if (pendingPhotos.isEmpty()) return
        val done = prefs.getStringSet("gps_done", emptySet()).orEmpty().toMutableSet()
        val iter = pendingPhotos.entries.iterator()
        while (iter.hasNext()) {
            val (key, p) = iter.next()
            if (key in insxSeen || key in insxDone) { iter.remove(); continue }
            if (now() - p.seenAt < PHOTO_GRACE_MS) continue
            val fix = p.fix
            if (fix == null) {
                if (now() - p.seenAt > 3 * 60_000L) iter.remove() // no position could be taken
                continue
            }
            iter.remove()
            done += key
            enqueue(
                JSONObject()
                    .put("ca_number", p.ca)
                    .put("photo_name", p.name)
                    .put("latitude", fix.latitude)
                    .put("longitude", fix.longitude)
                    .put("photo_datetime", serverTime(fix.time))
                    .put("event_datetime", serverTime(fix.time))
                    .put("source_file", SOURCE_DEVICE_GPS)
                    .put("raw_parameter", JSONObject().put("source", SOURCE_DEVICE_GPS).put("accuracy_m", fix.accuracy.toDouble()).put("provider", fix.provider ?: "").toString())
            )
            prefs.edit().putString("last_ca", p.ca).putString("last_photo", p.name)
                .putString("last_latlon", "${fix.latitude}, ${fix.longitude}")
                .putString("last_capture_source", SOURCE_DEVICE_GPS).putLong("last_capture_ms", now())
                .putInt("gps_record_count", prefs.getInt("gps_record_count", 0) + 1).apply()
        }
        val compact = if (done.size > 4000) done.toList().takeLast(3000).toSet() else done
        prefs.edit().putStringSet("gps_done", compact).apply()
        flushQueue()
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /** The freshest position already on the phone, or one single new fix. GPS is never left on. */
    @SuppressLint("MissingPermission")
    private fun takeFix(done: (Location) -> Unit) {
        if (!hasLocationPermission()) { prefs.edit().putString("gps_status", "ยังไม่ได้อนุญาต Location").apply(); return }
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) }
        if (providers.isEmpty()) { prefs.edit().putString("gps_status", "GPS/Location ถูกปิดอยู่").apply(); return }
        val fresh = providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .filter { now() - it.time <= FRESH_FIX_MS && it.accuracy <= 100f }
            .minByOrNull { it.accuracy }
        if (fresh != null) { done(fresh); return }
        val provider = if (LocationManager.GPS_PROVIDER in providers) LocationManager.GPS_PROVIDER else providers.first()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val cancel = android.os.CancellationSignal()
            handler.postDelayed({ cancel.cancel() }, SINGLE_FIX_TIMEOUT_MS)
            runCatching {
                lm.getCurrentLocation(provider, cancel, java.util.concurrent.Executor { r -> handler.post(r) }) { loc -> if (loc != null) done(loc) }
            }
        } else {
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) { lm.removeUpdates(this); done(location) }
                @Deprecated("Deprecated in Java") override fun onStatusChanged(p: String?, s: Int, e: Bundle?) = Unit
                override fun onProviderEnabled(p: String) = Unit
                override fun onProviderDisabled(p: String) = Unit
            }
            @Suppress("DEPRECATION")
            runCatching { lm.requestSingleUpdate(provider, listener, handler.looper) }
            handler.postDelayed({ runCatching { lm.removeUpdates(listener) } }, SINGLE_FIX_TIMEOUT_MS)
        }
        prefs.edit().putString("gps_status", "DEVICE GPS พร้อมใช้").apply()
    }

    // ---------------------------------------------------------------- queue + upload

    private fun key(ca: String, photoName: String) = "$ca|${photoName.substringBeforeLast('.').lowercase(Locale.US)}"

    /** One entry per photo; a newer record for the same photo replaces the older one. */
    @Synchronized
    private fun enqueue(rec: JSONObject) {
        val q = readQueue()
        q.put(key(rec.getString("ca_number"), rec.getString("photo_name")), rec)
        writeQueue(q)
    }

    @Synchronized private fun readQueue(): JSONObject =
        runCatching { JSONObject(File(filesDir, QUEUE_FILE).readText()) }.getOrDefault(JSONObject())

    @Synchronized private fun writeQueue(q: JSONObject) {
        val f = File(filesDir, QUEUE_FILE)
        val tmp = File(filesDir, "$QUEUE_FILE.tmp")
        tmp.writeText(q.toString())
        tmp.renameTo(f)
        prefs.edit().putInt("queue_size", q.length()).apply()
    }

    private val retry = Runnable { flushQueue() }

    private fun flushQueue() {
        if (uploading) return
        val q = readQueue()
        if (q.length() == 0) return
        uploading = true
        val keys = q.keys().asSequence().take(200).toList()
        val batch = JSONArray().apply { keys.forEach { put(q.getJSONObject(it)) } }
        net.execute {
            val ok = post(JSONObject().put("records", batch))
            handler.post {
                uploading = false
                if (ok) {
                    synchronized(this) {
                        val cur = readQueue()
                        // remove only what was sent and not replaced meanwhile
                        keys.forEachIndexed { i, k -> if (cur.optJSONObject(k)?.toString() == batch.getJSONObject(i).toString()) cur.remove(k) }
                        writeQueue(cur)
                    }
                    retryDelayMs = 30_000L
                    prefs.edit().putInt("uploaded_count", prefs.getInt("uploaded_count", 0) + keys.size).putString("last_error", "").apply()
                    if (readQueue().length() > 0) handler.post { flushQueue() }
                } else {
                    handler.removeCallbacks(retry)
                    handler.postDelayed(retry, retryDelayMs)
                    retryDelayMs = (retryDelayMs * 2).coerceAtMost(10 * 60_000L)
                }
            }
        }
    }

    private fun post(payload: JSONObject): Boolean {
        val base = BuildConfig.SUPABASE_URL
        val apiKey = BuildConfig.SUPABASE_KEY
        val c = URL("$base/functions/v1/image-location-import").openConnection() as HttpURLConnection
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
    private fun error(where: String, e: Exception) =
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
