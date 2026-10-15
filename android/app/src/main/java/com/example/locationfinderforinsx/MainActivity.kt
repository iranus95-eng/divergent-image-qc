package com.example.locationfinderforinsx

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.media.AudioManager
import android.media.ToneGenerator
import android.location.LocationManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.ArrayDeque
import java.util.Calendar
import java.util.TimeZone

import android.util.Log
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search

data class Customer(
    val mru: String,
    val peaNo: String,
    val ca: String,
    val installation: String,
    val readDate: String,
    val name: String,
    val address: String,
    val latitude: Double?,
    val longitude: Double?,
    val googleMap: String
)

data class NoticeLocation(
    val latitude: Double,
    val longitude: Double,
    val eventDatetime: String,
    val photoDatetime: String,
    val sourcePhotoName: String,
    val matchStatus: String
)

data class InsxImage(
    val id: Long,
    val name: String,
    val ca: String,
    val rawDate: String,
    val date: String,
    val time: String
)

data class ParsedInsxName(
    val ca: String,
    val rawDate: String,
    val date: String,
    val time: String
)

data class ImageWorkLocationRecord(
    val caNumber: String,
    val photoName: String,
    val photoStem: String,
    val rawDate: String,
    val latitude: Double,
    val longitude: Double,
    val photoDateTime: String?,
    val eventDateTime: String?,
    val sourceFile: String,
    val jobRef: String?,
    val cycleCode: String?,
    val secondaryRef: String?,
    val subdistrict: String?,
    val district: String?,
    val province: String?,
    val rawParameter: String
)


data class WorkSite(
    val code: String,
    val name: String
)

val WORK_SITES = listOf(
    WorkSite("UDON", "การไฟฟ้าส่วนภูมิภาคสาขาอุดรธานี"),
    WorkSite("PHUWIANG", "การไฟฟ้าส่วนภูมิภาคอำเภอภูเวียง"),
    WorkSite("KRANUAN", "การไฟฟ้าส่วนภูมิภาคสาขากระนวน"),
    WorkSite("KOSUM", "การไฟฟ้าส่วนภูมิภาคอำเภอโกสุมพิสัย"),
    WorkSite("NONGSONGHONG", "การไฟฟ้าส่วนภูมิภาคสาขาหนองสองห้อง"),
    WorkSite("BANFANG", "การไฟฟ้าส่วนภูมิภาคอำเภอบ้านฝาง"),
    WorkSite("PHUKHIAO", "การไฟฟ้าส่วนภูมิภาคสาขาภูเขียว"),
    WorkSite("MANCHAKHIRI", "การไฟฟ้าส่วนภูมิภาคสาขามัญจาคีรี"),
    WorkSite("CHATTURAT", "การไฟฟ้าส่วนภูมิภาคสาขาจัตุรัส"),
    WorkSite("CHAIYAPHUM", "การไฟฟ้าส่วนภูมิภาคจังหวัดชัยภูมิ"),
    WorkSite("KAENGKHRO", "การไฟฟ้าส่วนภูมิภาคสาขาแก้งคร้อ"),
    WorkSite("NONGKI", "การไฟฟ้าส่วนภูมิภาคสาขาหนองกี่"),
    WorkSite("PRAKHONCHAI", "การไฟฟ้าส่วนภูมิภาคสาขาประโคนชัย"),
    WorkSite("KORAT2", "การไฟฟ้าส่วนภูมิภาคสาขาเมืองนครราชสีมา2 (หัวทะเล)"),
    WorkSite("PHUTTHAISONG", "การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง"),
    WorkSite("CHUMPHUANG", "การไฟฟ้าส่วนภูมิภาคสาขาชุมพวง"),
    WorkSite("SUNGNOEN", "การไฟฟ้าส่วนภูมิภาคสาขาสูงเนิน"),
    WorkSite("NONTHAI", "การไฟฟ้าส่วนภูมิภาคสาขาโนนไทย"),
    WorkSite("KANTHARALAK", "การไฟฟ้าส่วนภูมิภาคสาขากันทรลักษ์"),
    WorkSite("PRATHAI", "การไฟฟ้าส่วนภูมิภาคอำเภอประทาย"),
    WorkSite("BUAYAI", "การไฟฟ้าส่วนภูมิภาคอำเภอบัวใหญ่"),
    WorkSite("NONGBUNMAK", "การไฟฟ้าส่วนภูมิภาคอำเภอหนองบุญมาก")
)


data class SavedBatch(
    val batchId: String,
    val rawDate: String,
    val siteCode: String,
    val siteName: String,
    val imageIds: List<Long>,
    val imageNames: List<String>,
    val caValues: List<String>,
    val status: String = "WAITING"
)

private const val BATCH_PREFS = "image_rescue_batches"
private const val KEY_BATCH_LIST = "batch_list_v2"

private fun encodeField(value: String): String =
    Base64.encodeToString(value.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

private fun decodeField(value: String): String =
    String(Base64.decode(value, Base64.NO_WRAP), Charsets.UTF_8)

private fun encodeBatch(batch: SavedBatch): String {
    return listOf(
        encodeField(batch.batchId),
        encodeField(batch.rawDate),
        encodeField(batch.siteCode),
        encodeField(batch.siteName),
        encodeField(batch.imageIds.joinToString(",")),
        encodeField(batch.imageNames.joinToString("\n")),
        encodeField(batch.caValues.joinToString("\n")),
        encodeField(batch.status)
    ).joinToString("|")
}

private fun decodeBatch(value: String): SavedBatch? {
    return try {
        val parts = value.split("|")

        if (parts.size == 8) {
            SavedBatch(
                batchId = decodeField(parts[0]),
                rawDate = decodeField(parts[1]),
                siteCode = decodeField(parts[2]),
                siteName = decodeField(parts[3]),
                imageIds = decodeField(parts[4])
                    .split(",")
                    .mapNotNull { it.toLongOrNull() },
                imageNames = decodeField(parts[5])
                    .split("\n")
                    .filter { it.isNotBlank() },
                caValues = decodeField(parts[6])
                    .split("\n")
                    .filter { it.isNotBlank() },
                status = decodeField(parts[7])
            )
        } else if (parts.size == 6) {
            // Backward compatibility for batches saved before Site support.
            SavedBatch(
                batchId = decodeField(parts[0]),
                rawDate = decodeField(parts[1]),
                siteCode = "",
                siteName = "ยังไม่ได้กำหนด Site",
                imageIds = decodeField(parts[2])
                    .split(",")
                    .mapNotNull { it.toLongOrNull() },
                imageNames = decodeField(parts[3])
                    .split("\n")
                    .filter { it.isNotBlank() },
                caValues = decodeField(parts[4])
                    .split("\n")
                    .filter { it.isNotBlank() },
                status = decodeField(parts[5])
            )
        } else {
            null
        }
    } catch (e: Exception) {
        null
    }
}

fun loadSavedBatches(context: Context): List<SavedBatch> {
    return try {
        context.getSharedPreferences(BATCH_PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY_BATCH_LIST, emptySet())
            .orEmpty()
            .mapNotNull { decodeBatch(it) }
            .sortedByDescending { it.batchId }
    } catch (e: Exception) {
        emptyList()
    }
}

fun updateBatchStatus(
    context: Context,
    batchId: String,
    newStatus: String
): Boolean {
    return try {
        val batches = loadSavedBatches(context).toMutableList()
        val index = batches.indexOfFirst { it.batchId == batchId }
        if (index < 0) return false

        batches[index] = batches[index].copy(status = newStatus)

        context.getSharedPreferences(BATCH_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_BATCH_LIST, batches.map { encodeBatch(it) }.toSet())
            .commit()
    } catch (e: Exception) {
        false
    }
}

/**
 * V6.9.2
 * บันทึกสถานะ Batch แบบ upsert:
 * - ถ้ามี batchId อยู่แล้ว -> อัปเดตสถานะ
 * - ถ้ายังไม่มี (เช่นผู้ใช้กดอัปโหลดก่อนกด "บันทึกไว้ในเครื่อง") -> สร้างรายการพร้อมสถานะให้ทันที
 *
 * แก้เคส Server อัปโหลดครบ แต่ขึ้น "บันทึกสถานะในมือถือไม่สำเร็จ"
 */
fun upsertBatchStatus(
    context: Context,
    batch: SavedBatch,
    newStatus: String
): Boolean {
    return try {
        val batches = loadSavedBatches(context).toMutableList()
        val index = batches.indexOfFirst { it.batchId == batch.batchId }
        val updated = batch.copy(status = newStatus)

        if (index >= 0) {
            batches[index] = updated
        } else {
            batches.add(updated)
        }

        context.getSharedPreferences(BATCH_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_BATCH_LIST, batches.map { encodeBatch(it) }.toSet())
            .commit()
    } catch (e: Exception) {
        false
    }
}

fun saveBatchToDevice(
    context: Context,
    batch: SavedBatch
): Boolean {
    return try {
        val batches = loadSavedBatches(context).toMutableList()

        // Same work date + same image set = update existing batch instead of duplicating it.
        val existingIndex = batches.indexOfFirst {
            it.rawDate == batch.rawDate &&
                    it.siteCode == batch.siteCode &&
                    it.imageIds.toSet() == batch.imageIds.toSet()
        }

        if (existingIndex >= 0) {
            val existing = batches[existingIndex]
            batches[existingIndex] = batch.copy(
                batchId = existing.batchId,
                status = existing.status
            )
        } else {
            batches.add(batch)
        }

        context.getSharedPreferences(BATCH_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_BATCH_LIST, batches.map { encodeBatch(it) }.toSet())
            .commit()
    } catch (e: Exception) {
        false
    }
}




private fun appBuildConfigValue(fieldName: String): String {
    return try {
        val clazz = Class.forName("com.example.locationfinderforinsx.BuildConfig")
        clazz.getField(fieldName).get(null)?.toString().orEmpty()
    } catch (_: Exception) {
        ""
    }
}

private val SUPABASE_URL: String
    get() = appBuildConfigValue("SUPABASE_URL")

private val SUPABASE_KEY: String
    get() = appBuildConfigValue("SUPABASE_KEY")

private fun isLocationServiceEnabledCompat(context: Context): Boolean {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        manager.isLocationEnabled
    } else {
        @Suppress("DEPRECATION")
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }
}

enum class ImageHealthStatus {
    GREEN,
    YELLOW,
    RED
}

enum class ImageHealthIssue {
    NONE,
    IMAGE_PERMISSION,
    FILE_ACCESS,
    LOCATION_PERMISSION,
    LOCATION_SERVICE,
    SCAN_ERROR
}

data class ImageHealthResult(
    val status: ImageHealthStatus,
    val issue: ImageHealthIssue,
    val message: String,
    val actionHint: String
)

private fun evaluateImageHealth(
    permissionGranted: Boolean,
    hasFileAccess: Boolean,
    locationPermissionGranted: Boolean,
    locationServiceEnabled: Boolean,
    scanInProgress: Boolean,
    scanError: String?
): ImageHealthResult {
    if (!permissionGranted) {
        return ImageHealthResult(
            status = ImageHealthStatus.RED,
            issue = ImageHealthIssue.IMAGE_PERMISSION,
            message = "ระบบนับรูปผิดปกติ: ไม่มีสิทธิ์เข้าถึงรูปภาพ",
            actionHint = "กด “แก้ไขตอนนี้” เพื่อเปิดสิทธิ์รูปภาพให้แอป"
        )
    }

    if (!locationPermissionGranted) {
        return ImageHealthResult(
            status = ImageHealthStatus.RED,
            issue = ImageHealthIssue.LOCATION_PERMISSION,
            message = "ระบบพิกัดไม่พร้อม: ยังไม่ได้อนุญาตตำแหน่ง",
            actionHint = "กด “แก้ไขตอนนี้” เพื่ออนุญาตตำแหน่งทันที"
        )
    }

    if (!locationServiceEnabled) {
        return ImageHealthResult(
            status = ImageHealthStatus.RED,
            issue = ImageHealthIssue.LOCATION_SERVICE,
            message = "ระบบพิกัดไม่พร้อม: GPS/ตำแหน่งของเครื่องถูกปิด",
            actionHint = "กด “แก้ไขตอนนี้” ระบบจะเปิดหน้าตั้งค่าตำแหน่งให้ทันที"
        )
    }

    if (!scanError.isNullOrBlank()) {
        return ImageHealthResult(
            status = ImageHealthStatus.RED,
            issue = ImageHealthIssue.SCAN_ERROR,
            message = "ระบบนับรูปผิดปกติ: สแกนรูปไม่สำเร็จ",
            actionHint = "กด “แก้ไขตอนนี้” เพื่อสแกนข้อมูลใหม่"
        )
    }

    if (scanInProgress) {
        return ImageHealthResult(
            status = ImageHealthStatus.YELLOW,
            issue = ImageHealthIssue.NONE,
            message = "กำลังตรวจสอบระบบนับรูป",
            actionHint = "รอสักครู่ ระบบกำลังสแกนข้อมูลล่าสุด"
        )
    }

    return ImageHealthResult(
        status = ImageHealthStatus.GREEN,
        issue = ImageHealthIssue.NONE,
        message = if (hasFileAccess) {
            "ระบบนับรูปและพิกัดปกติ"
        } else {
            "ระบบนับรูปและพิกัดปกติ • ใช้ Device GPS/LIVE_CAPTURE เป็นหลัก"
        },
        actionHint = if (hasFileAccess) {
            "พร้อมทำงาน • ระบบกำลังติดตามรูป ไฟล์งาน และตำแหน่ง"
        } else {
            "พร้อมทำงาน • ไม่ต้องเปิดสิทธิ์จัดการไฟล์ทั้งหมด"
        }
    )
}

private const val HEALTH_NOTIFICATION_CHANNEL = "image_health_alerts"
private const val HEALTH_NOTIFICATION_ID = 62012

private fun ensureHealthNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(HEALTH_NOTIFICATION_CHANNEL) == null) {
            val channel = NotificationChannel(
                HEALTH_NOTIFICATION_CHANNEL,
                "แจ้งเตือนระบบนับรูป",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "แจ้งเตือนเมื่อระบบนับรูปหรือสิทธิ์ที่จำเป็นผิดปกติ"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }
    }
}

private fun sendImageHealthAlert(
    context: Context,
    message: String
) {
    ensureHealthNotificationChannel(context)

    // เสียงเตือนสั้น ๆ ทันที แม้ผู้ใช้กำลังอยู่ในแอป
    try {
        ToneGenerator(AudioManager.STREAM_NOTIFICATION, 90)
            .startTone(ToneGenerator.TONE_PROP_BEEP, 700)
    } catch (_: Exception) {
    }

    // สั่น
    try {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(
                VibrationEffect.createWaveform(
                    longArrayOf(0, 250, 120, 350),
                    -1
                )
            )
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 250, 120, 350), -1)
        }
    } catch (_: Exception) {
    }

    // Notification
    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        android.app.Notification.Builder(context, HEALTH_NOTIFICATION_CHANNEL)
    } else {
        @Suppress("DEPRECATION")
        android.app.Notification.Builder(context)
    }

    builder
        .setSmallIcon(android.R.drawable.stat_notify_error)
        .setContentTitle("ต้องตรวจสอบระบบนับรูป")
        .setContentText(message)
        .setStyle(
            android.app.Notification.BigTextStyle().bigText(
                "$message\nกรุณาตรวจสอบและแก้ไขให้สถานะกลับเป็นสีเขียวก่อนทำงานต่อ"
            )
        )
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .setPriority(android.app.Notification.PRIORITY_HIGH)

    try {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(HEALTH_NOTIFICATION_ID, builder.build())
    } catch (_: SecurityException) {
        // Android 13+ ถ้าผู้ใช้ยังไม่อนุญาต Notification เสียง/สั่นในแอปยังทำงาน
    }
}


class MainActivity : ComponentActivity() {

    private fun ensureLiveLocationCaptureStarted() {
        // 6.19.7: restore DEVICE_LIVE capture automatically.
        // Safe when permission is missing: the helper simply returns false.
        runCatching { applicationContext.startLiveLocationCapture() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                DivergentAppRoot()
            }
        }

        ensureLiveLocationCaptureStarted()
    }

    override fun onResume() {
        super.onResume()
        // Covers the common flow where the user grants Location permission
        // and returns to the app, without requiring another upload attempt.
        ensureLiveLocationCaptureStarted()
    }

    fun scanInsxImages(): List<InsxImage> {

        val result = mutableListOf<InsxImage>()

        val collection =
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI

        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME
        )

        val sortOrder =
            "${MediaStore.Images.Media.DATE_ADDED} DESC"

        contentResolver.query(
            collection,
            projection,
            null,
            null,
            sortOrder
        )?.use { cursor ->

            val idColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Images.Media._ID
                )

            val nameColumn =
                cursor.getColumnIndexOrThrow(
                    MediaStore.Images.Media.DISPLAY_NAME
                )

            while (cursor.moveToNext()) {

                val id = cursor.getLong(idColumn)
                val name =
                    cursor.getString(nameColumn) ?: ""

                if (
                    name.startsWith(
                        "INSx",
                        ignoreCase = true
                    )
                ) {

                    val parsed =
                        parseInsxFileName(name)

                    if (parsed != null) {

                        result.add(
                            InsxImage(
                                id = id,
                                name = name,
                                ca = parsed.ca,
                                rawDate = parsed.rawDate,
                                date = parsed.date,
                                time = parsed.time
                            )
                        )
                    }
                }
            }
        }

        return result
            .distinctBy { it.name.lowercase() }
    }

    fun hasAllFilesAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true
        }
    }

    fun scanInsUploadPicFilesAuto(): List<ImageWorkLocationRecord> {
        if (!hasAllFilesAccess()) return emptyList()

        val records = mutableListOf<ImageWorkLocationRecord>()
        val root = Environment.getExternalStorageDirectory()
        val queue = ArrayDeque<File>()
        queue.add(root)

        val fileNameRegex = Regex(
            """^InsUploadPic.*\.txt$""",
            RegexOption.IGNORE_CASE
        )

        // ข้ามโฟลเดอร์ระบบ/โฟลเดอร์ขนาดใหญ่ที่ไม่เกี่ยวกับไฟล์งาน
        val blockedDirNames = setOf(
            ".thumbnails",
            ".Trash",
            ".RecycleBin",
            "Android",
            "LOST.DIR"
        )

        while (queue.isNotEmpty()) {
            val dir = queue.removeFirst()

            val children = try {
                dir.listFiles()?.toList().orEmpty()
            } catch (_: Exception) {
                emptyList()
            }

            children.forEach { file ->
                try {
                    if (file.isDirectory) {
                        if (!file.name.startsWith(".") && file.name !in blockedDirNames) {
                            queue.add(file)
                        }
                    } else if (
                        file.isFile &&
                        file.length() in 1..10_000_000L &&
                        fileNameRegex.matches(file.name)
                    ) {
                        val fileText = runCatching {
                            file.inputStream().bufferedReader(Charsets.UTF_8).use { it.readText() }
                        }.getOrNull()

                        if (!fileText.isNullOrBlank()) {
                            records += parseInsUploadPicText(file.name, fileText)
                        }
                    }
                } catch (_: Exception) {
                    // ข้ามไฟล์/โฟลเดอร์ที่ Android ไม่อนุญาตให้อ่าน
                }
            }
        }

        return records.distinctBy {
            "${it.caNumber}|${it.photoStem}|${it.latitude}|${it.longitude}|${it.eventDateTime.orEmpty()}".lowercase()
        }
    }
}

private fun decodeXmlText(value: String): String =
    value.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")

fun parseInsUploadPicText(sourceFileName: String, text: String): List<ImageWorkLocationRecord> {
    val parameterRegex = Regex(
        "<Parameter>(.*?)</Parameter>",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    )

    return parameterRegex.findAll(text).mapNotNull { match ->
        val rawParameter = decodeXmlText(match.groupValues[1].trim())
        val fields = rawParameter.split(',')
        if (fields.size < 24) return@mapNotNull null

        val ca = fields[2].trim().filter { it.isDigit() }
        val latitude = fields[15].trim().toDoubleOrNull() ?: return@mapNotNull null
        val longitude = fields[16].trim().toDoubleOrNull() ?: return@mapNotNull null
        val photoName = fields[18].trim()
        val parsedName = parseInsxFileName(photoName) ?: return@mapNotNull null

        if (ca.length != 12 || parsedName.ca != ca) return@mapNotNull null
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return@mapNotNull null
        if (latitude == 0.0 && longitude == 0.0) return@mapNotNull null

        ImageWorkLocationRecord(
            caNumber = ca,
            photoName = photoName,
            photoStem = photoName.substringBeforeLast('.'),
            rawDate = parsedName.rawDate,
            latitude = latitude,
            longitude = longitude,
            photoDateTime = fields[21].trim().takeIf { it.isNotBlank() },
            eventDateTime = fields[23].trim().takeIf { it.isNotBlank() },
            sourceFile = sourceFileName,
            jobRef = fields[0].trim().takeIf { it.isNotBlank() },
            cycleCode = fields[1].trim().takeIf { it.isNotBlank() },
            secondaryRef = fields[3].trim().takeIf { it.isNotBlank() },
            subdistrict = fields[12].trim().takeIf { it.isNotBlank() },
            district = fields[13].trim().takeIf { it.isNotBlank() },
            province = fields[14].trim().takeIf { it.isNotBlank() },
            rawParameter = rawParameter
        )
    }.toList()
}

fun parseInsxFileName(
    fileName: String
): ParsedInsxName? {

    val nameWithoutExtension =
        fileName.substringBeforeLast(".")

    val regex =
        Regex(
            """^INSx(\d{12})_(\d{8})_(\d{6})$""",
            RegexOption.IGNORE_CASE
        )

    val match =
        regex.matchEntire(nameWithoutExtension)
            ?: return null

    val ca =
        match.groupValues[1]

    val rawDate =
        match.groupValues[2]

    val rawTime =
        match.groupValues[3]

    val date =
        "${rawDate.substring(0, 2)}/" +
                "${rawDate.substring(2, 4)}/" +
                rawDate.substring(4, 8)

    val time =
        "${rawTime.substring(0, 2)}:" +
                "${rawTime.substring(2, 4)}:" +
                rawTime.substring(4, 6)

    return ParsedInsxName(
        ca = ca,
        rawDate = rawDate,
        date = date,
        time = time
    )
}


private enum class MainModule {
    MENU,
    LOCATION_FINDER,
    IMAGE_RESCUE,
    COMPENSATION,
    PROFILE
}

@Composable
fun DivergentAppRoot() {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences("divergent_login", Context.MODE_PRIVATE)
    }

    // ตาม requirement: เปิดแอปทุกครั้งให้เริ่มที่หน้า Login
    // Remember password = จำ Username/Password เพื่อกรอกให้ ไม่ใช่ข้ามหน้า Login
    var loggedIn by remember { mutableStateOf(false) }
    var currentUsername by remember { mutableStateOf("") }
    var currentSessionToken by remember { mutableStateOf("") }
    var module by remember { mutableStateOf(MainModule.MENU) }

    if (!loggedIn) {
        DivergentLoginScreen(
            prefs = prefs,
            onLoginSuccess = { username, sessionToken, requiresProfile ->
                currentUsername = username
                currentSessionToken = sessionToken
                loggedIn = true
                module = if (requiresProfile) MainModule.PROFILE else MainModule.MENU
            }
        )
        return
    }

    when (module) {
        MainModule.MENU -> DivergentMainMenuScreen(
            username = currentUsername,
            onOpenLocationFinder = { module = MainModule.LOCATION_FINDER },
            onOpenImageRescue = { module = MainModule.IMAGE_RESCUE },
            onOpenCompensation = { module = MainModule.COMPENSATION },
            onOpenProfile = { module = MainModule.PROFILE },
            onLogout = {
                loggedIn = false
                currentUsername = ""
                currentSessionToken = ""
                prefs.edit().remove("session_token").apply()
                module = MainModule.MENU
            }
        )

        MainModule.LOCATION_FINDER -> SearchScreen(
            customers = emptyList(),
            sessionToken = currentSessionToken,
            isRefreshing = false,
            refreshMessage = "",
            onRefresh = {},
            onLogout = {
                loggedIn = false
                currentUsername = ""
                currentSessionToken = ""
                prefs.edit().remove("session_token").apply()
                module = MainModule.MENU
            },
            onBack = { module = MainModule.MENU }
        )

        MainModule.IMAGE_RESCUE -> ImageScannerApp(
            onBackToMainMenu = { module = MainModule.MENU }
        )

        MainModule.COMPENSATION -> CompensationScreen(
            sessionToken = currentSessionToken,
            onBack = { module = MainModule.MENU }
        )

        MainModule.PROFILE -> DivergentProfileScreen(
            username = currentUsername,
            sessionToken = currentSessionToken,
            onBack = { module = MainModule.MENU },
            onLogout = {
                loggedIn = false
                currentUsername = ""
                currentSessionToken = ""
                prefs.edit().remove("session_token").apply()
                module = MainModule.MENU
            }
        )
    }
}

private fun currentRawDateThai(): String {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Bangkok"))
    val day = cal.get(Calendar.DAY_OF_MONTH)
    val month = cal.get(Calendar.MONTH) + 1
    val buddhistYear = cal.get(Calendar.YEAR) + 543
    return "%02d%02d%04d".format(day, month, buddhistYear)
}

private suspend fun loginAppUser(
    username: String,
    password: String
): String? = withContext(Dispatchers.IO) {
    try {
        val url = URL("${SUPABASE_URL}/rest/v1/rpc/create_app_session")
        val connection = url.openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 20000
            connection.readTimeout = 20000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("apikey", SUPABASE_KEY)

            val body = JSONObject().apply {
                put("p_username", username.trim())
                put("p_password", password)
            }.toString()

            connection.outputStream.use {
                it.write(body.toByteArray(Charsets.UTF_8))
            }

            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            if (code !in 200..299) return@withContext null

            val array = JSONArray(response)
            if (array.length() == 0) return@withContext null

            array.getJSONObject(0)
                .optString("token")
                .takeIf { it.isNotBlank() }
        } finally {
            connection.disconnect()
        }
    } catch (_: Exception) {
        null
    }
}



private val DivergentPurple = Color(0xFF5B2DBF)
private val DivergentPurpleDark = Color(0xFF3D197E)
private val DivergentPurpleLight = Color(0xFF8A5CF5)
private val DivergentSurface = Color(0xFFF7F4FC)
private val DivergentCard = Color(0xFFFFFFFF)
private val DivergentText = Color(0xFF24183A)
private val DivergentMuted = Color(0xFF6F6680)
private val DivergentSuccess = Color(0xFF2E7D32)
private val DivergentWarning = Color(0xFFF57F17)
private val DivergentDanger = Color(0xFFC62828)

@Composable
private fun DivergentBrandHeader(
    title: String,
    subtitle: String? = null
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.horizontalGradient(
                    listOf(
                        DivergentPurpleDark,
                        DivergentPurple,
                        DivergentPurpleLight
                    )
                ),
                RoundedCornerShape(28.dp)
            )
            .padding(horizontal = 20.dp, vertical = 22.dp)
    ) {
        Column {
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp
            )
            if (!subtitle.isNullOrBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    color = Color.White.copy(alpha = 0.88f),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
private fun DivergentPrimaryButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(56.dp),
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = DivergentPurple,
            contentColor = Color.White,
            disabledContainerColor = Color(0xFFD1C7E8),
            disabledContentColor = Color(0xFF8C82A0)
        )
    ) {
        Text(
            text = text,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun DivergentSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(
            1.dp,
            Brush.horizontalGradient(
                listOf(DivergentPurple, DivergentPurpleLight)
            )
        )
    ) {
        Text(
            text = text,
            color = DivergentPurple,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun DivergentSectionCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = DivergentCard),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            content = content
        )
    }
}

@Composable
private fun DivergentTopBar(
    title: String,
    onBack: (() -> Unit)? = null
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = DivergentPurpleDark,
        shadowElevation = 5.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onBack != null) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(44.dp)
                        .background(
                            Color.White.copy(alpha = 0.12f),
                            CircleShape
                        )
                ) {
                    Text(
                        text = "←",
                        color = Color.White,
                        fontSize = 25.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else {
                Spacer(Modifier.size(44.dp))
            }

            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.size(44.dp))
        }
    }
}

@Composable
private fun DivergentScreenContainer(
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFF7F4FC),
                        Color(0xFFF1EBFB)
                    )
                )
            ),
        content = content
    )
}


@Composable
private fun DashboardMetricCard(
    title: String,
    value: String,
    unit: String,
    icon: String,
    containerColor: Color,
    valueColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(icon, fontSize = 24.sp)
            Spacer(Modifier.height(6.dp))
            Text(
                title,
                fontSize = 12.sp,
                color = DivergentMuted,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(4.dp))
            Text(
                value,
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
                color = valueColor
            )
            Text(
                unit,
                fontSize = 12.sp,
                color = DivergentMuted
            )
        }
    }
}

@Composable
private fun DashboardMenuTile(
    title: String,
    icon: String,
    onClick: () -> Unit,
    highlighted: Boolean = false,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(110.dp),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(
            if (highlighted) 2.dp else 1.dp,
            if (highlighted) Color(0xFFFF4778) else Color(0xFFE4DDF2)
        ),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (highlighted) Color(0xFFFFF8FB) else Color.White
        ),
        contentPadding = PaddingValues(8.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(icon, fontSize = 30.sp)
            Spacer(Modifier.height(7.dp))
            Text(
                title,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.SemiBold,
                color = DivergentPurpleDark
            )
        }
    }
}

@Composable
private fun DashboardBottomNav(
    selected: String,
    onHome: () -> Unit,
    onWork: () -> Unit,
    onCompensation: () -> Unit,
    onProfile: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shadowElevation = 12.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 7.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            fun item(label: String, icon: String, key: String, action: () -> Unit) {
            }
            TextButton(onClick = onHome, modifier = Modifier.weight(1f)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("⌂", fontSize = 22.sp, color = if (selected == "home") DivergentPurple else DivergentMuted)
                    Text("หน้าหลัก", fontSize = 10.sp, color = if (selected == "home") DivergentPurple else DivergentMuted)
                }
            }
            TextButton(onClick = onWork, modifier = Modifier.weight(1f)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("▣", fontSize = 20.sp, color = if (selected == "work") DivergentPurple else DivergentMuted)
                    Text("งานของฉัน", fontSize = 10.sp, color = if (selected == "work") DivergentPurple else DivergentMuted)
                }
            }
            TextButton(onClick = onCompensation, modifier = Modifier.weight(1f)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("฿", fontSize = 20.sp, color = if (selected == "comp") DivergentPurple else DivergentMuted)
                    Text("ค่าตอบแทน", fontSize = 10.sp, color = if (selected == "comp") DivergentPurple else DivergentMuted)
                }
            }
            TextButton(onClick = onProfile, modifier = Modifier.weight(1f)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("●", fontSize = 20.sp, color = if (selected == "profile") DivergentPurple else DivergentMuted)
                    Text("โปรไฟล์", fontSize = 10.sp, color = if (selected == "profile") DivergentPurple else DivergentMuted)
                }
            }
        }
    }
}

@Composable
private fun DivergentLoginScreen(
    prefs: android.content.SharedPreferences,
    onLoginSuccess: (String, String, Boolean) -> Unit
) {
    val scope = rememberCoroutineScope()
    var rememberPassword by remember {
        mutableStateOf(prefs.getBoolean("remember_password", false))
    }
    var username by remember {
        mutableStateOf(if (rememberPassword) prefs.getString("remembered_username", "").orEmpty() else "")
    }
    var password by remember {
        mutableStateOf(if (rememberPassword) prefs.getString("remembered_password", "").orEmpty() else "")
    }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        DivergentPurpleDark,
                        DivergentPurple,
                        Color(0xFFF3EEFD)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(48.dp))

            Text("➤", fontSize = 78.sp, color = Color.White)
            Text(
                "Divergent",
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                "Field Tools",
                fontSize = 24.sp,
                color = Color.White.copy(alpha = 0.92f)
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "งานของคุณ สร้างความเปลี่ยนแปลงให้ชุมชน",
                color = Color.White.copy(alpha = 0.88f),
                fontSize = 15.sp
            )

            Spacer(Modifier.height(34.dp))

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp),
                shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp, bottomStart = 30.dp, bottomEnd = 30.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFDFBFF)),
                elevation = CardDefaults.cardElevation(defaultElevation = 10.dp)
            ) {
                Column(modifier = Modifier.padding(22.dp)) {
                    Text(
                        "เข้าสู่ระบบ",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = DivergentText
                    )
                    Spacer(Modifier.height(16.dp))

                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it; error = "" },
                        label = { Text("รหัสพนักงาน / Username") },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; error = "" },
                        label = { Text("รหัสผ่าน") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = rememberPassword,
                            onCheckedChange = { checked ->
                                rememberPassword = checked
                                if (!checked) {
                                    prefs.edit()
                                        .putBoolean("remember_password", false)
                                        .remove("remembered_username")
                                        .remove("remembered_password")
                                        .apply()
                                }
                            }
                        )
                        Text("จดจำรหัสผ่าน")
                    }

                    if (error.isNotBlank()) {
                        Text(error, color = DivergentDanger, fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                    }

                    DivergentPrimaryButton(
                        text = if (isLoading) "กำลังเข้าสู่ระบบ..." else "เข้าสู่ระบบ  →",
                        onClick = {
                            if (username.isBlank() || password.isBlank()) {
                                error = "กรุณากรอก Username และ Password"
                                return@DivergentPrimaryButton
                            }
                            isLoading = true
                            error = ""
                            scope.launch {
                                val token = loginAppUser(username.trim(), password)
                                isLoading = false
                                if (token != null) {
                                    if (rememberPassword) {
                                        prefs.edit()
                                            .putBoolean("remember_password", true)
                                            .putString("remembered_username", username.trim())
                                            .putString("remembered_password", password)
                                            .apply()
                                    }
                                    val requiresProfile = compensationProfileRequired(token)
                                    prefs.edit().putString("session_token", token).apply()
                                    onLoginSuccess(username.trim(), token, requiresProfile)
                                } else {
                                    error = "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง"
                                }
                            }
                        },
                        enabled = !isLoading,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(Modifier.height(18.dp))
                    Text(
                        "Divergent Corporation จำกัด",
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        color = DivergentPurple,
                        fontSize = 12.sp
                    )
                    Text(
                        "Version 6.19.7",
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        color = DivergentMuted,
                        fontSize = 11.sp
                    )
                }
            }
            Spacer(Modifier.height(30.dp))
        }
    }
}

@Composable
private fun DivergentMainMenuScreen(
    username: String,
    onOpenLocationFinder: () -> Unit,
    onOpenImageRescue: () -> Unit,
    onOpenCompensation: () -> Unit,
    onOpenProfile: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val todayRaw = remember { currentRawDateThai() }
    val todayBatches = remember(todayRaw) {
        loadSavedBatches(context).filter {
            it.status == "SERVER_BACKED_UP" && it.rawDate == todayRaw
        }
    }
    val todayCount = remember(todayBatches) {
        todayBatches.flatMap { it.caValues }.map { it.trim() }.filter { it.isNotBlank() }.distinct().size
    }
    val payPrefs = remember { context.getSharedPreferences("compensation_settings", Context.MODE_PRIVATE) }
    val rate = payPrefs.getString("rate_DEFAULT", "0")?.toDoubleOrNull() ?: 0.0
    val gross = todayCount * rate
    val tax = gross * 0.03

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFFF4EFFC), Color(0xFFFDFBFF))
                )
            )
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            listOf(DivergentPurpleDark, DivergentPurple, DivergentPurpleLight)
                        ),
                        RoundedCornerShape(26.dp)
                    )
                    .padding(20.dp)
            ) {
                Column {
                    Text("➤  Divergent", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                    Text("Field Tools", color = Color.White.copy(alpha = 0.92f), fontSize = 16.sp)
                    Spacer(Modifier.height(18.dp))
                    Text(
                        "งานของคุณ\nสร้างความเปลี่ยนแปลงให้ชุมชน",
                        color = Color.White,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            DivergentSectionCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(Color(0xFFE7DDFB), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("●", color = DivergentPurple, fontSize = 28.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("สวัสดีครับ", color = DivergentMuted, fontSize = 12.sp)
                        Text(username, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = DivergentText)
                        Text("พนักงานภาคสนาม", color = DivergentMuted, fontSize = 12.sp)
                    }
                    Text("⚙", fontSize = 22.sp, color = DivergentPurple)
                }
            }

            Spacer(Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("▣", color = DivergentPurple, fontSize = 20.sp)
                    Spacer(Modifier.width(10.dp))
                    Text(
                        "วันนี้ ${formatRawDate(todayRaw)}",
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.SemiBold
                    )
                    TextButton(onClick = onOpenCompensation) {
                        Text("ดูประวัติ", color = Color.White)
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardMetricCard(
                    "จำนวนราย", todayCount.toString(), "ราย", "▣",
                    Color(0xFFE0F8EC), Color(0xFF118B55),
                    modifier = Modifier.weight(1f)
                )
                DashboardMetricCard(
                    "ส่งสำเร็จ", todayCount.toString(), "ราย", "✓",
                    Color(0xFFE7F3FF), Color(0xFF1976D2),
                    modifier = Modifier.weight(1f)
                )
                DashboardMetricCard(
                    "ค่าตอบแทน", String.format("%,.2f", gross), "บาท", "฿",
                    Color(0xFFFFF0D9), Color(0xFFF57C00),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF1EAFE))
            ) {
                Row(
                    modifier = Modifier.padding(15.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("ยอดสุทธิ", modifier = Modifier.weight(1f), color = DivergentPurpleDark)
                    Text(
                        String.format("%,.2f บาท", gross - tax),
                        fontWeight = FontWeight.Bold,
                        color = DivergentPurple,
                        fontSize = 20.sp
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DashboardMenuTile(
                    title = "งาน Image Rescue\n/ ส่งงาน",
                    icon = "▣",
                    onClick = onOpenImageRescue,
                    modifier = Modifier.weight(1f)
                )
                DashboardMenuTile(
                    title = "ตรวจสอบ\nค่าตอบแทน",
                    icon = "▥",
                    onClick = onOpenCompensation,
                    highlighted = true,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DashboardMenuTile(
                    title = "ค้นหาพิกัด",
                    icon = "⌖",
                    onClick = onOpenLocationFinder,
                    modifier = Modifier.weight(1f)
                )
                DashboardMenuTile(
                    title = "ข้อมูลส่วนตัว",
                    icon = "●",
                    onClick = onOpenProfile,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(16.dp))
        }

        DashboardBottomNav(
            selected = "home",
            onHome = {},
            onWork = onOpenImageRescue,
            onCompensation = onOpenCompensation,
            onProfile = onOpenProfile
        )
    }
}

@Composable
private fun LegacyDivergentProfileScreen(
    username: String,
    onBack: () -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F4FC))
    ) {
        DivergentTopBar(title = "โปรไฟล์ / ตั้งค่า", onBack = onBack)
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(18.dp)
        ) {
            DivergentSectionCard {
                Text("●", color = DivergentPurple, fontSize = 42.sp)
                Spacer(Modifier.height(8.dp))
                Text(username, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Text("พนักงานภาคสนาม", color = DivergentMuted)
            }
            Spacer(Modifier.height(14.dp))
            DivergentSectionCard {
                Text("ข้อมูลส่วนตัว", fontWeight = FontWeight.SemiBold)
                HorizontalDivider(Modifier.padding(vertical = 12.dp))
                Text("ตั้งค่าแอป")
                HorizontalDivider(Modifier.padding(vertical = 12.dp))
                Text("เกี่ยวกับแอป • Version 6.19.7")
            }
            Spacer(Modifier.height(18.dp))
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, DivergentDanger)
            ) {
                Text("ออกจากระบบ", color = DivergentDanger)
            }
        }
        DashboardBottomNav(
            selected = "profile",
            onHome = onBack,
            onWork = onBack,
            onCompensation = onBack,
            onProfile = {}
        )
    }
}

data class ServerSearchResult(
    val customer: Customer,
    val noticeLocation: NoticeLocation?
)

suspend fun searchLocationsFromServer(
    token: String,
    query: String
): List<ServerSearchResult> = withContext(Dispatchers.IO) {
    try {
        val cleanQuery = query.filter { it.isDigit() }
        if (cleanQuery.length < 5) return@withContext emptyList()

        val url = URL("${SUPABASE_URL}/functions/v1/android-location-choice")
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("apikey", SUPABASE_KEY)
        connection.connectTimeout = 8000
        connection.readTimeout = 8000
        connection.doOutput = true

        val body = JSONObject().apply {
            put("token", token)
            put("query", cleanQuery)
        }.toString()

        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

        val code = connection.responseCode
        val responseText = if (code in 200..299) {
            connection.inputStream.bufferedReader().use { it.readText() }
        } else {
            connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        }
        connection.disconnect()

        if (code !in 200..299) {
            Log.e("SERVER_SEARCH", "HTTP $code : $responseText")
            return@withContext emptyList()
        }

        val arr = JSONObject(responseText).optJSONArray("search_results") ?: JSONArray()
        val results = mutableListOf<ServerSearchResult>()

        for (i in 0 until arr.length()) {
            val row = arr.getJSONObject(i)
            val ca = row.optString("ca").filter { it.isDigit() }

            val cObj = if (row.isNull("customer")) null else row.optJSONObject("customer")
            val customer = Customer(
                mru = cObj?.optString("mru").orEmpty(),
                peaNo = cObj?.optString("pea_no").orEmpty(),
                ca = ca,
                installation = cObj?.optString("installation").orEmpty(),
                readDate = "",
                name = cObj?.optString("name").orEmpty(),
                address = cObj?.optString("address").orEmpty(),
                latitude = if (cObj == null || cObj.isNull("latitude")) null else cObj.optDouble("latitude"),
                longitude = if (cObj == null || cObj.isNull("longitude")) null else cObj.optDouble("longitude"),
                googleMap = cObj?.optString("google_map").orEmpty()
            )

            val nObj = if (row.isNull("notice_location")) null else row.optJSONObject("notice_location")
            val notice = if (nObj != null) {
                val lat = nObj.optDouble("actual_latitude", Double.NaN)
                val lon = nObj.optDouble("actual_longitude", Double.NaN)
                if (!lat.isNaN() && !lon.isNaN()) {
                    NoticeLocation(
                        latitude = lat,
                        longitude = lon,
                        eventDatetime = nObj.optString("event_datetime"),
                        photoDatetime = nObj.optString("photo_datetime"),
                        sourcePhotoName = nObj.optString("source_photo_name"),
                        matchStatus = nObj.optString("match_status")
                    )
                } else null
            } else null

            if (ca.isNotBlank()) results.add(ServerSearchResult(customer, notice))
        }
        results
    } catch (e: Exception) {
        Log.e("SERVER_SEARCH", "ERROR", e)
        emptyList()
    }
}

@Composable
fun SearchScreen(
    customers: List<Customer>,
    sessionToken: String,
    isRefreshing: Boolean,
    refreshMessage: String,
    onRefresh: () -> Unit,
    onLogout: () -> Unit,
    onBack: () -> Unit
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<ServerSearchResult>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var selectedCa by remember { mutableStateOf<String?>(null) }

    val digitQuery = query.filter { it.isDigit() }

    LaunchedEffect(digitQuery, sessionToken) {
        selectedCa = null
        if (digitQuery.length < 5 || sessionToken.isBlank()) {
            results = emptyList()
            loading = false
        } else {
            delay(180)
            loading = true
            results = searchLocationsFromServer(sessionToken, digitQuery)
            loading = false
            if (results.size == 1) selectedCa = results.first().customer.ca
        }
    }

    val selected = results.firstOrNull { it.customer.ca == selectedCa }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F6FB))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 34.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF6A35B5))
                    .padding(horizontal = 8.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "ค้นหาพิกัด",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "Divergent Field Tools • V6.19.7",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.sp
                    )
                }

                IconButton(onClick = onRefresh) {
                    Icon(
                        Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = Color.White
                    )
                }

                IconButton(onClick = onLogout) {
                    Icon(
                        Icons.AutoMirrored.Filled.Logout,
                        contentDescription = "Logout",
                        tint = Color.White
                    )
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it.filter(Char::isDigit) },
                    placeholder = { Text("กรอก CA หรือ 5 ตัวท้าย") },
                    label = { Text("ค้นหา CA") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(Modifier.height(6.dp))
                Text(
                    "ค้นจาก Server โดยตรง • ไม่โหลดฐาน 71,000+ รายลงมือถือ",
                    fontSize = 12.sp,
                    color = Color(0xFF6B7280)
                )

                if (refreshMessage.isNotBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        refreshMessage,
                        color = Color(0xFF2E7D32),
                        fontSize = 13.sp
                    )
                }

                if (loading) {
                    Spacer(Modifier.height(20.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.width(10.dp))
                        Text("กำลังค้นหา...")
                    }
                } else if (digitQuery.length in 1..4) {
                    Spacer(Modifier.height(16.dp))
                    Text("กรอกอย่างน้อย 5 หลัก", color = Color(0xFF6B7280))
                } else if (digitQuery.length >= 5 && results.isEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "ไม่พบ CA ที่ตรงกับ $digitQuery",
                        color = Color(0xFF6B7280)
                    )
                }

                Spacer(Modifier.height(14.dp))

                if (selected != null) {
                    if (results.size > 1) {
                        TextButton(onClick = { selectedCa = null }) {
                            Text("← กลับไปผลการค้นหา")
                        }
                    }

                    CustomerCard(
                        customer = selected.customer,
                        noticeLocation = selected.noticeLocation
                    )
                } else if (results.size == 1) {
                    CustomerCard(
                        customer = results.first().customer,
                        noticeLocation = results.first().noticeLocation
                    )
                } else if (results.size > 1) {
                    Text(
                        "พบ ${results.size} รายการ • เลือก CA ที่ต้องการ",
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(10.dp))

                    results.forEach { item ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp)
                                .clickable { selectedCa = item.customer.ca },
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(Modifier.padding(14.dp)) {
                                Text(
                                    "CA ${item.customer.ca}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp
                                )

                                if (item.customer.name.isNotBlank()) {
                                    Text(item.customer.name, fontSize = 14.sp)
                                }

                                Spacer(Modifier.height(6.dp))

                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        if (item.noticeLocation != null)
                                            "🏠 แจ้งเตือน ✓"
                                        else
                                            "🏠 แจ้งเตือน -",
                                        fontSize = 12.sp
                                    )

                                    Text(
                                        if (
                                            item.customer.latitude != null &&
                                            item.customer.longitude != null
                                        )
                                            "📟 มิเตอร์ ✓"
                                        else
                                            "📟 มิเตอร์ -",
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            color = Color(0xFF2B1745),
            tonalElevation = 6.dp
        ) {
            Text(
                text = "Divergent Field Tools • V6.19.7",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }
    }
}

@Composable
fun CustomerCard(customer: Customer, noticeLocation: NoticeLocation? = null) {
    val context = LocalContext.current
    val hasMeter = customer.latitude != null && customer.longitude != null
    val hasNotice = noticeLocation != null

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Text(
                text = customer.name.ifBlank { "ข้อมูลพิกัด CA ${customer.ca}" },
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp
            )

            Spacer(Modifier.height(8.dp))
            Text("CA: ${customer.ca.ifBlank { "-" }}", fontWeight = FontWeight.SemiBold)

            if (customer.peaNo.isNotBlank()) Text("PEA No.: ${customer.peaNo}")
            if (customer.mru.isNotBlank()) Text("MRU: ${customer.mru}")

            if (customer.address.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    customer.address.replace(
                        Regex("""\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*$"""),
                        ""
                    ).trim()
                )
            }

            Spacer(Modifier.height(18.dp))

            Text(
                text = "เลือกพิกัดที่ต้องการนำทาง",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = Color(0xFF4B2A78)
            )

            Spacer(Modifier.height(12.dp))

            // ตัวเลือก 1: พิกัดใบแจ้งเตือน
            Button(
                onClick = {
                    noticeLocation?.let {
                        val uri = Uri.parse(
                            "google.navigation:q=${it.latitude},${it.longitude}&mode=d"
                        )
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                },
                enabled = hasNotice,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFD32F2F),
                    disabledContainerColor = Color(0xFFBDBDBD)
                )
            ) {
                Icon(Icons.Default.Map, contentDescription = null)
                Spacer(Modifier.width(10.dp))
                Text(
                    if (hasNotice)
                        "พิกัดใบแจ้งเตือน (บ้านลูกค้า)"
                    else
                        "พิกัดใบแจ้งเตือน • ไม่มีข้อมูล",
                    fontWeight = FontWeight.Bold
                )
            }

            if (hasNotice) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "พิกัดงานจริงที่บ้านลูกค้า",
                    color = Color(0xFFC62828),
                    fontSize = 12.sp
                )
            }

            Spacer(Modifier.height(12.dp))

            // ตัวเลือก 2: พิกัดจดหน่วย / มิเตอร์
            Button(
                onClick = {
                    val lat = customer.latitude
                    val lon = customer.longitude
                    if (lat != null && lon != null) {
                        val uri = Uri.parse("google.navigation:q=$lat,$lon&mode=d")
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                },
                enabled = hasMeter,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF1976D2),
                    disabledContainerColor = Color(0xFFBDBDBD)
                )
            ) {
                Icon(Icons.Default.Map, contentDescription = null)
                Spacer(Modifier.width(10.dp))
                Text(
                    if (hasMeter)
                        "พิกัดจดหน่วย / มิเตอร์"
                    else
                        "พิกัดจดหน่วย / มิเตอร์ • ไม่มีข้อมูล",
                    fontWeight = FontWeight.Bold
                )
            }

            if (hasMeter) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "พิกัดตำแหน่งติดตั้งมิเตอร์",
                    color = Color(0xFF1565C0),
                    fontSize = 12.sp
                )
            }

            Spacer(Modifier.height(18.dp))

            // รายละเอียดพิกัดทั้งสองแบบ
            Surface(
                color = Color(0xFFF8F8FA),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(
                        "รายละเอียดพิกัด",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )

                    Spacer(Modifier.height(10.dp))

                    Text(
                        "🏠 ใบแจ้งเตือน",
                        fontWeight = FontWeight.SemiBold,
                        color = if (hasNotice) Color(0xFFC62828) else Color(0xFF888888)
                    )
                    if (hasNotice) {
                        Text("ละติจูด  ${noticeLocation!!.latitude}", fontSize = 12.sp)
                        Text("ลองจิจูด  ${noticeLocation.longitude}", fontSize = 12.sp)
                        val dt = noticeLocation.eventDatetime.ifBlank {
                            noticeLocation.photoDatetime
                        }
                        if (dt.isNotBlank()) {
                            Text(
                                "บันทึกล่าสุด  $dt",
                                fontSize = 11.sp,
                                color = Color.DarkGray
                            )
                        }
                    } else {
                        Text(
                            "ไม่มีข้อมูล",
                            fontSize = 12.sp,
                            color = Color(0xFF888888)
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    Text(
                        "📟 จดหน่วย / มิเตอร์",
                        fontWeight = FontWeight.SemiBold,
                        color = if (hasMeter) Color(0xFF1565C0) else Color(0xFF888888)
                    )
                    if (hasMeter) {
                        Text("ละติจูด  ${customer.latitude}", fontSize = 12.sp)
                        Text("ลองจิจูด  ${customer.longitude}", fontSize = 12.sp)
                    } else {
                        Text(
                            "ไม่มีข้อมูล",
                            fontSize = 12.sp,
                            color = Color(0xFF888888)
                        )
                    }
                }
            }
        }
    }
}

// ============================================================
// IMAGE RESCUE MODULE - merged into Divergent Field Tools V6.0
// ============================================================


















fun Context.scanInsxImages(): List<InsxImage> {
    val result = mutableListOf<InsxImage>()
    val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val projection = arrayOf(
        MediaStore.Images.Media._ID,
        MediaStore.Images.Media.DISPLAY_NAME
    )
    val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"

    contentResolver.query(
        collection,
        projection,
        null,
        null,
        sortOrder
    )?.use { cursor ->
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
        val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)

        while (cursor.moveToNext()) {
            val id = cursor.getLong(idColumn)
            val name = cursor.getString(nameColumn) ?: ""

            if (name.startsWith("INSx", ignoreCase = true)) {
                val parsed = parseInsxFileName(name)
                if (parsed != null) {
                    result.add(
                        InsxImage(
                            id = id,
                            name = name,
                            ca = parsed.ca,
                            rawDate = parsed.rawDate,
                            date = parsed.date,
                            time = parsed.time
                        )
                    )
                }
            }
        }
    }

    return result.distinctBy { it.name.lowercase() }
}

fun Context.hasAllFilesAccess(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
    } else {
        true
    }
}

fun Context.hasLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(
        this,
        android.Manifest.permission.ACCESS_FINE_LOCATION
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED

    val coarse = ContextCompat.checkSelfPermission(
        this,
        android.Manifest.permission.ACCESS_COARSE_LOCATION
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED

    return fine || coarse
}

data class DeviceLocationSnapshot(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val timeMs: Long
)

fun Context.readLatestDeviceLocation(): DeviceLocationSnapshot? {
    val prefs = getSharedPreferences(
        LIVE_CAPTURE_PREFS,
        Context.MODE_PRIVATE
    )

    if (!prefs.contains("device_latitude")) return null

    return DeviceLocationSnapshot(
        latitude = java.lang.Double.longBitsToDouble(
            prefs.getLong("device_latitude", 0L)
        ),
        longitude = java.lang.Double.longBitsToDouble(
            prefs.getLong("device_longitude", 0L)
        ),
        accuracy = prefs.getFloat("device_accuracy", -1f),
        timeMs = prefs.getLong("device_time_ms", 0L)
    )
}


fun Context.scanInsUploadPicFilesAuto(): List<ImageWorkLocationRecord> {
    if (!hasAllFilesAccess()) return emptyList()

    val records = mutableListOf<ImageWorkLocationRecord>()
    val root = Environment.getExternalStorageDirectory()
    val queue = ArrayDeque<File>()
    queue.add(root)

    val fileNameRegex = Regex(
        """^InsUploadPic.*\.txt$""",
        RegexOption.IGNORE_CASE
    )

    val blockedDirNames = setOf(
        ".thumbnails",
        ".Trash",
        ".RecycleBin",
        "Android",
        "LOST.DIR"
    )

    while (queue.isNotEmpty()) {
        val dir = queue.removeFirst()
        val children = try {
            dir.listFiles()?.toList().orEmpty()
        } catch (_: Exception) {
            emptyList()
        }

        children.forEach { file ->
            try {
                if (file.isDirectory) {
                    if (!file.name.startsWith(".") && file.name !in blockedDirNames) {
                        queue.add(file)
                    }
                } else if (
                    file.isFile &&
                    file.length() in 1..10_000_000L &&
                    fileNameRegex.matches(file.name)
                ) {
                    val fileText = runCatching {
                        file.inputStream().bufferedReader(Charsets.UTF_8).use { it.readText() }
                    }.getOrNull()

                    if (!fileText.isNullOrBlank()) {
                        records += parseInsUploadPicText(file.name, fileText)
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    return records.distinctBy {
        "${it.caNumber}|${it.photoStem}|${it.latitude}|${it.longitude}|${it.eventDateTime.orEmpty()}".lowercase()
    }
}





@Composable
fun ImageScannerApp(
    onBackToMainMenu: () -> Unit = {}
) {

    val activity =
        LocalContext.current as MainActivity

    var permissionGranted by remember {
        mutableStateOf(false)
    }

    var scanInProgress by remember { mutableStateOf(false) }
    var scanError by remember { mutableStateOf<String?>(null) }
    var showHealthHelp by remember { mutableStateOf(false) }
    var previousHealthStatus by remember { mutableStateOf<ImageHealthStatus?>(null) }

    var images by remember {
        mutableStateOf<List<InsxImage>>(
            emptyList()
        )
    }

    var selectedDate by remember {
        mutableStateOf<String?>(null)
    }

    var selectedSiteCode by remember {
        mutableStateOf<String?>(null)
    }

    var showList by remember {
        mutableStateOf(false)
    }

    var showBatchSummary by remember {
        mutableStateOf(false)
    }

    var showPendingBatches by remember {
        mutableStateOf(false)
    }

    var showCompensation by remember {
        mutableStateOf(false)
    }

    var locationRecords by remember { mutableStateOf<List<ImageWorkLocationRecord>>(emptyList()) }
    var locationScanMessage by remember { mutableStateOf("กำลังตรวจสิทธิ์สแกนไฟล์ InsUploadPic...") }
    var locationScanNonce by remember { mutableStateOf(0) }
    var hasFileAccess by remember { mutableStateOf(activity.hasAllFilesAccess()) }
    var locationPermissionGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }
    var locationServiceEnabled by remember {
        mutableStateOf(
            isLocationServiceEnabledCompat(activity)
        )
    }

    val allFilesAccessLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        hasFileAccess = activity.hasAllFilesAccess()
        if (hasFileAccess) {
            locationScanNonce++
        } else {
            locationScanMessage = "ยังไม่ได้อนุญาตเข้าถึงไฟล์ทั้งหมด จึงยังสแกน InsUploadPic อัตโนมัติไม่ได้"
        }
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) {
        locationPermissionGranted =
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    val locationSettingsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        locationServiceEnabled =
            isLocationServiceEnabledCompat(activity)
    }

    LaunchedEffect(Unit) {
        ensureHealthNotificationChannel(activity)
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun requestAllFilesAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:${activity.packageName}")
            )
            allFilesAccessLauncher.launch(intent)
        } else {
            hasFileAccess = true
            locationScanNonce++
        }
    }

    val permissionLauncher =
        rememberLauncherForActivityResult(
            contract =
                ActivityResultContracts.RequestPermission()
        ) { granted ->

            permissionGranted = granted

            if (granted) {
                scanInProgress = true
                scanError = null
                try {
                    images = activity.scanInsxImages()
                    selectedDate = images.firstOrNull()?.rawDate
                } catch (e: Exception) {
                    scanError = e.message ?: "ไม่สามารถสแกนรูปได้"
                } finally {
                    scanInProgress = false
                }
            }
        }

    LaunchedEffect(Unit) {

        val permission =
            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.TIRAMISU
            ) {
                Manifest.permission.READ_MEDIA_IMAGES
            } else {
                Manifest.permission.READ_EXTERNAL_STORAGE
            }

        permissionGranted =
            ContextCompat.checkSelfPermission(
                activity,
                permission
            ) == PackageManager.PERMISSION_GRANTED

        if (permissionGranted) {
            scanInProgress = true
            scanError = null
            try {
                images = activity.scanInsxImages()

                if (selectedDate == null) {
                    selectedDate = images.firstOrNull()?.rawDate
                }
            } catch (e: Exception) {
                scanError = e.message ?: "ไม่สามารถสแกนรูปได้"
            } finally {
                scanInProgress = false
            }
        }
    }

    LaunchedEffect(hasFileAccess, locationScanNonce) {
        if (hasFileAccess) {
            locationScanMessage = "กำลังสแกนรูปและไฟล์ InsUploadPic อัตโนมัติ..."
            locationRecords = withContext(Dispatchers.IO) {
                activity.scanInsUploadPicFilesAuto()
            }
            locationScanMessage = if (locationRecords.isEmpty()) {
                "สแกนอัตโนมัติแล้ว • ไม่พบ InsUploadPic หรือไม่พบพิกัดที่อ่านได้"
            } else {
                "สแกนอัตโนมัติสำเร็จ • พบข้อมูลพิกัด ${locationRecords.size} รายการ"
            }
        } else {
            locationRecords = emptyList()
            locationScanMessage = "ระบบใช้ Device GPS / LIVE_CAPTURE อัตโนมัติ"
        }
    }

    val selectedImages =
        if (selectedDate == null) {

            emptyList()

        } else {

            images.filter {
                it.rawDate == selectedDate
            }
        }

    val selectedImageStems = selectedImages.map { it.name.substringBeforeLast('.').lowercase() }.toSet()
    val selectedLocationRecords = locationRecords.filter {
        it.rawDate == selectedDate && it.photoStem.lowercase() in selectedImageStems
    }

    val imageHealth = evaluateImageHealth(
        permissionGranted = permissionGranted,
        hasFileAccess = hasFileAccess,
        locationPermissionGranted = locationPermissionGranted,
        locationServiceEnabled = locationServiceEnabled,
        scanInProgress = scanInProgress,
        scanError = scanError
    )

    // เตือนทันทีเฉพาะตอนเปลี่ยนจากสถานะปกติ (เขียว) -> ผิดปกติ (แดง)
    LaunchedEffect(imageHealth.status) {
        val oldStatus = previousHealthStatus
        if (
            oldStatus == ImageHealthStatus.GREEN &&
            imageHealth.status == ImageHealthStatus.RED
        ) {
            sendImageHealthAlert(activity, imageHealth.message)
        }
        previousHealthStatus = imageHealth.status
    }

    // ตรวจสิทธิ์ซ้ำเป็นระยะ เพื่อจับกรณีผู้ใช้ปิด permission ระหว่างทำงาน
    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            val mediaPermission =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    Manifest.permission.READ_MEDIA_IMAGES
                } else {
                    Manifest.permission.READ_EXTERNAL_STORAGE
                }

            permissionGranted =
                ContextCompat.checkSelfPermission(
                    activity,
                    mediaPermission
                ) == PackageManager.PERMISSION_GRANTED

            hasFileAccess = activity.hasAllFilesAccess()

            locationPermissionGranted =
                ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                        ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

            locationServiceEnabled =
                isLocationServiceEnabledCompat(activity)
        }
    }

    if (showCompensation) {

        val compensationSessionToken = remember {
            activity
                .getSharedPreferences("divergent_login", Context.MODE_PRIVATE)
                .getString("session_token", "")
                .orEmpty()
        }

        CompensationScreen(
            sessionToken = compensationSessionToken,
            onBack = { showCompensation = false }
        )

    } else if (showPendingBatches) {

        PendingBatchesScreen(
            onBack = { showPendingBatches = false }
        )

    } else if (showBatchSummary) {

        BatchSummaryScreen(
            selectedDate = selectedDate,
            selectedSiteCode = selectedSiteCode,
            images = selectedImages,
            locationRecords = selectedLocationRecords,
            onBack = { showBatchSummary = false }
        )

    } else if (showList) {

        ImageListScreen(
            images = selectedImages,
            onBack = {
                showList = false
            }
        )

    } else {

        HomeScreen(
            permissionGranted =
                permissionGranted,

            allImages =
                images,

            selectedDate =
                selectedDate,

            selectedImages =
                selectedImages,

            selectedSiteCode =
                selectedSiteCode,

            hasFileAccess = hasFileAccess,
            locationRecordCount = locationRecords.size,
            selectedLocationCount = selectedLocationRecords.size,
            locationScanMessage = locationScanMessage,
            imageHealth = imageHealth,
            showHealthHelp = showHealthHelp,
            onShowHealthHelp = { showHealthHelp = true },
            onDismissHealthHelp = { showHealthHelp = false },
            onFixHealthIssue = {
                when (imageHealth.issue) {
                    ImageHealthIssue.IMAGE_PERMISSION -> {
                        val mediaPermission =
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                Manifest.permission.READ_MEDIA_IMAGES
                            } else {
                                Manifest.permission.READ_EXTERNAL_STORAGE
                            }
                        permissionLauncher.launch(mediaPermission)
                    }

                    ImageHealthIssue.FILE_ACCESS -> Unit

                    ImageHealthIssue.LOCATION_PERMISSION -> {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }

                    ImageHealthIssue.LOCATION_SERVICE -> {
                        locationSettingsLauncher.launch(
                            Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                        )
                    }

                    ImageHealthIssue.SCAN_ERROR -> {
                        scanInProgress = true
                        scanError = null
                        try {
                            images = activity.scanInsxImages()
                            locationScanNonce++
                        } catch (e: Exception) {
                            scanError = e.message ?: "ไม่สามารถสแกนรูปได้"
                        } finally {
                            scanInProgress = false
                        }
                    }

                    ImageHealthIssue.NONE -> Unit
                }
            },
            onRequestFileAccess = { requestAllFilesAccess() },

            onSiteSelected = {
                selectedSiteCode = it
            },

            onDateSelected = {
                selectedDate = it
            },

            onRequestPermission = {

                val permission =
                    if (
                        Build.VERSION.SDK_INT >=
                        Build.VERSION_CODES.TIRAMISU
                    ) {
                        Manifest.permission.READ_MEDIA_IMAGES
                    } else {
                        Manifest.permission.READ_EXTERNAL_STORAGE
                    }

                permissionLauncher.launch(
                    permission
                )
            },

            onScanAgain = {

                images =
                    activity.scanInsxImages()

                locationScanNonce++

                if (
                    selectedDate == null ||
                    images.none {
                        it.rawDate == selectedDate
                    }
                ) {

                    selectedDate =
                        images.firstOrNull()?.rawDate
                }
            },

            onOpenList = {
                showList = true
            },

            onPrepareBatch = {
                showBatchSummary = true
            },

            onOpenPendingBatches = {
                showPendingBatches = true
            },

            onOpenCompensation = {
                showCompensation = true
            },

            onBackToMainMenu = onBackToMainMenu
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    permissionGranted: Boolean,
    allImages: List<InsxImage>,
    selectedDate: String?,
    selectedImages: List<InsxImage>,
    selectedSiteCode: String?,
    hasFileAccess: Boolean,
    locationRecordCount: Int,
    selectedLocationCount: Int,
    locationScanMessage: String,
    imageHealth: ImageHealthResult,
    showHealthHelp: Boolean,
    onShowHealthHelp: () -> Unit,
    onDismissHealthHelp: () -> Unit,
    onFixHealthIssue: () -> Unit,
    onRequestFileAccess: () -> Unit,
    onSiteSelected: (String) -> Unit,
    onDateSelected: (String) -> Unit,
    onRequestPermission: () -> Unit,
    onScanAgain: () -> Unit,
    onOpenList: () -> Unit,
    onPrepareBatch: () -> Unit,
    onOpenPendingBatches: () -> Unit,
    onOpenCompensation: () -> Unit,
    onBackToMainMenu: () -> Unit
) {

    var showDatePicker by remember {
        mutableStateOf(false)
    }

    var showSiteMenu by remember {
        mutableStateOf(false)
    }

    val selectedSite =
        WORK_SITES.firstOrNull { it.code == selectedSiteCode }

    val displayDate =
        if (selectedDate != null) {

            allImages
                .firstOrNull {
                    it.rawDate == selectedDate
                }
                ?.date
                ?: formatRawDate(selectedDate)

        } else {

            "เลือกวันที่"
        }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFF7F4FC),
                        Color(0xFFF1EBFB)
                    )
                )
            )
    ) {

        DivergentTopBar(
            title = "Image Rescue",
            onBack = onBackToMainMenu
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {

            DivergentBrandHeader(
                title = "Image Rescue",
                subtitle = "ระบบส่งงานและตรวจสอบสถานะแบบเรียลไทม์"
            )

            Spacer(modifier = Modifier.height(14.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(22.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                colors = CardDefaults.cardColors(
                    containerColor = when (imageHealth.status) {
                        ImageHealthStatus.GREEN -> Color(0xFFE8F5E9)
                        ImageHealthStatus.YELLOW -> Color(0xFFFFF8E1)
                        ImageHealthStatus.RED -> Color(0xFFFFEBEE)
                    }
                )
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = when (imageHealth.status) {
                            ImageHealthStatus.GREEN -> "🟢 ระบบปกติ"
                            ImageHealthStatus.YELLOW -> "🟡 กำลังตรวจสอบ"
                            ImageHealthStatus.RED -> "🔴 ต้องตรวจสอบก่อน"
                        },
                        fontWeight = FontWeight.Bold,
                        color = when (imageHealth.status) {
                            ImageHealthStatus.GREEN -> Color(0xFF2E7D32)
                            ImageHealthStatus.YELLOW -> Color(0xFFF57F17)
                            ImageHealthStatus.RED -> Color(0xFFC62828)
                        }
                    )

                    Spacer(Modifier.height(4.dp))
                    Text(imageHealth.message)
                    Text(
                        imageHealth.actionHint,
                        style = MaterialTheme.typography.bodySmall
                    )

                    if (imageHealth.status == ImageHealthStatus.RED) {
                        Spacer(Modifier.height(10.dp))
                        Button(
                            onClick = onFixHealthIssue,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                when (imageHealth.issue) {
                                    ImageHealthIssue.IMAGE_PERMISSION -> "เปิดสิทธิ์รูปภาพ"
                                    ImageHealthIssue.FILE_ACCESS -> "ไม่ต้องเปิดสิทธิ์ไฟล์ทั้งหมด"
                                    ImageHealthIssue.LOCATION_PERMISSION -> "เปิดสิทธิ์ตำแหน่ง"
                                    ImageHealthIssue.LOCATION_SERVICE -> "เปิด GPS / ตำแหน่ง"
                                    ImageHealthIssue.SCAN_ERROR -> "สแกนใหม่"
                                    ImageHealthIssue.NONE -> "แก้ไขตอนนี้"
                                }
                            )
                        }

                        TextButton(
                            onClick = onShowHealthHelp,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("ดูรายละเอียดปัญหา")
                        }
                    }
                }
            }

            Spacer(
                modifier = Modifier.height(24.dp)
            )

            if (!permissionGranted) {

                Text(
                    text =
                        "ยังไม่ได้รับอนุญาตให้เข้าถึงรูปภาพ"
                )

                Spacer(
                    modifier = Modifier.height(16.dp)
                )

                Button(
                    onClick = onRequestPermission
                ) {
                    Text(
                        "อนุญาตเข้าถึงรูปภาพ"
                    )
                }

            } else {

                Text(
                    text = "Site งาน"
                )

                Spacer(
                    modifier = Modifier.height(8.dp)
                )

                Box {

                    Button(
                        onClick = {
                            showSiteMenu = true
                        }
                    ) {
                        Text(
                            selectedSite?.name ?: "เลือก Site งาน"
                        )
                    }

                    DropdownMenu(
                        expanded = showSiteMenu,
                        onDismissRequest = {
                            showSiteMenu = false
                        }
                    ) {
                        WORK_SITES.forEach { site ->
                            DropdownMenuItem(
                                text = {
                                    Text(site.name)
                                },
                                onClick = {
                                    onSiteSelected(site.code)
                                    showSiteMenu = false
                                }
                            )
                        }
                    }
                }

                Spacer(
                    modifier = Modifier.height(20.dp)
                )

                Text(
                    text = "วันที่ทำงาน"
                )

                Spacer(
                    modifier = Modifier.height(8.dp)
                )

                Button(
                    onClick = {
                        showDatePicker = true
                    }
                ) {
                    Text(
                        "$displayDate  📅"
                    )
                }

                Spacer(
                    modifier = Modifier.height(24.dp)
                )

                Text(
                    text =
                        "พบรูปสำหรับวันที่นี้"
                )

                Spacer(
                    modifier = Modifier.height(8.dp)
                )

                Text(
                    text =
                        "${selectedImages.size} รูป",
                    style =
                        MaterialTheme.typography.headlineLarge
                )

                Spacer(modifier = Modifier.height(16.dp))

                DivergentSectionCard {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("พิกัดงานรูป (InsUploadPic) • Auto Scan", style = MaterialTheme.typography.titleSmall)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(locationScanMessage, style = MaterialTheme.typography.bodySmall)
                        if (hasFileAccess) {
                            Text("พิกัดทั้งหมด: $locationRecordCount • ตรงกับรูปวันที่นี้: $selectedLocationCount")
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("กด “สแกนใหม่” ครั้งเดียว ระบบจะสแกนทั้งรูป INSx และ InsUploadPic*.txt", style = MaterialTheme.typography.bodySmall)
                        } else {
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedButton(onClick = onRequestFileAccess) {
                                Text("อนุญาตเข้าถึงไฟล์งาน 1 ครั้ง")
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = onOpenList,
                    enabled =
                        selectedImages.isNotEmpty()
                ) {
                    Text(
                        "ดูรายการรูป"
                    )
                }

                Spacer(
                    modifier = Modifier.height(12.dp)
                )

                Button(
                    onClick = onPrepareBatch,
                    enabled = selectedImages.isNotEmpty() && selectedSiteCode != null
                ) {
                    Text("เตรียมส่งตรวจสอบ")
                }

                Spacer(modifier = Modifier.height(12.dp))

                DivergentPrimaryButton(
                    text = "ตรวจสอบค่าตอบแทน",
                    onClick = onOpenCompensation,
                    enabled = selectedDate != null,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedButton(
                    onClick = onOpenPendingBatches
                ) {
                    Text("งานรอส่ง")
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedButton(
                    onClick = onScanAgain
                ) {
                    Text(
                        "สแกนใหม่"
                    )
                }
            }
        }

        if (showHealthHelp) {
            AlertDialog(
                onDismissRequest = onDismissHealthHelp,
                title = { Text("ตรวจสอบระบบนับรูป") },
                text = {
                    Column {
                        Text(imageHealth.message)
                        Spacer(Modifier.height(8.dp))
                        Text(imageHealth.actionHint)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "กด “แก้ไขตอนนี้” ระบบจะเปิดหน้าที่เกี่ยวข้องให้โดยตรง ไม่ต้องเข้า Settings ไปค้นหาเอง"
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            onDismissHealthHelp()
                            onFixHealthIssue()
                        }
                    ) {
                        Text("แก้ไขตอนนี้")
                    }
                },
                dismissButton = {
                    TextButton(onClick = onDismissHealthHelp) {
                        Text("ปิด")
                    }
                }
            )
        }

        if (showDatePicker) {

            DatePickerPopup(
                selectedDate = selectedDate,
                onDismiss = {
                    showDatePicker = false
                },
                onDateSelected = { rawDate ->

                    onDateSelected(rawDate)

                    showDatePicker = false
                }
            )
        }
    }
}



@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DivergentProfileScreen(
    username: String,
    sessionToken: String,
    onBack: () -> Unit,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var profile by remember { mutableStateOf<EmployeeProfileData?>(null) }
    var nationalId by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var changingNationalId by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            loading = true
            val root = compensationApi(sessionToken, JSONObject().apply { put("action", "profile") })
            profile = parseEmployeeProfile(root)
            loading = false
        }
    }

    LaunchedEffect(sessionToken) { reload() }

    Scaffold(topBar = { DivergentTopBar("โปรไฟล์พนักงาน", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().background(DivergentSurface)
                .padding(pad).verticalScroll(rememberScrollState()).padding(18.dp)
        ) {
            DivergentBrandHeader("ข้อมูลพนักงาน", "เชื่อมกับฐานค่าตอบแทนของบริษัท")
            Spacer(Modifier.height(18.dp))

            if (loading) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            } else if (profile == null) {
                DivergentSectionCard {
                    Column(Modifier.padding(18.dp)) {
                        Text("ยืนยันตัวตนพนักงาน", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text("ต้องกรอกเลขบัตรประชาชน 13 หลักก่อนใช้งานระบบค่าตอบแทน", color = DivergentDanger)
                        Spacer(Modifier.height(16.dp))
                        OutlinedTextField(
                            value = nationalId,
                            onValueChange = { nationalId = it.filter(Char::isDigit).take(13); message = "" },
                            label = { Text("เลขบัตรประชาชน 13 หลัก *") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (nationalId.length == 13 && !isValidThaiNationalId(nationalId)) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "เลขบัตรประชาชน 13 หลักนี้ไม่ผ่านการตรวจสอบ กรุณาตรวจตัวเลขอีกครั้ง",
                                color = DivergentDanger
                            )
                        }

                        if (message.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text(message, color = DivergentDanger)
                        }
                        Spacer(Modifier.height(14.dp))
                        DivergentPrimaryButton(
                            text = "ตรวจสอบและเชื่อมข้อมูล",
                            enabled = nationalId.length == 13 && isValidThaiNationalId(nationalId),
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                if (!isValidThaiNationalId(nationalId)) {
                                    message = "เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบตัวเลข 13 หลักอีกครั้ง"
                                    return@DivergentPrimaryButton
                                }

                                scope.launch {
                                    loading = true
                                    val root = compensationApi(
                                        sessionToken,
                                        JSONObject().apply {
                                            put("action", "bind_profile")
                                            put("national_id", nationalId)
                                        }
                                    )

                                    profile = parseEmployeeProfile(root)

                                    message = if (profile != null) {
                                        ""
                                    } else {
                                        nationalIdErrorMessage(
                                            root?.optString("error").orEmpty()
                                        )
                                    }

                                    loading = false
                                }
                            }
                        )
                    }
                }
            } else {
                val p = profile!!
                DivergentSectionCard {
                    Column(Modifier.padding(18.dp)) {
                        Text(p.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("Username: $username", color = DivergentMuted)
                        Text("เลขบัตรประชาชน: •••••••••${p.nationalIdLast4}", color = DivergentMuted)
                        Spacer(Modifier.height(14.dp))
                        Text("อัตราค่าตอบแทนจากระบบ", fontWeight = FontWeight.SemiBold)
                        p.rates.forEach { r ->
                            val suffix = if (r.rateType == "per_unit") "บาท/ราย" else "บาท"
                            Text("• ${r.siteName}: ${String.format("%,.2f", r.rate)} $suffix")
                        }

                        Spacer(Modifier.height(16.dp))
                        OutlinedButton(
                            onClick = {
                                changingNationalId = !changingNationalId
                                nationalId = ""
                                message = ""
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text(if (changingNationalId) "ยกเลิกเปลี่ยนเลขบัตรประชาชน" else "เปลี่ยนเลขบัตรประชาชน")
                        }

                        if (changingNationalId) {
                            Spacer(Modifier.height(14.dp))
                            Text(
                                "กรอกเลขบัตรประชาชนใหม่ 13 หลัก ระบบจะตรวจสอบชื่อพนักงานจากฐานข้อมูลก่อนเปลี่ยน",
                                color = DivergentMuted,
                                fontSize = 13.sp
                            )
                            Spacer(Modifier.height(10.dp))
                            OutlinedTextField(
                                value = nationalId,
                                onValueChange = {
                                    nationalId = it.filter(Char::isDigit).take(13)
                                    message = ""
                                },
                                label = { Text("เลขบัตรประชาชนใหม่ 13 หลัก *") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )

                            if (nationalId.length == 13 && !isValidThaiNationalId(nationalId)) {
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "เลขบัตรประชาชนไม่ผ่านการตรวจสอบ กรุณาตรวจตัวเลขอีกครั้ง",
                                    color = DivergentDanger,
                                    fontSize = 13.sp
                                )
                            }

                            if (message.isNotBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    message,
                                    color = if (message.contains("สำเร็จ")) DivergentSuccess else DivergentDanger
                                )
                            }

                            Spacer(Modifier.height(12.dp))
                            DivergentPrimaryButton(
                                text = "ยืนยันเปลี่ยนเลขบัตรประชาชน",
                                enabled = nationalId.length == 13 && isValidThaiNationalId(nationalId),
                                modifier = Modifier.fillMaxWidth(),
                                onClick = {
                                    scope.launch {
                                        loading = true
                                        val root = compensationApi(
                                            sessionToken,
                                            JSONObject().apply {
                                                put("action", "change_profile")
                                                put("national_id", nationalId)
                                            }
                                        )
                                        val changed = parseEmployeeProfile(root)
                                        if (changed != null) {
                                            profile = changed
                                            changingNationalId = false
                                            nationalId = ""
                                            message = ""
                                        } else {
                                            message = nationalIdErrorMessage(root?.optString("error").orEmpty())
                                        }
                                        loading = false
                                    }
                                }
                            )
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
                DivergentPrimaryButton("ไปหน้าหลัก", onClick = onBack, modifier = Modifier.fillMaxWidth())
            }

            Spacer(Modifier.height(16.dp))
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("ออกจากระบบ") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompensationScreen(
    sessionToken: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var profile by remember { mutableStateOf<EmployeeProfileData?>(null) }
    var summary by remember { mutableStateOf<CompensationSummaryData?>(null) }
    var advanceText by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var lastRequest by remember { mutableStateOf<AdvanceRequestData?>(null) }

    fun reload() {
        scope.launch {
            loading = true
            val root = compensationApi(sessionToken, JSONObject().apply { put("action", "summary") })
            profile = parseEmployeeProfile(root)
            summary = parseSummary(root)
            loading = false
        }
    }
    LaunchedEffect(sessionToken) { reload() }

    Scaffold(topBar = { DivergentTopBar("ตรวจสอบค่าตอบแทน", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().background(DivergentSurface)
                .padding(pad).verticalScroll(rememberScrollState()).padding(18.dp)
        ) {
            DivergentBrandHeader("ค่าตอบแทน ณ ปัจจุบัน", profile?.name ?: "กำลังดึงข้อมูลจาก Server")
            Spacer(Modifier.height(16.dp))

            if (loading) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            } else if (profile == null || summary == null) {
                Text("ยังไม่ได้เชื่อมโปรไฟล์พนักงาน กรุณาไปที่เมนูโปรไฟล์ก่อน", color = DivergentDanger)
            } else {
                val s1 = summary!!
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DashboardMetricCard("จำนวนราย", s1.workCount.toString(), "ราย", "▣", Color(0xFFE0F8EC), Color(0xFF118B55), Modifier.weight(1f))
                    DashboardMetricCard("รายได้รวม", String.format("%,.2f", s1.gross), "บาท", "฿", Color(0xFFFFF0D9), Color(0xFFF57C00), Modifier.weight(1f))
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DashboardMetricCard("ภาษี 3%", String.format("%,.2f", s1.tax), "บาท", "%", Color(0xFFE7F3FF), Color(0xFF1976D2), Modifier.weight(1f))
                    DashboardMetricCard("ยอดสุทธิ", String.format("%,.2f", s1.net), "บาท", "✓", Color(0xFFE8F5E9), DivergentSuccess, Modifier.weight(1f))
                }

                Spacer(Modifier.height(16.dp))
                DivergentSectionCard {
                    Column(Modifier.padding(18.dp)) {
                        Text("ขอเบิกเงินล่วงหน้า", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("เบิกได้สูงสุด ${String.format("%,.2f", s1.availableAdvance)} บาท", color = DivergentSuccess)
                        if (s1.reservedAdvance > 0) {
                        }
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = advanceText,
                            onValueChange = { v ->
                                val c=v.filter { it.isDigit() || it=='.' }
                                if (c.count { it=='.' }<=1) advanceText=c
                            },
                            label = { Text("จำนวนเงินที่ต้องการเบิก") },
                            suffix = { Text("บาท") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = note,
                            onValueChange = { note = it.take(300) },
                            label = { Text("หมายเหตุ (ถ้ามี)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (message.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text(message, color = if (lastRequest != null) DivergentSuccess else DivergentDanger)
                        }
                        Spacer(Modifier.height(12.dp))
                        val amount = advanceText.toDoubleOrNull() ?: 0.0
                        DivergentPrimaryButton(
                            text = "ส่งคำขอเบิก",
                            enabled = amount > 0 && amount <= s1.availableAdvance,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                scope.launch {
                                    val root = compensationApi(
                                        sessionToken,
                                        JSONObject().apply {
                                            put("action", "advance_request")
                                            put("amount", amount)
                                            put("note", note)
                                        }
                                    )
                                    val r = root?.optJSONObject("request")
                                    if (r != null) {
                                        lastRequest = AdvanceRequestData(
                                            r.optString("request_code"),
                                            r.optDouble("requested_amount"),
                                            r.optString("status")
                                        )
                                        message = "บันทึกคำขอในระบบแล้ว ✓"
                                        reload()
                                    } else {
                                        lastRequest = null
                                        message = "ส่งคำขอไม่สำเร็จ กรุณาตรวจสอบยอดที่เบิกได้"
                                    }
                                }
                            }
                        )

                        lastRequest?.let { req ->
                            Spacer(Modifier.height(10.dp))
                            Button(
                                onClick = {
                                    val text = buildString {
                                        appendLine("ขอเบิกเงินล่วงหน้า")
                                        appendLine("พนักงาน: ${profile!!.name}")
                                        appendLine("จำนวนเงิน: ${String.format("%,.2f", req.amount)} บาท")
                                        appendLine("จำนวนงานปัจจุบัน: ${summary!!.workCount} ราย")
                                        appendLine("รายได้สุทธิ: ${String.format("%,.2f", summary!!.net)} บาท")
                                        appendLine("เลขคำขอ: ${req.requestCode}")
                                        append("กรุณาตรวจสอบและอนุมัติครับ/ค่ะ")
                                    }
                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, text)
                                    }
                                    context.startActivity(Intent.createChooser(intent, "แชร์คำขอไปยัง LINE หัวหน้างาน"))
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF06C755))
                            ) { Text("แชร์คำขอไปยัง LINE") }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LegacyCompensationScreen(
    selectedDate: String?,
    selectedSiteCode: String?,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences("compensation_settings", Context.MODE_PRIVATE)
    }

    // นับเฉพาะงานที่ส่งผ่านโปรแกรมและ Server ยืนยันแล้ว
    val completedBatches = remember(selectedDate, selectedSiteCode) {
        loadSavedBatches(context).filter { batch ->
            batch.status == "SERVER_BACKED_UP" &&
                    (selectedDate == null || batch.rawDate == selectedDate) &&
                    (selectedSiteCode == null || batch.siteCode == selectedSiteCode)
        }
    }

    val completedCa = remember(completedBatches) {
        completedBatches
            .flatMap { it.caValues }
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()
    }

    val workCount = completedCa.size
    val rateKey = "rate_${selectedSiteCode ?: "DEFAULT"}"
    var rateText by remember(selectedSiteCode) {
        mutableStateOf(
            prefs.getString(rateKey, "0") ?: "0"
        )
    }

    val rate = rateText.toDoubleOrNull() ?: 0.0
    val gross = workCount * rate
    val tax = gross * 0.03
    val net = gross - tax
    val siteName = WORK_SITES.firstOrNull { it.code == selectedSiteCode }?.name ?: "ทุก Site"

    Scaffold(
        topBar = {
            DivergentTopBar(
                title = "ตรวจสอบค่าตอบแทน",
                onBack = onBack
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF7F4FC))
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(18.dp)
        ) {
            Text(
                text = "ค่าตอบแทน ณ ปัจจุบัน",
                style = MaterialTheme.typography.headlineSmall
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = "วันที่ ${selectedDate?.let { formatRawDate(it) } ?: "-"}"
            )
            Text(
                text = siteName,
                style = MaterialTheme.typography.bodySmall
            )

            Spacer(Modifier.height(18.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardMetricCard(
                    "จำนวนราย", workCount.toString(), "ราย", "▣",
                    Color(0xFFE0F8EC), Color(0xFF118B55),
                    modifier = Modifier.weight(1f)
                )
                DashboardMetricCard(
                    "ค่าตอบแทนรวม", String.format("%,.2f", gross), "บาท", "฿",
                    Color(0xFFFFF0D9), Color(0xFFF57C00),
                    modifier = Modifier.weight(1f)
                )
                DashboardMetricCard(
                    "หักภาษี 3%", String.format("%,.2f", tax), "บาท", "%",
                    Color(0xFFE7F3FF), Color(0xFF1976D2),
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(18.dp))

            DivergentSectionCard {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "จำนวนรายที่ระบบนับได้",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "$workCount ราย",
                        style = MaterialTheme.typography.headlineLarge
                    )
                    Text(
                        text = "นับจาก CA ไม่ซ้ำของ Batch ที่ส่งสำเร็จและ Server ยืนยันแล้ว",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            OutlinedTextField(
                value = rateText,
                onValueChange = { value ->
                    val cleaned = value.filter { it.isDigit() || it == '.' }
                    if (cleaned.count { it == '.' } <= 1) {
                        rateText = cleaned
                        prefs.edit().putString(rateKey, cleaned).apply()
                    }
                },
                label = { Text("ค่าตอบแทนต่อราย") },
                suffix = { Text("บาท/ราย") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(Modifier.height(16.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(18.dp)) {
                    CompensationRow("ค่าตอบแทนรวม", gross)
                    Spacer(Modifier.height(10.dp))
                    CompensationRow("หักภาษี ณ ที่จ่าย (3%)", tax)
                    Text(
                        text = "ระบบคำนวณอัตโนมัติ • แก้ไขไม่ได้",
                        style = MaterialTheme.typography.bodySmall
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp))
                    Text(
                        text = "ยอดสุทธิ ณ ปัจจุบัน",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = String.format("%,.2f บาท", net),
                        style = MaterialTheme.typography.headlineLarge
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            Text(
                text = "หมายเหตุ: รุ่นเริ่มต้นนี้ยังไม่รวมเงินพิเศษ เงินเบิกล่วงหน้า หรือรายการหักอื่น",
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun CompensationRow(
    label: String,
    amount: Double
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label)
        Text(String.format("%,.2f บาท", amount))
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerPopup(
    selectedDate: String?,
    onDismiss: () -> Unit,
    onDateSelected: (String) -> Unit
) {

    /*
     * DatePicker ของ Android ใช้ปี ค.ศ.
     * แต่ชื่อไฟล์ INSx ใช้ปี พ.ศ.
     *
     * เช่น:
     *
     * 02/09/2026
     *       ↓
     * 02/09/2569
     *
     * rawDate:
     * 02092569
     */

    val initialMillis =
        selectedDate
            ?.let {
                rawDateToMillis(it)
            }

    val datePickerState =
        rememberDatePickerState(
            initialSelectedDateMillis =
                initialMillis
        )

    DatePickerDialog(
        onDismissRequest =
            onDismiss,

        confirmButton = {

            TextButton(
                onClick = {

                    val millis =
                        datePickerState
                            .selectedDateMillis

                    if (millis != null) {

                        val rawDate =
                            millisToInsxDate(
                                millis
                            )

                        onDateSelected(
                            rawDate
                        )
                    }
                }
            ) {
                Text("ตกลง")
            }
        },

        dismissButton = {

            TextButton(
                onClick =
                    onDismiss
            ) {
                Text("ยกเลิก")
            }
        }
    ) {

        DatePicker(
            state =
                datePickerState
        )
    }
}

fun millisToInsxDate(
    millis: Long
): String {

    val calendar =
        Calendar.getInstance(
            TimeZone.getTimeZone("UTC")
        )

    calendar.timeInMillis =
        millis

    val day =
        calendar.get(
            Calendar.DAY_OF_MONTH
        )

    val month =
        calendar.get(
            Calendar.MONTH
        ) + 1

    val yearAD =
        calendar.get(
            Calendar.YEAR
        )

    val yearBE =
        yearAD + 543

    return String.format(
        "%02d%02d%04d",
        day,
        month,
        yearBE
    )
}

fun rawDateToMillis(
    rawDate: String
): Long? {

    if (rawDate.length != 8) {
        return null
    }

    return try {

        val day =
            rawDate
                .substring(0, 2)
                .toInt()

        val month =
            rawDate
                .substring(2, 4)
                .toInt()

        val yearBE =
            rawDate
                .substring(4, 8)
                .toInt()

        val yearAD =
            yearBE - 543

        val calendar =
            Calendar.getInstance(
                TimeZone.getTimeZone("UTC")
            )

        calendar.clear()

        calendar.set(
            yearAD,
            month - 1,
            day,
            0,
            0,
            0
        )

        calendar.timeInMillis

    } catch (e: Exception) {

        null
    }
}

fun formatRawDate(
    rawDate: String
): String {

    if (rawDate.length != 8) {
        return rawDate
    }

    return try {

        "${rawDate.substring(0, 2)}/" +
                "${rawDate.substring(2, 4)}/" +
                rawDate.substring(4, 8)

    } catch (e: Exception) {

        rawDate
    }
}



private data class SimpleHttpResult(
    val code: Int,
    val body: String
)

private fun postJson(
    urlString: String,
    jsonBody: String
): SimpleHttpResult {
    val connection = (URL(urlString).openConnection() as HttpURLConnection)
    return try {
        connection.requestMethod = "POST"
        connection.connectTimeout = 20000
        connection.readTimeout = 30000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("apikey", SUPABASE_KEY)
        connection.setRequestProperty("Authorization", "Bearer ${SUPABASE_KEY}")

        connection.outputStream.use { out ->
            out.write(jsonBody.toByteArray(Charsets.UTF_8))
        }

        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        SimpleHttpResult(code, body)
    } finally {
        connection.disconnect()
    }
}


private fun postSessionJson(
    urlString: String,
    sessionToken: String,
    jsonBody: String
): SimpleHttpResult {
    val connection = (URL(urlString).openConnection() as HttpURLConnection)
    return try {
        connection.requestMethod = "POST"
        connection.connectTimeout = 20000
        connection.readTimeout = 30000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("apikey", SUPABASE_KEY)
        connection.setRequestProperty("Authorization", "Bearer $sessionToken")
        connection.outputStream.use { out ->
            out.write(jsonBody.toByteArray(Charsets.UTF_8))
        }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        SimpleHttpResult(code, body)
    } finally {
        connection.disconnect()
    }
}

private const val COMPENSATION_API_URL =
    "https://neauzvqroaszvqffahkv.supabase.co/functions/v1/compensation-api"

private data class EmployeeRate(
    val siteName: String,
    val rate: Double,
    val rateType: String
)

private data class EmployeeProfileData(
    val name: String,
    val nationalIdLast4: String,
    val rates: List<EmployeeRate>
)

private data class CompensationSummaryData(
    val workCount: Int,
    val gross: Double,
    val tax: Double,
    val net: Double,
    val reservedAdvance: Double,
    val availableAdvance: Double
)

private data class AdvanceRequestData(
    val requestCode: String,
    val amount: Double,
    val status: String
)


private fun isValidThaiNationalId(value: String): Boolean {
    val digits = value.filter(Char::isDigit)
    if (digits.length != 13) return false

    var sum = 0
    for (i in 0 until 12) {
        sum += (digits[i] - '0') * (13 - i)
    }
    val checkDigit = (11 - (sum % 11)) % 10
    return checkDigit == (digits[12] - '0')
}

private fun nationalIdErrorMessage(errorCode: String): String {
    return when (errorCode) {
        "INVALID_NATIONAL_ID" ->
            "เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบตัวเลข 13 หลักอีกครั้ง"
        "EMPLOYEE_NOT_FOUND" ->
            "ไม่พบเลขบัตรประชาชนนี้ในฐานข้อมูลค่าตอบแทน"
        "NATIONAL_ID_ALREADY_BOUND" ->
            "เลขบัตรประชาชนนี้ถูกเชื่อมกับบัญชีผู้ใช้อื่นแล้ว กรุณาติดต่อหัวหน้างาน"
        "USER_ALREADY_BOUND" ->
            "บัญชีผู้ใช้นี้เชื่อมกับข้อมูลพนักงานคนอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ"
        "SESSION_REQUIRED", "SESSION_INVALID" ->
            "Session หมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
        else ->
            "ตรวจสอบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
    }
}

private suspend fun compensationApi(
    sessionToken: String,
    payload: JSONObject
): JSONObject? = withContext(Dispatchers.IO) {
    try {
        val r = postSessionJson(COMPENSATION_API_URL, sessionToken, payload.toString())
        val body = r.body.trim()
        if (body.isBlank()) return@withContext null
        JSONObject(body)
    } catch (_: Exception) {
        null
    }
}

private suspend fun compensationProfileRequired(sessionToken: String): Boolean {
    val root = compensationApi(
        sessionToken,
        JSONObject().apply { put("action", "profile") }
    ) ?: return false
    return root.optBoolean("requires_national_id", false) ||
            root.isNull("profile")
}

private fun parseEmployeeProfile(root: JSONObject?): EmployeeProfileData? {
    val p = root?.optJSONObject("profile") ?: return null
    val ratesJson = p.optJSONArray("rates") ?: JSONArray()
    val rates = buildList {
        for (i in 0 until ratesJson.length()) {
            val r = ratesJson.optJSONObject(i) ?: continue
            add(
                EmployeeRate(
                    siteName = r.optString("site_name"),
                    rate = r.optDouble("rate_amount", 0.0),
                    rateType = r.optString("rate_type")
                )
            )
        }
    }
    return EmployeeProfileData(
        name = p.optString("employee_name"),
        nationalIdLast4 = p.optString("national_id_last4"),
        rates = rates
    )
}

private fun parseSummary(root: JSONObject?): CompensationSummaryData? {
    val s = root?.optJSONObject("summary") ?: return null
    return CompensationSummaryData(
        workCount = s.optInt("work_count", 0),
        gross = s.optDouble("gross", 0.0),
        tax = s.optDouble("tax", 0.0),
        net = s.optDouble("net", 0.0),
        reservedAdvance = s.optDouble("reserved_advance", 0.0),
        availableAdvance = s.optDouble("available_advance", 0.0)
    )
}

private fun postBytes(
    urlString: String,
    bytes: ByteArray,
    contentType: String,
    upsert: Boolean = false
): SimpleHttpResult {
    val connection = (URL(urlString).openConnection() as HttpURLConnection)
    return try {
        connection.requestMethod = "POST"
        connection.connectTimeout = 20000
        connection.readTimeout = 60000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", contentType)
        connection.setRequestProperty("apikey", SUPABASE_KEY)
        connection.setRequestProperty("Authorization", "Bearer ${SUPABASE_KEY}")
        connection.setRequestProperty("x-upsert", upsert.toString())
        connection.setFixedLengthStreamingMode(bytes.size)

        connection.outputStream.use { out ->
            out.write(bytes)
        }

        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        SimpleHttpResult(code, body)
    } finally {
        connection.disconnect()
    }
}

private enum class UploadItemStatus {
    UPLOADED,
    SKIPPED,
    FAILED
}

private data class UploadItemResult(
    val status: UploadItemStatus,
    val path: String,
    val message: String = ""
)

private suspend fun uploadImageToBatch(
    context: Context,
    image: InsxImage,
    siteCode: String,
    rawDate: String,
    batchId: String
): UploadItemResult = withContext(Dispatchers.IO) {
    try {
        val uri = ContentUris.withAppendedId(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            image.id
        )

        val bytes = context.contentResolver
            .openInputStream(uri)
            ?.use { it.readBytes() }
            ?: return@withContext UploadItemResult(
                status = UploadItemStatus.FAILED,
                path = image.name,
                message = "ไม่สามารถเปิดไฟล์รูปได้"
            )

        if (bytes.isEmpty()) {
            return@withContext UploadItemResult(
                status = UploadItemStatus.FAILED,
                path = image.name,
                message = "ไฟล์รูปว่าง"
            )
        }

        // ตรวจชนิดไฟล์จากข้อมูลจริง ไม่เชื่อเฉพาะนามสกุลเดิม
        val mimeType = when {
            bytes.size >= 3 &&
                    bytes[0] == 0xFF.toByte() &&
                    bytes[1] == 0xD8.toByte() &&
                    bytes[2] == 0xFF.toByte() -> "image/jpeg"

            bytes.size >= 8 &&
                    bytes[0] == 0x89.toByte() &&
                    bytes[1] == 0x50.toByte() &&
                    bytes[2] == 0x4E.toByte() &&
                    bytes[3] == 0x47.toByte() -> "image/png"

            else -> context.contentResolver.getType(uri)
                ?: "application/octet-stream"
        }

        val baseName = image.name.substringBeforeLast(".")
        val finalExtension = when (mimeType) {
            "image/jpeg" -> "jpg"
            "image/png" -> "png"
            else -> image.name.substringAfterLast(".", "bin")
        }

        val finalFileName = "$baseName.$finalExtension"
        val objectPath = "$siteCode/$rawDate/$batchId/$finalFileName"
        val url = "${SUPABASE_URL}/storage/v1/object/insx-images/$objectPath"

        val response = postBytes(
            urlString = url,
            bytes = bytes,
            contentType = mimeType,
            upsert = false
        )
        val responseText = response.body

        if (response.code in 200..299) {
            UploadItemResult(
                status = UploadItemStatus.UPLOADED,
                path = objectPath
            )
        } else if (
            response.code == 409 ||
            responseText.contains("KeyAlreadyExists", ignoreCase = true) ||
            responseText.contains("already exists", ignoreCase = true)
        ) {
            UploadItemResult(
                status = UploadItemStatus.SKIPPED,
                path = objectPath,
                message = "มีไฟล์นี้อยู่แล้ว"
            )
        } else {
            UploadItemResult(
                status = UploadItemStatus.FAILED,
                path = objectPath,
                message = "HTTP ${response.code}: ${responseText.take(180)}"
            )
        }
    } catch (e: Exception) {
        UploadItemResult(
            status = UploadItemStatus.FAILED,
            path = image.name,
            message = e.message ?: "Unknown error"
        )
    }
}


private data class LocationImportSummary(
    val imported: Int,
    val matched: Int,
    val multiple: Int,
    val notFound: Int
)

private suspend fun uploadImageLocations(
    records: List<ImageWorkLocationRecord>,
    siteCode: String,
    batchId: String
): Result<LocationImportSummary> = withContext(Dispatchers.IO) {
    if (records.isEmpty()) return@withContext Result.success(LocationImportSummary(0, 0, 0, 0))

    try {
        val payload = JSONObject().apply {
            put("site_code", siteCode)
            put("batch_id", batchId)
            put("records", JSONArray().apply {
                records.forEach { record ->
                    put(JSONObject().apply {
                        put("ca_number", record.caNumber)
                        put("photo_name", record.photoName)
                        put("latitude", record.latitude)
                        put("longitude", record.longitude)
                        record.photoDateTime?.let { put("photo_datetime", it) }
                        record.eventDateTime?.let { put("event_datetime", it) }
                        put("source_file", record.sourceFile)
                        record.jobRef?.let { put("job_ref", it) }
                        record.cycleCode?.let { put("cycle_code", it) }
                        record.secondaryRef?.let { put("secondary_ref", it) }
                        record.subdistrict?.let { put("subdistrict", it) }
                        record.district?.let { put("district", it) }
                        record.province?.let { put("province", it) }
                        put("raw_parameter", record.rawParameter)
                    })
                }
            })
        }

        val response = postJson(
            "${SUPABASE_URL}/functions/v1/image-location-import",
            payload.toString()
        )
        val responseText = response.body
        if (response.code !in 200..299) {
            return@withContext Result.failure(
                IllegalStateException("LOCATION IMPORT HTTP ${response.code}: ${responseText.take(220)}")
            )
        }
        val summary = JSONObject(responseText).optJSONObject("summary") ?: JSONObject()
        Result.success(LocationImportSummary(
            imported = summary.optInt("imported", 0),
            matched = summary.optInt("matched", 0),
            multiple = summary.optInt("multiple", 0),
            notFound = summary.optInt("not_found", 0)
        ))
    } catch (e: Exception) {
        Result.failure(e)
    }
}

private data class LiveLocationLinkSummary(
    val total: Int,
    val linked: Int,
    val notFound: Int,
    val invalid: Int
)

private suspend fun linkLiveLocationsToBatch(
    images: List<InsxImage>,
    siteCode: String,
    rawDate: String,
    batchId: String
): Result<LiveLocationLinkSummary> = withContext(Dispatchers.IO) {
    if (images.isEmpty()) {
        return@withContext Result.success(
            LiveLocationLinkSummary(0, 0, 0, 0)
        )
    }

    try {
        val payload = JSONObject().apply {
            put("site_code", siteCode)
            put("raw_date", rawDate)
            put("batch_id", batchId)
            put("images", JSONArray().apply {
                images.forEach { image ->
                    put(JSONObject().apply {
                        put("ca", image.ca)
                        put("photo_name", image.name)
                    })
                }
            })
        }

        val response = postJson(
            "${SUPABASE_URL}/functions/v1/link-live-locations",
            payload.toString()
        )
        val responseText = response.body

        if (response.code !in 200..299) {
            return@withContext Result.failure(
                IllegalStateException(
                    "LIVE LOCATION LINK HTTP ${response.code}: ${responseText.take(220)}"
                )
            )
        }

        val root = JSONObject(responseText)
        val summary = root.optJSONObject("summary") ?: JSONObject()

        Result.success(
            LiveLocationLinkSummary(
                total = summary.optInt("total", images.size),
                linked = summary.optInt("linked", 0),
                notFound = summary.optInt("not_found", 0),
                invalid = summary.optInt("invalid", 0)
            )
        )
    } catch (e: Exception) {
        Result.failure(e)
    }
}


private data class BatchVerifyResult(
    val foundCount: Long,
    val expectedCount: Int,
    val isComplete: Boolean
)

private suspend fun registerBatchOnServer(
    context: Context,
    batchId: String,
    siteCode: String,
    siteName: String,
    rawDate: String,
    imageCount: Int,
    caCount: Int,
    status: String = "UPLOADED"
): Result<Unit> = withContext(Dispatchers.IO) {
    try {
        val url = "${SUPABASE_URL}/rest/v1/rpc/register_image_batch_v2"
        val sessionToken = context
            .getSharedPreferences("divergent_login", Context.MODE_PRIVATE)
            .getString("session_token", "")
            .orEmpty()
        if (sessionToken.isBlank()) {
            return@withContext Result.failure(IllegalStateException("ไม่พบ Session ผู้ใช้งาน"))
        }

        val json = JSONObject().apply {
            put("p_session_token", sessionToken)
            put("p_batch_id", batchId)
            put("p_site_code", siteCode)
            put("p_site_name", siteName)
            put("p_raw_date", rawDate)
            put("p_image_count", imageCount)
            put("p_ca_count", caCount)
            put("p_status", status)
        }

        val response = postJson(url, json.toString())
        val responseText = response.body

        if (response.code in 200..299) {
            Result.success(Unit)
        } else {
            Result.failure(
                IllegalStateException(
                    "BATCH REGISTER RPC HTTP ${response.code}: ${responseText.take(200)}"
                )
            )
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}

private suspend fun verifyBatchOnServer(
    siteCode: String,
    rawDate: String,
    batchId: String,
    expectedCount: Int
): Result<BatchVerifyResult> = withContext(Dispatchers.IO) {
    try {
        val url = "${SUPABASE_URL}/rest/v1/rpc/verify_insx_batch"

        val json = JSONObject().apply {
            put("p_site_code", siteCode)
            put("p_raw_date", rawDate)
            put("p_batch_id", batchId)
            put("p_expected_count", expectedCount)
        }

        val response = postJson(url, json.toString())
        val responseText = response.body

        if (response.code !in 200..299) {
            return@withContext Result.failure(
                IllegalStateException(
                    "VERIFY HTTP ${response.code}: ${responseText.take(200)}"
                )
            )
        }

        // Supabase RPC ที่ returns table จะตอบกลับเป็น JSON array
        val array = org.json.JSONArray(responseText)

        if (array.length() == 0) {
            return@withContext Result.failure(
                IllegalStateException("Server ไม่ส่งผลตรวจสอบกลับมา")
            )
        }

        val row = array.getJSONObject(0)

        Result.success(
            BatchVerifyResult(
                foundCount = row.optLong("found_count", -1L),
                expectedCount = row.optInt("expected_count", expectedCount),
                isComplete = row.optBoolean("is_complete", false)
            )
        )
    } catch (e: Exception) {
        Result.failure(e)
    }
}

@Composable
fun BatchSummaryScreen(
    selectedDate: String?,
    selectedSiteCode: String?,
    images: List<InsxImage>,
    locationRecords: List<ImageWorkLocationRecord>,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val selectedSite = WORK_SITES.firstOrNull { it.code == selectedSiteCode }
    var savedBatches by remember { mutableStateOf(loadSavedBatches(context)) }
    var saveMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()
    var uploadInProgress by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf(0) }
    var uploadTotal by remember { mutableStateOf(0) }
    var uploadSuccessCount by remember { mutableStateOf(0) }
    var uploadSkippedCount by remember { mutableStateOf(0) }
    var uploadFailedCount by remember { mutableStateOf(0) }
    var uploadMessage by remember { mutableStateOf<String?>(null) }
    var verifyMessage by remember { mutableStateOf<String?>(null) }
    var registryMessage by remember { mutableStateOf<String?>(null) }
    var locationUploadMessage by remember { mutableStateOf<String?>(null) }

    val existingBatch = savedBatches.firstOrNull {
        it.rawDate == selectedDate &&
                it.siteCode == selectedSiteCode &&
                it.imageIds.toSet() == images.map { image -> image.id }.toSet()
    }

    val batchId = remember(selectedDate, images, existingBatch?.batchId) {
        existingBatch?.batchId ?: run {
            val sitePart = selectedSiteCode ?: "NOSITE"
            val datePart = selectedDate ?: "00000000"
            val suffix = System.currentTimeMillis().toString().takeLast(6)
            "IR-$sitePart-$datePart-$suffix"
        }
    }

    val uniqueCaCount =
        images.map { it.ca }.filter { it.isNotBlank() }.distinct().size

    // Duplicate Diagnostic V1: ตรวจชื่อไฟล์ซ้ำในชุดที่เลือก โดยยังไม่เปลี่ยน logic การอัปโหลด
    val duplicateNameGroups = images
        .groupBy { it.name.lowercase() }
        .filterValues { it.size > 1 }

    val uniqueFileNameCount = images
        .map { it.name.lowercase() }
        .distinct()
        .size

    val duplicateExtraCount = duplicateNameGroups.values
        .sumOf { it.size - 1 }

    LaunchedEffect(
        existingBatch?.status,
        batchId,
        selectedSite?.code,
        selectedDate,
        images.size,
        uniqueCaCount
    ) {
        if (
            existingBatch?.status == "SERVER_BACKED_UP" &&
            selectedSite != null &&
            !selectedDate.isNullOrBlank() &&
            images.isNotEmpty()
        ) {
            registryMessage = "กำลังซิงก์ทะเบียน Batch..."

            val result = registerBatchOnServer(
                context = context,
                batchId = batchId,
                siteCode = selectedSite.code,
                siteName = selectedSite.name,
                rawDate = selectedDate,
                imageCount = images.size,
                caCount = uniqueCaCount,
                status = "UPLOADED"
            )

            registryMessage = if (result.isSuccess) {
                "ทะเบียน Batch บน Server พร้อมแล้ว ✓"
            } else {
                "ซิงก์ทะเบียน Batch ไม่สำเร็จ: ${result.exceptionOrNull()?.message ?: "Unknown error"}"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFF7F4FC),
                        Color(0xFFF1EBFB)
                    )
                )
            )
    ) {
        DivergentTopBar(
            title = "สรุป Batch",
            onBack = onBack
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            Text(
                "สรุปชุดส่งตรวจสอบ",
                style = MaterialTheme.typography.headlineMedium
            )

            Spacer(modifier = Modifier.height(24.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("Batch ID", style = MaterialTheme.typography.labelLarge)
                    Text(batchId, style = MaterialTheme.typography.titleMedium)

                    Spacer(modifier = Modifier.height(18.dp))
                    Text("Site: ${selectedSite?.name ?: "ยังไม่ได้เลือก"}")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("วันที่ทำงาน: ${selectedDate?.let { formatRawDate(it) } ?: "-"}")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("จำนวนรูป: ${images.size} รูป")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("จำนวน CA: $uniqueCaCount")
                    Spacer(modifier = Modifier.height(8.dp))
                    if (locationRecords.size < images.size) {
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    Divider()
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("ตรวจชื่อไฟล์ (Duplicate Diagnostic V1)", style = MaterialTheme.typography.titleSmall)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("รูปที่พบ: ${images.size} รูป")
                    Text("ชื่อไฟล์ไม่ซ้ำ: $uniqueFileNameCount ชื่อ")
                    Text("รายการชื่อซ้ำส่วนเกิน: $duplicateExtraCount รูป")

                    if (duplicateNameGroups.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("⚠ พบชื่อไฟล์ซ้ำ ${duplicateNameGroups.size} ชื่อ")
                        duplicateNameGroups
                            .toList()
                            .sortedBy { it.first }
                            .forEach { (_, duplicateImages) ->
                                Text(
                                    "• ${duplicateImages.first().name} × ${duplicateImages.size}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                    } else {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("✓ ไม่พบชื่อไฟล์ซ้ำ")
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Divider()
                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        when {
                            images.isEmpty() -> "สถานะ: ไม่มีรูปสำหรับส่ง"
                            existingBatch?.status == "SERVER_BACKED_UP" ->
                                "สถานะ: สำรองบน Server แล้ว ✓"
                            existingBatch != null -> "สถานะ: บันทึกในเครื่องแล้ว • รอส่ง"
                            else -> "สถานะ: พร้อมบันทึกในเครื่อง"
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (existingBatch?.status != "SERVER_BACKED_UP") {
                Button(
                    onClick = {
                        val batch = SavedBatch(
                            batchId = batchId,
                            rawDate = selectedDate ?: "",
                            siteCode = selectedSite?.code ?: "",
                            siteName = selectedSite?.name ?: "",
                            imageIds = images.map { it.id },
                            imageNames = images.map { it.name },
                            caValues = images
                                .map { it.ca }
                                .filter { it.isNotBlank() }
                                .distinct(),
                            status = "WAITING"
                        )

                        if (saveBatchToDevice(context, batch)) {
                            savedBatches = loadSavedBatches(context)
                            saveMessage = "บันทึกชุดงานในมือถือแล้ว"
                        } else {
                            saveMessage = "บันทึกไม่สำเร็จ"
                        }
                    },
                    enabled = images.isNotEmpty() && selectedSite != null
                ) {
                    Text(if (existingBatch == null) "บันทึกไว้ในเครื่อง" else "บันทึกแล้ว")
                }

                if (saveMessage != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(saveMessage!!)
                }

                Spacer(modifier = Modifier.height(16.dp))
            }

            if (existingBatch?.status != "SERVER_BACKED_UP") {
                Button(
                    onClick = {
                        val siteCode = selectedSite?.code
                        val rawDate = selectedDate

                        if (images.isEmpty() || siteCode == null || rawDate.isNullOrBlank()) {
                            uploadMessage = "ข้อมูลสำหรับอัปโหลดยังไม่ครบ"
                            return@Button
                        }

                        // V6.9.2: ก่อนอัปโหลดต้องมี Batch ในเครื่องเสมอ
                        // ป้องกันกรณีกด "อัปโหลด" โดยยังไม่ได้กด "บันทึกไว้ในเครื่อง"
                        val localBatch = SavedBatch(
                            batchId = batchId,
                            rawDate = rawDate,
                            siteCode = siteCode,
                            siteName = selectedSite?.name.orEmpty(),
                            imageIds = images.map { it.id },
                            imageNames = images.map { it.name },
                            caValues = images.map { it.ca }.filter { it.isNotBlank() }.distinct(),
                            status = existingBatch?.status ?: "WAITING"
                        )

                        if (!saveBatchToDevice(context, localBatch)) {
                            uploadMessage = "บันทึก Batch ในมือถือไม่สำเร็จ จึงยังไม่เริ่มอัปโหลด"
                            return@Button
                        }
                        savedBatches = loadSavedBatches(context)

                        uploadInProgress = true
                        uploadProgress = 0
                        uploadTotal = images.size
                        uploadSuccessCount = 0
                        uploadSkippedCount = 0
                        uploadFailedCount = 0
                        uploadMessage = "กำลังเตรียมอัปโหลด..."
                        verifyMessage = null

                        scope.launch {
                            var success = 0
                            var skipped = 0
                            var failed = 0
                            val failedDetails = mutableListOf<String>()

                            images.forEachIndexed { index, image ->
                                uploadProgress = index + 1
                                uploadMessage =
                                    "กำลังอัปโหลด ${index + 1}/${images.size}\n${image.name}"

                                val result = uploadImageToBatch(
                                    context = context,
                                    image = image,
                                    siteCode = siteCode,
                                    rawDate = rawDate,
                                    batchId = batchId
                                )

                                when (result.status) {
                                    UploadItemStatus.UPLOADED -> success++
                                    UploadItemStatus.SKIPPED -> skipped++
                                    UploadItemStatus.FAILED -> {
                                        failed++
                                        if (failedDetails.size < 3) {
                                            failedDetails.add(
                                                "${image.name}: ${result.message}"
                                            )
                                        }
                                    }
                                }

                                uploadSuccessCount = success
                                uploadSkippedCount = skipped
                                uploadFailedCount = failed
                            }

                            uploadMessage = buildString {
                                append("อัปโหลด Batch เสร็จแล้ว\n")
                                append("สำเร็จ: $success รูป\n")
                                append("ข้าม: $skipped รูป\n")
                                append("ล้มเหลว: $failed รูป")

                                if (failedDetails.isNotEmpty()) {
                                    append("\n\nตัวอย่างข้อผิดพลาด:\n")
                                    append(failedDetails.joinToString("\n"))
                                }
                            }

                            // ยืนยันจากผลตอบกลับของ Storage ทีละไฟล์โดยตรง:
                            // 2xx = อัปโหลดสำเร็จ, 409/KeyAlreadyExists = ไฟล์มีอยู่บน Server แล้ว
                            // ทั้งสองกรณีถือว่า Server ยืนยันไฟล์นั้นแล้ว
                            val serverConfirmed = success + skipped
                            if (failed == 0 && serverConfirmed == images.size) {
                                val completedBatch = SavedBatch(
                                    batchId = batchId,
                                    rawDate = rawDate,
                                    siteCode = siteCode,
                                    siteName = selectedSite?.name.orEmpty(),
                                    imageIds = images.map { it.id },
                                    imageNames = images.map { it.name },
                                    caValues = images.map { it.ca }.filter { it.isNotBlank() }.distinct(),
                                    status = "SERVER_BACKED_UP"
                                )

                                val statusSaved = upsertBatchStatus(
                                    context = context,
                                    batch = completedBatch,
                                    newStatus = "SERVER_BACKED_UP"
                                )

                                if (statusSaved) {
                                    savedBatches = loadSavedBatches(context)

                                    val registerResult = registerBatchOnServer(
                                        context = context,
                                        batchId = batchId,
                                        siteCode = siteCode,
                                        siteName = selectedSite?.name.orEmpty(),
                                        rawDate = rawDate,
                                        imageCount = images.size,
                                        caCount = uniqueCaCount,
                                        status = "UPLOADED"
                                    )

                                    // V6.9.3-LF:
                                    // 1) ผูกพิกัด LIVE_CAPTURE ที่ถูกส่งขึ้นมาก่อนหน้าเข้ากับ Batch นี้ตาม CA + ชื่อรูป
                                    // 2) ถ้ามีพิกัดจาก InsUploadPic ในเครื่อง ก็ import ตามเดิม
                                    val liveLinkResult = linkLiveLocationsToBatch(
                                        images = images,
                                        siteCode = siteCode,
                                        rawDate = rawDate,
                                        batchId = batchId
                                    )

                                    val locationResult = uploadImageLocations(
                                        records = locationRecords,
                                        siteCode = siteCode,
                                        batchId = batchId
                                    )

                                    val liveText = liveLinkResult.fold(
                                        onSuccess = { summary ->
                                            "LIVE_CAPTURE ผูก Batch ${summary.linked}/${summary.total} รูป" +
                                                    if (summary.notFound > 0) " • ไม่พบ ${summary.notFound}" else ""
                                        },
                                        onFailure = { error ->
                                            "LIVE_CAPTURE ผูก Batch ไม่สำเร็จ: ${error.message ?: "Unknown error"}"
                                        }
                                    )

                                    val fileText = locationResult.fold(
                                        onSuccess = { summary ->
                                            if (summary.imported == 0) {
                                                "InsUploadPic: ไม่มีข้อมูลสำหรับชุดนี้"
                                            } else {
                                                "InsUploadPic: บันทึก ${summary.imported} รายการ ✓ • MATCHED ${summary.matched} • MULTIPLE ${summary.multiple} • NOT_FOUND ${summary.notFound}"
                                            }
                                        },
                                        onFailure = { error ->
                                            "InsUploadPic บันทึกไม่สำเร็จ: ${error.message ?: "Unknown error"}"
                                        }
                                    )

                                    locationUploadMessage = "$liveText\n$fileText"

                                    verifyMessage = if (registerResult.isSuccess) {
                                        "ตรวจ Server ผ่าน ✓\nพบ $serverConfirmed/${images.size} รูป\nสถานะ: สำรองบน Server แล้ว ✓\nบันทึกทะเบียน Batch แล้ว ✓"
                                    } else {
                                        "ตรวจ Server ผ่าน ✓\nพบ $serverConfirmed/${images.size} รูป\nสถานะ: สำรองบน Server แล้ว ✓\nแต่บันทึกทะเบียน Batch ไม่สำเร็จ: ${registerResult.exceptionOrNull()?.message ?: "Unknown error"}"
                                    }
                                } else {
                                    verifyMessage =
                                        "ตรวจ Server ผ่าน ✓\nพบ $serverConfirmed/${images.size} รูป\nแต่บันทึกสถานะในมือถือไม่สำเร็จ (V6.9.2)"
                                }
                            } else {
                                verifyMessage =
                                    "ตรวจ Server ยังไม่ผ่าน\nยืนยันได้ $serverConfirmed/${images.size} รูป\nล้มเหลว $failed รูป"
                            }

                            uploadInProgress = false
                        }
                    },
                    enabled = images.isNotEmpty() &&
                            selectedSite != null &&
                            !uploadInProgress
                ) {
                    Text(
                        if (uploadInProgress) {
                            "กำลังอัปโหลด $uploadProgress/$uploadTotal"
                        } else {
                            "อัปโหลดทั้ง Batch (${images.size} รูป)"
                        }
                    )
                }
            } else {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            "สำรองบน Server แล้ว ✓",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Batch นี้ส่งครบแล้ว ไม่ต้องอัปโหลดซ้ำ")
                        if (registryMessage != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(registryMessage!!)
                        }
                    }
                }
            }

            if (uploadInProgress) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "สำเร็จ $uploadSuccessCount • ข้าม $uploadSkippedCount • ล้มเหลว $uploadFailedCount"
                )
            }

            if (uploadMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(uploadMessage!!)
            }

            if (verifyMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(verifyMessage!!)
            }

            if (locationUploadMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(locationUploadMessage!!)
            }
        }
    }
}

@Composable
fun PendingBatchesScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val batches = remember { loadSavedBatches(context) }
    val waitingBatches = batches.filter { it.status != "SERVER_BACKED_UP" }
    val completedBatches = batches.filter { it.status == "SERVER_BACKED_UP" }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFF7F4FC),
                        Color(0xFFF1EBFB)
                    )
                )
            )
    ) {
        DivergentTopBar(
            title = "งานรอส่ง ${waitingBatches.size} ชุด",
            onBack = onBack
        )

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (waitingBatches.isEmpty()) {
                item {
                    Text("ไม่มีงานรอส่ง ✓")
                }
            } else {
                items(
                    items = waitingBatches,
                    key = { "waiting-${it.batchId}" }
                ) { batch ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                batch.batchId,
                                style = MaterialTheme.typography.titleMedium
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("Site: ${batch.siteName}")
                            Text("วันที่: ${formatRawDate(batch.rawDate)}")
                            Text("รูป: ${batch.imageIds.size} รูป")
                            Text("CA: ${batch.caValues.size}")
                            Text("สถานะ: รอส่ง")
                        }
                    }
                }
            }

            if (completedBatches.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "สำรองบน Server แล้ว ${completedBatches.size} ชุด",
                        style = MaterialTheme.typography.titleMedium
                    )
                }

                items(
                    items = completedBatches,
                    key = { "completed-${it.batchId}" }
                ) { batch ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                batch.batchId,
                                style = MaterialTheme.typography.titleMedium
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("Site: ${batch.siteName}")
                            Text("วันที่: ${formatRawDate(batch.rawDate)}")
                            Text("รูป: ${batch.imageIds.size} รูป")
                            Text("CA: ${batch.caValues.size}")
                            Text("สถานะ: สำรองบน Server แล้ว ✓")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ImageListScreen(
    images: List<InsxImage>,
    onBack: () -> Unit
) {

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFF7F4FC),
                        Color(0xFFF1EBFB)
                    )
                )
            )
    ) {

        DivergentTopBar(
            title = "รายการรูป ${images.size} รูป",
            onBack = onBack
        )

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(
            verticalArrangement =
                Arrangement.spacedBy(10.dp)
        ) {

            items(
                items = images,
                key = {
                    it.id
                }
            ) { image ->

                ImageItem(
                    image = image
                )
            }
        }
    }
}

@Composable
fun ImageItem(
    image: InsxImage
) {

    val context =
        LocalContext.current

    val bitmap by
    produceState<android.graphics.Bitmap?>(
        initialValue = null,
        key1 = image.id
    ) {

        value =
            withContext(
                Dispatchers.IO
            ) {

                try {

                    val uri =
                        ContentUris
                            .withAppendedId(
                                MediaStore
                                    .Images
                                    .Media
                                    .EXTERNAL_CONTENT_URI,
                                image.id
                            )

                    context
                        .contentResolver
                        .openInputStream(uri)
                        ?.use { stream ->

                            BitmapFactory
                                .decodeStream(
                                    stream
                                )
                        }

                } catch (
                    e: Exception
                ) {

                    null
                }
            }
    }

    Card(
        modifier =
            Modifier.fillMaxWidth()
    ) {

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
        ) {

            if (bitmap != null) {

                Image(
                    bitmap =
                        bitmap!!
                            .asImageBitmap(),

                    contentDescription =
                        image.name,

                    modifier =
                        Modifier.size(90.dp)
                )

            } else {

                Box(
                    modifier =
                        Modifier.size(90.dp),

                    contentAlignment =
                        Alignment.Center
                ) {

                    Text(
                        "ไม่มีรูป"
                    )
                }
            }

            Spacer(
                modifier =
                    Modifier.width(14.dp)
            )

            Column(
                modifier =
                    Modifier.weight(1f)
            ) {

                Text(
                    text =
                        "CA: ${image.ca}",

                    style =
                        MaterialTheme
                            .typography
                            .titleMedium
                )

                Spacer(
                    modifier =
                        Modifier.height(4.dp)
                )

                Text(
                    text =
                        "วันที่: ${image.date}"
                )

                Text(
                    text =
                        "เวลา: ${image.time}"
                )

                Spacer(
                    modifier =
                        Modifier.height(6.dp)
                )

                Text(
                    text =
                        image.name,

                    style =
                        MaterialTheme
                            .typography
                            .bodySmall
                )
            }
        }
    }
}
